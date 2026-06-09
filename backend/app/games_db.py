from __future__ import annotations

import json
import sqlite3
from collections import defaultdict
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Iterator

from .config import Settings
from .storage import read_json


DEFAULT_SCOREBOARD = {"totals": {"matches": 0, "players": 0}, "overall": [], "games": {}, "recent": [], "players": []}

DEFAULT_SERVER_PLAYERS = [
    {"id": "player-driver", "name": "Driver", "icon": "compass", "sortOrder": 10},
    {"id": "player-navigator", "name": "Navigator", "icon": "map", "sortOrder": 20},
    {"id": "player-scout", "name": "Scout", "icon": "mountain", "sortOrder": 30},
    {"id": "player-ranger", "name": "Ranger", "icon": "tent", "sortOrder": 40},
    {"id": "player-cpu", "name": "Computer", "icon": "star", "sortOrder": 900},
]

CPU_PLAYER_ID = "player-cpu"


def now_iso() -> str:
    return datetime.now().isoformat()


def json_dumps(value: Any) -> str:
    return json.dumps(value, indent=2, sort_keys=True, default=str)


def json_loads(value: str | None, fallback: Any) -> Any:
    if not value:
        return fallback
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback


def normalize_game_type(value: str | None) -> str:
    raw = str(value or "game").strip().lower().replace("_", "-")
    return raw.removeprefix("record-") or "game"


def is_cpu_identity(player_id: str | None = "", name: str | None = "") -> bool:
    raw_id = str(player_id or "").strip().lower()
    raw = f"{player_id or ''} {name or ''}".lower()
    normalized = " ".join("".join(ch if ch.isalnum() else " " for ch in raw).split())
    normalized_name = " ".join("".join(ch if ch.isalnum() else " " for ch in str(name or "").lower()).split())
    return (
        raw_id.startswith("cpu")
        or raw_id.startswith("computer")
        or normalized == "cpu"
        or normalized.startswith("cpu ")
        or normalized == "computer"
        or normalized.startswith("computer ")
        or normalized_name == "computer"
        or normalized_name.startswith("computer ")
    )


