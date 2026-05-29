from __future__ import annotations

import argparse
import base64
import csv
import hashlib
import io
import ipaddress
import json
import mimetypes
import os
import random
import re
import secrets
import shutil
import subprocess
import threading
import time
from datetime import datetime
from email.utils import formatdate
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlencode, urlparse
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from .app_db import AppDB
from .config import REPO_ROOT, SETTINGS, Settings, ensure_data_layout
from .games_db import GamesDB
from .gps.gpsd import read_gpsd
from .services import docker_container_action, docker_containers, list_services, service_action
from .storage import folders_from_places, read_json, read_places, save_waypoint

try:
    from PIL import Image
except Exception:  # Pillow is optional at runtime, but enables thumbnailing large embedded covers.
    Image = None


mimetypes.add_type("application/octet-stream", ".pmtiles")
mimetypes.add_type("application/x-protobuf", ".pbf")
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("application/manifest+json", ".webmanifest")


MAP_PACK_JOBS: dict[str, dict[str, object]] = {}
MAP_PACK_JOBS_LOCK = threading.Lock()
OVERLAY_JOBS: dict[str, dict[str, object]] = {}
OVERLAY_JOBS_LOCK = threading.Lock()
MUSIC_SCHEMA_VERSION = 3
AUDIO_EXTENSIONS = {".mp3", ".m4a", ".aac", ".ogg", ".oga", ".wav", ".flac"}
COVER_NAMES = ("cover.jpg", "cover.jpeg", "cover.png", "folder.jpg", "folder.png", "album.jpg", "album.png")
TEXT_FRAMES = {"TIT2": "title", "TPE1": "artist", "TALB": "album", "TRCK": "track"}
COVER_FALLBACK_MAX_BYTES = 1024 * 1024
COVER_MAX_PIXELS = 512
COVER_JPEG_QUALITY = 82
ROM_SYSTEMS = {
    "arcade": ("Arcade", "mame2003"),
    "atari2600": ("Atari 2600", "stella2014"),
    "fbneo": ("FinalBurn Neo", "fbneo"),
    "gba": ("Game Boy Advance", "mgba"),
    "gb": ("Game Boy", "gambatte"),
    "gbc": ("Game Boy Color", "gambatte"),
    "gamegear": ("Game Gear", "genesis_plus_gx"),
    "genesis": ("Genesis", "genesis_plus_gx"),
    "mame2003": ("MAME 2003", "mame2003"),
    "mastersystem": ("Master System", "genesis_plus_gx"),
    "megadrive": ("Mega Drive", "genesis_plus_gx"),
    "n64": ("Nintendo 64", "mupen64plus_next"),
    "nds": ("Nintendo DS", "desmume"),
    "neogeo": ("Neo Geo", "fbneo"),
    "nes": ("NES", "fceumm"),
    "psx": ("PlayStation", "pcsx_rearmed"),
    "snes": ("SNES", "snes9x"),
    "virtualboy": ("Virtual Boy", "beetle_vb"),
    "wonderswan": ("WonderSwan", "mednafen_wswan"),
    "wonderswancolor": ("WonderSwan Color", "mednafen_wswan"),
}
ROM_EXTENSIONS = {
    ".7z", ".a26", ".bin", ".cue", ".fig", ".gb", ".gba", ".gbc", ".gen",
    ".gg", ".iso", ".m3u", ".md", ".n64", ".nds", ".nes", ".sfc", ".smc",
    ".sms", ".v64", ".vb", ".ws", ".wsc", ".z64", ".zip",
}

MOBILE_GAME_TITLES = {
    "tic-tac-toe": "Tic-Tac-Toe",
    "chess": "Chess",
    "checkers": "Checkers",
    "minesweeper": "Minesweeper",
    "blockfall": "Blockfall Battle",
    "claimline": "Territory Trace",
    "blank-slate": "Blank Slate",
    "word-tile-arena": "Word Tile Arena",
    "dots-and-boxes": "Dots and Boxes",
    "connect-four": "Connect Four",
    "battleship": "Battleship",
    "hangman": "Hangman",
    "word-grid": "Word Grid",
    "pattern-match": "Pattern Match",
}
MOBILE_GAME_PREFIXES = {
    "tic-tac-toe": "ttt",
    "chess": "chess",
    "checkers": "check",
    "minesweeper": "mine",
    "blockfall": "block",
    "claimline": "trace",
    "blank-slate": "blank",
    "word-tile-arena": "tiles",
    "dots-and-boxes": "dots",
    "connect-four": "c4",
    "battleship": "ship",
    "hangman": "hang",
    "word-grid": "word",
    "pattern-match": "pat",
}
MOBILE_GAME_MARKS = {
    "tic-tac-toe": ("X", "O"),
    "chess": ("white", "black"),
    "checkers": ("red", "black"),
    "minesweeper": ("A", "B"),
    "blockfall": ("P1", "P2"),
    "claimline": ("P1", "P2"),
    "blank-slate": ("P1", "P2"),
    "word-tile-arena": ("P1", "P2", "P3", "P4"),
    "dots-and-boxes": ("A", "B"),
    "connect-four": ("R", "Y"),
    "battleship": ("A", "B"),
    "hangman": ("A", "B"),
    "word-grid": ("A", "B"),
    "pattern-match": ("A", "B"),
}

CLAIMLINE_COLS = 64
CLAIMLINE_ROWS = 40
CLAIMLINE_MAX_PLAYERS = 6
CLAIMLINE_TICK_SECONDS = 0.12
CLAIMLINE_STARTS = [
    (0, 1),
    (CLAIMLINE_COLS - 1, CLAIMLINE_ROWS - 2),
    (CLAIMLINE_COLS - 1, 1),
    (0, CLAIMLINE_ROWS - 2),
    (CLAIMLINE_COLS // 2, 0),
    (CLAIMLINE_COLS // 2, CLAIMLINE_ROWS - 1),
]
CLAIMLINE_DIRS = {"up": (0, -1), "down": (0, 1), "left": (-1, 0), "right": (1, 0)}
HANGMAN_WORDS = [
    "adventure", "backpack", "campfire", "compass", "canyon", "dashboard", "evergreen",
    "fishing", "highway", "lantern", "mountain", "offroad", "pioneer", "ranger",
    "riverbank", "starlight", "trailhead", "wildflower", "windshield", "woodland",
    "waterfall", "lookout", "trail map", "campground", "service road", "fire tower",
]
WORD_GRID_ROUND_SECONDS = 90
WORD_GRID_REVEAL_SECONDS = 3
WORD_GRID_WORDS = {
    "A", "I", "AM", "AN", "AS", "AT", "BE", "BY", "DO", "GO", "HE", "IF", "IN", "IS", "IT", "ME", "MY", "NO", "OF", "ON", "OR", "SO", "TO", "UP", "US", "WE",
    "ACE", "ACT", "AGE", "AIR", "ANT", "ARC", "ARM", "ART", "ASH", "BAG", "BAR", "BAT",
    "BEE", "BIRD", "BOAT", "BOLT", "BOOK", "CAMP", "CARD", "CART", "CASE", "CAST", "CAT",
    "CAVE", "CLAY", "COAL", "CODE", "COLD", "CONE", "CORE", "CORN", "DARK", "DEER", "DICE",
    "DOME", "DOOR", "DRUM", "DUST", "EAST", "FARM", "FAST", "FIRE", "FISH", "FLAG", "FOAM",
    "FORT", "FROG", "GAME", "GEAR", "GIFT", "GLOW", "GOAL", "GOLD", "GRID", "HARD", "HAM",
    "HAT", "HILL", "HOME", "HOOK", "IRON", "JUMP", "KITE", "LAKE", "LAND", "LEAF", "LENS",
    "LIGHT", "LINE", "LOCK", "LOG", "MAP", "MARS", "MILE", "MINT", "MOON", "MOSS", "NEST",
    "NORTH", "OAK", "PATH", "PEAK", "PINE", "PLAN", "POND", "PORT", "RAIN", "RING", "ROAD",
    "ROCK", "ROPE", "SAND", "SEAT", "SHIP", "SIGN", "SNOW", "SONG", "STAR", "STONE", "STORM",
    "TENT", "TILE", "TIRE", "TREE", "TRIP", "WAVE", "WEST", "WIND", "WING", "WIRE", "WOOD",
}
WORD_GRID_WORDS.update("""
ABLE ABOUT ACID ACORN ACRE AFTER ALARM ALBUM ALERT ALIKE ALIVE ALONE ALONG ALSO AMBER
ANGLE ANIMAL APPLE AREA ARISE ARROW ATOM AUTO AWAKE AWAY BACK BADGE BAKE BALL BANK BASE
BATH BEAM BEAN BEAR BEAT BELL BELT BEND BEST BIKE BILL BITE BLACK BLADE BLANK BLAST BLAZE
BLUE BOARD BONE BOOM BOOT BORN BOWL BRAVE BREAD BREAK BRICK BRIDGE BRIGHT BRING BROWN
BRUSH BUILD BURN BUSH BUSY CABLE CAKE CALL CALM CANDLE CANE CAPE CARE CARRY CASH CATCH
CHAIR CHALK CHASE CHECK CHEER CHEST CHILD CHILL CHIP CHORD CITY CLIMB CLOCK CLOUD CLUE
COAST COIN COMET COOK COOL COPY CORD COUNT CRAFT CREEK CREST CROW CROWN CUBE CURL CYCLE
DAILY DANCE DAWN DEAL DEEP DESK DIAL DIRT DISH DOCK DOLL DOWN DRAW DREAM DRESS DRIFT
DRINK DRIVE DROP DUCK EAGER EARN EDGE EGG EIGHT ELBOW EMPTY ENTER EVEN EVER FACE FACT
FAIR FALL FANG FEAST FEET FENCE FIELD FILL FIND FINE FIRM FIVE FLAME FLAT FLEET FLOAT
FLOOD FLOOR FLOW FOCUS FOOD FOOT FORK FORM FOUR FRAME FREE FRESH FRIEND FRONT FRUIT FULL
GARDEN GATE GHOST GIANT GIRL GIVE GLASS GOAT GOOD GRACE GRAIN GRAPE GRASS GREAT GREEN
GROUND GROUP GROW GUARD GUIDE HAND HAPPY HARBOR HARE HARM HAWK HAZE HEAD HEART HEAT HELLO
HIDE HIGH HINT HIVE HOLD HOPE HORN HORSE HOST HOUSE HUNT IDEA IDLE INCH INTO ISLAND ITEM
JADE JAR JAZZ JOIN JOKE KIND KING KNEE KNIFE KNOT LADDER LAMP LANE LATE LAUGH LAWN LEFT
LEMON LIFE LIFT LIME LION LIST LIVE LONG LOOK LOOP LOST LOVE LUCK LUNCH MAGIC MAIN MAKE
MASK MATE MEAL MEAN MEET MELT MEND MINE MIST MODE MORE MOUSE MOVE MUSIC NAIL NAME NEAR
NEED NIGHT NINE NOSE NOTE OCEAN OPEN ORBIT ORDER PACK PAGE PAIR PALM PARK PART PAST PEAR
PICK PILE PILOT PLACE PLAIN PLANE PLANT PLAY POINT POWER PRESS PRICE PRIDE PRIZE PULL PUSH
QUICK QUIET RACE RACK RAIL RANCH READ READY REAL REED REST RICE RIDE RISE RIVER ROLL ROOF
ROOM ROOT ROSE ROUND RULE SAFE SAIL SALT SAME SCALE SCARF SCHOOL SCORE SCOUT SEED SEEK SEEN
SHAPE SHARE SHARP SHEEP SHELL SHINE SHOE SHOP SHORT SIDE SIGHT SINK SKILL SKY SLIDE SLOW
SMALL SMART SMILE SMOKE SNAKE SOAP SOIL SOUND SOUTH SPACE SPARK SPEAR SPEED SPELL SPICE
SPIKE SPOON SPORT SPRING STACK STAND STEAM STEEL STEP STICK STILL STORE STREAM STREET STRONG
SWEET SWIFT TABLE TALL TEAM TEAR TEETH THANK THICK THINK THREE THROW TICK TIDE TIME TINY
TOAD TOOL TOWER TRACK TRAIN TRUCK TRUST TUNE TURN TWIN UNIT VALUE VIEW VINE VOICE WALK WALL
WARM WATCH WATER WEAR WEEK WHEEL WHITE WIDE WILD WISH WOLF WORD WORK WORLD YARD YEAR YOUNG
ZONE
""".split())
_OVERLAND_WORD_SET: set[str] | None = None
_OVERLAND_WORD_TRIE: dict | None = None


def form_value(form: dict, key: str, default: str = "") -> str:
    value = form.get(key, default)
    if isinstance(value, list):
        value = value[0] if value else default
    if value is None:
        return default
    return str(value)


def clean_player_id(value: object) -> str:
    raw = str(value or "").strip()
    return re.sub(r"[^A-Za-z0-9._:-]+", "-", raw)[:80] or secrets.token_urlsafe(18)


def clean_player_name(value: object) -> str:
    return re.sub(r"[\x00-\x1f]+", "", str(value or "Player")).strip()[:32] or "Player"


def cpu_player_id(difficulty: str) -> str:
    return f"cpu-{str(difficulty or 'medium').lower()}"


def cpu_player_name(difficulty: str) -> str:
    return f"Computer ({str(difficulty or 'medium').title()})"


def touch_mobile_game(game: dict) -> None:
    game["updated"] = timestamp()
    game["updatedEpoch"] = time.time()


def public_mobile_players(game: dict) -> list[dict]:
    players = []
    for player in game.get("players", []) if isinstance(game.get("players"), list) else []:
        if not isinstance(player, dict):
            continue
        players.append(
            {
                "id": str(player.get("id") or ""),
                "name": clean_player_name(player.get("name") or player.get("id") or "Player"),
                "mark": str(player.get("mark") or ""),
            }
        )
    return players


def find_mobile_player(game: dict, player_id: str | None) -> dict | None:
    pid = str(player_id or "")
    for player in game.get("players", []) if isinstance(game.get("players"), list) else []:
        if isinstance(player, dict) and str(player.get("id") or "") == pid:
            return player
    return None


def record_mobile_game_result(game: dict) -> None:
    # Engines call this when a terminal state is reached. SQLite persistence
    # happens at the handler boundary where GamesDB is available.
    game["resultPending"] = True


def clean_game_word(value: object) -> str:
    return re.sub(r"[^A-Z]", "", str(value or "").upper())


def overland_word_set() -> set[str]:
    global _OVERLAND_WORD_SET
    if _OVERLAND_WORD_SET is not None:
        return _OVERLAND_WORD_SET
    words = set(WORD_GRID_WORDS)
    candidates = [
        SETTINGS.data_dir / "games" / "overland-words.txt",
        SETTINGS.data_dir / "dictionaries" / "overland-words.txt",
        REPO_ROOT / "data" / "overland-words.txt",
        Path("/usr/share/dict/words"),
        Path("/usr/share/dict/american-english"),
        Path("/usr/share/dict/web2"),
        Path("/usr/share/dict/web2a"),
    ]
    for path in candidates:
        if not path.exists():
            continue
        trusted = path.name == "overland-words.txt"
        try:
            for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
                original = raw.strip()
                if not original or not original.replace("'", "").replace("-", "").isalpha():
                    continue
                if not trusted and original[:1].isupper() and not original.isupper():
                    continue
                word = clean_game_word(original)
                if 1 <= len(word) <= 16:
                    words.add(word)
        except OSError:
            continue
    _OVERLAND_WORD_SET = words
    return words


def overland_word_trie() -> dict:
    global _OVERLAND_WORD_TRIE
    if _OVERLAND_WORD_TRIE is not None:
        return _OVERLAND_WORD_TRIE
    root: dict = {}
    for word in overland_word_set():
        node = root
        for letter in word:
            node = node.setdefault(letter, {})
        node["$"] = word
    _OVERLAND_WORD_TRIE = root
    return root


def is_valid_game_word(value: object) -> bool:
    return clean_game_word(value) in overland_word_set()


WORD_TILE_SIZE = 15
WORD_TILE_CENTER = 7
WORD_TILE_MAX_PLAYERS = 4
WORD_TILE_TILE_VALUES = {
    "A": 1, "B": 3, "C": 3, "D": 2, "E": 1, "F": 4, "G": 2, "H": 4,
    "I": 1, "J": 8, "K": 5, "L": 1, "M": 3, "N": 1, "O": 1, "P": 3,
    "Q": 10, "R": 1, "S": 1, "T": 1, "U": 1, "V": 4, "W": 4, "X": 8,
    "Y": 4, "Z": 10, "_": 0,
}
WORD_TILE_DISTRIBUTION = {
    "A": 9, "B": 2, "C": 2, "D": 4, "E": 12, "F": 2, "G": 3, "H": 2,
    "I": 9, "J": 1, "K": 1, "L": 4, "M": 2, "N": 6, "O": 8, "P": 2,
    "Q": 1, "R": 6, "S": 4, "T": 6, "U": 4, "V": 2, "W": 2, "X": 1,
    "Y": 2, "Z": 1, "_": 2,
}
WORD_TILE_PASS_LIMIT_FACTOR = 2


def word_tile_premium_layout() -> dict[str, str]:
    layout: dict[str, str] = {}
    premium_groups = {
        "TW": [(0, 0), (0, 7), (0, 14), (7, 0), (7, 14), (14, 0), (14, 7), (14, 14)],
        "DW": [(1, 1), (2, 2), (3, 3), (4, 4), (10, 10), (11, 11), (12, 12), (13, 13), (1, 13), (2, 12), (3, 11), (4, 10), (10, 4), (11, 3), (12, 2), (13, 1), (7, 7)],
        "TL": [(1, 5), (1, 9), (5, 1), (5, 5), (5, 9), (5, 13), (9, 1), (9, 5), (9, 9), (9, 13), (13, 5), (13, 9)],
        "DL": [(0, 3), (0, 11), (2, 6), (2, 8), (3, 0), (3, 7), (3, 14), (6, 2), (6, 6), (6, 8), (6, 12), (7, 3), (7, 11), (8, 2), (8, 6), (8, 8), (8, 12), (11, 0), (11, 7), (11, 14), (12, 6), (12, 8), (14, 3), (14, 11)],
    }
    for premium, coords in premium_groups.items():
        for x, y in coords:
            layout[f"{x},{y}"] = premium
    layout[f"{WORD_TILE_CENTER},{WORD_TILE_CENTER}"] = "STAR"
    return layout


WORD_TILE_PREMIUM_LAYOUT = word_tile_premium_layout()


def word_tile_player_mark(index: int) -> str:
    return f"P{int(index) + 1}"


def word_tile_new_bag() -> list[dict]:
    bag = []
    counter = 1
    for letter, count in WORD_TILE_DISTRIBUTION.items():
        for _ in range(int(count)):
            bag.append({"id": f"{letter}{counter}", "letter": letter, "blank": letter == "_", "value": WORD_TILE_TILE_VALUES[letter]})
            counter += 1
    secrets.SystemRandom().shuffle(bag)
    return bag


def word_tile_empty_board() -> list[dict | None]:
    return [None for _ in range(WORD_TILE_SIZE * WORD_TILE_SIZE)]


def word_tile_index(x: int, y: int) -> int:
    return int(y) * WORD_TILE_SIZE + int(x)


def word_tile_new_payload() -> dict:
    return {
        "size": WORD_TILE_SIZE,
        "board": word_tile_empty_board(),
        "racks": {},
        "bag": [],
        "scores": {},
        "turnOrder": [],
        "lastMove": None,
        "moveHistory": [],
        "consecutivePasses": 0,
        "turnNumber": 1,
        "hostMark": "P1",
    }


def word_tile_board(payload: dict) -> list:
    board = payload.get("board")
    if not isinstance(board, list) or len(board) != WORD_TILE_SIZE * WORD_TILE_SIZE:
        board = word_tile_empty_board()
        payload["board"] = board
    return board


def word_tile_public_payload(game: dict, player_id: str = "") -> dict:
    payload = game.setdefault("payload", word_tile_new_payload())
    player = find_mobile_player(game, player_id) if player_id else None
    mark = str(player.get("mark") or "") if player else ""
    racks = payload.get("racks") if isinstance(payload.get("racks"), dict) else {}
    public_players = []
    for item in game.get("players", []):
        if not isinstance(item, dict):
            continue
        player_mark = str(item.get("mark") or "")
        public_players.append({
            "mark": player_mark,
            "name": clean_player_name(item.get("name") or player_mark),
            "rackCount": len(racks.get(player_mark) or []),
            "score": int(payload.get("scores", {}).get(player_mark) or 0),
        })
    return {
        "size": WORD_TILE_SIZE,
        "board": word_tile_board(payload),
        "premiums": WORD_TILE_PREMIUM_LAYOUT,
        "rack": list(racks.get(mark) or []),
        "rackCounts": {item["mark"]: item["rackCount"] for item in public_players},
        "scores": {item["mark"]: item["score"] for item in public_players},
        "players": public_players,
        "tileBagCount": len(payload.get("bag") or []),
        "turnOrder": list(payload.get("turnOrder") or []),
        "turnNumber": int(payload.get("turnNumber") or 1),
        "consecutivePasses": int(payload.get("consecutivePasses") or 0),
        "lastMove": payload.get("lastMove"),
        "moveHistory": list(payload.get("moveHistory") or [])[-20:],
        "hostMark": payload.get("hostMark") or "P1",
        "myMark": mark,
    }


def word_tile_draw_tiles(payload: dict, mark: str) -> None:
    rack = payload.setdefault("racks", {}).setdefault(mark, [])
    bag = payload.setdefault("bag", [])
    while len(rack) < 7 and bag:
        rack.append(bag.pop())


def word_tile_start_game(game: dict) -> None:
    if game.get("status") == "active":
        return
    players = [item for item in game.get("players", []) if isinstance(item, dict)]
    if len(players) < 2:
        raise ValueError("Word Tile Arena needs at least 2 players.")
    if len(players) > WORD_TILE_MAX_PLAYERS:
        raise ValueError("Word Tile Arena supports up to 4 players.")
    payload = word_tile_new_payload()
    payload["bag"] = word_tile_new_bag()
    payload["turnOrder"] = [str(player.get("mark") or word_tile_player_mark(index)) for index, player in enumerate(players)]
    payload["hostMark"] = str(players[0].get("mark") or "P1")
    for player in players:
        mark = str(player.get("mark") or "")
        payload.setdefault("scores", {})[mark] = 0
        word_tile_draw_tiles(payload, mark)
    game["payload"] = payload
    game["turn"] = payload["turnOrder"][0]
    game["status"] = "active"
    game["winner"] = ""
    game["resultRecorded"] = False


def word_tile_next_turn(game: dict) -> None:
    payload = game.setdefault("payload", word_tile_new_payload())
    order = list(payload.get("turnOrder") or [str(player.get("mark") or "") for player in game.get("players", []) if isinstance(player, dict)])
    current = str(game.get("turn") or (order[0] if order else "P1"))
    if order:
        game["turn"] = order[(order.index(current) + 1) % len(order)] if current in order else order[0]
    payload["turnNumber"] = int(payload.get("turnNumber") or 1) + 1


def word_tile_tile_value(tile_or_cell: dict | None) -> int:
    if not isinstance(tile_or_cell, dict) or bool(tile_or_cell.get("blank")):
        return 0
    return int(tile_or_cell.get("value") if tile_or_cell.get("value") is not None else WORD_TILE_TILE_VALUES.get(str(tile_or_cell.get("letter") or "").upper(), 0))


def word_tile_normalize_placements(raw: object) -> list[dict]:
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError("Tile placements were not valid JSON.") from exc
    if not isinstance(raw, list) or not raw:
        raise ValueError("Place at least one tile.")
    placements = []
    seen = set()
    for item in raw[:7]:
        if not isinstance(item, dict):
            raise ValueError("Each tile placement must be an object.")
        try:
            x = int(item.get("x"))
            y = int(item.get("y"))
        except (TypeError, ValueError) as exc:
            raise ValueError("Tile coordinates must be numbers.") from exc
        if x < 0 or y < 0 or x >= WORD_TILE_SIZE or y >= WORD_TILE_SIZE:
            raise ValueError("A tile is outside the board.")
        tile_id = str(item.get("tileId") or "").strip()[:24]
        letter = str(item.get("letter") or "").strip().upper()[:1]
        if not re.fullmatch(r"[A-Z]", letter):
            raise ValueError("Every placed tile needs a letter.")
        if (x, y) in seen:
            raise ValueError("Two tiles cannot be placed on the same square.")
        seen.add((x, y))
        placements.append({"x": x, "y": y, "tileId": tile_id, "letter": letter})
    return placements


def word_tile_direction(placements: list[dict]) -> str:
    rows = {item["y"] for item in placements}
    cols = {item["x"] for item in placements}
    if len(placements) == 1:
        return "single"
    if len(rows) == 1:
        return "row"
    if len(cols) == 1:
        return "col"
    raise ValueError("Placed tiles must be in one row or one column.")


def word_tile_line_cells(board: list, x: int, y: int, dx: int, dy: int, overlay: dict) -> list[dict]:
    while 0 <= x - dx < WORD_TILE_SIZE and 0 <= y - dy < WORD_TILE_SIZE and (board[word_tile_index(x - dx, y - dy)] or overlay.get((x - dx, y - dy))):
        x -= dx
        y -= dy
    cells = []
    while 0 <= x < WORD_TILE_SIZE and 0 <= y < WORD_TILE_SIZE and (board[word_tile_index(x, y)] or overlay.get((x, y))):
        item = overlay.get((x, y)) or board[word_tile_index(x, y)]
        cells.append({"x": x, "y": y, "cell": item, "new": (x, y) in overlay})
        x += dx
        y += dy
    return cells


def word_tile_word_from_cells(cells: list[dict]) -> str:
    return "".join(str((item["cell"] or {}).get("letter") or "").upper()[:1] for item in cells)


def word_tile_score_cells(cells: list[dict]) -> int:
    total = 0
    multiplier = 1
    for item in cells:
        cell = item["cell"]
        value = word_tile_tile_value(cell)
        if item.get("new"):
            premium = WORD_TILE_PREMIUM_LAYOUT.get(f"{item['x']},{item['y']}")
            if premium == "DL":
                value *= 2
            elif premium == "TL":
                value *= 3
            elif premium in {"DW", "STAR"}:
                multiplier *= 2
            elif premium == "TW":
                multiplier *= 3
        total += value
    return total * multiplier


def word_tile_build_words(board: list, placements: list[dict], tile_lookup: dict[str, dict]) -> tuple[list[list[dict]], dict]:
    direction = word_tile_direction(placements)
    overlay = {}
    for place in placements:
        tile = tile_lookup[place["tileId"]]
        overlay[(place["x"], place["y"])] = {
            "letter": place["letter"],
            "tileLetter": tile.get("letter"),
            "blank": bool(tile.get("blank")),
            "value": 0 if bool(tile.get("blank")) else WORD_TILE_TILE_VALUES.get(str(tile.get("letter") or "").upper(), 0),
            "owner": "",
            "turn": 0,
        }
    if direction == "single":
        place = placements[0]
        words = []
        row_cells = word_tile_line_cells(board, place["x"], place["y"], 1, 0, overlay)
        col_cells = word_tile_line_cells(board, place["x"], place["y"], 0, 1, overlay)
        if len(row_cells) > 1:
            words.append(row_cells)
        if len(col_cells) > 1:
            words.append(col_cells)
        return words or [row_cells], overlay
    main_dx, main_dy = (1, 0) if direction == "row" else (0, 1)
    cross_dx, cross_dy = (0, 1) if direction == "row" else (1, 0)
    anchor = placements[0]
    words = [word_tile_line_cells(board, anchor["x"], anchor["y"], main_dx, main_dy, overlay)]
    for place in placements:
        cross = word_tile_line_cells(board, place["x"], place["y"], cross_dx, cross_dy, overlay)
        if len(cross) > 1:
            words.append(cross)
    return words, overlay


def word_tile_validate_continuity(board: list, placements: list[dict], direction: str) -> None:
    if direction == "single":
        return
    if direction == "row":
        y = placements[0]["y"]
        xs = [item["x"] for item in placements]
        for x in range(min(xs), max(xs) + 1):
            if not board[word_tile_index(x, y)] and not any(item["x"] == x and item["y"] == y for item in placements):
                raise ValueError("Tiles must form one continuous line.")
    else:
        x = placements[0]["x"]
        ys = [item["y"] for item in placements]
        for y in range(min(ys), max(ys) + 1):
            if not board[word_tile_index(x, y)] and not any(item["x"] == x and item["y"] == y for item in placements):
                raise ValueError("Tiles must form one continuous line.")


def word_tile_has_existing_tiles(board: list) -> bool:
    return any(bool(cell) for cell in board)


def word_tile_connected_to_board(board: list, placements: list[dict]) -> bool:
    if not word_tile_has_existing_tiles(board):
        return any(item["x"] == WORD_TILE_CENTER and item["y"] == WORD_TILE_CENTER for item in placements)
    for item in placements:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            x = item["x"] + dx
            y = item["y"] + dy
            if 0 <= x < WORD_TILE_SIZE and 0 <= y < WORD_TILE_SIZE and board[word_tile_index(x, y)]:
                return True
    return False


def word_tile_apply_play(game: dict, player: dict, raw_placements: object) -> None:
    if str(player.get("mark") or "") != str(game.get("turn") or ""):
        raise ValueError("It is not your turn.")
    payload = game.setdefault("payload", word_tile_new_payload())
    board = word_tile_board(payload)
    mark = str(player.get("mark") or "")
    rack = payload.setdefault("racks", {}).setdefault(mark, [])
    placements = word_tile_normalize_placements(raw_placements)
    rack_by_id = {str(tile.get("id") or ""): tile for tile in rack if isinstance(tile, dict)}
    for place in placements:
        tile = rack_by_id.get(place["tileId"])
        if not tile:
            raise ValueError("A submitted tile is not in your rack.")
        if board[word_tile_index(place["x"], place["y"])]:
            raise ValueError("A tile was placed on an occupied square.")
        if not tile.get("blank") and place["letter"] != str(tile.get("letter") or "").upper():
            raise ValueError("A non-blank tile cannot change letters.")
    direction = word_tile_direction(placements)
    word_tile_validate_continuity(board, placements, direction)
    if not word_tile_connected_to_board(board, placements):
        raise ValueError("The first move must cover center; later moves must connect to existing tiles.")
    words_cells, overlay = word_tile_build_words(board, placements, rack_by_id)
    words = []
    total_score = 0
    for cells in words_cells:
        word = word_tile_word_from_cells(cells)
        if len(word) < 2:
            continue
        if not is_valid_game_word(word):
            raise ValueError(f"{word} is not in the word list.")
        words.append(word)
        total_score += word_tile_score_cells(cells)
    if not words:
        raise ValueError("The move must form a valid word.")
    if len(placements) == 7:
        total_score += 50
    turn_no = int(payload.get("turnNumber") or 1)
    for (x, y), cell in overlay.items():
        cell["owner"] = mark
        cell["turn"] = turn_no
        board[word_tile_index(x, y)] = cell
    used_ids = {place["tileId"] for place in placements}
    payload["racks"][mark] = [tile for tile in rack if str(tile.get("id") or "") not in used_ids]
    payload.setdefault("scores", {})[mark] = int(payload.setdefault("scores", {}).get(mark) or 0) + total_score
    word_tile_draw_tiles(payload, mark)
    payload["consecutivePasses"] = 0
    move = {
        "mark": mark,
        "name": clean_player_name(player.get("name") or mark),
        "action": "play",
        "words": words,
        "score": total_score,
        "tilesPlayed": len(placements),
        "coords": [{"x": item["x"], "y": item["y"]} for item in placements],
        "turnNumber": turn_no,
        "timestamp": timestamp(),
    }
    payload["lastMove"] = move
    payload.setdefault("moveHistory", []).append(move)
    if not payload.get("bag") and not payload["racks"].get(mark):
        word_tile_finish_game(game, mark)
    else:
        word_tile_next_turn(game)


def word_tile_exchange(game: dict, player: dict, raw_tile_ids: object) -> None:
    if str(player.get("mark") or "") != str(game.get("turn") or ""):
        raise ValueError("It is not your turn.")
    if isinstance(raw_tile_ids, str):
        try:
            raw_tile_ids = json.loads(raw_tile_ids)
        except json.JSONDecodeError as exc:
            raise ValueError("Exchange tile IDs were not valid JSON.") from exc
    tile_ids = [str(item or "") for item in (raw_tile_ids if isinstance(raw_tile_ids, list) else [])]
    if not tile_ids:
        raise ValueError("Select at least one tile to exchange.")
    payload = game.setdefault("payload", word_tile_new_payload())
    if len(payload.get("bag") or []) < len(tile_ids):
        raise ValueError("Not enough tiles remain in the bag to exchange.")
    mark = str(player.get("mark") or "")
    rack = payload.setdefault("racks", {}).setdefault(mark, [])
    selected = [tile for tile in rack if str(tile.get("id") or "") in set(tile_ids)]
    if len(selected) != len(set(tile_ids)):
        raise ValueError("A selected tile was not in your rack.")
    payload["racks"][mark] = [tile for tile in rack if str(tile.get("id") or "") not in set(tile_ids)]
    payload.setdefault("bag", []).extend(selected)
    secrets.SystemRandom().shuffle(payload["bag"])
    word_tile_draw_tiles(payload, mark)
    payload["consecutivePasses"] = 0
    move = {"mark": mark, "name": clean_player_name(player.get("name") or mark), "action": "exchange", "count": len(selected), "score": 0, "turnNumber": int(payload.get("turnNumber") or 1), "timestamp": timestamp()}
    payload["lastMove"] = move
    payload.setdefault("moveHistory", []).append(move)
    word_tile_next_turn(game)


def word_tile_pass(game: dict, player: dict) -> None:
    if str(player.get("mark") or "") != str(game.get("turn") or ""):
        raise ValueError("It is not your turn.")
    payload = game.setdefault("payload", word_tile_new_payload())
    mark = str(player.get("mark") or "")
    payload["consecutivePasses"] = int(payload.get("consecutivePasses") or 0) + 1
    move = {"mark": mark, "name": clean_player_name(player.get("name") or mark), "action": "pass", "score": 0, "turnNumber": int(payload.get("turnNumber") or 1), "timestamp": timestamp()}
    payload["lastMove"] = move
    payload.setdefault("moveHistory", []).append(move)
    if payload["consecutivePasses"] >= max(2, len(game.get("players", [])) * WORD_TILE_PASS_LIMIT_FACTOR):
        word_tile_finish_game(game)
    else:
        word_tile_next_turn(game)


def word_tile_rack_value(rack: list) -> int:
    return sum(word_tile_tile_value(tile) for tile in (rack or []) if isinstance(tile, dict))


def word_tile_finish_game(game: dict, emptied_mark: str = "") -> None:
    payload = game.setdefault("payload", word_tile_new_payload())
    scores = payload.setdefault("scores", {})
    opponent_bonus = 0
    rack_penalties = {}
    for mark, rack in payload.setdefault("racks", {}).items():
        penalty = word_tile_rack_value(rack)
        rack_penalties[mark] = penalty
        scores[mark] = int(scores.get(mark) or 0) - penalty
        if emptied_mark and mark != emptied_mark:
            opponent_bonus += penalty
    if emptied_mark:
        scores[emptied_mark] = int(scores.get(emptied_mark) or 0) + opponent_bonus
    payload["rackPenalties"] = rack_penalties
    payload["opponentBonus"] = opponent_bonus
    game["status"] = "complete"
    ordered = sorted(scores.items(), key=lambda item: int(item[1]), reverse=True)
    game["winner"] = "draw" if len(ordered) > 1 and int(ordered[0][1]) == int(ordered[1][1]) else (ordered[0][0] if ordered else "draw")
    record_mobile_game_result(game)


def checkers_initial_board() -> list[str]:
    board = [""] * 32
    for index in range(12):
        board[index] = "b"
    for index in range(20, 32):
        board[index] = "r"
    return board


def checkers_row_col(index: int) -> tuple[int, int]:
    index = int(index)
    row = index // 4
    col = (index % 4) * 2 + (1 if row % 2 == 0 else 0)
    return row, col


def checkers_index(row: int, col: int) -> int | None:
    if row < 0 or row > 7 or col < 0 or col > 7 or (row + col) % 2 == 0:
        return None
    return row * 4 + (col // 2)


def checkers_side(piece: str) -> str:
    piece = str(piece or "")
    if piece.lower() == "r":
        return "red"
    if piece.lower() == "b":
        return "black"
    return ""


def checkers_directions(piece: str) -> list[tuple[int, int]]:
    piece = str(piece or "")
    if piece in {"R", "B"}:
        return [(-1, -1), (-1, 1), (1, -1), (1, 1)]
    if piece == "r":
        return [(-1, -1), (-1, 1)]
    if piece == "b":
        return [(1, -1), (1, 1)]
    return []


def checkers_king_piece(piece: str, row: int) -> str:
    if piece == "r" and row == 0:
        return "R"
    if piece == "b" and row == 7:
        return "B"
    return piece


def checkers_capture_moves(board: list[str], side: str, from_index: int | None = None) -> list[dict]:
    moves = []
    for index, piece in enumerate(board):
        if from_index is not None and index != from_index:
            continue
        if checkers_side(piece) != side:
            continue
        row, col = checkers_row_col(index)
        for dr, dc in checkers_directions(piece):
            mid = checkers_index(row + dr, col + dc)
            to = checkers_index(row + dr * 2, col + dc * 2)
            if mid is None or to is None or board[to]:
                continue
            captured = board[mid]
            if captured and checkers_side(captured) and checkers_side(captured) != side:
                moves.append({"from": index, "to": to, "capture": mid})
    return moves


def checkers_simple_moves(board: list[str], side: str) -> list[dict]:
    moves = []
    for index, piece in enumerate(board):
        if checkers_side(piece) != side:
            continue
        row, col = checkers_row_col(index)
        for dr, dc in checkers_directions(piece):
            to = checkers_index(row + dr, col + dc)
            if to is not None and not board[to]:
                moves.append({"from": index, "to": to})
    return moves


def checkers_legal_moves(game: dict) -> list[dict]:
    payload = game.get("payload") or {}
    board = list(payload.get("board") or checkers_initial_board())
    side = str(game.get("turn") or "red")
    must_continue = payload.get("mustContinue")
    try:
        must_continue = int(must_continue) if must_continue is not None else None
    except (TypeError, ValueError):
        must_continue = None
    if must_continue is not None:
        return checkers_capture_moves(board, side, must_continue)
    captures = checkers_capture_moves(board, side)
    if captures and bool(payload.get("forcedJumps", True)):
        return captures
    return captures + checkers_simple_moves(board, side)


def checkers_result(game: dict) -> tuple[str, list]:
    board = list((game.get("payload") or {}).get("board") or [])
    red = any(checkers_side(piece) == "red" for piece in board)
    black = any(checkers_side(piece) == "black" for piece in board)
    if not red:
        return "black", []
    if not black:
        return "red", []
    if not checkers_legal_moves(game):
        return ("black" if game.get("turn") == "red" else "red"), []
    return "", []


def public_checkers_payload(game: dict) -> dict:
    payload = game.get("payload") or {}
    board = list(payload.get("board") or checkers_initial_board())
    return {
        "board": board,
        "lastMove": payload.get("lastMove"),
        "mustContinue": payload.get("mustContinue"),
        "forcedJumps": bool(payload.get("forcedJumps", True)),
        "legalMoves": checkers_legal_moves(game) if game.get("status") == "active" and not game.get("winner") else [],
        "counts": {
            "red": sum(1 for piece in board if checkers_side(piece) == "red"),
            "black": sum(1 for piece in board if checkers_side(piece) == "black"),
        },
    }


def checkers_apply_move(game: dict, from_index: int, to_index: int, side: str) -> dict:
    payload = game.setdefault("payload", {})
    board = list(payload.get("board") or checkers_initial_board())
    if len(board) != 32:
        board = checkers_initial_board()
    from_index = int(from_index)
    to_index = int(to_index)
    if from_index < 0 or from_index >= 32 or to_index < 0 or to_index >= 32:
        raise ValueError("Move is outside the board.")
    if side != game.get("turn"):
        raise ValueError("It is not your turn.")
    move = next((item for item in checkers_legal_moves(game) if item.get("from") == from_index and item.get("to") == to_index), None)
    if not move:
        raise ValueError("That move is not legal.")
    piece = board[from_index]
    if checkers_side(piece) != side:
        raise ValueError("That is not your checker.")
    board[from_index] = ""
    captured = move.get("capture")
    if captured is not None:
        board[captured] = ""
    row, _col = checkers_row_col(to_index)
    promoted = piece != checkers_king_piece(piece, row)
    piece = checkers_king_piece(piece, row)
    board[to_index] = piece
    payload["board"] = board
    payload["lastMove"] = {"from": from_index, "to": to_index, "capture": captured, "mark": side}
    payload["mustContinue"] = None
    if captured is not None and not promoted and checkers_capture_moves(board, side, to_index):
        payload["mustContinue"] = to_index
        game["turn"] = side
    else:
        game["turn"] = "black" if side == "red" else "red"
    winner, line = checkers_result(game)
    if winner:
        game["winner"] = winner
        game["winningLine"] = line
        game["status"] = "complete"
        record_mobile_game_result(game)
    return move


def checkers_cpu_score_move(game: dict, move: dict, difficulty: str) -> int:
    board = list((game.get("payload") or {}).get("board") or checkers_initial_board())
    piece = board[move["from"]]
    score = 10 if move.get("capture") is not None else 0
    to_row, _to_col = checkers_row_col(move["to"])
    if piece == "b" and to_row == 7:
        score += 6
    if piece == "B":
        score += 2
    if difficulty == "hard":
        board_copy = list(board)
        board_copy[move["from"]] = ""
        if move.get("capture") is not None:
            board_copy[move["capture"]] = ""
        board_copy[move["to"]] = checkers_king_piece(piece, to_row)
        if checkers_capture_moves(board_copy, "red"):
            score -= 5
    return score


def checkers_cpu_choose_move(game: dict) -> dict | None:
    moves = checkers_legal_moves(game)
    if not moves:
        return None
    difficulty = str(game.get("difficulty") or "medium").lower()
    if difficulty == "easy":
        return secrets.choice(moves)
    scored = [(checkers_cpu_score_move(game, move, difficulty), move) for move in moves]
    best = max(score for score, _move in scored)
    best_moves = [move for score, move in scored if score == best]
    if difficulty == "medium" and len(best_moves) < len(moves) and secrets.randbelow(4) == 0:
        return secrets.choice(moves)
    return secrets.choice(best_moves)


def checkers_cpu_move(game: dict) -> None:
    if game.get("mode") != "cpu" or game.get("status") != "active" or game.get("winner") or game.get("turn") != "black":
        return
    chain_limit = 12
    while game.get("status") == "active" and game.get("turn") == "black" and chain_limit > 0:
        chain_limit -= 1
        move = checkers_cpu_choose_move(game)
        if not move:
            winner, line = checkers_result(game)
            if winner:
                game["winner"] = winner
                game["winningLine"] = line
                game["status"] = "complete"
            break
        checkers_apply_move(game, move["from"], move["to"], "black")
        if (game.get("payload") or {}).get("mustContinue") is None:
            break


def dots_boxes_edge_count(size: int) -> int:
    try:
        size = int(size)
    except (TypeError, ValueError):
        size = 4
    if size < 2 or size > 6:
        return 0
    return (size + 1) * size * 2


def dots_boxes_box_edges(size: int, box_index: int) -> list[int]:
    row = box_index // size
    col = box_index % size
    horizontal_count = (size + 1) * size
    return [
        row * size + col,
        (row + 1) * size + col,
        horizontal_count + row * (size + 1) + col,
        horizontal_count + row * (size + 1) + col + 1,
    ]


def dots_boxes_edge_boxes(size: int, edge_index: int) -> list[int]:
    horizontal_count = (size + 1) * size
    boxes: list[int] = []
    if edge_index < horizontal_count:
        row = edge_index // size
        col = edge_index % size
        if row > 0:
            boxes.append((row - 1) * size + col)
        if row < size:
            boxes.append(row * size + col)
    else:
        local = edge_index - horizontal_count
        row = local // (size + 1)
        col = local % (size + 1)
        if col > 0:
            boxes.append(row * size + col - 1)
        if col < size:
            boxes.append(row * size + col)
    return boxes


def dots_boxes_scores(boxes: list[str]) -> dict[str, int]:
    return {"A": sum(1 for box in boxes if box == "A"), "B": sum(1 for box in boxes if box == "B")}


def dots_boxes_result(game: dict) -> tuple[str, list]:
    boxes = game.get("boxes", [])
    if not boxes or any(not box for box in boxes):
        return "", []
    scores = dots_boxes_scores(boxes)
    if scores["A"] == scores["B"]:
        return "draw", []
    return ("A" if scores["A"] > scores["B"] else "B"), []


def dots_boxes_apply_move(game: dict, edge_index: int, mark: str) -> list[int]:
    size = int(game.get("size") or 4)
    edge_count = dots_boxes_edge_count(size)
    edge_index = int(edge_index)
    if edge_index < 0 or edge_index >= edge_count:
        raise ValueError("Line is outside the board.")
    edges = list(game.get("edges") or [""] * edge_count)
    boxes = list(game.get("boxes") or [""] * (size * size))
    if edges[edge_index]:
        raise ValueError("That line is already taken.")
    edges[edge_index] = mark
    completed: list[int] = []
    for box_index in dots_boxes_edge_boxes(size, edge_index):
        if not boxes[box_index] and all(edges[item] for item in dots_boxes_box_edges(size, box_index)):
            boxes[box_index] = mark
            completed.append(box_index)
    game["edges"] = edges
    game["boxes"] = boxes
    game["scores"] = dots_boxes_scores(boxes)
    game["lastMove"] = {"edge": edge_index, "mark": mark, "boxes": completed}
    winner, line = dots_boxes_result(game)
    if winner:
        game["winner"] = winner
        game["winningLine"] = line
        game["status"] = "complete"
        record_mobile_game_result(game)
    elif not completed:
        game["turn"] = "B" if mark == "A" else "A"
    return completed


def dots_boxes_completing_moves(game: dict) -> list[int]:
    size = int(game.get("size") or 4)
    edges = list(game.get("edges") or [])
    boxes = list(game.get("boxes") or [])
    moves: list[int] = []
    for edge_index, owner in enumerate(edges):
        if owner:
            continue
        for box_index in dots_boxes_edge_boxes(size, edge_index):
            if boxes[box_index]:
                continue
            if sum(1 for edge in dots_boxes_box_edges(size, box_index) if edges[edge] or edge == edge_index) == 4:
                moves.append(edge_index)
                break
    return moves


def dots_boxes_safe_moves(game: dict, moves: list[int]) -> list[int]:
    size = int(game.get("size") or 4)
    edges = list(game.get("edges") or [])
    boxes = list(game.get("boxes") or [])
    safe: list[int] = []
    for move in moves:
        risky = False
        for box_index in dots_boxes_edge_boxes(size, move):
            if boxes[box_index]:
                continue
            if sum(1 for edge in dots_boxes_box_edges(size, box_index) if edges[edge] or edge == move) == 3:
                risky = True
                break
        if not risky:
            safe.append(move)
    return safe


def dots_boxes_cpu_move(game: dict) -> None:
    if game.get("mode") != "cpu" or game.get("status") != "active" or game.get("winner") or game.get("turn") != "B":
        return
    chain_limit = max(1, len(game.get("edges", [])))
    while game.get("status") == "active" and game.get("turn") == "B" and chain_limit > 0:
        chain_limit -= 1
        moves = [idx for idx, owner in enumerate(game.get("edges", [])) if not owner]
        if not moves:
            break
        difficulty = str(game.get("difficulty") or "medium").lower()
        completing = dots_boxes_completing_moves(game)
        if completing and difficulty in {"medium", "hard"}:
            move = secrets.choice(completing)
        elif difficulty in {"medium", "hard"}:
            move = secrets.choice(dots_boxes_safe_moves(game, moves) or moves)
        else:
            move = secrets.choice(moves)
        completed = dots_boxes_apply_move(game, move, "B")
        if not completed:
            break


def connect_four_result(board: list[str]) -> tuple[str, list[int]]:
    for row in range(6):
        for col in range(7):
            mark = board[row * 7 + col] if row * 7 + col < len(board) else ""
            if not mark:
                continue
            for dr, dc in ((0, 1), (1, 0), (1, 1), (1, -1)):
                cells = []
                for step in range(4):
                    rr = row + dr * step
                    cc = col + dc * step
                    if rr < 0 or rr >= 6 or cc < 0 or cc >= 7 or board[rr * 7 + cc] != mark:
                        break
                    cells.append(rr * 7 + cc)
                if len(cells) == 4:
                    return mark, cells
    if all(board):
        return "draw", []
    return "", []


def connect_four_legal_columns(board: list[str]) -> list[int]:
    return [col for col in range(7) if not board[col]]


def connect_four_drop(board: list[str], col: int, mark: str) -> int:
    col = int(col)
    if col < 0 or col > 6:
        raise ValueError("Column is outside the board.")
    for row in range(5, -1, -1):
        index = row * 7 + col
        if not board[index]:
            board[index] = mark
            return index
    raise ValueError("That column is full.")


def connect_four_winning_column(board: list[str], mark: str) -> int | None:
    for col in connect_four_legal_columns(board):
        test = list(board)
        connect_four_drop(test, col, mark)
        winner, _line = connect_four_result(test)
        if winner == mark:
            return col
    return None


def connect_four_cpu_column(board: list[str], difficulty: str = "medium", cpu_mark: str = "Y") -> int | None:
    moves = connect_four_legal_columns(board)
    if not moves:
        return None
    player_mark = "R" if cpu_mark == "Y" else "Y"
    if difficulty == "easy":
        return secrets.choice(moves)
    for mark in (cpu_mark, player_mark):
        winning = connect_four_winning_column(board, mark)
        if winning is not None:
            return winning
    preferred = [3, 2, 4, 1, 5, 0, 6]
    available = [col for col in preferred if col in moves]
    return secrets.choice(available[:3] if difficulty == "medium" and available[:3] else available or moves)


def connect_four_apply_move(game: dict, col: int, mark: str) -> None:
    board = list(game.get("board") or [""] * 42)
    index = connect_four_drop(board, int(col), mark)
    game["board"] = board
    game["lastMove"] = index
    winner, line = connect_four_result(board)
    if winner:
        game["winner"] = winner
        game["winningLine"] = line
        game["status"] = "complete"
        record_mobile_game_result(game)
    else:
        game["turn"] = "Y" if mark == "R" else "R"


def connect_four_cpu_move(game: dict) -> None:
    if game.get("mode") != "cpu" or game.get("status") != "active" or game.get("winner") or game.get("turn") != "Y":
        return
    board = list(game.get("board") or [""] * 42)
    col = connect_four_cpu_column(board, str(game.get("difficulty") or "medium"), "Y")
    if col is not None:
        connect_four_apply_move(game, col, "Y")


BATTLESHIP_SHIP_LENGTHS = (4, 3, 2)


def random_battleship_ship_groups(size: int = 6) -> list[list[int]]:
    groups: list[list[int]] = []
    occupied: set[int] = set()
    for length in BATTLESHIP_SHIP_LENGTHS:
        for _attempt in range(200):
            horizontal = bool(secrets.randbelow(2))
            max_row = size if horizontal else size - length + 1
            max_col = size - length + 1 if horizontal else size
            row = secrets.randbelow(max_row)
            col = secrets.randbelow(max_col)
            cells = [row * size + col + (step if horizontal else step * size) for step in range(length)]
            if not any(cell in occupied for cell in cells):
                occupied.update(cells)
                groups.append(cells)
                break
    return groups


def flatten_battleship_ship_groups(groups: list[list[int]]) -> list[int]:
    return sorted({cell for group in groups for cell in group})


def public_battleship_payload(game: dict, player_id: str = "") -> dict:
    payload = game.get("payload") or {}
    size = int(payload.get("size") or 6)
    player = find_mobile_player(game, player_id) if player_id else None
    mark = player.get("mark") if player else ""
    opponent = "B" if mark == "A" else "A"
    ships = {key: set(value or []) for key, value in (payload.get("ships") or {}).items()}
    shots = {key: set(value or []) for key, value in (payload.get("shots") or {}).items()}
    complete = game.get("status") == "complete"
    return {
        "size": size,
        "mark": mark,
        "ownShips": sorted(ships.get(mark, set())) if mark else [],
        "ownShipGroups": (payload.get("shipGroups") or {}).get(mark, []) if mark else [],
        "ownShots": sorted(shots.get(mark, set())) if mark else [],
        "opponentShots": sorted(shots.get(opponent, set())) if mark else [],
        "hitsByMe": sorted(shots.get(mark, set()) & ships.get(opponent, set())) if mark else [],
        "hitsOnMe": sorted(shots.get(opponent, set()) & ships.get(mark, set())) if mark else [],
        "opponentShips": sorted(ships.get(opponent, set())) if mark and complete else [],
        "opponentShipGroups": (payload.get("shipGroups") or {}).get(opponent, []) if mark and complete else [],
        "remaining": {
            "A": max(0, len(ships.get("A", set()) - shots.get("B", set()))),
            "B": max(0, len(ships.get("B", set()) - shots.get("A", set()))),
        },
        "lastMove": payload.get("lastMove"),
    }


def battleship_apply_move(game: dict, cell: int, mark: str) -> None:
    payload = game.setdefault("payload", {})
    size = int(payload.get("size") or 6)
    cell = int(cell)
    if cell < 0 or cell >= size * size:
        raise ValueError("Target is outside the board.")
    ships = payload.setdefault("ships", {})
    shots = payload.setdefault("shots", {})
    shots.setdefault(mark, [])
    if cell in shots[mark]:
        raise ValueError("That coordinate was already targeted.")
    shots[mark].append(cell)
    opponent = "B" if mark == "A" else "A"
    payload["lastMove"] = {"mark": mark, "cell": cell, "hit": cell in set(ships.get(opponent, []))}
    if set(ships.get(opponent, [])) and set(ships.get(opponent, [])).issubset(set(shots.get(mark, []))):
        game["winner"] = mark
        game["winningLine"] = []
        game["status"] = "complete"
        record_mobile_game_result(game)
    else:
        game["turn"] = opponent


def battleship_cpu_move(game: dict) -> None:
    if game.get("mode") != "cpu" or game.get("status") != "active" or game.get("winner") or game.get("turn") != "B":
        return
    payload = game.setdefault("payload", {})
    size = int(payload.get("size") or 6)
    shots = set(payload.setdefault("shots", {}).setdefault("B", []))
    moves = [cell for cell in range(size * size) if cell not in shots]
    if moves:
        battleship_apply_move(game, secrets.choice(moves), "B")


def public_hangman_payload(game: dict) -> dict:
    payload = game.get("payload") or {}
    word = str(payload.get("word") or "").upper()
    guessed = sorted(set(payload.get("guessed") or []))
    mask_chars = [char if not char.isalpha() or char in guessed else "_" for char in word]
    return {
        "maskedWord": " ".join(mask_chars),
        "maskedChars": mask_chars,
        "word": word if game.get("status") == "complete" else "",
        "guessed": guessed,
        "wrong": int(payload.get("wrong") or 0),
        "maxWrong": int(payload.get("maxWrong") or 6),
        "lastMove": payload.get("lastMove"),
        "setterMark": payload.get("setterMark") or "",
        "guesserMark": payload.get("guesserMark") or "A",
    }


def clean_hangman_phrase(value: object, fallback: str = "") -> str:
    phrase = re.sub(r"\s+", " ", str(value or "")).strip().upper()
    phrase = re.sub(r"[^A-Z0-9 '\-]", "", phrase)[:48].strip(" '-") or fallback.upper()
    if len(re.findall(r"[A-Z]", phrase)) < 2:
        raise ValueError("Enter a word or phrase with at least two letters.")
    return phrase


def hangman_apply_move(game: dict, letter: str, mark: str) -> None:
    letter = re.sub(r"[^A-Z]", "", str(letter or "").upper())[:1]
    if not letter:
        raise ValueError("Choose a letter.")
    payload = game.setdefault("payload", {})
    word = str(payload.get("word") or "").upper()
    guessed = set(payload.setdefault("guessed", []))
    if letter in guessed:
        raise ValueError("That letter has already been guessed.")
    guessed.add(letter)
    payload["guessed"] = sorted(guessed)
    hit = letter in word
    if not hit:
        payload["wrong"] = int(payload.get("wrong") or 0) + 1
    payload["lastMove"] = {"mark": mark, "letter": letter, "hit": hit}
    if all((not char.isalpha()) or char in guessed for char in word):
        game["winner"] = mark
        game["status"] = "complete"
        record_mobile_game_result(game)
    elif int(payload.get("wrong") or 0) >= int(payload.get("maxWrong") or 6):
        game["winner"] = "B" if game.get("mode") == "cpu" else (payload.get("setterMark") or "A")
        game["status"] = "complete"
        record_mobile_game_result(game)
    else:
        game["turn"] = payload.get("guesserMark") or mark


def word_grid_neighbors(index: int) -> list[int]:
    row = index // 4
    col = index % 4
    return [
        nr * 4 + nc
        for nr in range(row - 1, row + 2)
        for nc in range(col - 1, col + 2)
        if 0 <= nr < 4 and 0 <= nc < 4 and not (nr == row and nc == col)
    ]


def word_grid_min_word_length(difficulty: str) -> int:
    return {"easy": 1, "medium": 2, "hard": 3}.get(str(difficulty or "medium").lower(), 2)


def word_grid_valid_words(letters: list[str], min_word_length: int = 3) -> list[str]:
    letters = [str(letter or "").upper()[:1] for letter in letters]
    if len(letters) != 16:
        return []
    min_word_length = max(1, min(3, int(min_word_length or 3)))
    trie = overland_word_trie()
    found: set[str] = set()

    def walk(index: int, node: dict, used: set[int]) -> None:
        letter = letters[index]
        next_node = node.get(letter)
        if not next_node:
            return
        word = next_node.get("$")
        if word and len(word) >= min_word_length:
            found.add(word)
        used.add(index)
        for neighbor in word_grid_neighbors(index):
            if neighbor not in used:
                walk(neighbor, next_node, used)
        used.remove(index)

    for start in range(16):
        walk(start, trie, set())
    return sorted(found, key=lambda item: (len(item), item))


def word_grid_round_state(payload: dict) -> dict:
    now = time.time()
    start_at = float(payload.get("startAt") or 0)
    end_at = float(payload.get("endAt") or 0)
    return {
        "now": now,
        "startAt": start_at,
        "endAt": end_at,
        "startsIn": max(0, int(round(start_at - now))) if start_at else 0,
        "timeRemaining": max(0, int(round(end_at - now))) if end_at else 0,
        "hidden": bool(start_at and now < start_at),
        "expired": bool(end_at and now >= end_at),
    }


def word_grid_make_letters(min_word_length: int = 3) -> list[str]:
    vowels = list("AAEEIIOOU")
    consonants = list("BCDFGHJKLMNPQRSTVWY")
    best: list[str] = []
    best_count = -1
    for _ in range(80):
        letters = [secrets.choice(vowels) for _ in range(5)] + [secrets.choice(consonants) for _ in range(11)]
        random.shuffle(letters)
        count = len(word_grid_valid_words(letters, min_word_length))
        if count > best_count:
            best = letters
            best_count = count
        if count >= 18:
            break
    return best or [secrets.choice(vowels + consonants) for _ in range(16)]


def word_grid_new_payload(start_at: float = 0, min_word_length: int = 3) -> dict:
    min_word_length = max(1, min(3, int(min_word_length or 3)))
    letters = word_grid_make_letters(min_word_length)
    return {
        "letters": letters,
        "validWords": word_grid_valid_words(letters, min_word_length),
        "minWordLength": min_word_length,
        "found": {"A": [], "B": []},
        "scores": {"A": 0, "B": 0},
        "startAt": float(start_at or 0),
        "endAt": float(start_at + WORD_GRID_ROUND_SECONDS) if start_at else 0,
        "lastMove": None,
    }


def word_grid_word_score(word: str) -> int:
    return len(str(word or ""))


def word_grid_mark_for_player(game: dict, player_id: str = "") -> str:
    player = find_mobile_player(game, player_id) if player_id else None
    return str(player.get("mark") or "") if player else ""


def word_grid_finalize(game: dict) -> bool:
    payload = game.setdefault("payload", {})
    if game.get("status") == "complete":
        return False
    valid_words = set(payload.setdefault("validWords", word_grid_valid_words(payload.get("letters") or [], int(payload.get("minWordLength") or 2))))
    found = payload.setdefault("found", {"A": [], "B": []})
    scores = payload.setdefault("scores", {})
    for mark in ("A", "B"):
        scores[mark] = sum(word_grid_word_score(word) for word in set(found.get(mark) or []) if word in valid_words)
    has_b = any(player.get("mark") == "B" for player in game.get("players", []) if isinstance(player, dict))
    a_score = int(scores.get("A") or 0)
    b_score = int(scores.get("B") or 0)
    game["winner"] = ("draw" if a_score == b_score else ("A" if a_score > b_score else "B")) if has_b else "A"
    game["status"] = "complete"
    record_mobile_game_result(game)
    return True


def public_word_grid_payload(game: dict, player_id: str = "") -> dict:
    payload = game.get("payload") or {}
    state = word_grid_round_state(payload)
    mark = word_grid_mark_for_player(game, player_id)
    complete = game.get("status") == "complete"
    waiting = game.get("status") == "waiting" or not payload.get("startAt")
    hidden = waiting or state["hidden"]
    found = payload.get("found") or {}
    return {
        "letters": [] if hidden else list(payload.get("letters") or []),
        "hidden": hidden,
        "waitingForPlayer": waiting,
        "startsIn": state["startsIn"],
        "timeRemaining": state["timeRemaining"],
        "startAt": state["startAt"],
        "endAt": state["endAt"],
        "roundSeconds": WORD_GRID_ROUND_SECONDS,
        "minWordLength": int(payload.get("minWordLength") or word_grid_min_word_length(game.get("difficulty"))),
        "found": dict(found) if complete else ({mark: list(found.get(mark) or [])} if mark else {}),
        "scores": dict(payload.get("scores") or {}),
        "validWords": list(payload.get("validWords") or []) if complete else [],
        "opponentCount": len(found.get("B" if mark == "A" else "A", [])) if mark else 0,
        "lastMove": payload.get("lastMove"),
    }


def word_grid_apply_move(game: dict, word: str, mark: str) -> None:
    payload = game.setdefault("payload", {})
    state = word_grid_round_state(payload)
    if state["hidden"]:
        raise ValueError("The board is not revealed yet.")
    if state["expired"]:
        word_grid_finalize(game)
        return
    candidate = clean_game_word(word)[:16]
    min_len = int(payload.get("minWordLength") or word_grid_min_word_length(game.get("difficulty")))
    if len(candidate) < min_len:
        raise ValueError(f"Words must be at least {min_len} letter{'s' if min_len != 1 else ''}.")
    valid = payload.setdefault("validWords", word_grid_valid_words(payload.get("letters") or [], min_len))
    if candidate not in valid:
        raise ValueError("That word is not valid on this board.")
    found = payload.setdefault("found", {})
    mark_words = set(found.setdefault(mark, []))
    if candidate in mark_words:
        raise ValueError("You already found that word.")
    mark_words.add(candidate)
    found[mark] = sorted(mark_words)
    payload.setdefault("scores", {})[mark] = sum(word_grid_word_score(item) for item in mark_words)
    payload["lastMove"] = {"mark": mark, "word": candidate}


def public_pattern_payload(game: dict) -> dict:
    payload = game.get("payload") or {}
    sequence = [int(item) for item in payload.get("sequence", []) if str(item).isdigit()]
    score = int((payload.get("scores") or {}).get("A") or 0)
    return {
        "sequence": sequence,
        "scores": dict(payload.get("scores") or {}),
        "score": score,
        "round": max(1, len(sequence)),
        "speedMs": max(240, 640 - max(0, len(sequence) - 1) * 24),
        "lastMove": payload.get("lastMove"),
    }


def pattern_apply_move(game: dict, pattern: str, mark: str) -> None:
    payload = game.setdefault("payload", {})
    sequence = [int(item) for item in payload.get("sequence", []) if str(item).isdigit()]
    attempt = [int(item) for item in re.findall(r"[0-3]", str(pattern or ""))]
    if attempt != sequence:
        game["winner"] = mark
        game["status"] = "complete"
        payload["lastMove"] = {"mark": mark, "success": False, "attempt": attempt}
        record_mobile_game_result(game)
        return
    scores = payload.setdefault("scores", {})
    scores[mark] = int(scores.get(mark) or 0) + 1
    sequence.append(secrets.randbelow(4))
    payload["sequence"] = sequence
    payload["lastMove"] = {"mark": mark, "success": True}


def claimline_player_mark(index: int) -> str:
    return f"P{max(1, min(CLAIMLINE_MAX_PLAYERS, int(index) + 1))}"


def claimline_index(x: int, y: int) -> int:
    return y * CLAIMLINE_COLS + x


def claimline_xy(index: int) -> tuple[int, int]:
    return index % CLAIMLINE_COLS, index // CLAIMLINE_COLS


def claimline_new_grid() -> str:
    grid = ["." for _ in range(CLAIMLINE_COLS * CLAIMLINE_ROWS)]
    for y in range(CLAIMLINE_ROWS):
        for x in range(CLAIMLINE_COLS):
            if x in {0, CLAIMLINE_COLS - 1} or y in {0, CLAIMLINE_ROWS - 1}:
                grid[claimline_index(x, y)] = "#"
    return "".join(grid)


def claimline_new_payload(mode: str = "timed-battle", duration: int = 120) -> dict:
    try:
        duration = max(60, min(300, int(duration or 120)))
    except (TypeError, ValueError):
        duration = 120
    return {
        "cols": CLAIMLINE_COLS,
        "rows": CLAIMLINE_ROWS,
        "grid": claimline_new_grid(),
        "trails": {},
        "inputs": {},
        "states": {},
        "hazards": [
            {"x": CLAIMLINE_COLS // 2, "y": CLAIMLINE_ROWS // 2, "dx": 1, "dy": 1},
            {"x": CLAIMLINE_COLS // 2 - 12, "y": CLAIMLINE_ROWS // 2 + 8, "dx": -1, "dy": 1},
        ],
        "duration": duration,
        "startedAt": 0,
        "lastStepAt": time.time(),
        "lastEvent": "",
        "maxPlayers": CLAIMLINE_MAX_PLAYERS,
    }


def claimline_mark_digit(mark: str) -> str:
    try:
        return str(max(1, min(CLAIMLINE_MAX_PLAYERS, int(str(mark).replace("P", "") or "1"))))
    except (TypeError, ValueError):
        return "1"


def claimline_init_player(game: dict, mark: str, name: str = "Player") -> None:
    payload = game.setdefault("payload", claimline_new_payload(game.get("mode", "timed-battle")))
    states = payload.setdefault("states", {})
    if mark in states:
        return
    index = max(0, min(CLAIMLINE_MAX_PLAYERS - 1, int(str(mark).replace("P", "") or "1") - 1))
    x, y = CLAIMLINE_STARTS[index]
    states[mark] = {
        "name": clean_player_name(name or mark),
        "x": x,
        "y": y,
        "dir": "right" if x < CLAIMLINE_COLS // 2 else "left",
        "drawing": False,
        "lives": 3,
        "deaths": 0,
        "captures": 0,
        "capturedCells": 0,
        "score": 0,
        "alive": True,
        "stunnedUntil": 0,
    }
    payload.setdefault("inputs", {})[mark] = {"dir": states[mark]["dir"], "draw": False}
    payload.setdefault("trails", {})[mark] = []


def claimline_grid_list(payload: dict) -> list[str]:
    grid = str(payload.get("grid") or "")
    if len(grid) != CLAIMLINE_COLS * CLAIMLINE_ROWS:
        grid = claimline_new_grid()
    return list(grid)


def claimline_public_payload(game: dict, player_id: str = "") -> dict:
    payload = game.get("payload") if isinstance(game.get("payload"), dict) else {}
    grid = str(payload.get("grid") or claimline_new_grid())
    total = max(1, (CLAIMLINE_COLS - 2) * (CLAIMLINE_ROWS - 2))
    ownership = {}
    for mark in [str(player.get("mark") or "") for player in game.get("players", []) if isinstance(player, dict)]:
        claimed = grid.count(claimline_mark_digit(mark))
        ownership[mark] = {"cells": claimed, "percent": round((claimed / total) * 100, 1)}
    return {
        "cols": int(payload.get("cols") or CLAIMLINE_COLS),
        "rows": int(payload.get("rows") or CLAIMLINE_ROWS),
        "grid": grid,
        "trails": payload.get("trails") if isinstance(payload.get("trails"), dict) else {},
        "states": payload.get("states") if isinstance(payload.get("states"), dict) else {},
        "hazards": payload.get("hazards") if isinstance(payload.get("hazards"), list) else [],
        "duration": int(payload.get("duration") or 0),
        "startedAt": float(payload.get("startedAt") or 0),
        "now": time.time(),
        "ownership": ownership,
        "lastEvent": str(payload.get("lastEvent") or ""),
    }


def claimline_cell_safe(cell: str, mark: str) -> bool:
    return cell == "#" or cell == claimline_mark_digit(mark)


def claimline_kill_player(payload: dict, mark: str, reason: str = "trail hit") -> None:
    state = payload.setdefault("states", {}).get(mark)
    if not isinstance(state, dict) or not state.get("alive", True):
        return
    state["deaths"] = int(state.get("deaths") or 0) + 1
    state["lives"] = max(0, int(state.get("lives") or 0) - 1)
    state["drawing"] = False
    payload.setdefault("trails", {})[mark] = []
    if state["lives"] <= 0:
        state["alive"] = False
    else:
        index = max(0, min(CLAIMLINE_MAX_PLAYERS - 1, int(str(mark).replace("P", "") or "1") - 1))
        state["x"], state["y"] = CLAIMLINE_STARTS[index]
        state["stunnedUntil"] = time.time() + 1.2
    payload["lastEvent"] = f"{mark} lost a life: {reason}"


def claimline_component_cells(grid: list[str], blocked: set[int], start_index: int, players_by_index: dict[int, str]) -> tuple[set[int], bool]:
    stack = [start_index]
    seen = {start_index}
    has_player = start_index in players_by_index
    while stack:
        index = stack.pop()
        x, y = claimline_xy(index)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if nx <= 0 or nx >= CLAIMLINE_COLS - 1 or ny <= 0 or ny >= CLAIMLINE_ROWS - 1:
                continue
            ni = claimline_index(nx, ny)
            if ni in seen or ni in blocked or grid[ni] != ".":
                continue
            seen.add(ni)
            if ni in players_by_index:
                has_player = True
            stack.append(ni)
    return seen, has_player


def claimline_finish_capture(payload: dict, mark: str, trail: list) -> int:
    grid = claimline_grid_list(payload)
    digit = claimline_mark_digit(mark)
    trail_set = {int(item) for item in trail if isinstance(item, int) or str(item).isdigit()}
    if not trail_set:
        return 0
    blocked = {i for i, cell in enumerate(grid) if cell != "."} | trail_set
    players_by_index = {}
    for other_mark, state in payload.setdefault("states", {}).items():
        if not isinstance(state, dict) or other_mark == mark or not state.get("alive", True):
            continue
        players_by_index[claimline_index(int(state.get("x") or 0), int(state.get("y") or 0))] = other_mark
    components = []
    player_free_components = []
    visited: set[int] = set()
    for i, cell in enumerate(grid):
        if cell != "." or i in blocked or i in visited:
            continue
        cells, has_player = claimline_component_cells(grid, blocked, i, players_by_index)
        visited |= cells
        components.append(cells)
        if not has_player:
            player_free_components.append(cells)
    capture = min(player_free_components, key=len) if len(components) >= 2 and player_free_components else set()
    for i in trail_set | capture:
        if 0 <= i < len(grid):
            grid[i] = digit
    payload["grid"] = "".join(grid)
    state = payload.setdefault("states", {}).get(mark, {})
    captured = len(capture) + len(trail_set)
    state["captures"] = int(state.get("captures") or 0) + 1
    state["capturedCells"] = int(state.get("capturedCells") or 0) + captured
    state["score"] = int(state.get("score") or 0) + captured * 5 + max(0, 200 - len(trail_set))
    payload["lastEvent"] = f"{mark} captured {captured} cells"
    return captured


def claimline_move_player(payload: dict, mark: str) -> None:
    states = payload.setdefault("states", {})
    state = states.get(mark)
    if not isinstance(state, dict) or not state.get("alive", True):
        return
    now = time.time()
    if now < float(state.get("stunnedUntil") or 0):
        return
    inputs = payload.setdefault("inputs", {}).get(mark, {})
    direction = inputs.get("dir") if inputs.get("dir") in CLAIMLINE_DIRS else state.get("dir", "right")
    dx, dy = CLAIMLINE_DIRS[direction]
    x = max(0, min(CLAIMLINE_COLS - 1, int(state.get("x") or 0) + dx))
    y = max(0, min(CLAIMLINE_ROWS - 1, int(state.get("y") or 0) + dy))
    index = claimline_index(x, y)
    grid = claimline_grid_list(payload)
    cell = grid[index]
    trails = payload.setdefault("trails", {})
    trail = trails.setdefault(mark, [])
    wants_draw = bool(inputs.get("draw"))
    drawing = bool(state.get("drawing"))
    other_trail_indexes = {
        int(item)
        for other_mark, other_trail in trails.items()
        if other_mark != mark and isinstance(other_trail, list)
        for item in other_trail
        if isinstance(item, int) or str(item).isdigit()
    }
    if index in other_trail_indexes:
        claimline_kill_player(payload, mark, "crossed a trail")
        return
    if drawing and claimline_cell_safe(cell, mark):
        claimline_finish_capture(payload, mark, trail)
        trail.clear()
        drawing = False
    elif drawing and index in {int(item) for item in trail if isinstance(item, int) or str(item).isdigit()}:
        claimline_kill_player(payload, mark, "hit own trail")
        return
    elif wants_draw and cell == ".":
        drawing = True
        if index not in trail:
            trail.append(index)
    elif cell == "." and not drawing:
        return
    state["x"] = x
    state["y"] = y
    state["dir"] = direction
    state["drawing"] = drawing


def claimline_move_hazards(payload: dict) -> None:
    grid = claimline_grid_list(payload)
    trails = payload.setdefault("trails", {})
    for hazard in payload.setdefault("hazards", []):
        if not isinstance(hazard, dict):
            continue
        x = int(hazard.get("x") or 1)
        y = int(hazard.get("y") or 1)
        dx = int(hazard.get("dx") or 1) or 1
        dy = int(hazard.get("dy") or 1) or 1
        nx, ny = x + dx, y + dy
        if nx <= 0 or nx >= CLAIMLINE_COLS - 1 or grid[claimline_index(nx, y)] != ".":
            dx *= -1
            nx = x + dx
        if ny <= 0 or ny >= CLAIMLINE_ROWS - 1 or grid[claimline_index(x, ny)] != ".":
            dy *= -1
            ny = y + dy
        nx = max(1, min(CLAIMLINE_COLS - 2, nx))
        ny = max(1, min(CLAIMLINE_ROWS - 2, ny))
        hazard.update({"x": nx, "y": ny, "dx": dx, "dy": dy})
        h_index = claimline_index(nx, ny)
        for mark, trail in list(trails.items()):
            if h_index in [int(item) for item in trail if isinstance(item, int) or str(item).isdigit()]:
                claimline_kill_player(payload, mark, "hazard hit trail")


def claimline_advance(game: dict) -> None:
    payload = game.setdefault("payload", claimline_new_payload(game.get("mode", "timed-battle")))
    if game.get("status") != "active":
        return
    now = time.time()
    if not payload.get("startedAt"):
        payload["startedAt"] = now + (0 if game.get("mode") == "solo" else 3)
        payload["lastStepAt"] = now
        return
    if now < float(payload.get("startedAt") or 0):
        return
    elapsed = now - float(payload.get("lastStepAt") or now)
    steps = max(0, min(6, int(elapsed / CLAIMLINE_TICK_SECONDS)))
    if steps <= 0:
        return
    payload["lastStepAt"] = float(payload.get("lastStepAt") or now) + steps * CLAIMLINE_TICK_SECONDS
    for _step in range(steps):
        for player in game.get("players", []):
            if isinstance(player, dict):
                claimline_move_player(payload, str(player.get("mark") or ""))
        claimline_move_hazards(payload)
    claimline_sync_status(game)


def claimline_winner_mark(game: dict) -> str:
    payload = game.get("payload") if isinstance(game.get("payload"), dict) else {}
    grid = str(payload.get("grid") or "")
    states = payload.get("states") if isinstance(payload.get("states"), dict) else {}
    best = None
    best_mark = "draw"
    for player in game.get("players", []):
        if not isinstance(player, dict):
            continue
        mark = str(player.get("mark") or "")
        state = states.get(mark) if isinstance(states.get(mark), dict) else {}
        score_tuple = (grid.count(claimline_mark_digit(mark)), int(state.get("captures") or 0), -int(state.get("deaths") or 0), int(state.get("score") or 0))
        if best is None or score_tuple > best:
            best = score_tuple
            best_mark = mark
    return best_mark


def claimline_sync_status(game: dict) -> None:
    if game.get("type") != "claimline" or game.get("status") != "active":
        return
    payload = game.setdefault("payload", claimline_new_payload(game.get("mode", "timed-battle")))
    states = payload.setdefault("states", {})
    now = time.time()
    duration = int(payload.get("duration") or 0)
    alive = [mark for mark, state in states.items() if isinstance(state, dict) and state.get("alive", True)]
    if game.get("mode") == "solo" and len(alive) < 1:
        game["winner"] = claimline_winner_mark(game)
        game["status"] = "complete"
    elif game.get("mode") == "elimination" and len(alive) <= 1 and len(game.get("players", [])) > 1:
        game["winner"] = alive[0] if alive else "draw"
        game["status"] = "complete"
    elif duration and payload.get("startedAt") and now >= float(payload.get("startedAt") or 0) + duration:
        game["winner"] = claimline_winner_mark(game)
        game["status"] = "complete"


def claimline_set_input(game: dict, player: dict, form: dict) -> None:
    payload = game.setdefault("payload", claimline_new_payload(game.get("mode", "timed-battle")))
    mark = str(player.get("mark") or "")
    direction = str(form_value(form, "direction", "") or "").lower()
    current = payload.setdefault("inputs", {}).setdefault(mark, {"dir": "right", "draw": False})
    if direction in CLAIMLINE_DIRS:
        current["dir"] = direction
    current["draw"] = str(form_value(form, "draw", "0")).lower() in {"1", "true", "yes", "on"}
    claimline_advance(game)


def public_mobile_game(game: dict, player_id: str = "") -> dict:
    game_type = game.get("type") or "tic-tac-toe"
    payload = {
        "id": game.get("id"),
        "type": game_type,
        "title": game.get("title") or MOBILE_GAME_TITLES.get(game_type, "Game"),
        "mode": game.get("mode") or "pvp",
        "difficulty": game.get("difficulty") or "medium",
        "status": game.get("status") or "waiting",
        "players": public_mobile_players(game),
        "turn": game.get("turn") or ("w" if game_type == "chess" else "red" if game_type == "checkers" else "A"),
        "winner": game.get("winner") or "",
        "winningLine": game.get("winningLine") or [],
        "created": game.get("created") or "",
        "updated": game.get("updated") or "",
    }
    if game_type == "checkers":
        payload["payload"] = public_checkers_payload(game)
    elif game_type == "claimline":
        payload["payload"] = claimline_public_payload(game, player_id)
    elif game_type == "chess":
        payload.update({"fen": game.get("fen") or "", "history": list(game.get("history") or []), "result": game.get("result") or "", "check": bool(game.get("check"))})
    elif game_type == "dots-and-boxes":
        payload.update({"size": int(game.get("size") or 4), "edges": list(game.get("edges") or []), "boxes": list(game.get("boxes") or []), "scores": dict(game.get("scores") or {}), "lastMove": game.get("lastMove")})
    elif game_type == "connect-four":
        payload["board"] = list(game.get("board") or [""] * 42)
    elif game_type == "battleship":
        payload["payload"] = public_battleship_payload(game, player_id)
    elif game_type == "hangman":
        payload["payload"] = public_hangman_payload(game)
    elif game_type == "word-grid":
        payload["payload"] = public_word_grid_payload(game, player_id)
    elif game_type == "pattern-match":
        payload["payload"] = public_pattern_payload(game)
    elif game_type == "word-tile-arena":
        payload["payload"] = word_tile_public_payload(game, player_id)
    elif game_type in {"blank-slate", "blockfall"}:
        payload["payload"] = game.get("payload") or {}
    else:
        payload["board"] = list(game.get("board") or [""] * 9)
    return payload


def timestamp() -> str:
    return datetime.now().isoformat(timespec="seconds")


def map_pack_job_snapshot(pack_id: str | None = None) -> dict[str, object]:
    with MAP_PACK_JOBS_LOCK:
        if pack_id:
            return dict(MAP_PACK_JOBS.get(pack_id, {}))
        return {key: dict(value) for key, value in MAP_PACK_JOBS.items()}


def update_map_pack_job(pack_id: str, **updates: object) -> dict[str, object]:
    with MAP_PACK_JOBS_LOCK:
        job = dict(MAP_PACK_JOBS.get(pack_id, {}))
        job.update(updates)
        job["id"] = pack_id
        job["updated_at"] = timestamp()
        MAP_PACK_JOBS[pack_id] = job
        return dict(job)


def overlay_job_snapshot(job_id: str | None = None) -> dict[str, object]:
    with OVERLAY_JOBS_LOCK:
        if job_id:
            return dict(OVERLAY_JOBS.get(job_id, {}))
        return {key: dict(value) for key, value in OVERLAY_JOBS.items()}


def update_overlay_job(job_id: str, **updates: object) -> dict[str, object]:
    with OVERLAY_JOBS_LOCK:
        job = dict(OVERLAY_JOBS.get(job_id, {}))
        if "progress" in updates and "progress_pct" not in updates:
            updates["progress_pct"] = updates["progress"]
        job.update(updates)
        job["id"] = job_id
        job["updated_at"] = timestamp()
        OVERLAY_JOBS[job_id] = job
        return dict(job)


def display_title(path: Path) -> str:
    return path.stem.replace("_", " ").replace("-", " ").strip() or path.name


def synchsafe(value: bytes) -> int:
    result = 0
    for byte in value:
        result = (result << 7) | (byte & 0x7F)
    return result


def decode_id3_text(value: bytes) -> str:
    if not value:
        return ""
    encoding = value[0]
    payload = value[1:]
    if encoding == 0:
        text = payload.decode("latin-1", errors="replace")
    elif encoding == 1:
        text = payload.decode("utf-16", errors="replace")
    elif encoding == 2:
        text = payload.decode("utf-16-be", errors="replace")
    else:
        text = payload.decode("utf-8", errors="replace")
    return text.strip("\x00").strip()


def encoded_null_index(value: bytes, encoding: int) -> int:
    marker = b"\x00\x00" if encoding in (1, 2) else b"\x00"
    index = value.find(marker)
    return len(value) if index < 0 else index + len(marker)


def parse_apic(frame_data: bytes, want_cover: bool = False) -> dict | bool | None:
    if not frame_data:
        return None
    encoding = frame_data[0]
    rest = frame_data[1:]
    mime_end = rest.find(b"\x00")
    if mime_end < 0:
        return None
    mime = rest[:mime_end].decode("latin-1", errors="replace") or "image/jpeg"
    after_mime = rest[mime_end + 1 :]
    if not after_mime:
        return None
    after_type = after_mime[1:]
    desc_end = encoded_null_index(after_type, encoding)
    image_data = after_type[desc_end:]
    if not image_data:
        return None
    return {"mime": mime, "data": image_data} if want_cover else True


def id3_metadata(path: Path, want_cover: bool = False) -> dict:
    if path.suffix.lower() != ".mp3":
        return {}
    metadata = {}
    try:
        with path.open("rb") as handle:
            header = handle.read(10)
            if len(header) != 10 or header[:3] != b"ID3":
                return metadata
            major = header[3]
            tag_size = synchsafe(header[6:10])
            tag = handle.read(tag_size)
    except OSError:
        return metadata

    offset = 0
    while offset + 10 <= len(tag):
        frame_id = tag[offset : offset + 4].decode("latin-1", errors="ignore")
        if not frame_id.strip("\x00"):
            break
        raw_size = tag[offset + 4 : offset + 8]
        frame_size = synchsafe(raw_size) if major == 4 else int.from_bytes(raw_size, "big")
        frame_start = offset + 10
        frame_end = frame_start + frame_size
        if frame_size <= 0 or frame_end > len(tag):
            break
        frame_data = tag[frame_start:frame_end]
        if frame_id in TEXT_FRAMES:
            value = decode_id3_text(frame_data)
            if value:
                metadata[TEXT_FRAMES[frame_id]] = value
        elif frame_id == "APIC":
            parsed = parse_apic(frame_data, want_cover=want_cover)
            if parsed:
                if want_cover:
                    metadata["cover"] = parsed
                else:
                    metadata["hasCover"] = True
        offset = frame_end
    return metadata


def cover_extension(mime: str) -> str:
    lowered = (mime or "").lower()
    if "png" in lowered:
        return ".png"
    if "webp" in lowered:
        return ".webp"
    return ".jpg"


def thumbnail_cover_bytes(image_data: bytes) -> bytes | None:
    if Image is None:
        return None
    try:
        with Image.open(io.BytesIO(image_data)) as image:
            image.thumbnail((COVER_MAX_PIXELS, COVER_MAX_PIXELS))
            if image.mode not in ("RGB", "L"):
                image = image.convert("RGB")
            output = io.BytesIO()
            image.save(output, format="JPEG", quality=COVER_JPEG_QUALITY, optimize=True)
            return output.getvalue()
    except Exception:
        return None


def start_map_pack_install(settings: Settings, pack_id: str, reason: str = "manual") -> dict[str, object]:
    pack_id = str(pack_id or "").strip()
    if not pack_id:
        raise ValueError("Map pack id is required.")
    current = map_pack_job_snapshot(pack_id)
    if current.get("status") in {"pending", "running"}:
        return current

    job = update_map_pack_job(
        pack_id,
        status="pending",
        reason=reason,
        error="",
        progress=0,
        started_at=timestamp(),
    )

    def worker() -> None:
        update_map_pack_job(pack_id, status="running", progress=5)
        try:
            handler = object.__new__(OIABHandler)
            handler.settings = settings
            result = handler.install_map_pack_sync(pack_id)
            update_map_pack_job(pack_id, status="succeeded", progress=100, error="", result=result)
        except Exception as exc:  # noqa: BLE001 - background job boundary
            update_map_pack_job(pack_id, status="failed", progress=100, error=str(exc))

    thread = threading.Thread(target=worker, name=f"oiab-map-pack-{pack_id}", daemon=True)
    thread.start()
    return job


def start_mvum_install(settings: Settings, kind: str) -> dict[str, object]:
    kind = str(kind or "").strip().lower()
    if kind not in {"roads", "trails"}:
        raise ValueError("MVUM install kind must be roads or trails.")
    overlay_id = f"mvum_{kind}_us"
    job_id = f"{overlay_id}_install"
    current = overlay_job_snapshot(job_id)
    if current.get("status") in {"pending", "running"}:
        return current
    job = update_overlay_job(
        job_id,
        overlay_id=overlay_id,
        status="pending",
        step="queued",
        progress=0,
        error_message="",
        started_at=timestamp(),
        output_path="",
        size_bytes=0,
    )

    def worker() -> None:
        update_overlay_job(job_id, status="running", step="starting", progress=2)
        try:
            handler = object.__new__(OIABHandler)
            handler.settings = settings
            result = handler.install_mvum_overlay_sync(kind, job_id)
            update_overlay_job(
                job_id,
                status="succeeded",
                step="complete",
                progress=100,
                error_message="",
                output_path=result.get("output_path", ""),
                size_bytes=result.get("size_bytes", 0),
                feature_count=result.get("feature_count", 0),
                result=result,
            )
        except Exception as exc:  # noqa: BLE001 - background job boundary
            update_overlay_job(job_id, status="failed", step="failed", progress=100, error_message=str(exc))
            handler = object.__new__(OIABHandler)
            handler.settings = settings
            try:
                handler.app_db().update_map_overlay_metadata(overlay_id, {"install_status": "failed", "cache_status": "failed", "error_message": str(exc)})
            except Exception:
                pass

    thread = threading.Thread(target=worker, name=f"oiab-{job_id}", daemon=True)
    thread.start()
    return job


def ensure_default_world_map(settings: Settings) -> dict[str, object]:
    db = AppDB(settings)
    registry = db.map_pack_registry()
    active_id = registry.get("active")
    if active_id:
        active = next((pack for pack in registry.get("basemaps", []) if pack.get("id") == active_id and pack.get("installed")), None)
        if active:
            return {"ok": True, "status": "active_exists", "active": active_id}

    world_file = settings.data_dir / "maps" / "packs" / "world-overview.pmtiles"
    if world_file.exists() and world_file.is_file() and world_file.stat().st_size > 0:
        db.upsert_map_pack(
            {
                "id": "world_overview",
                "name": "World Overview",
                "type": "pmtiles",
                "path": str(world_file),
                "url": "/maps/packs/world-overview.pmtiles",
                "style": "/maps-v2/map-style.json",
                "attribution": "© OpenStreetMap contributors; Protomaps",
            },
            active=True,
        )
        return {"ok": True, "status": "registered_existing_world_overview", "active": "world_overview"}

    if settings.auto_install_world_map:
        job = start_map_pack_install(settings, "world_overview", reason="bootstrap")
        return {"ok": True, "status": "install_started", "job": job}
    return {"ok": True, "status": "auto_install_disabled"}


def start_track_recorder(settings: Settings) -> threading.Thread:
    def worker() -> None:
        db = AppDB(settings)
        while True:
            try:
                location = read_gpsd(timeout=0.7)
                db.record_location_point(location)
            except Exception as exc:  # noqa: BLE001 - background recorder must keep running
                if settings.dev_mode:
                    print(f"OIAB track recorder error: {exc}")
            time.sleep(1)

    thread = threading.Thread(target=worker, name="oiab-track-recorder", daemon=True)
    thread.start()
    return thread


class OIABHandler(BaseHTTPRequestHandler):
    server_version = "OIAB/0.1"
    settings: Settings = SETTINGS

    def log_message(self, fmt: str, *args: object) -> None:
        if self.settings.dev_mode:
            super().log_message(fmt, *args)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = unquote(parsed.path)

        if path in {"/generate_204", "/gen_204"}:
            self.send_response(HTTPStatus.NO_CONTENT)
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return
        if path == "/hotspot-detect.html":
            return self.send_text("<HTML><HEAD><TITLE>Success</TITLE></HEAD><BODY>Success</BODY></HTML>", "text/html; charset=utf-8")
        if path == "/connecttest.txt":
            return self.send_text("Microsoft Connect Test", "text/plain; charset=utf-8")
        if path == "/ncsi.txt":
            return self.send_text("Microsoft NCSI", "text/plain; charset=utf-8")
        if path in {"/api/health", "/health"}:
            return self.send_json({"ok": True, "name": "Overland In A Box", "time": datetime.now().isoformat()})
        if path in {"/api/config", "/oiab-config"}:
            return self.send_json(self.config_payload())
        if path in {"/api/location/current", "/maps-location-current"}:
            location = read_gpsd()
            try:
                self.app_db().record_location_point(location)
            except Exception as exc:  # noqa: BLE001 - location polling must not fail because recording did
                if self.settings.dev_mode:
                    print(f"Track recording skipped: {exc}")
            return self.send_json(location)
        if path in {"/api/maps-v2/map-packs", "/maps-v2-map-packs"}:
            return self.send_json(self.map_packs())
        if path in {"/api/maps/packs/catalog", "/maps-packs-catalog"}:
            return self.send_json(self.map_pack_catalog())
        if path in {"/api/maps/packs/installed", "/api/maps/packs/status", "/api/maps/packs"}:
            return self.send_json(self.map_packs())
        if path in {"/api/maps/overlays/catalog", "/maps-overlays-catalog"}:
            return self.send_json(self.app_db().map_overlay_catalog())
        if path in {"/api/maps/overlays", "/api/maps/overlays/installed", "/api/maps/overlays/status", "/maps-overlays"}:
            return self.send_json(self.map_overlays())
        if path == "/api/maps/overlays/jobs":
            return self.send_json({"ok": True, "jobs": overlay_job_snapshot()})
        if path.startswith("/api/maps/overlays/jobs/"):
            job_id = path.rstrip("/").rsplit("/", 1)[-1]
            job = overlay_job_snapshot(job_id)
            return self.send_json({"ok": bool(job), "job": job}, status=200 if job else 404)
        if path in {"/api/maps/packs/diagnostics", "/api/maps/pmtiles/diagnostics"}:
            return self.send_json(self.pmtiles_diagnostics())
        if path in {"/api/maps/packs/tile-check", "/api/maps/pmtiles/tile-check"}:
            return self.send_json(self.pmtiles_tile_check(parsed))
        if path in {"/api/maps/packs/range-check", "/api/maps/pmtiles/range-check"}:
            return self.send_json(self.pmtiles_range_check(parsed))
        if path in {"/api/map-data", "/maps-data"}:
            places = read_places(self.settings)
            folders = self.app_db().folders() or folders_from_places(places)
            return self.send_json({"ok": True, "places": places, "folders": folders})
        if path in {"/api/maps/data/manage", "/maps-data-manage"}:
            return self.send_json(self.app_db().manage_data_snapshot())
        if path in {"/api/maps/data/export.geojson", "/maps-data-export.geojson"}:
            return self.send_download(
                "oiab-map-data.geojson",
                json.dumps(self.app_db().places_geojson(), indent=2).encode("utf-8"),
                "application/geo+json; charset=utf-8",
            )
        if path in {"/api/maps/data/export.gpx", "/maps-data-export.gpx"}:
            return self.send_download(
                "oiab-map-data.gpx",
                self.app_db().export_gpx().encode("utf-8"),
                "application/gpx+xml; charset=utf-8",
            )
        if path in {"/api/tracks/current", "/maps-tracks-current"}:
            return self.send_json(self.current_track())
        if path in {"/api/services", "/services-status"}:
            return self.send_json({"ok": True, "services": list_services(self.settings), "allow_docker_control": self.settings.allow_docker_control})
        if path in {"/api/containers", "/containers-status"}:
            return self.send_json(docker_containers(self.settings))
        if path in {"/api/system/status", "/system-status"}:
            return self.send_json(self.system_status())
        if path in {"/api/settings/app", "/settings/app"}:
            return self.send_json(self.app_settings_payload())
        if path in {"/api/settings/network", "/settings/network"}:
            return self.send_json(self.network_settings_payload())
        if path in {"/overland-https-admin", "/api/https-admin"}:
            return self.handle_https_admin({"action": "status"})
        if path in {"/music-api/library", "/api/music/library"}:
            refresh = "refresh=1" in parsed.query
            return self.send_json(self.music_library(refresh=refresh))
        if path in {"/music-api/visualizer-images", "/api/music/visualizer-images"}:
            return self.send_json(self.visualizer_images())
        if path in {"/roms-api/library", "/api/roms"}:
            return self.send_json(self.rom_library())
        if path in {"/mobile-games", "/api/mobile-games"}:
            return self.send_json({"ok": True, "games": self.open_games()})
        if path in {"/game-stats", "/api/game-stats"}:
            return self.send_json({"ok": True, "scoreboard": self.scoreboard()})
        if path in {"/license-plates", "/api/license-plates"}:
            return self.send_json(self.license_plates())
        if path in {"/api/uploads/trivia-questions", "/api/trivia/questions"}:
            return self.send_json(self.trivia_question_files())
        if path in {"/api/uploads/targets", "/api/uploads/categories"}:
            return self.send_json({"ok": True, "targets": self.upload_targets()})
        if path in {"/api/uploads/list", "/api/uploads/files"}:
            target = parse_qs(parsed.query).get("target", ["uploads"])[-1]
            return self.send_json(self.upload_files(target))
        if path in {"/maps/overland/trivia/questions/manifest.json", "/trivia/questions/manifest.json"}:
            return self.send_json(self.trivia_manifest())
        if path in {"/api/apps", "/overland/apps.json", "/maps/overland/apps.json"}:
            return self.send_json(self.apps_payload())
        if path == "/app-layout":
            return self.send_json({"ok": True, "layout": self.app_layout()})
        if path in {"/books-admin", "/books-admin/"}:
            self.send_response(HTTPStatus.FOUND)
            self.send_header("Set-Cookie", "komga_admin=1; Path=/books; SameSite=Lax")
            self.send_header("Location", "/books/")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            return
        if path in {"/books-reader", "/books-reader/"}:
            self.send_response(HTTPStatus.FOUND)
            self.send_header("Set-Cookie", "komga_admin=; Max-Age=0; Path=/books; SameSite=Lax")
            self.send_header("Location", "/books/")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            return
        if path == "/books":
            return self.redirect_to_url("/books/")
        if path.startswith("/books/"):
            return self.proxy_komga()
        if path.startswith("/apps/filebrowser"):
            return self.redirect_to_service(self.settings.filebrowser_url, str(self.settings.filebrowser_port))
        if path.startswith("/apps/minecraft-map"):
            return self.redirect_to_service(self.settings.minecraft_map_url, str(self.settings.minecraft_map_port))
        if path.startswith("/apps/minecraft-admin"):
            return self.redirect_to_service(self.settings.minecraft_admin_url, str(self.settings.minecraft_admin_port))
        if path.startswith("/apps/jellyfin"):
            return self.redirect_to_service(self.settings.jellyfin_url, os.environ.get("JELLYFIN_PORT", "8096"))
        if path.startswith("/apps/komga"):
            return self.redirect_to_url("/books/")
        if path.startswith("/apps/wiki"):
            return self.redirect_to_service(self.settings.kiwix_url, os.environ.get("KIWIX_PORT", "8081"))
        if path.startswith("/apps/minecraft-wiki") or path.startswith("/apps/pokemon-wiki"):
            static = self.resolve_static(path)
            if static:
                return self.serve_file(static)
            return self.redirect_to_service(self.settings.kiwix_url, os.environ.get("KIWIX_PORT", "8081"))
        if path.startswith("/apps/minecraft"):
            return self.redirect_to_service(self.settings.minecraft_admin_url, str(self.settings.minecraft_admin_port))

        static = self.resolve_static(path)
        if static:
            return self.serve_file(static)
        self.send_error(HTTPStatus.NOT_FOUND, "Not found")

    def do_HEAD(self) -> None:
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        static = self.resolve_static(path)
        if static and static.exists() and static.is_file():
            file_size = static.stat().st_size
            content_type = mimetypes.guess_type(str(static))[0] or "application/octet-stream"
            range_header = self.headers.get("Range")
            start, end = 0, file_size - 1
            status = HTTPStatus.OK
            if range_header and range_header.startswith("bytes="):
                try:
                    range_value = range_header.split("=", 1)[1]
                    start_s, end_s = range_value.split("-", 1)
                    start = int(start_s) if start_s else 0
                    end = int(end_s) if end_s else file_size - 1
                    end = min(end, file_size - 1)
                    if start > end:
                        raise ValueError
                    status = HTTPStatus.PARTIAL_CONTENT
                except ValueError:
                    self.send_error(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                    return
            self.send_response(status)
            self.send_static_headers(static, content_type, end - start + 1)
            if status == HTTPStatus.PARTIAL_CONTENT:
                self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
            self.end_headers()
            return
        if path in {"/api/health", "/health"}:
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            return
        self.send_error(HTTPStatus.NOT_FOUND, "Not found")

    def redirect_to_port(self, port: str) -> None:
        host = self.headers.get("Host", self.settings.hostname).split(":", 1)[0]
        target = f"http://{host}:{port}/"
        self.redirect_to_url(target)

    def redirect_to_service(self, configured_url: str, fallback_port: str) -> None:
        if configured_url:
            host = self.headers.get("Host", self.settings.hostname).split(":", 1)[0]
            parts = host.split(".")
            domain = ".".join(parts[1:]) if len(parts) > 2 and parts[0] in {"overland", "mobile", "maps", "music", "files", "jellyfin", "komga", "wiki", "minecraft-map", "minecraft-admin"} else host
            target = configured_url.replace("{host}", host).replace("{hostname}", host).replace("{overland_domain}", domain)
            return self.redirect_to_url(target)
        return self.redirect_to_port(fallback_port)

    def redirect_to_url(self, target: str) -> None:
        self.send_response(HTTPStatus.FOUND)
        self.send_header("Location", target)
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()

    def app_settings_payload(self) -> dict[str, object]:
        db = self.app_db()
        return {
            "ok": True,
            "settings": {
                "map_auto_recording": bool(db.app_setting("map_auto_recording", True)),
                "settings_pin": str(db.app_setting("settings_pin", self.settings.settings_pin) or self.settings.settings_pin),
            },
        }

    def handle_app_settings(self) -> None:
        payload = self.read_body()
        settings_payload = payload.get("settings") if isinstance(payload.get("settings"), dict) else payload
        db = self.app_db()
        if "map_auto_recording" in settings_payload:
            db.set_app_setting("map_auto_recording", bool(settings_payload.get("map_auto_recording")))
        if "settings_pin" in settings_payload:
            pin = str(settings_payload.get("settings_pin") or "").strip()
            if not re.fullmatch(r"\d{6}", pin):
                return self.send_json({"ok": False, "error": "Settings PIN must be exactly 6 digits."}, status=400)
            db.set_app_setting("settings_pin", pin)
        return self.send_json(self.app_settings_payload())

    def network_settings_defaults(self) -> dict[str, str]:
        return {
            "OIAB_ETH_IFACE": os.environ.get("OIAB_ETH_IFACE", "eth0"),
            "OIAB_AP_IFACE": os.environ.get("OIAB_AP_IFACE", "wlan0"),
            "OIAB_WAN_WIFI_IFACE": os.environ.get("OIAB_WAN_WIFI_IFACE", "wlan1"),
            "OIAB_AP_SSID": os.environ.get("OIAB_AP_SSID", "Daemon Adventures"),
            "OIAB_AP_PASSPHRASE": os.environ.get("OIAB_AP_PASSPHRASE", self.settings.ap_passphrase),
            "OIAB_AP_COUNTRY": os.environ.get("OIAB_AP_COUNTRY", "US"),
            "OIAB_AP_CHANNEL": os.environ.get("OIAB_AP_CHANNEL", "6"),
            "OIAB_AP_SUBNET": os.environ.get("OIAB_AP_SUBNET", "192.168.8.0/24"),
            "OIAB_AP_IP": os.environ.get("OIAB_AP_IP", "192.168.8.2"),
            "OIAB_DHCP_RANGE": os.environ.get("OIAB_DHCP_RANGE", "192.168.8.3,192.168.8.20,12h"),
        }

    def network_config_path(self) -> Path:
        return Path(os.environ.get("OIAB_NETWORK_CONFIG", self.settings.data_dir / "config" / "network.env"))

    def read_network_settings(self) -> dict[str, str]:
        values = self.network_settings_defaults()
        path = self.network_config_path()
        if not path.exists():
            return values
        for line in path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            key, raw_value = stripped.split("=", 1)
            key = key.strip()
            value = raw_value.strip()
            if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
                value = value[1:-1]
            if key in values:
                values[key] = value
        return values

    def network_settings_payload(self) -> dict[str, object]:
        path = self.network_config_path()
        return {
            "ok": True,
            "settings": self.read_network_settings(),
            "defaults": self.network_settings_defaults(),
            "config_path": str(path),
            "exists": path.exists(),
            "note": "Host networking changes are applied by the oiab-network-manager systemd service.",
        }

    def validate_network_settings(self, values: dict[str, str]) -> str | None:
        iface_re = re.compile(r"^[A-Za-z0-9_.:-]{1,32}$")
        for key in ("OIAB_ETH_IFACE", "OIAB_AP_IFACE", "OIAB_WAN_WIFI_IFACE"):
            if not iface_re.fullmatch(values.get(key, "")):
                return f"{key} must be a valid interface name."
        if not values.get("OIAB_AP_SSID", "").strip():
            return "OIAB_AP_SSID cannot be empty."
        passphrase = values.get("OIAB_AP_PASSPHRASE", "").strip()
        if passphrase and not 8 <= len(passphrase) <= 63:
            return "OIAB_AP_PASSPHRASE must be 8-63 characters, or blank for an open access point."
        if not re.fullmatch(r"[A-Z]{2}", values.get("OIAB_AP_COUNTRY", "")):
            return "OIAB_AP_COUNTRY must be a two-letter country code."
        try:
            channel = int(values.get("OIAB_AP_CHANNEL", "0"))
            if channel < 1 or channel > 165:
                return "OIAB_AP_CHANNEL must be between 1 and 165."
        except ValueError:
            return "OIAB_AP_CHANNEL must be numeric."
        try:
            network = ipaddress.ip_network(values.get("OIAB_AP_SUBNET", ""), strict=False)
            ip = ipaddress.ip_address(values.get("OIAB_AP_IP", ""))
            if ip not in network:
                return "OIAB_AP_IP must be inside OIAB_AP_SUBNET."
        except ValueError as exc:
            return f"Invalid AP subnet/IP: {exc}"
        dhcp_parts = values.get("OIAB_DHCP_RANGE", "").split(",")
        if len(dhcp_parts) != 3:
            return "OIAB_DHCP_RANGE must be start,end,lease, for example 192.168.8.3,192.168.8.20,12h."
        try:
            start = ipaddress.ip_address(dhcp_parts[0].strip())
            end = ipaddress.ip_address(dhcp_parts[1].strip())
            network = ipaddress.ip_network(values.get("OIAB_AP_SUBNET", ""), strict=False)
            if start not in network or end not in network:
                return "DHCP range addresses must be inside OIAB_AP_SUBNET."
        except ValueError as exc:
            return f"Invalid DHCP range: {exc}"
        return None

    def shell_quote_env(self, value: str) -> str:
        if re.fullmatch(r"[A-Za-z0-9_./:,-]+", value):
            return value
        return "'" + value.replace("'", "'\"'\"'") + "'"

    def handle_network_settings(self) -> None:
        payload = self.read_body()
        incoming = payload.get("settings") if isinstance(payload.get("settings"), dict) else payload
        values = self.network_settings_defaults()
        for key in values:
            if key in incoming:
                values[key] = str(incoming.get(key) or "").strip()
        error = self.validate_network_settings(values)
        if error:
            return self.send_json({"ok": False, "error": error, "settings": values}, status=400)
        path = self.network_config_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        body = [
            "# OIAB hotspot/network mode manager configuration.",
            "# This file is written by Central Settings and read by the host systemd service.",
        ]
        for key in self.network_settings_defaults():
            body.append(f"{key}={self.shell_quote_env(values[key])}")
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text("\n".join(body) + "\n", encoding="utf-8")
        tmp.replace(path)
        return self.send_json(self.network_settings_payload())

    def handle_https_admin(self, payload: dict[str, object]) -> None:
        helper = Path(os.environ.get("HTTPS_ADMIN_HELPER", REPO_ROOT / "scripts" / "overland-https-admin.py"))
        if not helper.exists():
            return self.send_json(
                {
                    "ok": False,
                    "error": f"HTTPS helper is not installed: {helper}",
                    "config": {
                        "OVERLAND_DOMAIN": self.settings.hostname,
                        "OVERLAND_CERT_DOMAINS": f"{self.settings.hostname},*.{self.settings.hostname}",
                        "OVERLAND_PI_LAN_IP": os.environ.get("OIAB_PI_LAN_IP", "192.168.8.2"),
                    },
                    "tokenConfigured": False,
                    "trustedSiteEnabled": False,
                },
                status=501,
            )
        sudo_path = shutil.which("sudo")
        use_sudo = os.geteuid() != 0 and bool(sudo_path) and os.environ.get("OIAB_HTTPS_HELPER_USE_SUDO", "auto") != "false"
        command = [sudo_path, "-n", str(helper)] if use_sudo else [str(helper)]
        try:
            result = subprocess.run(
                command,
                input=json.dumps(payload).encode("utf-8"),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=180,
                check=False,
            )
        except Exception as exc:  # noqa: BLE001 - helper boundary
            return self.send_json({"ok": False, "error": f"HTTPS helper failed: {exc}"}, status=500)
        stdout = result.stdout.decode("utf-8", "replace").strip()
        stderr = result.stderr.decode("utf-8", "replace").strip()
        try:
            data = json.loads(stdout or "{}")
        except json.JSONDecodeError:
            data = {"ok": False, "error": stderr or stdout or f"HTTPS helper exited {result.returncode}"}
        if stderr and not data.get("stderr"):
            data["stderr"] = stderr
        status = 200 if result.returncode == 0 and data.get("ok", True) else 500
        return self.send_json(data, status=status)

    def handle_power_action(self, action: str) -> None:
        if action not in {"reboot", "shutdown"}:
            return self.send_json({"ok": False, "error": "Unsupported power action."}, status=400)
        if os.environ.get("OIAB_ALLOW_HOST_POWER", "").lower() not in {"1", "true", "yes", "on"}:
            return self.send_json(
                {
                    "ok": False,
                    "error": "Host power controls are disabled. Set OIAB_ALLOW_HOST_POWER=true and grant the container/host helper permission.",
                },
                status=403,
            )
        command = ["/sbin/shutdown", "-h", "now"] if action == "shutdown" else ["/sbin/shutdown", "-r", "now"]
        if not Path(command[0]).exists():
            command = ["shutdown", "-h" if action == "shutdown" else "-r", "now"]
        try:
            subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception as exc:  # noqa: BLE001 - host integration boundary
            return self.send_json({"ok": False, "error": f"{action} failed: {exc}"}, status=500)
        return self.send_json({"ok": True, "action": action})

    def komga_reader_auth_header(self) -> str:
        configured = (self.settings.komga_reader_auth_header or "").strip()
        if configured:
            return configured.removeprefix("Authorization:").strip()
        paths = [
            self.settings.komga_reader_auth_file,
            self.settings.data_dir / "services" / "komga" / "config" / "reader-auth.env",
            self.settings.data_dir / "services" / "komga" / "config" / "komga.env",
            Path("/srv/trailer/komga/config/reader-auth.env"),
            Path("/srv/trailer/komga/config/komga.env"),
        ]
        for path in paths:
            try:
                if not path.exists() or not path.is_file():
                    continue
                for raw_line in path.read_text(encoding="utf-8", errors="replace").splitlines():
                    line = raw_line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        key, value = line.split("=", 1)
                        key = key.strip().upper()
                        value = value.strip().strip('"').strip("'")
                        if "AUTH" in key or "HEADER" in key or key == "AUTHORIZATION":
                            return value.removeprefix("Authorization:").strip()
                        if key in {"KOMGA_READER_USERNAME", "KOMGA_VIEWER_USERNAME", "KOMGA_USERNAME"}:
                            username = value
                            password = ""
                            for candidate in path.read_text(encoding="utf-8", errors="replace").splitlines():
                                c_line = candidate.strip()
                                if not c_line or c_line.startswith("#") or "=" not in c_line:
                                    continue
                                c_key, c_value = c_line.split("=", 1)
                                c_key = c_key.strip().upper()
                                c_value = c_value.strip().strip('"').strip("'")
                                if c_key in {"KOMGA_READER_PASSWORD", "KOMGA_VIEWER_PASSWORD", "KOMGA_PASSWORD"}:
                                    password = c_value
                                    break
                            if username and password:
                                token = f"{username}:{password}".encode("utf-8")
                                return f"Basic {base64.b64encode(token).decode('ascii')}"
                    return line.removeprefix("Authorization:").strip()
            except OSError:
                continue
        return ""

    def komga_admin_cookie_enabled(self) -> bool:
        cookie = self.headers.get("Cookie", "")
        return any(part.strip() == "komga_admin=1" for part in cookie.split(";"))

    def proxy_komga(self) -> None:
        target_base = self.settings.komga_proxy_target.rstrip("/")
        parsed = urlparse(self.path)
        target = f"{target_base}{parsed.path}"
        if parsed.query:
            target = f"{target}?{parsed.query}"
        body = b""
        if self.command in {"POST", "PUT", "PATCH"}:
            length = int(self.headers.get("Content-Length", "0") or "0")
            body = self.rfile.read(length) if length else b""
        headers = {}
        skip = {"host", "connection", "content-length", "accept-encoding", "authorization"}
        for key, value in self.headers.items():
            if key.lower() not in skip:
                headers[key] = value
        headers["Host"] = urlparse(target_base).netloc
        host = self.headers.get("Host", self.settings.hostname)
        headers["X-Forwarded-Host"] = host
        headers["X-Forwarded-Proto"] = self.headers.get("X-Forwarded-Proto", "http")
        if not self.komga_admin_cookie_enabled():
            auth_header = self.komga_reader_auth_header()
            if auth_header:
                headers["Authorization"] = auth_header
        try:
            request = Request(
                target,
                data=body if body or self.command in {"POST", "PUT", "PATCH"} else None,
                headers=headers,
                method=self.command,
            )
            with urlopen(request, timeout=30) as response:
                payload = b"" if self.command == "HEAD" else response.read()
                self.send_response(response.status)
                for key, value in response.headers.items():
                    lowered = key.lower()
                    if lowered in {"connection", "transfer-encoding", "content-length", "content-encoding"}:
                        continue
                    if lowered == "location":
                        value = value.replace(target_base, "")
                    self.send_header(key, value)
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                if payload:
                    self.wfile.write(payload)
        except HTTPError as exc:
            payload = b"" if self.command == "HEAD" else exc.read()
            self.send_response(exc.code)
            for key, value in exc.headers.items():
                lowered = key.lower()
                if lowered in {"connection", "transfer-encoding", "content-length", "content-encoding"}:
                    continue
                if lowered == "location":
                    value = value.replace(target_base, "")
                self.send_header(key, value)
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            if payload:
                self.wfile.write(payload)
        except Exception as exc:  # noqa: BLE001 - proxy boundary
            return self.send_json({"ok": False, "error": f"Komga proxy failed: {exc}"}, status=502)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        if path.startswith("/books/"):
            return self.proxy_komga()
        if path in {"/api/quick-save", "/maps-quick-save", "/api/waypoints"}:
            try:
                payload = self.read_multipart() if "multipart/form-data" in self.headers.get("Content-Type", "") else self.read_body()
                feature = save_waypoint(self.settings, payload)
                return self.send_json({"ok": True, "feature": feature})
            except Exception as exc:  # noqa: BLE001 - HTTP boundary
                return self.send_json({"ok": False, "error": str(exc)}, status=400)
        if path in {"/api/maps/data/import", "/maps-data-import"}:
            return self.handle_map_data_import()
        if path in {"/api/maps/data/manage", "/maps-data-manage"}:
            return self.handle_map_data_manage()
        if path.startswith("/api/services/"):
            parts = [part for part in path.split("/") if part]
            service_id = parts[2] if len(parts) > 2 else ""
            action = parts[3] if len(parts) > 3 else str(self.read_body().get("action") or "")
            result = service_action(self.settings, service_id, action)
            status = 200 if result.get("ok") else 400
            return self.send_json({**result, "services": list_services(self.settings)}, status=status)
        if path.startswith("/api/containers/"):
            parts = [part for part in path.split("/") if part]
            container = parts[2] if len(parts) > 2 else ""
            action = parts[3] if len(parts) > 3 else str(self.read_body().get("action") or "")
            result = docker_container_action(self.settings, container, action)
            status = 200 if result.get("ok") else 400
            return self.send_json({**result, **docker_containers(self.settings)}, status=status)
        if path in {"/api/settings/app", "/settings/app"}:
            return self.handle_app_settings()
        if path in {"/api/tracks/manual/start", "/maps-tracks-manual-start"}:
            result = self.app_db().start_manual_track()
            return self.send_json({**result, **self.current_track()})
        if path in {"/api/tracks/manual/stop", "/maps-tracks-manual-stop"}:
            result = self.app_db().stop_current_track()
            return self.send_json({**result, **self.current_track()})
        if path in {"/api/settings/network", "/settings/network"}:
            return self.handle_network_settings()
        if path in {"/overland-https-admin", "/api/https-admin"}:
            return self.handle_https_admin(self.read_body())
        if path in {"/api/system/reboot", "/system/reboot"}:
            return self.handle_power_action("reboot")
        if path in {"/api/system/shutdown", "/system/shutdown"}:
            return self.handle_power_action("shutdown")
        if path in {"/mobile-games", "/api/mobile-games"}:
            return self.handle_mobile_games()
        if path in {"/game-stats", "/api/game-stats"}:
            return self.handle_game_stats()
        if path in {"/license-plates", "/api/license-plates"}:
            return self.handle_license_plates()
        if path in {"/api/uploads/trivia-question", "/api/trivia/questions/upload"}:
            return self.handle_trivia_question_upload()
        if path in {"/api/uploads/file", "/api/uploads/upload"}:
            target = parse_qs(parsed.query).get("target", ["uploads"])[-1]
            return self.handle_file_upload(target)
        if path in {"/api/maps-v2/map-packs", "/maps-v2-map-packs"}:
            return self.handle_map_packs()
        if path in {"/api/maps/overlays", "/maps-overlays"}:
            return self.handle_map_overlays()
        if path == "/api/maps/overlays/wildfire/refresh":
            return self.send_json(self.refresh_wildfire_overlay())
        if path == "/api/maps/overlays/weather/alerts/refresh":
            return self.send_json(self.refresh_weather_alerts_overlay())
        if path == "/api/maps/overlays/mvum/roads/install":
            job = start_mvum_install(self.settings, "roads")
            return self.send_json({"ok": True, "job": job, **self.map_overlays()})
        if path == "/api/maps/overlays/mvum/trails/install":
            job = start_mvum_install(self.settings, "trails")
            return self.send_json({"ok": True, "job": job, **self.map_overlays()})
        if path in {"/api/maps/packs/validate", "/api/maps/pmtiles/validate"}:
            return self.send_json(self.pmtiles_validate(self.read_body()))
        if path.startswith("/api/maps/overlays/"):
            action = path.rstrip("/").rsplit("/", 1)[-1]
            return self.handle_map_overlays(action_override=action)
        if path.startswith("/api/maps/packs/"):
            action = path.rstrip("/").rsplit("/", 1)[-1]
            return self.handle_map_packs(action_override=action)
        self.send_error(HTTPStatus.NOT_FOUND, "Not found")

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def read_body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        content_type = self.headers.get("Content-Type", "")
        if "application/json" in content_type:
            return json.loads(raw.decode("utf-8") or "{}")
        data = parse_qs(raw.decode("utf-8"))
        return {key: values[-1] for key, values in data.items()}

    def read_multipart(self) -> dict[str, object]:
        length = int(self.headers.get("Content-Length", "0"))
        content_type = self.headers.get("Content-Type", "")
        raw = self.rfile.read(length) if length else b""
        match = re.search(r'boundary="?([^";]+)"?', content_type)
        if not match:
            raise ValueError("Missing multipart boundary.")
        boundary = ("--" + match.group(1)).encode()
        form: dict[str, object] = {}
        for raw_part in raw.split(boundary):
            part = raw_part.strip(b"\r\n")
            if not part or part == b"--":
                continue
            if part.endswith(b"--"):
                part = part[:-2].rstrip(b"\r\n")
            header_blob, sep, content = part.partition(b"\r\n\r\n")
            if not sep:
                header_blob, sep, content = part.partition(b"\n\n")
            if not sep:
                continue
            headers = {}
            for line in header_blob.decode("utf-8", errors="replace").splitlines():
                if ":" in line:
                    key, value = line.split(":", 1)
                    headers[key.lower().strip()] = value.strip()
            disposition = headers.get("content-disposition", "")
            name_match = re.search(r'name="([^"]+)"', disposition)
            if not name_match:
                continue
            name = name_match.group(1)
            filename_match = re.search(r'filename="([^"]*)"', disposition)
            if filename_match:
                form[name] = {
                    "filename": Path(filename_match.group(1)).name,
                    "content": content,
                    "content_type": headers.get("content-type", ""),
                }
            else:
                form[name] = content.decode("utf-8", errors="replace")
        return form

    def send_json(self, data: object, status: int = 200) -> None:
        body = json.dumps(data, indent=2, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def send_text(self, text: str, content_type: str = "text/plain; charset=utf-8", status: int = 200) -> None:
        body = text.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def send_download(self, filename: str, body: bytes, content_type: str) -> None:
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def handle_map_data_import(self) -> None:
        try:
            form = self.read_multipart() if "multipart/form-data" in self.headers.get("Content-Type", "") else self.read_body()
            upload = form.get("import_file")
            if not isinstance(upload, dict) or not upload.get("content"):
                return self.send_json({"ok": False, "error": "Choose a GPX, GeoJSON/JSON, or KML file to import."}, status=400)
            result = self.app_db().import_upload(
                str(upload.get("filename") or "uploaded"),
                upload.get("content") if isinstance(upload.get("content"), bytes) else bytes(upload.get("content") or b""),
                str(form.get("folder") or ""),
            )
            return self.send_json({"ok": True, **result, **self.app_db().manage_data_snapshot()})
        except Exception as exc:  # noqa: BLE001 - upload boundary
            return self.send_json({"ok": False, "error": str(exc)}, status=400)

    def handle_map_data_manage(self) -> None:
        try:
            payload = self.read_body()
            action = str(payload.get("action") or "").strip()
            db = self.app_db()
            if action == "add_folder":
                result = db.add_folder(str(payload.get("folder") or ""))
            elif action == "set_folder_visibility":
                result = db.set_folder_visibility(str(payload.get("folder") or ""), bool(payload.get("visible")))
            elif action == "move_items":
                result = db.move_items(
                    [str(item) for item in payload.get("item_ids", []) if item],
                    [str(item) for item in payload.get("folder_paths", []) if item],
                    str(payload.get("target_folder") or ""),
                )
            elif action == "rename_item":
                result = db.rename_item(str(payload.get("item_id") or ""), str(payload.get("name") or ""))
            elif action == "update_item":
                result = db.update_item_details(str(payload.get("item_id") or ""), payload)
            elif action == "bulk_update_items":
                result = db.bulk_update_items(
                    [str(item) for item in payload.get("item_ids", []) if item],
                    [str(item) for item in payload.get("folder_paths", []) if item],
                    payload,
                )
            elif action == "rename_folder":
                result = db.rename_folder(str(payload.get("old_folder") or ""), str(payload.get("new_folder") or ""))
            elif action == "delete_items":
                result = db.delete_items(
                    [str(item) for item in payload.get("item_ids", []) if item],
                    [str(item) for item in payload.get("folder_paths", []) if item],
                )
            else:
                return self.send_json({"ok": False, "error": "Unknown map data action."}, status=400)
            return self.send_json({"ok": True, **result, **db.manage_data_snapshot()})
        except Exception as exc:  # noqa: BLE001 - management boundary
            return self.send_json({"ok": False, "error": str(exc)}, status=400)

    def serve_file(self, path: Path) -> None:
        if not path.exists() or not path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND, "Not found")
            return
        file_size = path.stat().st_size
        range_header = self.headers.get("Range")
        content_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
        start, end = 0, file_size - 1
        status = HTTPStatus.OK
        if range_header and range_header.startswith("bytes="):
            try:
                range_value = range_header.split("=", 1)[1]
                start_s, end_s = range_value.split("-", 1)
                start = int(start_s) if start_s else 0
                end = int(end_s) if end_s else file_size - 1
                end = min(end, file_size - 1)
                if start > end:
                    raise ValueError
                status = HTTPStatus.PARTIAL_CONTENT
            except ValueError:
                self.send_error(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                return
        length = end - start + 1
        self.send_response(status)
        self.send_static_headers(path, content_type, length)
        if status == HTTPStatus.PARTIAL_CONTENT:
            self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
        self.end_headers()
        with path.open("rb") as fh:
            fh.seek(start)
            remaining = length
            while remaining > 0:
                chunk = fh.read(min(1024 * 1024, remaining))
                if not chunk:
                    break
                self.wfile.write(chunk)
                remaining -= len(chunk)

    def send_static_headers(self, path: Path, content_type: str, content_length: int) -> None:
        stat = path.stat()
        parsed = urlparse(self.path)
        has_pack_version = bool(parse_qs(parsed.query).get("v"))
        self.send_header("Content-Type", content_type)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(content_length))
        self.send_header("Last-Modified", formatdate(stat.st_mtime, usegmt=True))
        self.send_header("ETag", f'"{stat.st_mtime_ns:x}-{stat.st_size:x}"')
        if self.settings.dev_mode:
            self.send_header("Cache-Control", "no-store")
        elif path.suffix.lower() == ".pmtiles" and has_pack_version:
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        elif path.suffix.lower() == ".pmtiles":
            self.send_header("Cache-Control", "no-cache")
        elif path.suffix.lower() in {".html", ".js", ".css", ".json"}:
            self.send_header("Cache-Control", "no-cache")
        else:
            self.send_header("Cache-Control", "public, max-age=3600")

    def resolve_static(self, path: str) -> Path | None:
        if path in {"/", "/overland/", "/overland/index.html"}:
            return REPO_ROOT / "frontend" / "shell" / "index.html"
        if path.startswith("/config/"):
            return self.safe_join(REPO_ROOT / "config", path.removeprefix("/config/"))
        if path in {"/universal-shell.css", "/universal-shell.js", "/overland-shell.css", "/overland-shell.js"}:
            return REPO_ROOT / "frontend" / "shell" / path.removeprefix("/")
        if path == "/overland/legacy.html":
            return REPO_ROOT / "frontend" / "shell" / "legacy.html"
        if path.startswith("/overland/"):
            return self.safe_join(REPO_ROOT / "frontend" / "shell", path.removeprefix("/overland/"))
        if path.startswith("/docs/"):
            return self.safe_join(REPO_ROOT / "docs", path.removeprefix("/docs/"))
        if path in {"/maps-v2", "/maps-v2/"}:
            return REPO_ROOT / "frontend" / "maps" / "index.html"
        if path.startswith("/maps-v2/fonts/") and path.endswith(".pbf"):
            rel = path.removeprefix("/maps-v2/fonts/")
            target = self.safe_join(REPO_ROOT / "frontend" / "maps" / "fonts", rel)
            if target and target.exists():
                return target
            parts = rel.split("/")
            if len(parts) >= 2:
                fallback = self.safe_join(REPO_ROOT / "frontend" / "maps" / "fonts", "/".join([*parts[:-1], "0-255.pbf"]))
                if fallback and fallback.exists():
                    return fallback
            fallback = REPO_ROOT / "frontend" / "maps" / "fonts" / "Noto Sans Regular" / "0-255.pbf"
            if fallback.exists():
                return fallback
        if path.startswith("/maps-v2/"):
            return self.safe_join(REPO_ROOT / "frontend" / "maps", path.removeprefix("/maps-v2/"))
        if path.startswith("/maps-v2-packs/") or path.startswith("/maps/packs/"):
            rel = path.split("/packs/", 1)[-1] if "/packs/" in path else path.removeprefix("/maps-v2-packs/")
            return self.safe_join(self.settings.data_dir / "maps" / "packs", rel)
        if path.startswith("/maps/overlays/"):
            return self.safe_join(self.settings.data_dir / "maps" / "overlays", path.removeprefix("/maps/overlays/"))
        if path.startswith("/maps/emulatorjs/data/"):
            rel = path.removeprefix("/maps/emulatorjs/data/")
            runtime = self.safe_join(self.settings.data_dir / "services" / "emulatorjs" / "data", rel)
            if runtime and runtime.exists():
                return runtime
            return self.safe_join(REPO_ROOT / "frontend" / "shared" / "emulatorjs" / "data", rel)
        if path in {"/mobile", "/mobile/"}:
            return REPO_ROOT / "frontend" / "mobile" / "index.html"
        if path.startswith("/mobile/"):
            return self.safe_join(REPO_ROOT / "frontend" / "mobile", path.removeprefix("/mobile/"))
        if path in {"/music", "/music/"}:
            return REPO_ROOT / "frontend" / "mobile" / "music.html"
        if path in {"/games", "/games/"}:
            return REPO_ROOT / "frontend" / "mobile" / "index.html"
        if path in {"/settings", "/settings/"}:
            return REPO_ROOT / "frontend" / "mobile" / "admin.html"
        if path in {"/files", "/files/", "/upload", "/upload/", "/file-uploads", "/file-uploads/"}:
            return REPO_ROOT / "frontend" / "mobile" / "file-uploads.html"
        if path in {"/map-packs", "/map-packs/", "/maps-settings", "/maps-settings/"}:
            return REPO_ROOT / "frontend" / "mobile" / "map-packs.html"
        if path in {"/map-data", "/map-data/", "/maps-data-manager", "/maps-data-manager/"}:
            return REPO_ROOT / "frontend" / "mobile" / "map-data.html"
        if path in {"/map-diagnostics", "/map-diagnostics/", "/pmtiles-diagnostics", "/pmtiles-diagnostics/"}:
            return REPO_ROOT / "frontend" / "mobile" / "map-diagnostics.html"
        if path in {"/services", "/services/", "/service-manager", "/service-manager/"}:
            return REPO_ROOT / "frontend" / "mobile" / "services.html"
        if path in {"/gps-status", "/gps-status/"}:
            return REPO_ROOT / "frontend" / "mobile" / "gps-status.html"
        if path in {"/system-monitor", "/system-monitor/"}:
            return REPO_ROOT / "frontend" / "mobile" / "system-monitor.html"
        if path in {"/https-settings", "/https-settings/"}:
            return REPO_ROOT / "frontend" / "mobile" / "https-settings.html"
        if path.startswith("/maps/overland/trivia/questions/") or path.startswith("/trivia/questions/"):
            rel = path.removeprefix("/maps/overland/trivia/questions/").removeprefix("/trivia/questions/")
            return self.safe_join(self.settings.data_dir / "trivia" / "questions", rel)
        if path.startswith("/maps/overland/"):
            return self.safe_join(REPO_ROOT / "frontend" / "shared" / "overland", path.removeprefix("/maps/overland/"))
        if path in {"/apps/minecraft-wiki", "/apps/minecraft-wiki/"}:
            target = self.safe_join(self.settings.minecraft_wiki_dir, "index.html")
            return target if target and target.exists() else None
        if path.startswith("/apps/minecraft-wiki/"):
            rel = path.removeprefix("/apps/minecraft-wiki/")
            target = self.safe_join(self.settings.minecraft_wiki_dir, rel)
            if target and target.is_dir():
                index = self.safe_join(target, "index.html")
                return index if index and index.exists() else None
            return target if target and target.exists() else None
        if path in {"/apps/pokemon-wiki", "/apps/pokemon-wiki/"}:
            target = self.safe_join(self.settings.pokemon_wiki_dir, "index.html")
            return target if target and target.exists() else None
        if path.startswith("/apps/pokemon-wiki/"):
            rel = path.removeprefix("/apps/pokemon-wiki/")
            target = self.safe_join(self.settings.pokemon_wiki_dir, rel)
            if target and target.is_dir():
                index = self.safe_join(target, "index.html")
                return index if index and index.exists() else None
            return target if target and target.exists() else None
        if path.startswith("/media/music-art/"):
            return self.safe_join(self.settings.data_dir / "media" / "music-art", path.removeprefix("/media/music-art/"))
        if path.startswith("/media/music/"):
            return self.safe_join(self.settings.data_dir / "media" / "music", path.removeprefix("/media/music/"))
        if path.startswith("/media/books/"):
            return self.safe_join(self.settings.data_dir / "media" / "books", path.removeprefix("/media/books/"))
        if path.startswith("/media/comics/"):
            return self.safe_join(self.settings.data_dir / "media" / "comics", path.removeprefix("/media/comics/"))
        if path.startswith("/content/zim/"):
            return self.safe_join(self.settings.data_dir / "content" / "zim", path.removeprefix("/content/zim/"))
        if path.startswith("/games/roms/"):
            return self.safe_join(self.settings.data_dir / "games" / "roms", path.removeprefix("/games/roms/"))
        if path.startswith("/uploads/"):
            return self.safe_join(self.settings.data_dir / "media" / "uploads", path.removeprefix("/uploads/"))
        return None

    @staticmethod
    def safe_join(root: Path, rel: str) -> Path | None:
        target = (root / rel).resolve()
        try:
            target.relative_to(root.resolve())
        except ValueError:
            return None
        return target

    def config_payload(self) -> dict:
        return {
            "ok": True,
            "name": "Overland In A Box",
            "short_name": "OIAB",
            "hostname": self.settings.hostname,
            "data_dir": str(self.settings.data_dir),
            "default_map_app": self.settings.default_map_app,
            "optional_services_enabled": self.settings.enable_optional_services,
            "cert_mode": self.settings.cert_mode,
            "https_port": self.settings.https_port,
            "db_path": str(self.settings.db_path),
        }

    def app_db(self) -> AppDB:
        return AppDB(self.settings)

    def apps_payload(self) -> dict:
        payload = read_json(REPO_ROOT / "config" / "apps.json", {"schema": 1, "apps": []})
        services = {str(item.get("id")): item for item in list_services(self.settings)}
        filtered = []
        for app in payload.get("apps", []) or []:
            service_id = app.get("optionalService")
            if service_id:
                service = services.get(str(service_id), {})
                if not (service.get("installed") and service.get("enabled")):
                    continue
            filtered.append(app)
        return {**payload, "apps": filtered}

    def map_packs(self) -> dict:
        registry = self.app_db().map_pack_registry()
        return {**registry, "jobs": map_pack_job_snapshot()}

    def map_overlays(self) -> dict:
        return {**self.app_db().map_overlay_registry(), "jobs": overlay_job_snapshot()}

    def pmtiles_diagnostics(self) -> dict:
        try:
            active, path, stat, registry = self.resolve_pmtiles_pack("")
        except ValueError:
            registry = self.map_packs()
            return {"ok": False, "error": "No active PMTiles pack is registered.", "registry": registry}

        public_url = str(active.get("public_url") or active.get("url") or f"/maps/packs/{path.name}")
        result: dict[str, object] = {
            "ok": True,
            "active_id": active.get("id"),
            "active_name": active.get("name"),
            "public_url": public_url,
            "versioned_url": public_url,
            "base_url": active.get("base_url") or active.get("unversioned_url") or public_url.split("?", 1)[0],
            "version": active.get("version") or (f"{stat.st_size}-{stat.st_mtime_ns}" if stat else ""),
            "mtime": active.get("mtime") or (stat.st_mtime if stat else 0),
            "mtime_ns": active.get("mtime_ns") or (stat.st_mtime_ns if stat else 0),
            "mtime_iso": datetime.fromtimestamp(stat.st_mtime).isoformat() if stat else "",
            "path": str(path),
            "exists": path.exists(),
            "readable": os.access(path, os.R_OK) if path.exists() else False,
            "size_bytes": stat.st_size if stat else 0,
            "storage_root": str(self.settings.data_dir / "maps" / "packs"),
            "python_fallback_url": public_url,
            "serving_path": "python_fallback",
            "serving_note": "If Caddy/nginx is in front of OIAB, browser-origin checks show the external static server behavior; internal checks use the Python fallback.",
            "pack_zoom": {
                "catalog_minzoom": active.get("catalog_minzoom") or active.get("catalog_min_zoom"),
                "catalog_maxzoom": active.get("catalog_maxzoom") or active.get("catalog_max_zoom"),
                "actual_minzoom": active.get("actual_minzoom") or active.get("actual_min_zoom"),
                "actual_maxzoom": active.get("actual_maxzoom") or active.get("actual_max_zoom"),
                "source_minzoom": active.get("minzoom") or active.get("min_zoom"),
                "source_maxzoom": active.get("maxzoom") or active.get("max_zoom"),
                "metadata_source": active.get("metadata_source"),
            },
            "tests": {},
        }
        if not path.exists() or not path.is_file():
            result["ok"] = False
            result["error"] = "Active PMTiles file is missing on disk."
            return result

        origin = f"http://127.0.0.1:{self.settings.http_port}"
        url = f"{origin}{public_url}"
        result["tested_url"] = url
        result["tests"] = {
            "direct_file_read": self.pmtiles_direct_read_test(path),
            "head": self.http_probe(url, "HEAD"),
            "range": self.http_probe(url, "GET", range_header="bytes=0-16383"),
        }
        range_test = result["tests"]["range"]  # type: ignore[index]
        result["range_ok"] = bool(isinstance(range_test, dict) and range_test.get("status") == 206)
        result["metadata"] = self.pmtiles_metadata_summary(path)
        return result

    def resolve_pmtiles_pack(self, pack_id: str = "") -> tuple[dict, Path, os.stat_result | None, dict]:
        registry = self.map_packs()
        packs = registry.get("basemaps", [])
        target_id = str(pack_id or registry.get("active") or registry.get("active_basemap") or "")
        pack = next((item for item in packs if target_id and str(item.get("id")) == target_id), None)
        pack = pack or next((item for item in packs if item.get("active")), None)
        if not pack:
            raise ValueError("No PMTiles pack is registered.")
        path = self.app_db().resolve_pack_path(str(pack.get("path") or pack.get("public_url") or pack.get("url") or ""))
        stat = path.stat() if path.exists() and path.is_file() else None
        return pack, path, stat, registry

    @staticmethod
    def parse_json_text(value: str) -> object | None:
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return None

    def run_pmtiles_text(self, args: list[str], timeout: int = 20) -> dict[str, object]:
        pmtiles = shutil.which("pmtiles")
        command = [pmtiles or "pmtiles", *args]
        if not pmtiles:
            return {"ok": False, "available": False, "command": command, "error": "pmtiles CLI is not installed."}
        try:
            result = subprocess.run(command, text=True, capture_output=True, timeout=timeout, check=False)
            return {
                "ok": result.returncode == 0,
                "available": True,
                "command": command,
                "returncode": result.returncode,
                "stdout": result.stdout[-12000:],
                "stderr": result.stderr[-4000:],
            }
        except subprocess.TimeoutExpired:
            return {"ok": False, "available": True, "command": command, "error": f"pmtiles command timed out after {timeout}s."}

    def pmtiles_metadata_summary(self, path: Path) -> dict[str, object]:
        header = self.run_pmtiles_text(["show", str(path), "--header-json"], timeout=15)
        tilejson = self.run_pmtiles_text(["show", str(path), "--tilejson"], timeout=15)
        metadata = self.run_pmtiles_text(["show", str(path), "--metadata"], timeout=15)
        parsed_header = self.parse_json_text(str(header.get("stdout") or "")) if header.get("ok") else None
        parsed_tilejson = self.parse_json_text(str(tilejson.get("stdout") or "")) if tilejson.get("ok") else None
        parsed_metadata = self.parse_json_text(str(metadata.get("stdout") or "")) if metadata.get("ok") else None
        tilejson_obj = parsed_tilejson if isinstance(parsed_tilejson, dict) else {}
        header_obj = parsed_header if isinstance(parsed_header, dict) else {}
        return {
            "pmtiles_cli_available": bool(header.get("available")),
            "header": parsed_header if parsed_header is not None else header,
            "tilejson": parsed_tilejson if parsed_tilejson is not None else tilejson,
            "metadata": parsed_metadata if parsed_metadata is not None else metadata,
            "bounds": tilejson_obj.get("bounds") or header_obj.get("bounds"),
            "minzoom": tilejson_obj.get("minzoom") or header_obj.get("minzoom"),
            "maxzoom": tilejson_obj.get("maxzoom") or header_obj.get("maxzoom"),
        }

    def pmtiles_tile_check(self, parsed) -> dict[str, object]:
        query = parse_qs(parsed.query)
        pack_id = str(query.get("pack", [""])[-1] or "")
        try:
            z = int(query.get("z", [""])[-1])
            x = int(query.get("x", [""])[-1])
            y = int(query.get("y", [""])[-1])
        except (TypeError, ValueError):
            return {"ok": False, "error": "Provide integer z, x, and y query parameters."}
        try:
            pack, path, stat, _registry = self.resolve_pmtiles_pack(pack_id)
        except ValueError as exc:
            return {"ok": False, "error": str(exc)}
        if not path.exists() or not path.is_file():
            return {"ok": False, "error": "Selected PMTiles file is missing.", "path": str(path), "pack": pack}

        pmtiles = shutil.which("pmtiles")
        command = [pmtiles or "pmtiles", "tile", str(path), str(z), str(x), str(y)]
        result: dict[str, object] = {
            "ok": True,
            "pack_id": pack.get("id"),
            "pack_name": pack.get("name"),
            "pack_url": pack.get("public_url") or pack.get("url"),
            "base_url": pack.get("base_url"),
            "path": str(path),
            "size_bytes": stat.st_size if stat else 0,
            "mtime": stat.st_mtime if stat else 0,
            "mtime_ns": stat.st_mtime_ns if stat else 0,
            "version": pack.get("version") or (f"{stat.st_size}-{stat.st_mtime_ns}" if stat else ""),
            "pack_zoom": {
                "catalog_minzoom": pack.get("catalog_minzoom") or pack.get("catalog_min_zoom"),
                "catalog_maxzoom": pack.get("catalog_maxzoom") or pack.get("catalog_max_zoom"),
                "actual_minzoom": pack.get("actual_minzoom") or pack.get("actual_min_zoom"),
                "actual_maxzoom": pack.get("actual_maxzoom") or pack.get("actual_max_zoom"),
                "source_minzoom": pack.get("minzoom") or pack.get("min_zoom"),
                "source_maxzoom": pack.get("maxzoom") or pack.get("max_zoom"),
                "metadata_source": pack.get("metadata_source"),
            },
            "tile": {"z": z, "x": x, "y": y},
            "pmtiles_cli_available": bool(pmtiles),
            "command": command,
        }
        if not pmtiles:
            result.update({"ok": False, "tile_exists": None, "cli_readable": False, "error": "pmtiles CLI is not installed."})
            return result
        try:
            completed = subprocess.run(command, capture_output=True, timeout=20, check=False)
            output = completed.stdout or b""
            result.update(
                {
                    "returncode": completed.returncode,
                    "stderr": completed.stderr.decode("utf-8", errors="replace")[-4000:],
                    "tile_exists": completed.returncode == 0 and len(output) > 0,
                    "cli_readable": completed.returncode == 0,
                    "tile_bytes": len(output),
                    "tile_magic_hex": output[:16].hex(),
                }
            )
        except subprocess.TimeoutExpired:
            result.update({"ok": False, "tile_exists": None, "cli_readable": False, "error": "pmtiles tile command timed out."})
        return result

    def pmtiles_range_check(self, parsed) -> dict[str, object]:
        query = parse_qs(parsed.query)
        pack_id = str(query.get("pack", [""])[-1] or "")
        range_header = str(query.get("range", ["bytes=0-16383"])[-1] or "bytes=0-16383")
        try:
            pack, _path, _stat, _registry = self.resolve_pmtiles_pack(pack_id)
        except ValueError as exc:
            return {"ok": False, "error": str(exc)}
        public_url = str(pack.get("public_url") or pack.get("url") or "")
        if not public_url:
            return {"ok": False, "error": "Selected pack has no public URL."}
        origin = f"http://127.0.0.1:{self.settings.http_port}"
        url = f"{origin}{public_url}"
        probe = self.http_probe(url, "GET", range_header=range_header)
        return {"ok": bool(probe.get("ok") and probe.get("status") == 206), "pack_id": pack.get("id"), "public_url": public_url, "tested_url": url, "requested_range": range_header, "probe": probe}

    def pmtiles_validate(self, payload: dict) -> dict[str, object]:
        pack_id = str(payload.get("id") or payload.get("pack") or "")
        try:
            pack, path, stat, _registry = self.resolve_pmtiles_pack(pack_id)
        except ValueError as exc:
            return {"ok": False, "error": str(exc)}
        result: dict[str, object] = {
            "ok": True,
            "pack_id": pack.get("id"),
            "pack_name": pack.get("name"),
            "public_url": pack.get("public_url") or pack.get("url"),
            "path": str(path),
            "exists": path.exists(),
            "readable": os.access(path, os.R_OK) if path.exists() else False,
            "size_bytes": stat.st_size if stat else 0,
            "mtime": stat.st_mtime if stat else 0,
            "mtime_ns": stat.st_mtime_ns if stat else 0,
            "version": pack.get("version") or (f"{stat.st_size}-{stat.st_mtime_ns}" if stat else ""),
            "direct_file_read": self.pmtiles_direct_read_test(path) if path.exists() else {"ok": False, "error": "missing"},
        }
        if not path.exists() or not path.is_file():
            result.update({"ok": False, "error": "Selected PMTiles file is missing."})
            return result
        result["metadata"] = self.pmtiles_metadata_summary(path)
        result["verify"] = self.run_pmtiles_text(["verify", str(path)], timeout=45)
        metadata = result.get("metadata") if isinstance(result.get("metadata"), dict) else {}
        bounds = metadata.get("bounds") if isinstance(metadata, dict) else None
        center = payload.get("center") if isinstance(payload.get("center"), dict) else {}
        lon = center.get("lon") or center.get("lng")
        lat = center.get("lat")
        warnings: list[str] = []
        if isinstance(bounds, list) and len(bounds) == 4 and lon is not None and lat is not None:
            try:
                lon_f = float(lon)
                lat_f = float(lat)
                if not (float(bounds[0]) <= lon_f <= float(bounds[2]) and float(bounds[1]) <= lat_f <= float(bounds[3])):
                    warnings.append("Current map center is outside this pack's TileJSON bounds.")
            except (TypeError, ValueError):
                pass
        if not result["direct_file_read"].get("ok"):  # type: ignore[union-attr]
            warnings.append("PMTiles header could not be read from disk.")
        verify = result.get("verify")
        if isinstance(verify, dict) and not verify.get("ok"):
            warnings.append("pmtiles verify did not pass or could not complete.")
        result["warnings"] = warnings
        return result

    @staticmethod
    def pmtiles_direct_read_test(path: Path) -> dict[str, object]:
        try:
            with path.open("rb") as fh:
                head = fh.read(16)
            return {"ok": bool(head), "bytes_read": len(head), "magic_hex": head[:7].hex()}
        except OSError as exc:
            return {"ok": False, "error": str(exc)}

    @staticmethod
    def http_probe(url: str, method: str, range_header: str | None = None) -> dict[str, object]:
        headers = {"User-Agent": "OIAB PMTiles diagnostics/1.0"}
        if range_header:
            headers["Range"] = range_header
        request = Request(url, method=method, headers=headers)
        try:
            with urlopen(request, timeout=6) as response:  # noqa: S310 - local self-test URL
                body = response.read(64) if method != "HEAD" else b""
                return {
                    "ok": True,
                    "status": response.status,
                    "content_length": response.headers.get("Content-Length"),
                    "content_range": response.headers.get("Content-Range"),
                    "accept_ranges": response.headers.get("Accept-Ranges"),
                    "cache_control": response.headers.get("Cache-Control"),
                    "etag": response.headers.get("ETag"),
                    "last_modified": response.headers.get("Last-Modified"),
                    "server": response.headers.get("Server"),
                    "bytes_read": len(body),
                }
        except Exception as exc:  # noqa: BLE001 - diagnostics endpoint
            return {"ok": False, "error": str(exc)}

    def map_pack_catalog(self) -> dict:
        catalog = read_json(REPO_ROOT / "config" / "map-pack-catalog.json", {"version": 1, "packs": []})
        installed = self.map_packs()
        installed_by_id = {item["id"]: item for item in installed.get("basemaps", [])}
        installed_by_filename = {
            Path(str(item.get("path") or item.get("public_url") or item.get("url") or "")).name: item
            for item in installed.get("basemaps", [])
            if item.get("path") or item.get("public_url") or item.get("url")
        }
        packs = []
        for item in catalog.get("packs", []) or []:
            if not isinstance(item, dict):
                continue
            job = map_pack_job_snapshot(str(item.get("id") or ""))
            state = installed_by_id.get(str(item.get("id") or ""), {})
            if not state:
                state = installed_by_filename.get(str(item.get("expected_filename") or ""), {})
            installed_flag = bool(state.get("installed") or state.get("exists"))
            job_status = str(job.get("status") or "")
            install_status = (
                job_status
                or ("installed" if installed_flag else "available" if item.get("install_available", bool(item.get("source_url"))) else "manual")
            )
            packs.append(
                {
                    **item,
                    "installed": installed_flag,
                    "active": bool(state.get("active")),
                    "size_bytes": state.get("size_bytes") or item.get("size_bytes"),
                    "public_url": state.get("public_url") or f"/maps/packs/{item.get('expected_filename')}",
                    "install_available": bool(item.get("install_available", bool(item.get("source_url")))),
                    "install_status": install_status,
                    "install_error": job.get("error") or "",
                    "install_progress": job.get("progress"),
                    "install_job": job,
                }
            )
        return {"ok": True, "version": catalog.get("version", 1), "packs": packs, "jobs": map_pack_job_snapshot()}

    def handle_map_packs(self, action_override: str | None = None) -> None:
        payload = self.read_body()
        action = str(action_override or payload.get("action") or "rescan")
        try:
            if action == "set-active":
                return self.send_json(self.app_db().set_active_map_pack(str(payload.get("id") or "")))
            if action == "disable":
                return self.send_json(self.app_db().disable_map_pack(str(payload.get("id") or "")))
            if action == "install":
                job = start_map_pack_install(self.settings, str(payload.get("id") or ""), reason="manual")
                return self.send_json({"ok": True, "job": job, **self.map_packs()})
            if action == "remove":
                return self.send_json(self.remove_map_pack(str(payload.get("id") or "")))
            if action == "import-path":
                return self.send_json(self.app_db().import_pmtiles_path(str(payload.get("path") or ""), payload.get("name")))
            if action == "rescan":
                self.app_db().rescan_map_packs()
                return self.send_json(self.map_packs())
            return self.send_json({"ok": False, "error": f"Unknown map pack action: {action}"}, status=400)
        except Exception as exc:  # noqa: BLE001 - HTTP boundary
            return self.send_json({"ok": False, "error": str(exc)}, status=400)

    def handle_map_overlays(self, action_override: str | None = None) -> None:
        payload = self.read_body()
        action = str(action_override or payload.get("action") or "rescan")
        db = self.app_db()
        try:
            if action in {"rescan", "scan"}:
                db.rescan_map_overlays()
                return self.send_json(db.map_overlay_registry())
            if action in {"set-enabled", "enable", "disable"}:
                enabled = action == "enable" or bool(payload.get("enabled"))
                if action == "disable":
                    enabled = False
                return self.send_json(db.set_map_overlay_enabled(str(payload.get("id") or ""), enabled))
            if action == "set-opacity":
                return self.send_json(db.set_map_overlay_opacity(str(payload.get("id") or ""), payload.get("opacity")))
            if action == "set-order":
                return self.send_json(db.set_map_overlay_order(str(payload.get("id") or ""), payload.get("sort_order", payload.get("order"))))
            if action in {"clear-cache", "clear"}:
                return self.send_json(db.clear_map_overlay_cache(str(payload.get("id") or "")))
            if action in {"firms-key", "set-firms-key"}:
                return self.send_json(db.set_firms_map_key(str(payload.get("map_key") or payload.get("key") or "")))
            if action in {"refresh-wildfire", "wildfire-refresh"}:
                return self.send_json(self.refresh_wildfire_overlay())
            if action in {"refresh-weather", "refresh-alerts", "weather-alerts-refresh"}:
                return self.send_json(self.refresh_weather_alerts_overlay())
            if action in {"install-mvum-roads", "mvum-roads-install"}:
                job = start_mvum_install(self.settings, "roads")
                return self.send_json({"ok": True, "job": job, **self.map_overlays()})
            if action in {"install-mvum-trails", "mvum-trails-install"}:
                job = start_mvum_install(self.settings, "trails")
                return self.send_json({"ok": True, "job": job, **self.map_overlays()})
            return self.send_json({"ok": False, "error": f"Unknown map overlay action: {action}"}, status=400)
        except Exception as exc:  # noqa: BLE001 - HTTP boundary
            return self.send_json({"ok": False, "error": str(exc)}, status=400)

    def mvum_config(self, kind: str) -> dict[str, str]:
        if kind == "roads":
            return {
                "overlay_id": "mvum_roads_us",
                "layer": "mvum_roads",
                "label": "MVUM Roads",
                "source_url": self.settings.mvum_roads_url,
                "mapserver_url": self.settings.mvum_mapserver_url,
                "base": "mvum-roads-us",
                "env": "OIAB_MVUM_ROADS_URL",
                "layer_keywords": "road,route",
                "fallback_layer_id": "1",
            }
        return {
            "overlay_id": "mvum_trails_us",
            "layer": "mvum_trails",
            "label": "MVUM Trails",
            "source_url": self.settings.mvum_trails_url,
            "mapserver_url": self.settings.mvum_mapserver_url,
            "base": "mvum-trails-us",
            "env": "OIAB_MVUM_TRAILS_URL",
            "layer_keywords": "trail",
            "fallback_layer_id": "2",
        }

    def mvum_tool_status(self) -> dict[str, str | None]:
        return {tool: shutil.which(tool) for tool in ("ogr2ogr", "tippecanoe", "pmtiles")}

    def require_mvum_tools(self, required: tuple[str, ...] = ("ogr2ogr", "tippecanoe", "pmtiles")) -> dict[str, str]:
        tools = self.mvum_tool_status()
        missing = [tool for tool in required if not tools.get(tool)]
        if missing:
            raise ValueError(
                "Missing MVUM conversion tools: "
                + ", ".join(missing)
                + ". Install GDAL/ogr2ogr, Tippecanoe, and pmtiles in the OIAB runtime. "
                + "For Debian/Raspberry Pi hosts start with: sudo apt-get install -y gdal-bin tippecanoe. "
                + "The Docker image already includes pmtiles; rebuild/extend the image if GDAL or Tippecanoe are missing inside the container."
            )
        return {key: str(value) for key, value in tools.items() if value}

    def fetch_json_url(self, url: str, *, timeout: int = 60) -> dict:
        request = Request(url, headers={"User-Agent": f"OIAB overlay fetcher ({self.settings.hostname})", "Accept": "application/json, application/geo+json"})
        with urlopen(request, timeout=timeout) as response:  # noqa: S310 - configured public data endpoint
            return json.loads(response.read().decode("utf-8", errors="replace"))

    def arcgis_layer_id(self, mapserver_url: str, kind: str) -> int:
        cfg = self.mvum_config(kind)
        fallback = int(cfg["fallback_layer_id"])
        base = mapserver_url.rstrip("/")
        try:
            metadata = self.fetch_json_url(f"{base}?{urlencode({'f': 'json'})}", timeout=45)
        except Exception:
            return fallback
        layers = metadata.get("layers") if isinstance(metadata, dict) else []
        keywords = [part.strip().lower() for part in cfg["layer_keywords"].split(",") if part.strip()]
        candidates = []
        for layer in layers or []:
            if not isinstance(layer, dict):
                continue
            name = str(layer.get("name") or "").lower()
            if any(keyword in name for keyword in keywords):
                candidates.append(layer)
        if candidates:
            try:
                return int(candidates[0].get("id"))
            except (TypeError, ValueError):
                return fallback
        return fallback

    def fetch_arcgis_geojson(self, mapserver_url: str, kind: str, output_path: Path, job_id: str) -> int:
        layer_id = self.arcgis_layer_id(mapserver_url, kind)
        base = mapserver_url.rstrip("/")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        page_size = int(os.environ.get("OIAB_MVUM_ARCGIS_PAGE_SIZE", "2000"))
        max_features = int(os.environ.get("OIAB_MVUM_ARCGIS_MAX_FEATURES", "0"))
        offset = 0
        features: list[dict[str, object]] = []
        while True:
            params = {
                "f": "geojson",
                "where": "1=1",
                "outFields": "*",
                "returnGeometry": "true",
                "outSR": "4326",
                "resultOffset": str(offset),
                "resultRecordCount": str(page_size),
            }
            url = f"{base}/{layer_id}/query?{urlencode(params)}"
            update_overlay_job(job_id, step=f"fetching USFS page {offset // page_size + 1}", progress=min(60, 8 + offset // max(1, page_size)))
            payload = self.fetch_json_url(url, timeout=120)
            page_features = payload.get("features") if isinstance(payload, dict) else []
            if not isinstance(page_features, list):
                raise ValueError("USFS MVUM ArcGIS query did not return a GeoJSON feature list.")
            features.extend([feature for feature in page_features if isinstance(feature, dict)])
            if max_features and len(features) >= max_features:
                features = features[:max_features]
                break
            if len(page_features) < page_size:
                break
            offset += page_size
        if not features:
            raise ValueError(f"USFS MVUM ArcGIS layer {layer_id} returned no {kind} features.")
        output_path.write_text(json.dumps({
            "type": "FeatureCollection",
            "features": features,
            "properties": {
                "source": "USFS EDW_MVUM_01",
                "source_layer": layer_id,
                "fetched_at": timestamp(),
            },
        }, separators=(",", ":")), encoding="utf-8")
        return len(features)

    def download_or_copy_overlay_source(self, source_url: str, destination: Path, job_id: str) -> int:
        destination.parent.mkdir(parents=True, exist_ok=True)
        part = destination.with_suffix(destination.suffix + ".part")
        part.unlink(missing_ok=True)
        if source_url.startswith(("http://", "https://")):
            request = Request(source_url, headers={"User-Agent": f"OIAB MVUM installer ({self.settings.hostname})"})
            total = 0
            expected = 0
            with urlopen(request, timeout=45) as response, part.open("wb") as handle:  # noqa: S310 - user-configured overlay URL
                try:
                    expected = int(response.headers.get("Content-Length") or "0")
                except ValueError:
                    expected = 0
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    handle.write(chunk)
                    total += len(chunk)
                    if expected:
                        update_overlay_job(job_id, step="downloading source", progress=min(45, 10 + int((total / expected) * 35)))
            if total <= 0:
                part.unlink(missing_ok=True)
                raise ValueError("MVUM source download completed with zero bytes.")
            shutil.move(str(part), str(destination))
            return total
        source = Path(source_url)
        if not source.exists():
            raise ValueError(f"MVUM source path does not exist: {source_url}")
        shutil.copy2(source, part)
        shutil.move(str(part), str(destination))
        return destination.stat().st_size

    def mvum_prop(self, properties: dict[str, object], candidates: tuple[str, ...]) -> object:
        lowered = {str(key).lower().replace(" ", "").replace("_", ""): value for key, value in properties.items()}
        for candidate in candidates:
            key = candidate.lower().replace(" ", "").replace("_", "")
            if key in lowered and lowered[key] not in {None, ""}:
                return lowered[key]
        return ""

    def mvum_allowed(self, properties: dict[str, object]) -> bool | None:
        value = self.mvum_prop(properties, ("allowed", "open", "status", "access", "route_status", "travel_status", "seasonal", "seasonal_allowed", "symbolname", "route_status_desc"))
        text = str(value).strip().lower()
        if not text:
            return None
        if any(token in text for token in ("closed", "prohibit", "no motor", "not allowed", "restricted", "decommission")):
            return False
        if any(token in text for token in ("open", "allowed", "yes", "seasonal", "legal")):
            return True
        return None

    def mvum_high_clearance(self, properties: dict[str, object]) -> bool:
        value = self.mvum_prop(properties, ("high_clearance", "highclearance", "vehicle_classes", "vehicle", "symbol", "symbolname", "route_type", "routeclass"))
        text = str(value).strip().lower()
        return any(token in text for token in ("high clearance", "4wd", "4x4", "ohv", "off highway", "off-highway"))

    def mvum_route_type_label(self, value: object) -> str:
        text = str(value or "").strip()
        code = re.sub(r"\D+", "", text)
        labels = {
            "1": "Road Open to Highway Legal Vehicles",
            "2": "Road Open to All Vehicles",
            "3": "Road Seasonal",
            "4": "Road with Seasonal Designation",
            "5": "High Clearance Vehicle Road",
            "6": "Special Vehicle Designation",
            "7": "Trail Open to All Vehicles",
            "8": "Trail Open to Vehicles 50 Inches or Less",
            "9": "Trail Open to Motorcycles",
            "10": "Trail Seasonal",
            "11": "Motorized Trail Seasonal",
            "12": "Administrative Route",
            "13": "Closed Route",
            "14": "Decommissioned Route",
            "15": "Non-Motorized Trail",
            "16": "Motorized Mixed Use",
            "17": "ATV Only",
            "18": "Motorcycle Only",
            "19": "OHV Route",
        }
        if code in labels:
            return f"{labels[code]} ({code})"
        if text:
            return text
        return ""

    def mvum_style_bucket(self, *, kind: str, allowed: bool | None, season: object, high_clearance: bool, route_type: object) -> str:
        route_text = str(route_type or "").strip().lower()
        route_code = re.sub(r"\D+", "", route_text)
        if allowed is False:
            return "restricted"
        if route_code == "17" or "atv" in route_text or "50 inches" in route_text:
            return "atv_only"
        if route_code == "18" or "motorcycle" in route_text:
            return "motorcycle_only"
        if high_clearance:
            return "high_clearance"
        if route_code in {"7", "8", "9", "10", "11"}:
            return "trail"
        if str(season or "").strip():
            return "seasonal"
        if kind == "trails" or "trail" in route_text:
            return "trail"
        if allowed is True:
            return "open_motorized"
        return "unknown"

    def normalize_mvum_geojson(self, raw_path: Path, output_path: Path, *, kind: str) -> int:
        data = json.loads(raw_path.read_text(encoding="utf-8"))
        features = []
        for feature in data.get("features", []):
            if not isinstance(feature, dict) or not feature.get("geometry"):
                continue
            raw_properties = feature.get("properties") if isinstance(feature.get("properties"), dict) else {}
            allowed = self.mvum_allowed(raw_properties)
            season = self.mvum_prop(raw_properties, ("season", "seasonal", "open_dates", "dates", "period", "seasonal_allowed", "allowed_dates"))
            route_type = self.mvum_prop(raw_properties, ("route_type", "routeclass", "route_class", "type", "symbol", "symbolname", "route_status")) or kind
            high_clearance = self.mvum_high_clearance(raw_properties)
            route_type_label = self.mvum_route_type_label(route_type)
            normalized = {
                "route_id": self.mvum_prop(raw_properties, ("route_id", "routeid", "route_no", "route_num", "id", "objectid", "route_no_")),
                "route_name": self.mvum_prop(raw_properties, ("route_name", "rtename", "name", "road_name", "trail_name", "route_name_")),
                "route_type": route_type,
                "route_type_label": route_type_label,
                "vehicle_classes": self.mvum_prop(raw_properties, ("vehicle_classes", "vehicle", "vehicles", "vehclass", "allowed_vehicles", "use", "managed_use")),
                "season": season,
                "allowed": allowed,
                "allowed_raw": self.mvum_prop(raw_properties, ("allowed", "open", "status", "access", "route_status", "travel_status", "seasonal", "symbolname")),
                "high_clearance": high_clearance,
                "style_bucket": self.mvum_style_bucket(kind=kind, allowed=allowed, season=season, high_clearance=high_clearance, route_type=route_type),
                "forest_name": self.mvum_prop(raw_properties, ("forest_name", "forest", "forestname", "unit", "adminforest", "forestorg", "forestname_")),
                "district": self.mvum_prop(raw_properties, ("district", "ranger_district", "districtname", "districtname_")),
                "source": "USFS MVUM",
                "raw_properties": raw_properties,
            }
            features.append({"type": "Feature", "geometry": feature["geometry"], "properties": normalized})
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps({"type": "FeatureCollection", "features": features}, separators=(",", ":")), encoding="utf-8")
        return len(features)

    def install_mvum_overlay_sync(self, kind: str, job_id: str) -> dict[str, object]:
        cfg = self.mvum_config(kind)
        overlay_id = cfg["overlay_id"]
        source_url = cfg["source_url"]
        mapserver_url = cfg["mapserver_url"]
        if not source_url and not mapserver_url:
            raise ValueError(f"{cfg['label']} source is not configured. Set {cfg['env']} or OIAB_MVUM_MAPSERVER_URL and restart OIAB.")
        explicit_source = bool(source_url)
        if explicit_source:
            self.require_mvum_tools(("ogr2ogr",))
        base = cfg["base"]
        parsed_name = Path(urlparse(source_url or mapserver_url).path).name
        source_name = self.safe_upload_name(parsed_name or f"{base}-source")
        if "." not in source_name:
            source_name = f"{source_name}.geojson" if not explicit_source else f"{source_name}.source"
        source_path = self.settings.data_dir / "maps" / "overlays" / "mvum" / "source" / source_name
        raw_geojson = self.settings.data_dir / "maps" / "overlays" / "mvum" / "geojson" / f"{base}.raw.geojson"
        normalized_geojson = self.settings.data_dir / "maps" / "overlays" / "mvum" / "geojson" / f"{base}.geojson"
        output_pmtiles = self.settings.data_dir / "maps" / "overlays" / "mvum" / "pmtiles" / f"{base}.pmtiles"

        if explicit_source:
            update_overlay_job(job_id, step="downloading source", progress=8)
            source_size = self.download_or_copy_overlay_source(source_url, source_path, job_id)

            update_overlay_job(job_id, step="converting source to GeoJSON", progress=50)
            raw_geojson.parent.mkdir(parents=True, exist_ok=True)
            raw_geojson.unlink(missing_ok=True)
            timeout_seconds = int(os.environ.get("OIAB_MVUM_CONVERT_TIMEOUT_SECONDS", "14400"))
            ogr = subprocess.run(
                ["ogr2ogr", "-f", "GeoJSON", str(raw_geojson), str(source_path)],
                text=True,
                capture_output=True,
                timeout=timeout_seconds,
                check=False,
            )
            if ogr.returncode != 0:
                raise ValueError((ogr.stderr or ogr.stdout or "ogr2ogr failed")[-1500:])
            if not raw_geojson.exists() or raw_geojson.stat().st_size <= 0:
                raise ValueError("ogr2ogr did not create a usable GeoJSON file.")
        else:
            source_path = self.settings.data_dir / "maps" / "overlays" / "mvum" / "source" / f"{base}.arcgis.geojson"
            raw_geojson = source_path
            update_overlay_job(job_id, step="querying USFS EDW MVUM MapServer", progress=8)
            feature_count = self.fetch_arcgis_geojson(mapserver_url, kind, raw_geojson, job_id)
            source_size = raw_geojson.stat().st_size
            update_overlay_job(job_id, step=f"downloaded {feature_count} source features", progress=62, feature_count=feature_count)

        update_overlay_job(job_id, step="normalizing MVUM fields", progress=68)
        feature_count = self.normalize_mvum_geojson(raw_geojson, normalized_geojson, kind=kind)
        if feature_count <= 0:
            raise ValueError("MVUM source converted, but no line features were found.")

        timeout_seconds = int(os.environ.get("OIAB_MVUM_CONVERT_TIMEOUT_SECONDS", "14400"))
        output_path = normalized_geojson
        output_type = "geojson"
        output_url = self.app_db().overlay_public_url_for_path(normalized_geojson)
        source_layer = None
        install_status = "installed_geojson"
        if shutil.which("tippecanoe"):
            update_overlay_job(job_id, step="building PMTiles overlay", progress=82)
            output_pmtiles.parent.mkdir(parents=True, exist_ok=True)
            output_pmtiles.unlink(missing_ok=True)
            tip = subprocess.run(
                [
                    "tippecanoe",
                    "-o",
                    str(output_pmtiles),
                    "-l",
                    cfg["layer"],
                    "--force",
                    "--drop-densest-as-needed",
                    "--extend-zooms-if-still-dropping",
                    str(normalized_geojson),
                ],
                text=True,
                capture_output=True,
                timeout=timeout_seconds,
                check=False,
            )
            if tip.returncode != 0:
                output_pmtiles.unlink(missing_ok=True)
                raise ValueError((tip.stderr or tip.stdout or "tippecanoe failed")[-1500:])
            if not output_pmtiles.exists() or output_pmtiles.stat().st_size <= 0:
                raise ValueError("tippecanoe did not create a usable PMTiles file.")
            output_path = output_pmtiles
            output_type = "pmtiles"
            output_url = self.app_db().overlay_public_url_for_path(output_pmtiles)
            source_layer = cfg["layer"]
            install_status = "installed"
        else:
            update_overlay_job(job_id, step="tippecanoe missing; using normalized GeoJSON", progress=86)

        registry = self.app_db().update_map_overlay_metadata(
            overlay_id,
            {
                "cache_status": "cached",
                "install_status": install_status,
                "error_message": "",
                "last_fetch_at": timestamp(),
                "source_size_bytes": source_size,
                "feature_count": feature_count,
                "mvum_source_mode": "file_or_download" if explicit_source else "arcgis_rest",
            },
            path=str(output_path),
            source_url=output_url,
            overlay_type=output_type,
            source_layer=source_layer,
        )
        return {
            "ok": True,
            "overlay_id": overlay_id,
            "source_path": str(source_path),
            "geojson_path": str(normalized_geojson),
            "output_path": str(output_path),
            "size_bytes": output_path.stat().st_size,
            "feature_count": feature_count,
            "registry": registry,
        }

    def refresh_wildfire_overlay(self) -> dict[str, object]:
        job_id = "firms_active_hotspots_refresh"
        update_overlay_job(job_id, overlay_id="firms_active_hotspots", type="refresh", status="running", step="checking FIRMS key", progress=5, error_message="", started_at=timestamp())
        output = self.settings.data_dir / "maps" / "overlays" / "wildfire" / "firms-latest.geojson"
        output.parent.mkdir(parents=True, exist_ok=True)
        firms_map_key = self.app_db().firms_map_key()
        if not firms_map_key:
            error = "OIAB_FIRMS_MAP_KEY is required for live NASA FIRMS refresh. Cached GeoJSON will still render if present."
            try:
                registry = self.app_db().mark_overlay_refresh("firms_active_hotspots", output_path=output if output.exists() else None, ok=False, error=error)
                update_overlay_job(job_id, status="failed", step="missing FIRMS MAP_KEY", progress=100, error_message=error, output_path=str(output) if output.exists() else "", feature_count=registry.get("feature_count"))
                return {**registry, "ok": False, "error": error}
            except Exception:
                update_overlay_job(job_id, status="failed", step="missing FIRMS MAP_KEY", progress=100, error_message=error)
                return {"ok": False, "error": error}
        source = quote(self.settings.firms_source, safe="")
        url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{quote(firms_map_key, safe='')}/{source}/world/1"
        try:
            update_overlay_job(job_id, step="fetching NASA FIRMS CSV", progress=20)
            request = Request(url, headers={"User-Agent": f"OIAB wildfire overlay ({self.settings.hostname})"})
            with urlopen(request, timeout=45) as response:  # noqa: S310 - configured public data endpoint
                csv_text = response.read().decode("utf-8", errors="replace")
            features = []
            for row in csv.DictReader(io.StringIO(csv_text)):
                lat = row.get("latitude")
                lon = row.get("longitude")
                try:
                    lat_f = float(lat) if lat is not None else None
                    lon_f = float(lon) if lon is not None else None
                except ValueError:
                    continue
                if lat_f is None or lon_f is None or not (-90 <= lat_f <= 90 and -180 <= lon_f <= 180):
                    continue
                properties = {key: value for key, value in row.items() if value not in {None, ""}}
                properties.setdefault("source", "NASA FIRMS")
                features.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [lon_f, lat_f]}, "properties": properties})
            payload = {
                "type": "FeatureCollection",
                "features": features,
                "properties": {
                    "source": "NASA FIRMS",
                    "fetched_at": timestamp(),
                    "warning": "Active fire data is informational and may be delayed, incomplete, or wrong."
                },
            }
            output.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
            registry = self.app_db().mark_overlay_refresh("firms_active_hotspots", output_path=output, ok=True, extra={"feature_count": len(features)})
            update_overlay_job(job_id, status="succeeded", step="cached FIRMS snapshot", progress=100, error_message="", output_path=str(output), feature_count=len(features), size_bytes=output.stat().st_size)
            return {"ok": True, "feature_count": len(features), "path": str(output), **registry}
        except Exception as exc:  # noqa: BLE001 - HTTP boundary
            registry = self.app_db().mark_overlay_refresh("firms_active_hotspots", output_path=output if output.exists() else None, ok=False, error=str(exc))
            update_overlay_job(job_id, status="failed", step="FIRMS refresh failed", progress=100, error_message=str(exc), output_path=str(output) if output.exists() else "")
            return {**registry, "ok": False, "error": str(exc)}

    def refresh_weather_alerts_overlay(self) -> dict[str, object]:
        job_id = "nws_active_alerts_refresh"
        update_overlay_job(job_id, overlay_id="nws_active_alerts", type="refresh", status="running", step="fetching NWS alerts", progress=10, error_message="", started_at=timestamp())
        output = self.settings.data_dir / "maps" / "overlays" / "weather" / "nws-alerts-latest.geojson"
        output.parent.mkdir(parents=True, exist_ok=True)
        try:
            request = Request(
                self.settings.nws_alerts_url,
                headers={
                    "User-Agent": f"OIAB weather overlay ({self.settings.hostname})",
                    "Accept": "application/geo+json, application/json",
                },
            )
            with urlopen(request, timeout=35) as response:  # noqa: S310 - configured public data endpoint
                payload = json.loads(response.read().decode("utf-8", errors="replace"))
            if not isinstance(payload, dict) or payload.get("type") != "FeatureCollection":
                raise ValueError("NWS alerts endpoint did not return a GeoJSON FeatureCollection.")
            payload.setdefault("properties", {})
            if isinstance(payload["properties"], dict):
                payload["properties"].update({"source": "National Weather Service", "fetched_at": timestamp()})
            output.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
            feature_count = len(payload.get("features", []))
            registry = self.app_db().mark_overlay_refresh("nws_active_alerts", output_path=output, ok=True, extra={"feature_count": feature_count})
            update_overlay_job(job_id, status="succeeded", step="cached NWS alerts", progress=100, error_message="", output_path=str(output), feature_count=feature_count, size_bytes=output.stat().st_size)
            return {"ok": True, "feature_count": feature_count, "path": str(output), **registry}
        except Exception as exc:  # noqa: BLE001 - HTTP boundary
            registry = self.app_db().mark_overlay_refresh("nws_active_alerts", output_path=output if output.exists() else None, ok=False, error=str(exc))
            update_overlay_job(job_id, status="failed", step="NWS refresh failed", progress=100, error_message=str(exc), output_path=str(output) if output.exists() else "")
            return {**registry, "ok": False, "error": str(exc)}

    def catalog_pack(self, pack_id: str) -> dict:
        for pack in self.map_pack_catalog().get("packs", []):
            if pack.get("id") == pack_id:
                return pack
        raise ValueError("Map pack is not in the catalog.")

    def install_map_pack_sync(self, pack_id: str) -> dict:
        pack = self.catalog_pack(pack_id)
        source_type = str(pack.get("source_type") or "manual")
        if source_type == "direct_pmtiles":
            url = str(pack.get("source_url") or "")
            if not url:
                raise ValueError("This map pack has no download URL yet. Place the .pmtiles file in /data/oiab/maps/packs and rescan.")
            filename = self.safe_upload_name(str(pack.get("expected_filename") or f"{pack_id}.pmtiles"))
            if not filename.endswith(".pmtiles"):
                filename = f"{filename}.pmtiles"
            packs_dir = self.settings.data_dir / "maps" / "packs"
            tmp_dir = self.settings.data_dir / "maps" / "tmp"
            packs_dir.mkdir(parents=True, exist_ok=True)
            tmp_dir.mkdir(parents=True, exist_ok=True)
            part = tmp_dir / f"{filename}.part"
            final = packs_dir / filename
            digest = hashlib.sha256()
            total = 0
            request = Request(url, headers={"User-Agent": "OIAB map-pack-installer/1.0"})
            with urlopen(request, timeout=30) as response, part.open("wb") as fh:  # noqa: S310 - user-configured catalog URLs
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    fh.write(chunk)
                    digest.update(chunk)
                    total += len(chunk)
                    expected_size = pack.get("size_bytes")
                    if expected_size:
                        progress = min(95, max(5, int((total / int(expected_size)) * 95)))
                        update_map_pack_job(pack_id, status="running", progress=progress)
            if total <= 0:
                part.unlink(missing_ok=True)
                raise ValueError("Download completed with zero bytes.")
            expected_size = pack.get("size_bytes")
            if expected_size and int(expected_size) != total:
                part.unlink(missing_ok=True)
                raise ValueError(f"Downloaded size {total} did not match expected size {expected_size}.")
            expected_hash = str(pack.get("checksum") or "").lower().removeprefix("sha256:")
            if expected_hash and digest.hexdigest().lower() != expected_hash:
                part.unlink(missing_ok=True)
                raise ValueError("Downloaded checksum did not match catalog checksum.")
            shutil.move(str(part), str(final))
            self.app_db().upsert_map_pack(
                {
                    "id": pack_id,
                    "name": pack.get("name"),
                    "type": "pmtiles",
                    "path": str(final),
                    "url": f"/maps/packs/{filename}",
                    "style": pack.get("style") or "/maps-v2/map-style.json",
                    "attribution": pack.get("attribution") or "© OpenStreetMap contributors",
                    "catalog": pack,
                },
                active=(pack_id == "world_overview"),
                enabled=True,
            )
            return {"ok": True, "installed": pack_id, "bytes": total, "sha256": digest.hexdigest(), **self.map_packs()}
        if source_type == "extract_from_parent":
            parent = pack.get("parent_source_id")
            filename = self.safe_upload_name(str(pack.get("expected_filename") or f"{pack_id}.pmtiles"))
            if not filename.endswith(".pmtiles"):
                filename = f"{filename}.pmtiles"
            final = self.settings.data_dir / "maps" / "packs" / filename
            part = self.settings.data_dir / "maps" / "tmp" / f"{filename}.part"
            parent_pack = self.catalog_pack(str(parent or ""))
            source = str(parent_pack.get("source_url") or parent_pack.get("install_path") or "")
            if not source:
                raise ValueError("Extraction requires a parent source URL/path.")
            pmtiles = shutil.which("pmtiles")
            command = [pmtiles or "pmtiles", "extract", source, str(part)]
            bbox = pack.get("bbox")
            if bbox and pack_id != "world_overview":
                command.append(f"--bbox={','.join(map(str, bbox))}")
            if pack.get("max_zoom"):
                command.append(f"--maxzoom={pack.get('max_zoom')}")
            if not pmtiles:
                raise ValueError(f"PMTiles CLI is not installed in this environment. Command: {' '.join(command)}")
            part.parent.mkdir(parents=True, exist_ok=True)
            final.parent.mkdir(parents=True, exist_ok=True)
            part.unlink(missing_ok=True)
            update_map_pack_job(pack_id, status="running", progress=10)
            timeout_seconds = int(os.environ.get("OIAB_MAP_EXTRACT_TIMEOUT_SECONDS", "43200"))
            result = subprocess.run(command, text=True, capture_output=True, timeout=timeout_seconds, check=False)
            if result.returncode != 0:
                part.unlink(missing_ok=True)
                raise ValueError((result.stderr or result.stdout or "pmtiles extract failed")[-1000:])
            if not part.exists() or part.stat().st_size <= 0:
                part.unlink(missing_ok=True)
                raise ValueError("Extraction did not create a usable PMTiles file.")
            shutil.move(str(part), str(final))
            self.app_db().upsert_map_pack(
                {
                    "id": pack_id,
                    "name": pack.get("name"),
                    "path": str(final),
                    "url": f"/maps/packs/{filename}",
                    "style": pack.get("style") or "/maps-v2/map-style.json",
                    "attribution": pack.get("attribution") or "© OpenStreetMap contributors",
                    "catalog": pack,
                },
                active=(pack_id == "world_overview"),
                enabled=True,
            )
            return {"ok": True, "installed": pack_id, "stdout": result.stdout[-2000:], **self.map_packs()}
        raise ValueError("This map pack is manual-only. Place the .pmtiles file in /data/oiab/maps/packs and click Rescan.")

    def remove_map_pack(self, pack_id: str) -> dict:
        registry = self.map_packs()
        pack = next((item for item in registry.get("basemaps", []) if item.get("id") == pack_id), None)
        if not pack:
            raise ValueError("Map pack not found.")
        path = self.app_db().resolve_pack_path(str(pack.get("path") or ""))
        if path.exists() and path.is_file():
            path.unlink()
        self.app_db().rescan_map_packs()
        return self.map_packs()

    def system_status(self) -> dict:
        mem = self.read_meminfo()
        network = self.read_network_io()
        disks = []
        for path in [Path("/"), self.settings.data_dir]:
            try:
                usage = shutil.disk_usage(path)
                disks.append({"path": str(path), "total": usage.total, "used": usage.used, "free": usage.free, "percent": round((usage.used / usage.total) * 100, 1)})
            except OSError:
                continue
        temp_c = None
        temp_path = Path("/sys/class/thermal/thermal_zone0/temp")
        if temp_path.exists():
            try:
                temp_c = int(temp_path.read_text(encoding="utf-8").strip()) / 1000
            except (OSError, ValueError):
                temp_c = None
        uptime = 0.0
        try:
            uptime = float(Path("/proc/uptime").read_text(encoding="utf-8").split()[0])
        except (OSError, ValueError, IndexError):
            uptime = time.monotonic()
        return {
            "ok": True,
            "timestamp": datetime.now().isoformat(),
            "load": os.getloadavg() if hasattr(os, "getloadavg") else [0, 0, 0],
            "cpu_count": os.cpu_count(),
            "memory": mem,
            "network": network,
            "temperature_c": temp_c,
            "temperature_f": round((temp_c * 9 / 5) + 32, 1) if temp_c is not None else None,
            "uptime_seconds": uptime,
            "disks": disks,
            "services": list_services(self.settings),
        }

    @staticmethod
    def read_network_io() -> dict:
        interfaces = []
        total_rx = 0
        total_tx = 0
        try:
            lines = Path("/proc/net/dev").read_text(encoding="utf-8").splitlines()[2:]
            for line in lines:
                if ":" not in line:
                    continue
                name, values = line.split(":", 1)
                iface = name.strip()
                if not iface or iface == "lo":
                    continue
                fields = values.split()
                if len(fields) < 16:
                    continue
                rx_bytes = int(fields[0])
                tx_bytes = int(fields[8])
                total_rx += rx_bytes
                total_tx += tx_bytes
                interfaces.append({"name": iface, "rx_bytes": rx_bytes, "tx_bytes": tx_bytes})
        except (OSError, ValueError, IndexError):
            return {"rx_bytes": 0, "tx_bytes": 0, "interfaces": []}
        return {"rx_bytes": total_rx, "tx_bytes": total_tx, "interfaces": interfaces}

    @staticmethod
    def read_meminfo() -> dict:
        data = {}
        try:
            for line in Path("/proc/meminfo").read_text(encoding="utf-8").splitlines():
                key, value = line.split(":", 1)
                data[key] = int(value.strip().split()[0]) * 1024
        except (OSError, ValueError, IndexError):
            return {}
        total = data.get("MemTotal", 0)
        available = data.get("MemAvailable", 0)
        used = max(0, total - available)
        return {"total": total, "available": available, "used": used, "percent": round((used / total) * 100, 1) if total else 0}

    def current_track(self) -> dict:
        return self.app_db().current_track()

    def cache_music_cover(self, cover: dict | None) -> str:
        if not cover:
            return ""
        image_data = cover.get("data") or b""
        if not image_data:
            return ""
        cached_data = thumbnail_cover_bytes(image_data)
        suffix = ".jpg"
        if not cached_data:
            if len(image_data) > COVER_FALLBACK_MAX_BYTES:
                return ""
            cached_data = image_data
            suffix = cover_extension(str(cover.get("mime") or ""))
        digest = hashlib.sha256(
            f"thumb-v1:{COVER_MAX_PIXELS}:{COVER_JPEG_QUALITY}:".encode("utf-8") + image_data
        ).hexdigest()[:24]
        target_dir = self.settings.data_dir / "media" / "music-art"
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir / f"{digest}{suffix}"
        if not target.exists():
            tmp = target.with_suffix(target.suffix + ".tmp")
            tmp.write_bytes(cached_data)
            tmp.replace(target)
        return f"/media/music-art/{quote(target.name)}"

    @staticmethod
    def folder_cover(root: Path, path: Path) -> Path | None:
        for current in [path.parent, *path.parent.parents]:
            if current == root.parent or current == root:
                break
            for name in COVER_NAMES:
                candidate = current / name
                if candidate.is_file():
                    return candidate
        return None

    def music_library(self, refresh: bool = False) -> dict:
        cache = self.settings.data_dir / "media" / "music-library.json"
        if cache.exists() and not refresh:
            cached = read_json(cache, {"ok": True, "tracks": []})
            if cached.get("schema") == MUSIC_SCHEMA_VERSION:
                return cached
        root = self.settings.data_dir / "media" / "music"
        tracks = []
        for path in sorted(root.rglob("*")):
            if not path.is_file() or path.suffix.lower() not in AUDIO_EXTENSIONS:
                continue
            rel = path.relative_to(root)
            folder = str(rel.parent) if str(rel.parent) != "." else "Music"
            tags = id3_metadata(path, want_cover=True)
            title = tags.get("title") or display_title(path)
            album = tags.get("album") or (rel.parent.name if str(rel.parent) != "." else "Unknown Album")
            artist = tags.get("artist") or "Unknown Artist"
            cover_url = self.cache_music_cover(tags.get("cover"))
            if not cover_url:
                cover_path = self.folder_cover(root, path)
                if cover_path:
                    cover_rel = cover_path.relative_to(root).as_posix()
                    cover_url = f"/media/music/{quote(cover_rel)}"
            tracks.append(
                {
                    "id": str(rel),
                    "title": title,
                    "artist": artist,
                    "album": album,
                    "track": tags.get("track", ""),
                    "folder": folder,
                    "audioUrl": f"/media/music/{quote(rel.as_posix())}",
                    "coverUrl": cover_url or "/maps/overland/tunes.png",
                }
            )
        payload = {"ok": True, "schema": MUSIC_SCHEMA_VERSION, "tracks": tracks, "count": len(tracks)}
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return payload

    def visualizer_images(self) -> dict:
        target = self.settings.data_dir / "media" / "music" / "visualizers"
        target.mkdir(parents=True, exist_ok=True)
        extensions = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
        images = []
        for path in sorted(target.rglob("*")):
            if not path.is_file() or path.name.startswith(".") or path.suffix.lower() not in extensions:
                continue
            rel = path.relative_to(target).as_posix()
            images.append(
                {
                    "id": rel,
                    "name": path.stem.replace("-", " ").replace("_", " ").strip().title() or path.name,
                    "filename": path.name,
                    "url": f"/media/music/visualizers/{rel}",
                    "size": path.stat().st_size,
                }
            )
        return {"ok": True, "images": images}

    def rom_library(self) -> dict:
        root = self.settings.data_dir / "games" / "roms"
        root.mkdir(parents=True, exist_ok=True)
        extension_defaults = {
            ".a26": ("atari2600", *ROM_SYSTEMS["atari2600"]),
            ".gb": ("gb", *ROM_SYSTEMS["gb"]),
            ".gba": ("gba", *ROM_SYSTEMS["gba"]),
            ".gbc": ("gbc", *ROM_SYSTEMS["gbc"]),
            ".gen": ("genesis", *ROM_SYSTEMS["genesis"]),
            ".gg": ("gamegear", *ROM_SYSTEMS["gamegear"]),
            ".md": ("genesis", *ROM_SYSTEMS["genesis"]),
            ".n64": ("n64", *ROM_SYSTEMS["n64"]),
            ".nds": ("nds", *ROM_SYSTEMS["nds"]),
            ".nes": ("nes", *ROM_SYSTEMS["nes"]),
            ".sfc": ("snes", *ROM_SYSTEMS["snes"]),
            ".smc": ("snes", *ROM_SYSTEMS["snes"]),
            ".sms": ("mastersystem", *ROM_SYSTEMS["mastersystem"]),
            ".v64": ("n64", *ROM_SYSTEMS["n64"]),
            ".vb": ("virtualboy", *ROM_SYSTEMS["virtualboy"]),
            ".ws": ("wonderswan", *ROM_SYSTEMS["wonderswan"]),
            ".wsc": ("wonderswancolor", *ROM_SYSTEMS["wonderswancolor"]),
            ".z64": ("n64", *ROM_SYSTEMS["n64"]),
        }
        games = []
        systems: dict[str, dict] = {}
        for path in sorted(root.rglob("*")):
            if not path.is_file() or path.name.startswith("."):
                continue
            rel = path.relative_to(root).as_posix()
            first_dir = rel.split("/", 1)[0].lower() if "/" in rel else ""
            if path.suffix.lower() not in ROM_EXTENSIONS:
                continue
            if first_dir in ROM_SYSTEMS:
                system_id = first_dir
                system_title, core = ROM_SYSTEMS[first_dir]
                core_data = (system_id, system_title, core)
            else:
                core_data = extension_defaults.get(path.suffix.lower())
            if not core_data:
                continue
            system_id, system_title, core = core_data
            game = {
                "name": path.stem.replace("_", " ").replace("-", " ").strip() or path.name,
                "filename": path.name,
                "path": rel,
                "url": f"/games/roms/{rel}",
                "system": system_id,
                "systemTitle": system_title,
                "core": core,
                "size": path.stat().st_size,
            }
            games.append(game)
            entry = systems.setdefault(system_id, {"id": system_id, "title": system_title, "count": 0})
            entry["count"] += 1
        emulator_ready = (self.settings.data_dir / "services" / "emulatorjs" / "data" / "loader.js").exists() or (
            REPO_ROOT / "frontend" / "shared" / "emulatorjs" / "data" / "loader.js"
        ).exists() or (
            REPO_ROOT / "frontend" / "shared" / "overland" / "emulatorjs" / "data" / "loader.js"
        ).exists()
        return {"ok": True, "systems": sorted(systems.values(), key=lambda item: item["title"]), "games": games, "emulatorReady": emulator_ready}

    def games_db(self) -> GamesDB:
        return GamesDB(self.settings)

    def open_games(self) -> list[dict]:
        return self.games_db().list_open_games()

    def save_open_games(self, games: list[dict]) -> None:
        db = self.games_db()
        db.clear_open_games()
        for game in games:
            db.save_game(game)

    def persist_mobile_game_result(self, game: dict) -> None:
        if not isinstance(game, dict) or game.get("status") != "complete" or game.get("resultRecorded"):
            return
        game_type = str(game.get("type") or "game")
        winner_mark = str(game.get("winner") or "")
        draw = winner_mark == "draw"
        raw_players = [player for player in game.get("players", []) if isinstance(player, dict)]
        scores: dict[str, int] = {}
        payload = game.get("payload") if isinstance(game.get("payload"), dict) else {}
        if isinstance(game.get("scores"), dict):
            scores.update({str(mark): int(value or 0) for mark, value in game.get("scores", {}).items()})
        if isinstance(payload.get("scores"), dict):
            scores.update({str(mark): int(value or 0) for mark, value in payload.get("scores", {}).items()})
        if game_type == "checkers":
            board = list(payload.get("board") or [])
            scores.setdefault("red", sum(1 for piece in board if checkers_side(piece) == "red"))
            scores.setdefault("black", sum(1 for piece in board if checkers_side(piece) == "black"))
        elif game_type == "connect-four":
            board = list(game.get("board") or [])
            scores.setdefault("R", sum(1 for item in board if item == "R"))
            scores.setdefault("Y", sum(1 for item in board if item == "Y"))
        elif game_type == "battleship":
            ships = payload.get("ships") if isinstance(payload.get("ships"), dict) else {}
            shots = payload.get("shots") if isinstance(payload.get("shots"), dict) else {}
            for mark in ("A", "B"):
                opponent = "B" if mark == "A" else "A"
                scores.setdefault(mark, len(set(shots.get(mark) or []) & set(ships.get(opponent) or [])))
        elif game_type == "hangman":
            guesser = str(payload.get("guesserMark") or "A")
            scores.setdefault(guesser, max(0, len(str(payload.get("word") or "")) - int(payload.get("wrong") or 0)))
        elif game_type == "tic-tac-toe":
            scores.setdefault(winner_mark, 1 if winner_mark and not draw else 0)
        winner_player = next((player for player in raw_players if str(player.get("mark") or "") == winner_mark), None)
        event_players = []
        for player in raw_players:
            mark = str(player.get("mark") or "")
            event_players.append(
                {
                    "id": player.get("id") or mark,
                    "name": player.get("name") or mark or "Player",
                    "mark": mark,
                    "score": int(scores.get(mark, 1 if mark == winner_mark and not draw else 0)),
                }
            )
        self.games_db().record_score(
            {
                "game": game_type,
                "title": game.get("title") or MOBILE_GAME_TITLES.get(game_type, game_type.replace("-", " ").title()),
                "matchId": game.get("id"),
                "gameId": game.get("id"),
                "players": event_players,
                "winner": "draw" if draw else (winner_player.get("name") if winner_player else winner_mark),
                "winnerId": "" if draw else (winner_player.get("id") if winner_player else ""),
                "draw": draw,
                "score": max([player["score"] for player in event_players] or [0]),
                "created": timestamp(),
                "payload": {"winnerMark": winner_mark, "round": game.get("round"), "result": game.get("result")},
            }
        )
        game["resultRecorded"] = True
        game.pop("resultPending", None)

    def handle_mobile_games(self) -> None:
        payload = self.read_body()
        action = form_value(payload, "action", "status")
        games = self.open_games()
        db = self.games_db()
        if action in {"status", ""}:
            public_games = []
            changed = False
            for game in games:
                if game.get("type") == "claimline" and game.get("status") == "active":
                    before_status = game.get("status")
                    claimline_advance(game)
                    if game.get("status") != before_status:
                        changed = True
                        db.save_game(game)
                public_games.append(public_mobile_game(game, form_value(payload, "playerId")))
            return self.send_json({"ok": True, "games": public_games, "activeCount": len(public_games)})
        if action == "create":
            game_type = form_value(payload, "game") or form_value(payload, "type") or form_value(payload, "gameType") or "tic-tac-toe"
            game_type = game_type.strip().lower().replace("_", "-")
            if game_type not in MOBILE_GAME_TITLES:
                game_type = "tic-tac-toe"
            game_id = form_value(payload, "gameId") or f"{MOBILE_GAME_PREFIXES.get(game_type, 'game')}-{int(time.time())}-{secrets.token_hex(3)}"
            mode = form_value(payload, "mode", "pvp").lower()
            if game_type == "claimline":
                mode = mode if mode in {"solo", "timed-battle", "elimination"} else "timed-battle"
            elif mode not in {"pvp", "cpu"}:
                mode = "pvp"
            difficulty = form_value(payload, "difficulty", "medium").lower()
            if difficulty not in {"easy", "medium", "hard"}:
                difficulty = "medium"
            player_id = clean_player_id(form_value(payload, "playerId") or "player")
            player_name = clean_player_name(form_value(payload, "playerName") or "Player")
            mark_a, mark_b = MOBILE_GAME_MARKS.get(game_type, ("A", "B"))[:2]
            players = [{"id": player_id, "name": player_name, "mark": mark_a}]
            if mode == "cpu" and game_type not in {"claimline", "word-grid", "pattern-match"}:
                players.append({"id": cpu_player_id(difficulty), "name": cpu_player_name(difficulty), "mark": mark_b})
            game = {
                "id": game_id,
                "type": game_type,
                "title": MOBILE_GAME_TITLES.get(game_type, game_type.replace("-", " ").title()),
                "status": "active" if mode == "cpu" else "waiting",
                "mode": mode,
                "difficulty": difficulty,
                "players": players,
                "turn": mark_a,
                "winner": "",
                "winningLine": [],
                "round": 1,
                "resultRecorded": False,
                "created": timestamp(),
                "updated": timestamp(),
                "updatedEpoch": time.time(),
            }
            if game_type == "checkers":
                forced_jumps = form_value(payload, "forcedJumps", "1").lower() not in {"0", "false", "no", "off"}
                game.update({"turn": "red", "payload": {"board": checkers_initial_board(), "lastMove": None, "mustContinue": None, "forcedJumps": forced_jumps}})
            elif game_type == "claimline":
                try:
                    duration = max(60, min(300, int(form_value(payload, "duration", "120") or 120)))
                except (TypeError, ValueError):
                    duration = 120
                game.update({"status": "active" if mode == "solo" else "waiting", "turn": "all", "difficulty": f"{duration}s", "payload": claimline_new_payload(mode, duration)})
                claimline_init_player(game, "P1", player_name)
                if mode == "solo":
                    claimline_sync_status(game)
            elif game_type == "chess":
                game.update({"turn": "w", "fen": form_value(payload, "fen", "start"), "history": [], "result": "", "check": False})
            elif game_type == "dots-and-boxes":
                try:
                    size = max(3, min(6, int(form_value(payload, "size", "4") or 4)))
                except (TypeError, ValueError):
                    size = 4
                edge_count = dots_boxes_edge_count(size)
                game.update({"size": size, "edges": [""] * edge_count, "boxes": [""] * (size * size), "scores": {"A": 0, "B": 0}, "lastMove": None})
            elif game_type == "connect-four":
                game.update({"turn": "R", "board": [""] * 42})
            elif game_type == "battleship":
                ship_groups = {"A": random_battleship_ship_groups(6)}
                if mode == "cpu":
                    ship_groups["B"] = random_battleship_ship_groups(6)
                ships = {mark: flatten_battleship_ship_groups(groups) for mark, groups in ship_groups.items()}
                game.update({"payload": {"size": 6, "ships": ships, "shipGroups": ship_groups, "shots": {"A": [], "B": []}, "lastMove": None}})
            elif game_type == "hangman":
                if mode == "pvp":
                    phrase = clean_hangman_phrase(form_value(payload, "word"))
                    game.update({"payload": {"word": phrase, "guessed": [], "wrong": 0, "maxWrong": 6, "lastMove": None, "setterMark": mark_a, "guesserMark": mark_b}, "turn": mark_b})
                else:
                    phrase = clean_hangman_phrase(secrets.choice(HANGMAN_WORDS))
                    game.update({"payload": {"word": phrase, "guessed": [], "wrong": 0, "maxWrong": 6, "lastMove": None, "setterMark": mark_b, "guesserMark": mark_a}})
            elif game_type == "word-grid":
                start_at = time.time() if mode == "cpu" else 0
                game.update({"payload": word_grid_new_payload(start_at, word_grid_min_word_length(difficulty)), "turn": "A"})
            elif game_type == "word-tile-arena":
                game.update({"status": "waiting", "mode": "pvp", "turn": "P1", "payload": word_tile_new_payload()})
            elif game_type == "pattern-match":
                game.update({"status": "active", "mode": "cpu", "turn": "A", "payload": {"sequence": [secrets.randbelow(4)], "scores": {"A": 0}, "lastMove": None}})
            elif game_type == "tic-tac-toe":
                game.update({"turn": "X", "board": [""] * 9})
            else:
                game.setdefault("payload", {})
            db.save_game(game)
            return self.send_json({"ok": True, "game": public_mobile_game(game, player_id), "playerId": player_id, "mark": mark_a, "games": [public_mobile_game(item, player_id) for item in db.list_open_games()]})
        if action == "join":
            game_id = form_value(payload, "gameId")
            player_id = clean_player_id(form_value(payload, "playerId") or "player")
            for game in games:
                if game.get("id") == game_id:
                    player = find_mobile_player(game, player_id)
                    if not player:
                        if game.get("mode") == "cpu" and game.get("status") in {"waiting", "active"}:
                            return self.send_json({"ok": True, "game": public_mobile_game(game, player_id), "playerId": player_id, "mark": "", "observer": True, "games": [public_mobile_game(item, player_id) for item in games]})
                        if game.get("status") == "complete":
                            return self.send_json({"ok": True, "game": public_mobile_game(game, player_id), "playerId": player_id, "mark": "", "observer": True, "games": [public_mobile_game(item, player_id) for item in games]})
                        if game.get("type") == "claimline":
                            payload_state = game.setdefault("payload", claimline_new_payload(game.get("mode", "timed-battle")))
                            max_players = max(2, min(CLAIMLINE_MAX_PLAYERS, int(payload_state.get("maxPlayers") or CLAIMLINE_MAX_PLAYERS)))
                            if len(game.get("players", [])) >= max_players:
                                return self.send_json({"ok": True, "game": public_mobile_game(game, player_id), "playerId": player_id, "mark": "", "observer": True, "games": [public_mobile_game(item, player_id) for item in games]})
                            existing_marks = {item.get("mark") for item in game.get("players", []) if isinstance(item, dict)}
                            mark = next((claimline_player_mark(index) for index in range(max_players) if claimline_player_mark(index) not in existing_marks), claimline_player_mark(len(existing_marks)))
                            player = {"id": player_id, "name": clean_player_name(form_value(payload, "playerName", "Player")), "mark": mark}
                            game.setdefault("players", []).append(player)
                            claimline_init_player(game, mark, player.get("name", "Player"))
                        else:
                            if game.get("type") == "word-tile-arena":
                                if len(game.get("players", [])) >= WORD_TILE_MAX_PLAYERS:
                                    return self.send_json({"ok": True, "game": public_mobile_game(game, player_id), "playerId": player_id, "mark": "", "observer": True, "games": [public_mobile_game(item, player_id) for item in games]})
                                existing_marks = {item.get("mark") for item in game.get("players", []) if isinstance(item, dict)}
                                mark = next((word_tile_player_mark(index) for index in range(WORD_TILE_MAX_PLAYERS) if word_tile_player_mark(index) not in existing_marks), word_tile_player_mark(len(existing_marks)))
                            elif len(game.get("players", [])) >= 2:
                                return self.send_json({"ok": True, "game": public_mobile_game(game, player_id), "playerId": player_id, "mark": "", "observer": True, "games": [public_mobile_game(item, player_id) for item in games]})
                            elif game.get("type") == "chess":
                                mark = "black" if any(item.get("mark") == "white" for item in game.get("players", [])) else "white"
                            elif game.get("type") == "checkers":
                                mark = "black" if any(item.get("mark") == "red" for item in game.get("players", [])) else "red"
                            elif game.get("type") == "connect-four":
                                mark = "Y" if any(item.get("mark") == "R" for item in game.get("players", [])) else "R"
                            elif game.get("type") == "tic-tac-toe":
                                mark = "O" if any(item.get("mark") == "X" for item in game.get("players", [])) else "X"
                            else:
                                mark = "B" if any(item.get("mark") == "A" for item in game.get("players", [])) else "A"
                            player = {"id": player_id, "name": clean_player_name(form_value(payload, "playerName", "Player")), "mark": mark}
                            game.setdefault("players", []).append(player)
                            if game.get("type") == "battleship":
                                payload_state = game.setdefault("payload", {})
                                ship_groups = payload_state.setdefault("shipGroups", {})
                                if mark not in ship_groups:
                                    ship_groups[mark] = random_battleship_ship_groups(int(payload_state.get("size") or 6))
                                ships = payload_state.setdefault("ships", {})
                                ships[mark] = flatten_battleship_ship_groups(ship_groups[mark])
                                payload_state.setdefault("shots", {}).setdefault(mark, [])
                        if len(game.get("players", [])) >= 2 and game.get("status") == "waiting" and game.get("type") != "word-tile-arena":
                            game["status"] = "active"
                            if game.get("type") == "claimline":
                                claimline_sync_status(game)
                            if game.get("type") == "word-grid":
                                start_at = time.time() + WORD_GRID_REVEAL_SECONDS
                                state = game.setdefault("payload", {})
                                state["startAt"] = start_at
                                state["endAt"] = start_at + WORD_GRID_ROUND_SECONDS
                    touch_mobile_game(game)
                    db.save_game(game)
                    return self.send_json({"ok": True, "game": public_mobile_game(game, player_id), "playerId": player_id, "mark": player.get("mark") if player else "", "games": [public_mobile_game(item, player_id) for item in db.list_open_games()]})
        if action == "state":
            game_id = form_value(payload, "gameId")
            game = next((item for item in games if item.get("id") == game_id), None)
            if game and game.get("status") == "active":
                if game.get("type") == "claimline":
                    claimline_advance(game)
                    touch_mobile_game(game)
                    db.save_game(game)
                if game.get("type") == "checkers" and game.get("mode") == "cpu" and game.get("turn") == "black":
                    checkers_cpu_move(game)
                    touch_mobile_game(game)
                    if game.get("status") == "complete":
                        self.persist_mobile_game_result(game)
                    db.save_game(game)
                if game.get("type") == "connect-four" and game.get("mode") == "cpu" and game.get("turn") == "Y":
                    connect_four_cpu_move(game)
                    touch_mobile_game(game)
                    if game.get("status") == "complete":
                        self.persist_mobile_game_result(game)
                    db.save_game(game)
                if game.get("type") == "dots-and-boxes" and game.get("mode") == "cpu" and game.get("turn") == "B":
                    dots_boxes_cpu_move(game)
                    touch_mobile_game(game)
                    if game.get("status") == "complete":
                        self.persist_mobile_game_result(game)
                    db.save_game(game)
                if game.get("type") == "word-grid" and word_grid_round_state(game.get("payload") or {})["expired"]:
                    word_grid_finalize(game)
                    touch_mobile_game(game)
                    self.persist_mobile_game_result(game)
                    db.save_game(game)
            if game and game.get("status") == "complete":
                self.persist_mobile_game_result(game)
                db.save_game(game)
            return self.send_json({"ok": bool(game), "game": public_mobile_game(game, form_value(payload, "playerId")) if game else None, "error": None if game else "Game not found"})
        if action in {"delete", "reset"}:
            game_id = form_value(payload, "gameId")
            if action == "delete":
                games = db.delete_game(game_id)
                return self.send_json({"ok": True, "games": [public_mobile_game(item) for item in games]})
            game = next((item for item in games if item.get("id") == game_id), None)
            if not game:
                return self.send_json({"ok": False, "error": "Game not found."}, status=404)
            if game.get("type") == "checkers":
                forced_jumps = bool((game.get("payload") or {}).get("forcedJumps", True))
                game["payload"] = {"board": checkers_initial_board(), "lastMove": None, "mustContinue": None, "forcedJumps": forced_jumps}
                game["turn"] = "red"
            elif game.get("type") == "claimline":
                try:
                    duration = int((game.get("payload") or {}).get("duration") or 120)
                except (TypeError, ValueError):
                    duration = 120
                game["payload"] = claimline_new_payload(game.get("mode", "timed-battle"), duration)
                for player in game.get("players", []):
                    if isinstance(player, dict):
                        claimline_init_player(game, str(player.get("mark") or ""), player.get("name", "Player"))
            elif game.get("type") == "dots-and-boxes":
                size = int(game.get("size") or 4)
                game["edges"] = [""] * dots_boxes_edge_count(size)
                game["boxes"] = [""] * (size * size)
                game["scores"] = {"A": 0, "B": 0}
                game["turn"] = "A"
                game["lastMove"] = None
            elif game.get("type") == "connect-four":
                game["board"] = [""] * 42
                game["turn"] = "R"
                game["lastMove"] = None
            elif game.get("type") == "battleship":
                size = 6
                ship_groups = {"A": random_battleship_ship_groups(size)}
                if game.get("mode") == "cpu" or any(player.get("mark") == "B" for player in game.get("players", []) if isinstance(player, dict)):
                    ship_groups["B"] = random_battleship_ship_groups(size)
                ships = {mark: flatten_battleship_ship_groups(groups) for mark, groups in ship_groups.items()}
                game["payload"] = {"size": size, "ships": ships, "shipGroups": ship_groups, "shots": {"A": [], "B": []}, "lastMove": None}
                game["turn"] = "A"
            elif game.get("type") == "hangman":
                if game.get("mode") == "pvp":
                    prior = game.get("payload") if isinstance(game.get("payload"), dict) else {}
                    word = clean_hangman_phrase(prior.get("word") or form_value(payload, "word"))
                    game["payload"] = {"word": word, "guessed": [], "wrong": 0, "maxWrong": 6, "lastMove": None, "setterMark": prior.get("setterMark") or "A", "guesserMark": prior.get("guesserMark") or "B"}
                    game["turn"] = game["payload"]["guesserMark"]
                else:
                    game["payload"] = {"word": clean_hangman_phrase(secrets.choice(HANGMAN_WORDS)), "guessed": [], "wrong": 0, "maxWrong": 6, "lastMove": None, "setterMark": "B", "guesserMark": "A"}
                    game["turn"] = "A"
            elif game.get("type") == "word-grid":
                start_at = time.time() if game.get("mode") == "cpu" else (time.time() + WORD_GRID_REVEAL_SECONDS if len(game.get("players", [])) >= 2 else 0)
                game["payload"] = word_grid_new_payload(start_at, word_grid_min_word_length(game.get("difficulty")))
                game["turn"] = "A"
            elif game.get("type") == "word-tile-arena":
                game["payload"] = word_tile_new_payload()
                game["turn"] = "P1"
                game["mode"] = "pvp"
                game["status"] = "waiting"
            elif game.get("type") == "pattern-match":
                game["payload"] = {"sequence": [secrets.randbelow(4)], "scores": {"A": 0}, "lastMove": None}
                game["turn"] = "A"
                game["mode"] = "cpu"
            else:
                game["winner"] = ""
            game["winner"] = ""
            game["winningLine"] = []
            game["resultRecorded"] = False
            game.pop("resultPending", None)
            game["round"] = int(game.get("round") or 1) + 1
            if game.get("type") != "word-tile-arena":
                game["status"] = "active" if len(game.get("players", [])) >= 2 or game.get("mode") in {"cpu", "solo"} else "waiting"
            touch_mobile_game(game)
            db.save_game(game)
            return self.send_json({"ok": True, "game": public_mobile_game(game, form_value(payload, "playerId"))})
        if action == "move":
            game_id = form_value(payload, "gameId")
            for game in games:
                if game.get("id") == game_id:
                    player_id = form_value(payload, "playerId")
                    player = find_mobile_player(game, player_id)
                    if not player:
                        return self.send_json({"ok": False, "error": "Join the game before making a move."}, status=400)
                    word_tile_starting = game.get("type") == "word-tile-arena" and form_value(payload, "wordAction", "play").lower() == "start"
                    if game.get("status") != "active" and not word_tile_starting:
                        return self.send_json({"ok": False, "error": "Waiting for a second player."}, status=400)
                    if game.get("type") == "checkers":
                        if player.get("mark") != game.get("turn"):
                            return self.send_json({"ok": False, "error": "It is not your turn."}, status=400)
                        try:
                            checkers_apply_move(game, int(form_value(payload, "from")), int(form_value(payload, "to")), str(player.get("mark")))
                            checkers_cpu_move(game)
                        except ValueError as exc:
                            return self.send_json({"ok": False, "error": str(exc)}, status=400)
                    elif game.get("type") == "claimline":
                        claimline_set_input(game, player, payload)
                    elif game.get("type") == "chess":
                        game["fen"] = form_value(payload, "fen", game.get("fen") or "start")[:160]
                        move = form_value(payload, "move")
                        if move:
                            game.setdefault("history", []).append(move[:12])
                        game["turn"] = "w" if form_value(payload, "turn", "b" if game.get("turn") == "w" else "w") == "w" else "b"
                        game["check"] = form_value(payload, "check", "").lower() in {"1", "true", "yes", "on"}
                        if form_value(payload, "status") == "complete" or form_value(payload, "winner") or form_value(payload, "result"):
                            game["status"] = "complete"
                            game["winner"] = form_value(payload, "winner")
                            game["result"] = form_value(payload, "result")[:30]
                    elif game.get("type") == "dots-and-boxes":
                        if player.get("mark") != game.get("turn"):
                            return self.send_json({"ok": False, "error": "It is not your turn."}, status=400)
                        try:
                            dots_boxes_apply_move(game, int(form_value(payload, "edge")), str(player.get("mark")))
                            dots_boxes_cpu_move(game)
                        except (TypeError, ValueError) as exc:
                            return self.send_json({"ok": False, "error": str(exc)}, status=400)
                    elif game.get("type") == "connect-four":
                        if player.get("mark") != game.get("turn"):
                            return self.send_json({"ok": False, "error": "It is not your turn."}, status=400)
                        try:
                            connect_four_apply_move(game, int(form_value(payload, "column")), str(player.get("mark")))
                            connect_four_cpu_move(game)
                        except (TypeError, ValueError) as exc:
                            return self.send_json({"ok": False, "error": str(exc)}, status=400)
                    elif game.get("type") == "battleship":
                        if player.get("mark") != game.get("turn"):
                            return self.send_json({"ok": False, "error": "It is not your turn."}, status=400)
                        try:
                            battleship_apply_move(game, int(form_value(payload, "cell")), str(player.get("mark")))
                            battleship_cpu_move(game)
                        except (TypeError, ValueError) as exc:
                            return self.send_json({"ok": False, "error": str(exc)}, status=400)
                    elif game.get("type") == "hangman":
                        try:
                            hangman_apply_move(game, form_value(payload, "letter"), str(player.get("mark")))
                        except ValueError as exc:
                            return self.send_json({"ok": False, "error": str(exc)}, status=400)
                    elif game.get("type") == "word-grid":
                        try:
                            word_grid_apply_move(game, form_value(payload, "word"), str(player.get("mark")))
                        except ValueError as exc:
                            return self.send_json({"ok": False, "error": str(exc)}, status=400)
                    elif game.get("type") == "word-tile-arena":
                        try:
                            word_action = form_value(payload, "wordAction", "play").lower()
                            if word_action == "start":
                                if str(player.get("mark") or "") != "P1":
                                    raise ValueError("Only the host can start Word Tile Arena.")
                                word_tile_start_game(game)
                            elif word_action == "exchange":
                                word_tile_exchange(game, player, form_value(payload, "tileIds", "[]"))
                            elif word_action == "pass":
                                word_tile_pass(game, player)
                            else:
                                word_tile_apply_play(game, player, form_value(payload, "placements", "[]"))
                        except ValueError as exc:
                            return self.send_json({"ok": False, "error": str(exc)}, status=400)
                    elif game.get("type") == "pattern-match":
                        try:
                            pattern_apply_move(game, form_value(payload, "pattern"), str(player.get("mark")))
                        except ValueError as exc:
                            return self.send_json({"ok": False, "error": str(exc)}, status=400)
                    else:
                        game["lastMove"] = payload
                        for key, value in payload.items():
                            if key not in {"action", "gameId", "playerId"} and value is not None:
                                game[key] = value
                    touch_mobile_game(game)
                    if game.get("status") == "complete":
                        self.persist_mobile_game_result(game)
                    db.save_game(game)
                    return self.send_json({"ok": True, "game": public_mobile_game(game, form_value(payload, "playerId")), "games": [public_mobile_game(item, form_value(payload, "playerId")) for item in db.list_open_games()]})
        return self.send_json({"ok": True, "games": [public_mobile_game(item) for item in games]})

    def scoreboard(self) -> dict:
        return self.games_db().scoreboard()

    def handle_game_stats(self) -> None:
        payload = self.read_body()
        action = payload.get("action", "scoreboard")
        if action in {"scoreboard", ""}:
            return self.send_json({"ok": True, "scoreboard": self.scoreboard()})
        if action == "active-games":
            games = self.open_games()
            return self.send_json({"ok": True, "games": games, "activeGames": games})
        if action == "clear-active-games":
            games = self.games_db().clear_open_games()
            return self.send_json({"ok": True, "games": games, "activeGames": games})
        if action == "clear-active-game":
            game_id = payload.get("gameId")
            games = self.games_db().delete_game(game_id)
            return self.send_json({"ok": True, "games": games, "activeGames": games})
        if action == "merge":
            try:
                scoreboard = self.games_db().merge_identities(payload.get("sourceId", ""), payload.get("targetId", ""))
                return self.send_json({"ok": True, "scoreboard": scoreboard})
            except ValueError as exc:
                return self.send_json({"ok": False, "error": str(exc)}, status=400)
        if action == "wipe":
            scoreboard = self.games_db().wipe_scores(str(payload.get("game") or "all"))
            return self.send_json({"ok": True, "scoreboard": scoreboard})
        if str(action).startswith("record-"):
            scoreboard = self.games_db().record_score(payload)
            return self.send_json({"ok": True, "scoreboard": scoreboard})
        return self.send_json({"ok": True, "scoreboard": self.scoreboard()})

    def license_plates(self) -> dict:
        return self.games_db().license_plates()

    def handle_license_plates(self) -> None:
        payload = self.read_body()
        data = self.games_db().save_license_plates(payload)
        return self.send_json({"ok": True, **data})

    def trivia_questions_dir(self) -> Path:
        target = self.settings.data_dir / "trivia" / "questions"
        target.mkdir(parents=True, exist_ok=True)
        return target

    def trivia_question_files(self) -> dict:
        files = []
        for path in sorted(self.trivia_questions_dir().glob("*.json")):
            if path.name.startswith("."):
                continue
            files.append({"name": path.name, "size": path.stat().st_size, "updated": datetime.fromtimestamp(path.stat().st_mtime).isoformat()})
        return {"ok": True, "path": str(self.trivia_questions_dir()), "files": files, "manifest": self.trivia_manifest()}

    def trivia_manifest(self) -> dict:
        categories = []
        total = 0
        for path in sorted(self.trivia_questions_dir().glob("*.json")):
            if path.name == "manifest.json" or path.name.startswith("."):
                continue
            data = read_json(path, {})
            questions = data.get("questions", []) if isinstance(data, dict) else []
            difficulties = {"easy": 0, "medium": 0, "hard": 0}
            for question in questions:
                difficulty = str(question.get("difficulty") or "").lower() if isinstance(question, dict) else ""
                if difficulty in difficulties:
                    difficulties[difficulty] += 1
            count = len(questions)
            total += count
            slug = data.get("slug") or path.stem if isinstance(data, dict) else path.stem
            category = data.get("category") or slug.replace("-", " ").title() if isinstance(data, dict) else path.stem.replace("-", " ").title()
            categories.append({"category": category, "slug": slug, "file": path.name, "questionCount": count, "difficulties": difficulties})
        return {"version": 1, "categories": categories, "totalQuestions": total}

    def handle_trivia_question_upload(self) -> None:
        try:
            content_type = self.headers.get("Content-Type", "")
            if "multipart/form-data" not in content_type:
                return self.send_json({"ok": False, "error": "Expected multipart/form-data with a file field."}, status=400)
            upload = self.read_multipart_upload("file")
            if not upload:
                return self.send_json({"ok": False, "error": "No file provided."}, status=400)
            filename = self.safe_upload_name(Path(upload["filename"]).name)
            if not filename.endswith(".json"):
                return self.send_json({"ok": False, "error": "Trivia question files must be .json."}, status=400)
            raw = upload["content"]
            data = json.loads(raw.decode("utf-8"))
            if filename != "manifest.json" and (not isinstance(data, dict) or not isinstance(data.get("questions"), list)):
                return self.send_json({"ok": False, "error": "Question JSON must contain a questions array."}, status=400)
            target = self.trivia_questions_dir() / filename
            target.write_bytes(raw)
            return self.send_json({"ok": True, "file": filename, "files": self.trivia_question_files()["files"]})
        except json.JSONDecodeError as exc:
            return self.send_json({"ok": False, "error": f"Invalid JSON: {exc}"}, status=400)
        except Exception as exc:  # noqa: BLE001 - HTTP boundary
            return self.send_json({"ok": False, "error": str(exc)}, status=500)

    def upload_targets(self) -> list[dict]:
        return [
            {
                "id": "music",
                "title": "Music",
                "description": "Audio files for the persistent OIAB music player.",
                "path": str(self.settings.data_dir / "media" / "music"),
                "publicBase": "/media/music/",
                "accept": ".mp3,.m4a,.aac,.ogg,.wav,.flac",
                "extensions": [".mp3", ".m4a", ".aac", ".ogg", ".wav", ".flac"],
            },
            {
                "id": "trivia",
                "title": "Trivia Questions",
                "description": "Trail Trivia category JSON files.",
                "path": str(self.trivia_questions_dir()),
                "publicBase": "/trivia/questions/",
                "accept": "application/json,.json",
                "extensions": [".json"],
            },
            {
                "id": "maps",
                "title": "Map Packs",
                "description": "Local PMTiles archives for Maps v2. Large packs are usually copied directly to disk.",
                "path": str(self.settings.data_dir / "maps" / "packs"),
                "publicBase": "/maps/packs/",
                "accept": ".pmtiles",
                "extensions": [".pmtiles"],
            },
            {
                "id": "books",
                "title": "Books",
                "description": "Komga ebook/PDF library files.",
                "path": str(self.settings.data_dir / "media" / "books"),
                "publicBase": "/media/books/",
                "accept": ".epub,.pdf,.cbz,.cbr",
                "extensions": [".epub", ".pdf", ".cbz", ".cbr"],
            },
            {
                "id": "comics",
                "title": "Comics",
                "description": "Komga comic archives and PDFs.",
                "path": str(self.settings.data_dir / "media" / "comics"),
                "publicBase": "/media/comics/",
                "accept": ".cbz,.cbr,.pdf",
                "extensions": [".cbz", ".cbr", ".pdf"],
            },
            {
                "id": "zim",
                "title": "Kiwix ZIM",
                "description": "Offline Wikipedia/Kiwix ZIM files.",
                "path": str(self.settings.data_dir / "content" / "zim"),
                "publicBase": "/content/zim/",
                "accept": ".zim",
                "extensions": [".zim"],
            },
            {
                "id": "roms",
                "title": "ROMs",
                "description": "Local emulator ROM library. Only upload ROMs you are legally allowed to use.",
                "path": str(self.settings.data_dir / "games" / "roms"),
                "publicBase": "/games/roms/",
                "accept": ".nes,.sfc,.smc,.gba,.gb,.gbc,.gen,.md,.sms,.gg,.n64,.z64,.v64,.zip",
                "extensions": [".nes", ".sfc", ".smc", ".gba", ".gb", ".gbc", ".gen", ".md", ".sms", ".gg", ".n64", ".z64", ".v64", ".zip"],
            },
            {
                "id": "visualizers",
                "title": "Visualizer Images",
                "description": "Images usable by music visualizer modes.",
                "path": str(self.settings.data_dir / "media" / "music" / "visualizers"),
                "publicBase": "/media/music/visualizers/",
                "accept": ".png,.jpg,.jpeg,.webp,.gif",
                "extensions": [".png", ".jpg", ".jpeg", ".webp", ".gif"],
            },
            {
                "id": "uploads",
                "title": "General Uploads",
                "description": "General-purpose local files.",
                "path": str(self.settings.data_dir / "media" / "uploads"),
                "publicBase": "/uploads/",
                "accept": "",
                "extensions": [],
            },
        ]

    def upload_target(self, target_id: str) -> dict:
        target_id = str(target_id or "uploads").strip().lower()
        targets = {target["id"]: target for target in self.upload_targets()}
        if target_id not in targets:
            raise ValueError(f"Unknown upload target: {target_id}")
        return targets[target_id]

    def upload_files(self, target_id: str) -> dict:
        try:
            target = self.upload_target(target_id)
        except ValueError as exc:
            return {"ok": False, "error": str(exc), "files": []}
        root = Path(target["path"])
        root.mkdir(parents=True, exist_ok=True)
        files = []
        for path in sorted(root.rglob("*")):
            if not path.is_file() or path.name.startswith("."):
                continue
            rel = path.relative_to(root).as_posix()
            files.append(
                {
                    "name": rel,
                    "size": path.stat().st_size,
                    "updated": datetime.fromtimestamp(path.stat().st_mtime).isoformat(),
                    "url": f"{target['publicBase']}{rel}",
                }
            )
        return {"ok": True, "target": target, "files": files}

    def handle_file_upload(self, target_id: str) -> None:
        try:
            content_type = self.headers.get("Content-Type", "")
            if "multipart/form-data" not in content_type:
                return self.send_json({"ok": False, "error": "Expected multipart/form-data with a file field."}, status=400)
            target = self.upload_target(target_id)
            upload = self.read_multipart_upload("file")
            if not upload:
                return self.send_json({"ok": False, "error": "No file provided."}, status=400)
            filename = self.safe_upload_name(Path(upload["filename"]).name)
            suffix = Path(filename).suffix.lower()
            allowed = [str(ext).lower() for ext in target.get("extensions", [])]
            if allowed and suffix not in allowed:
                return self.send_json({"ok": False, "error": f"{target['title']} uploads must use: {', '.join(allowed)}"}, status=400)
            raw = upload["content"]
            if target["id"] == "trivia":
                try:
                    data = json.loads(raw.decode("utf-8"))
                except json.JSONDecodeError as exc:
                    return self.send_json({"ok": False, "error": f"Invalid JSON: {exc}"}, status=400)
                if filename != "manifest.json" and (not isinstance(data, dict) or not isinstance(data.get("questions"), list)):
                    return self.send_json({"ok": False, "error": "Question JSON must contain a questions array."}, status=400)
            root = Path(target["path"])
            root.mkdir(parents=True, exist_ok=True)
            destination = root / filename
            destination.write_bytes(raw)
            if target["id"] == "music":
                cache = self.settings.data_dir / "media" / "music-library.json"
                if cache.exists():
                    cache.unlink()
            if target["id"] == "maps":
                self.app_db().rescan_map_packs()
            return self.send_json({"ok": True, "target": target["id"], "file": filename, "files": self.upload_files(target["id"]).get("files", [])})
        except ValueError as exc:
            return self.send_json({"ok": False, "error": str(exc)}, status=400)
        except Exception as exc:  # noqa: BLE001 - HTTP boundary
            return self.send_json({"ok": False, "error": str(exc)}, status=500)

    @staticmethod
    def safe_upload_name(name: str) -> str:
        cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", name).strip(".-")
        return cleaned or "upload.json"

    def read_multipart_upload(self, field_name: str) -> dict | None:
        content_type = self.headers.get("Content-Type", "")
        match = re.search(r'boundary="?([^";]+)"?', content_type)
        if not match:
            return None
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return None
        raw = self.rfile.read(length)
        boundary = ("--" + match.group(1)).encode("utf-8")
        for part in raw.split(boundary):
            part = part.strip(b"\r\n")
            if not part or part == b"--" or b"\r\n\r\n" not in part:
                continue
            header_blob, body = part.split(b"\r\n\r\n", 1)
            headers = header_blob.decode("utf-8", errors="replace")
            if f'name="{field_name}"' not in headers:
                continue
            filename_match = re.search(r'filename="([^"]*)"', headers)
            filename = filename_match.group(1) if filename_match else ""
            if body.endswith(b"\r\n"):
                body = body[:-2]
            if body.endswith(b"--"):
                body = body[:-2]
            return {"filename": filename, "content": body}
        return None

    def app_layout(self) -> dict:
        settings_pin = str(self.app_db().app_setting("settings_pin", self.settings.settings_pin) or self.settings.settings_pin)
        return {
            "schema": 1,
            "settingsPassword": settings_pin,
            "hiddenAppIds": ["legacy-home", "legacy-admin", "https-settings", "service-manager", "audio-test", "minecraft"],
            "folders": [
                {"id": "games", "title": "Games", "icon": "/maps/overland/overland-folder-games.svg", "protected": False, "appIds": ["scoreboard", "chess", "checkers", "minesweeper", "blockfall", "claimline", "blank-slate", "word-tile-arena", "connect-four", "battleship", "dots-and-boxes", "hangman", "word-grid", "pattern-match", "web-emulator", "minecraft-map", "drums", "trivia", "tic-tac-toe", "license-plates"]},
            ],
        }


def run() -> None:
    parser = argparse.ArgumentParser(description="Run the Overland In A Box standalone backend.")
    parser.add_argument("--host", default=SETTINGS.bind_host)
    parser.add_argument("--port", type=int, default=SETTINGS.http_port)
    args = parser.parse_args()
    ensure_data_layout(SETTINGS)
    bootstrap = ensure_default_world_map(SETTINGS)
    start_track_recorder(SETTINGS)
    handler = OIABHandler
    handler.settings = SETTINGS
    httpd = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"OIAB serving http://{args.host}:{args.port} with data at {SETTINGS.data_dir}")
    print(f"Map bootstrap: {bootstrap.get('status')}")
    httpd.serve_forever()


if __name__ == "__main__":
    run()