class GamesDB:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.db_path = settings.data_dir / "games" / "oiab-games.sqlite3"
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.init()

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.db_path, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA busy_timeout=5000")
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA journal_mode=WAL")
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def init(self) -> None:
        with self.connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS game_sessions (
                  id TEXT PRIMARY KEY,
                  game_type TEXT NOT NULL,
                  title TEXT,
                  status TEXT NOT NULL,
                  mode TEXT,
                  difficulty TEXT,
                  payload_json TEXT NOT NULL,
                  created_at TEXT NOT NULL,
                  updated_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_game_sessions_status
                  ON game_sessions(status, updated_at);

                CREATE TABLE IF NOT EXISTS score_events (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  game_type TEXT NOT NULL,
                  title TEXT,
                  match_id TEXT,
                  player_id TEXT,
                  player_name TEXT,
                  winner_id TEXT,
                  winner_name TEXT,
                  draw INTEGER NOT NULL DEFAULT 0,
                  score INTEGER NOT NULL DEFAULT 0,
                  payload_json TEXT NOT NULL,
                  created_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_score_events_game_type
                  ON score_events(game_type, created_at);

                CREATE TABLE IF NOT EXISTS player_identities (
                  id TEXT PRIMARY KEY,
                  canonical_id TEXT NOT NULL,
                  name TEXT NOT NULL,
                  aliases_json TEXT NOT NULL DEFAULT '[]',
                  is_cpu INTEGER NOT NULL DEFAULT 0,
                  created_at TEXT NOT NULL,
                  updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS server_players (
                  id TEXT PRIMARY KEY,
                  name TEXT NOT NULL,
                  icon TEXT NOT NULL DEFAULT 'compass',
                  active INTEGER NOT NULL DEFAULT 1,
                  sort_order INTEGER NOT NULL DEFAULT 0,
                  created_at TEXT NOT NULL,
                  updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS kv_store (
                  namespace TEXT NOT NULL,
                  key TEXT NOT NULL,
                  value_json TEXT NOT NULL,
                  updated_at TEXT NOT NULL,
                  PRIMARY KEY (namespace, key)
                );
                """
            )
        self.seed_default_players()
        self.import_legacy_json_once()

    def seed_default_players(self) -> None:
        with self.connect() as conn:
            created = now_iso()
            for player in DEFAULT_SERVER_PLAYERS:
                conn.execute(
                    """
                    INSERT INTO server_players(id, name, icon, active, sort_order, created_at, updated_at)
                    VALUES (?, ?, ?, 1, ?, ?, ?)
                    ON CONFLICT(id) DO NOTHING
                    """,
                    (
                        player["id"],
                        player["name"],
                        player["icon"],
                        int(player.get("sortOrder") or 0),
                        created,
                        created,
                    ),
                )

    def list_server_players(self, include_inactive: bool = False) -> list[dict]:
        where = "" if include_inactive else "WHERE active = 1"
        with self.connect() as conn:
            rows = conn.execute(
                f"""
                SELECT id, name, icon, active, sort_order, created_at, updated_at
                FROM server_players
                {where}
                ORDER BY sort_order ASC, name COLLATE NOCASE ASC
                """
            ).fetchall()
        return [
            {
                "id": str(row["id"]),
                "name": str(row["name"]),
                "icon": str(row["icon"] or "compass"),
                "active": bool(row["active"]),
                "sortOrder": int(row["sort_order"] or 0),
                "createdAt": row["created_at"],
                "updatedAt": row["updated_at"],
            }
            for row in rows
        ]

    def save_server_player(self, payload: dict) -> dict:
        player_id = str(payload.get("id") or "").strip()
        name = str(payload.get("name") or "").strip()[:24]
        icon = str(payload.get("icon") or "compass").strip()[:64] or "compass"
        if not name:
            raise ValueError("Player name is required.")
        if not player_id:
            player_id = f"player-{''.join(ch.lower() if ch.isalnum() else '-' for ch in name).strip('-') or 'custom'}"
        player_id = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in player_id).strip("-_")[:64] or "player"
        try:
            sort_order = int(payload.get("sortOrder") or 0)
        except (TypeError, ValueError):
            sort_order = 0
        active = 1 if payload.get("active", True) else 0
        now = now_iso()
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO server_players(id, name, icon, active, sort_order, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  name = excluded.name,
                  icon = excluded.icon,
                  active = excluded.active,
                  sort_order = excluded.sort_order,
                  updated_at = excluded.updated_at
                """,
                (player_id, name, icon, active, sort_order, now, now),
            )
        return {"id": player_id, "name": name, "icon": icon, "active": bool(active), "sortOrder": sort_order}

    def delete_server_player(self, player_id: str | None) -> list[dict]:
        pid = str(player_id or "").strip()
        if pid == CPU_PLAYER_ID:
            return self.list_server_players(include_inactive=True)
        if pid:
            with self.connect() as conn:
                conn.execute("UPDATE server_players SET active = 0, updated_at = ? WHERE id = ?", (now_iso(), pid))
        return self.list_server_players(include_inactive=True)

    def import_legacy_json_once(self) -> None:
        if self.kv_get("migrations", "json_import_v1"):
            return

        games_file = self.settings.data_dir / "games" / "mobile-games.json"
        games = read_json(games_file, {"games": []}).get("games", [])
        for game in games:
            if isinstance(game, dict) and game.get("id"):
                self.save_game(game)

        scoreboard_file = self.settings.data_dir / "games" / "scoreboard.json"
        scoreboard = read_json(scoreboard_file, {})
        for event in scoreboard.get("recent", []) if isinstance(scoreboard, dict) else []:
            if isinstance(event, dict):
                self.record_score(event)

        plates_file = self.settings.data_dir / "games" / "license-plates.json"
        plates = read_json(plates_file, None)
        if isinstance(plates, dict):
            self.kv_set("license-plates", "state", plates)

        self.kv_set("migrations", "json_import_v1", {"imported_at": now_iso()})

    def kv_get(self, namespace: str, key: str, fallback: Any = None) -> Any:
        with self.connect() as conn:
            row = conn.execute(
                "SELECT value_json FROM kv_store WHERE namespace = ? AND key = ?",
                (namespace, key),
            ).fetchone()
            return json_loads(row["value_json"], fallback) if row else fallback

    def kv_set(self, namespace: str, key: str, value: Any) -> None:
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO kv_store(namespace, key, value_json, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(namespace, key) DO UPDATE SET
                  value_json = excluded.value_json,
                  updated_at = excluded.updated_at
                """,
                (namespace, key, json_dumps(value), now_iso()),
            )

    def register_player(self, player_id: str | None, name: str | None) -> None:
        if not player_id and not name:
            return
        pid = str(player_id or name or "player").strip()
        pname = str(name or pid).strip() or pid
        is_cpu = 1 if is_cpu_identity(pid, pname) else 0
        canonical = CPU_PLAYER_ID if is_cpu else pid
        created = now_iso()
        with self.connect() as conn:
            row = conn.execute("SELECT aliases_json, name FROM player_identities WHERE id = ?", (pid,)).fetchone()
            aliases = json_loads(row["aliases_json"], []) if row else []
            if row and row["name"] != pname and pname not in aliases:
                aliases.append(pname)
            conn.execute(
                """
                INSERT INTO player_identities(id, canonical_id, name, aliases_json, is_cpu, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  canonical_id = excluded.canonical_id,
                  name = excluded.name,
                  aliases_json = excluded.aliases_json,
                  is_cpu = excluded.is_cpu,
                  updated_at = excluded.updated_at
                """,
                (pid, canonical, pname, json_dumps(aliases), is_cpu, created, created),
            )

    def canonical_id(self, player_id: str | None) -> str:
        pid = str(player_id or "").strip()
        if not pid:
            return ""
        if is_cpu_identity(pid, pid):
            return CPU_PLAYER_ID
        with self.connect() as conn:
            row = conn.execute("SELECT canonical_id FROM player_identities WHERE id = ?", (pid,)).fetchone()
            return str(row["canonical_id"]) if row else pid

    def player_name(self, player_id: str | None, fallback: str | None = None) -> str:
        pid = str(player_id or "").strip()
        if not pid:
            return str(fallback or "Player")
        canonical = self.canonical_id(pid)
        with self.connect() as conn:
            row = conn.execute("SELECT name FROM server_players WHERE id = ? AND active = 1", (canonical,)).fetchone()
            if row:
                return str(row["name"])
            row = conn.execute("SELECT name FROM player_identities WHERE id = ?", (canonical,)).fetchone()
            return str(row["name"]) if row else str(fallback or pid)

    def merge_identities(self, source_id: str, target_id: str) -> dict:
        source_id = str(source_id or "").strip()
        target_id = str(target_id or "").strip()
        if not source_id or not target_id or source_id == target_id:
            raise ValueError("Choose two different identities.")

        with self.connect() as conn:
            source = conn.execute("SELECT * FROM player_identities WHERE id = ?", (source_id,)).fetchone()
            target = conn.execute("SELECT * FROM player_identities WHERE id = ?", (target_id,)).fetchone()
            if not source or not target:
                raise ValueError("Both identities must exist before merging.")
            if source["is_cpu"] or target["is_cpu"]:
                raise ValueError("Computer identities cannot be merged.")
            aliases = set(json_loads(target["aliases_json"], []))
            aliases.add(source["name"])
            aliases.add(source_id)
            aliases.update(json_loads(source["aliases_json"], []))
            conn.execute(
                "UPDATE player_identities SET canonical_id = ?, updated_at = ? WHERE id = ?",
                (target_id, now_iso(), source_id),
            )
            conn.execute(
                "UPDATE player_identities SET aliases_json = ?, updated_at = ? WHERE id = ?",
                (json_dumps(sorted(alias for alias in aliases if alias and alias != target["name"])), now_iso(), target_id),
            )
        return self.scoreboard()

    def list_open_games(self) -> list[dict]:
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT payload_json FROM game_sessions
                WHERE status NOT IN ('complete', 'finished', 'deleted')
                ORDER BY updated_at DESC
                """
            ).fetchall()
            return [json_loads(row["payload_json"], {}) for row in rows]

    def get_game(self, game_id: str | None) -> dict | None:
        if not game_id:
            return None
        with self.connect() as conn:
            row = conn.execute("SELECT payload_json FROM game_sessions WHERE id = ?", (game_id,)).fetchone()
            return json_loads(row["payload_json"], {}) if row else None

    def save_game(self, game: dict) -> dict:
        game_id = str(game.get("id") or "").strip()
        if not game_id:
            raise ValueError("Game id is required.")
        game_type = normalize_game_type(game.get("type") or game.get("game") or game.get("gameType"))
        game.setdefault("type", game_type)
        game.setdefault("title", game_type.replace("-", " ").title())
        game.setdefault("status", "waiting")
        game.setdefault("created", now_iso())
        game["updated"] = now_iso()
        for player in game.get("players", []) if isinstance(game.get("players"), list) else []:
            self.register_player(player.get("id"), player.get("name"))
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO game_sessions(id, game_type, title, status, mode, difficulty, payload_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  game_type = excluded.game_type,
                  title = excluded.title,
                  status = excluded.status,
                  mode = excluded.mode,
                  difficulty = excluded.difficulty,
                  payload_json = excluded.payload_json,
                  updated_at = excluded.updated_at
                """,
                (
                    game_id,
                    game_type,
                    game.get("title"),
                    game.get("status") or "waiting",
                    game.get("mode"),
                    game.get("difficulty"),
                    json_dumps(game),
                    game.get("created") or now_iso(),
                    game["updated"],
                ),
            )
        return game

    def delete_game(self, game_id: str | None) -> list[dict]:
        if game_id:
            with self.connect() as conn:
                conn.execute("DELETE FROM game_sessions WHERE id = ?", (game_id,))
        return self.list_open_games()

    def clear_open_games(self) -> list[dict]:
        with self.connect() as conn:
            conn.execute("DELETE FROM game_sessions WHERE status NOT IN ('complete', 'finished', 'deleted')")
        return []

    def record_score(self, payload: dict) -> dict:
        action = str(payload.get("action") or "")
        game_type = normalize_game_type(payload.get("game") or payload.get("gameType") or action.removeprefix("record-"))
        title = payload.get("title") or game_type.replace("-", " ").title()
        players = self.event_players(payload)
        for player in players:
            self.register_player(player.get("id"), player.get("name"))
        winner = self.event_winner(payload, players)
        score = int(float(payload.get("score") or max([float(p.get("score") or 0) for p in players] or [0])))
        created = str(payload.get("created") or now_iso())
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO score_events(game_type, title, match_id, player_id, player_name, winner_id,
                                         winner_name, draw, score, payload_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    game_type,
                    title,
                    payload.get("matchId") or payload.get("gameId"),
                    payload.get("playerId") or (players[0].get("id") if players else None),
                    payload.get("playerName") or (players[0].get("name") if players else None),
                    winner.get("id") if winner else None,
                    winner.get("name") if winner else payload.get("winner"),
                    1 if payload.get("draw") or payload.get("winner") == "draw" else 0,
                    score,
                    json_dumps({**payload, "created": created}),
                    created,
                ),
            )
        return self.scoreboard()

    def event_players(self, payload: dict) -> list[dict]:
        players = payload.get("players")
        if isinstance(players, list) and players:
            normalized = []
            for index, player in enumerate(players):
                if not isinstance(player, dict):
                    continue
                pid = str(player.get("id") or player.get("playerId") or player.get("mark") or f"player-{index + 1}")
                normalized.append(
                    {
                        "id": pid,
                        "name": str(player.get("name") or player.get("playerName") or pid),
                        "score": int(float(player.get("score") or 0)),
                        "mark": player.get("mark"),
                    }
                )
            return normalized
        player_id = payload.get("playerId") or payload.get("id")
        player_name = payload.get("playerName") or payload.get("name")
        if player_id or player_name:
            return [{"id": str(player_id or player_name), "name": str(player_name or player_id), "score": int(float(payload.get("score") or 0))}]
        return []

    def event_winner(self, payload: dict, players: list[dict]) -> dict | None:
        if payload.get("draw") or payload.get("winner") == "draw":
            return None
        winner_id = payload.get("winnerId") or payload.get("winner")
        if winner_id:
            for player in players:
                if winner_id in {player.get("id"), player.get("name"), player.get("mark")}:
                    return player
            return {"id": str(winner_id), "name": str(payload.get("winnerName") or winner_id)}
        if players:
            return max(players, key=lambda p: int(p.get("score") or 0))
        return None

    def wipe_scores(self, game: str) -> dict:
        with self.connect() as conn:
            if game == "all":
                conn.execute("DELETE FROM score_events")
            else:
                conn.execute("DELETE FROM score_events WHERE game_type = ?", (normalize_game_type(game),))
        return self.scoreboard()

    def wipe_player_scores(self, player_id: str | None) -> dict:
        target = self.canonical_id(player_id)
        if not target:
            raise ValueError("Player id is required.")
        rows = self.score_rows()
        delete_ids: list[int] = []
        for row in rows:
            payload = json_loads(row["payload_json"], {})
            players = self.event_players(payload)
            winner = self.event_winner(payload, players)
            row_ids = {
                self.canonical_id(row["player_id"]),
                self.canonical_id(row["winner_id"]),
            }
            for player in players:
                row_ids.add(self.canonical_id(player.get("id")))
                row_ids.add(self.canonical_id(player.get("name")))
            if winner:
                row_ids.add(self.canonical_id(winner.get("id")))
                row_ids.add(self.canonical_id(winner.get("name")))
            if target in row_ids:
                delete_ids.append(int(row["id"]))
        if delete_ids:
            placeholders = ",".join("?" for _ in delete_ids)
            with self.connect() as conn:
                conn.execute(f"DELETE FROM score_events WHERE id IN ({placeholders})", delete_ids)
        return self.scoreboard()

    def scoreboard(self) -> dict:
        rows = self.score_rows()
        stats: dict[str, dict] = {}
        game_stats: dict[str, dict[str, dict]] = defaultdict(dict)
        recent = []

        for row in rows:
            payload = json_loads(row["payload_json"], {})
            payload.setdefault("created", row["created_at"])
            payload.setdefault("game", row["game_type"])
            payload.setdefault("title", row["title"])
            if row["winner_name"] and not payload.get("winner"):
                payload["winner"] = row["winner_name"]
            if row["score"] and not payload.get("score"):
                payload["score"] = row["score"]
            recent.append(payload)
            players = self.event_players(payload)
            winner = self.event_winner(payload, players)
            draw = bool(payload.get("draw") or row["draw"])
            for player in players:
                pid = str(player.get("id") or player.get("name") or "player")
                name = str(player.get("name") or pid)
                canonical = self.canonical_id(pid)
                display = self.player_name(canonical, name)
                item = stats.setdefault(canonical, self.empty_rank(canonical, display))
                game_item = game_stats[row["game_type"]].setdefault(canonical, self.empty_rank(canonical, display))
                self.apply_event_stats(item, player, winner, draw)
                self.apply_event_stats(game_item, player, winner, draw)

        overall = self.rank_list(stats.values())
        games = {game: self.rank_list(items.values()) for game, items in game_stats.items()}
        players = self.identity_list()
        return {
            "totals": {"matches": len(rows), "players": len(overall)},
            "overall": overall,
            "games": games,
            "recent": recent[:50],
            "players": players,
        }

    def score_rows(self) -> list[sqlite3.Row]:
        with self.connect() as conn:
            return conn.execute("SELECT * FROM score_events ORDER BY created_at DESC, id DESC").fetchall()

    def empty_rank(self, player_id: str, name: str) -> dict:
        return {
            "id": player_id,
            "name": name,
            "aliases": self.identity_aliases(player_id),
            "played": 0,
            "wins": 0,
            "losses": 0,
            "draws": 0,
            "points": 0,
            "highScore": 0,
            "totalScore": 0,
            "winRate": 0,
        }

    def apply_event_stats(self, item: dict, player: dict, winner: dict | None, draw: bool) -> None:
        score = int(float(player.get("score") or 0))
        item["played"] += 1
        item["totalScore"] += score
        item["highScore"] = max(item["highScore"], score)
        if draw:
            item["draws"] += 1
        elif winner and self.canonical_id(player.get("id")) == self.canonical_id(winner.get("id")):
            item["wins"] += 1
        else:
            item["losses"] += 1
        item["points"] = item["wins"] * 3 + item["draws"] + item["totalScore"]
        item["winRate"] = round((item["wins"] / item["played"]) * 100) if item["played"] else 0

    def rank_list(self, rows: Any) -> list[dict]:
        return sorted((dict(row) for row in rows), key=lambda row: (row["points"], row["wins"], row["highScore"]), reverse=True)

    def identity_aliases(self, player_id: str) -> list[str]:
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT id, name, aliases_json FROM player_identities WHERE canonical_id = ? OR id = ?",
                (player_id, player_id),
            ).fetchall()
            aliases: set[str] = set()
            for row in rows:
                aliases.add(row["id"])
                aliases.update(json_loads(row["aliases_json"], []))
            aliases.discard(player_id)
            return sorted(alias for alias in aliases if alias)

    def identity_list(self) -> list[dict]:
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT id, canonical_id, name, aliases_json
                FROM player_identities
                WHERE is_cpu = 0 AND id = canonical_id
                ORDER BY name COLLATE NOCASE
                """
            ).fetchall()
            return [
                {
                    "id": row["id"],
                    "name": row["name"],
                    "aliases": sorted(set(json_loads(row["aliases_json"], []) + self.identity_aliases(row["id"]))),
                }
                for row in rows
            ]

    def license_plates(self) -> dict:
        return self.kv_get("license-plates", "state", {"ok": True, "plates": {}})

    def save_license_plates(self, payload: dict) -> dict:
        state = self.license_plates()
        state.update(payload)
        state["ok"] = True
        self.kv_set("license-plates", "state", state)
        return state
