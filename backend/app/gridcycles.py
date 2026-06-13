from __future__ import annotations

import math
import random
import time
from collections import deque
from typing import Any


GRIDCYCLES_MARKS = ("A", "B", "C", "D")
GRIDCYCLES_COLORS = {
    "A": "#67e8f9",
    "B": "#ffcf4d",
    "C": "#ff6b7a",
    "D": "#8bff8f",
}
DIRS = {
    "up": (0, -1),
    "right": (1, 0),
    "down": (0, 1),
    "left": (-1, 0),
}
OPPOSITE = {"up": "down", "down": "up", "left": "right", "right": "left"}


def now_ms() -> int:
    return int(time.time() * 1000)


def clamp_int(value: Any, default: int, low: int, high: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = default
    return max(low, min(high, parsed))


def gridcycles_tick_ms(difficulty: str | None, kid_mode: bool = False) -> int:
    if kid_mode:
        return 150
    return {
        "easy": 135,
        "medium": 105,
        "hard": 86,
        "expert": 72,
    }.get(str(difficulty or "medium").lower(), 105)


def gridcycles_new_payload(mode: str = "classic", difficulty: str = "medium", *, kid_mode: bool = False, rounds_to_win: int = 3, duration: int = 90) -> dict[str, Any]:
    game_mode = str(mode or "classic").lower()
    if game_mode not in {"classic", "timed", "kid"}:
        game_mode = "classic"
    if game_mode == "kid":
        kid_mode = True
    return {
        "phase": "lobby",
        "settings": {
            "gridW": 80,
            "gridH": 45,
            "tickMs": gridcycles_tick_ms(difficulty, kid_mode),
            "roundsToWin": clamp_int(rounds_to_win, 3, 1, 9),
            "mode": game_mode,
            "kidMode": bool(kid_mode),
            "duration": clamp_int(duration, 90, 30, 300),
            "lowPerf": False,
        },
        "players": {},
        "occupied": {},
        "round": 1,
        "winner": None,
        "scores": {},
        "roundWinners": [],
        "countdownUntil": 0,
        "startedAt": 0,
        "lastTick": 0,
        "events": [],
    }


def player_mark(player: dict[str, Any]) -> str:
    return str(player.get("mark") or "")


def sync_players(game: dict[str, Any]) -> dict[str, Any]:
    payload = game.setdefault("payload", gridcycles_new_payload())
    players_state = payload.setdefault("players", {})
    scores = payload.setdefault("scores", {})
    existing = {str(player.get("mark") or "") for player in game.get("players", []) if isinstance(player, dict)}
    for player in game.get("players", []):
        if not isinstance(player, dict):
            continue
        mark = player_mark(player)
        if not mark:
            continue
        state = players_state.setdefault(mark, {})
        state.update(
            {
                "id": player.get("id") or mark,
                "name": player.get("name") or mark,
                "mark": mark,
                "color": state.get("color") or GRIDCYCLES_COLORS.get(mark, "#ffffff"),
                "isBot": bool(player.get("isBot") or str(player.get("id") or "").startswith("cpu")),
            }
        )
        scores.setdefault(mark, 0)
    for mark in list(players_state):
        if mark not in existing:
            players_state.pop(mark, None)
    return payload


def add_gridcycles_bot(game: dict[str, Any], difficulty: str = "medium") -> dict[str, Any] | None:
    existing = {player_mark(player) for player in game.get("players", []) if isinstance(player, dict)}
    mark = next((candidate for candidate in GRIDCYCLES_MARKS if candidate not in existing), "")
    if not mark:
        return None
    bot = {
        "id": f"cpu-gridcycles-{mark.lower()}-{difficulty}",
        "name": f"Computer {mark}",
        "mark": mark,
        "isBot": True,
    }
    game.setdefault("players", []).append(bot)
    sync_players(game)
    return bot


def gridcycles_add_bots(game: dict[str, Any], count: int = 1, difficulty: str = "medium") -> None:
    for _ in range(max(0, min(3, int(count or 0)))):
        if len(game.get("players", [])) >= 4:
            break
        add_gridcycles_bot(game, difficulty)


def start_positions(grid_w: int, grid_h: int, marks: list[str]) -> dict[str, tuple[int, int, str]]:
    presets = {
        "A": (max(4, grid_w // 5), grid_h // 2, "right"),
        "B": (min(grid_w - 5, grid_w - grid_w // 5), grid_h // 2, "left"),
        "C": (grid_w // 2, max(4, grid_h // 5), "down"),
        "D": (grid_w // 2, min(grid_h - 5, grid_h - grid_h // 5), "up"),
    }
    return {mark: presets.get(mark, (grid_w // 2, grid_h // 2, "right")) for mark in marks}


def gridcycles_start_round(game: dict[str, Any], countdown_ms: int = 3200) -> None:
    # Round state lives entirely in payload so each poll returns the same
    # canonical arena, trails, score, and countdown snapshot to every client.
    payload = sync_players(game)
    settings = payload.setdefault("settings", {})
    grid_w = clamp_int(settings.get("gridW"), 80, 32, 120)
    grid_h = clamp_int(settings.get("gridH"), 45, 22, 80)
    settings["gridW"] = grid_w
    settings["gridH"] = grid_h
    settings["tickMs"] = clamp_int(settings.get("tickMs"), 105, 55, 180)
    marks = [player_mark(player) for player in game.get("players", []) if isinstance(player, dict) and player_mark(player)]
    positions = start_positions(grid_w, grid_h, marks)
    occupied: dict[str, str] = {}
    for mark in marks:
        x, y, direction = positions[mark]
        state = payload.setdefault("players", {}).setdefault(mark, {})
        state.update(
            {
                "x": x,
                "y": y,
                "dir": direction,
                "nextDir": direction,
                "alive": True,
                "distance": 0,
                "survivalMs": 0,
                "crashedAt": 0,
                "shield": bool(settings.get("kidMode")),
            }
        )
        occupied[f"{x},{y}"] = mark
    payload["occupied"] = occupied
    payload["winner"] = None
    payload["events"] = []
    payload["phase"] = "countdown"
    payload["countdownUntil"] = now_ms() + max(0, int(countdown_ms))
    payload["startedAt"] = 0
    payload["lastTick"] = payload["countdownUntil"]
    game["status"] = "active"
    game["turn"] = "all"
    game["winner"] = ""


def gridcycles_start_game(game: dict[str, Any]) -> None:
    payload = sync_players(game)
    if len(game.get("players", [])) < 2:
        gridcycles_add_bots(game, 1, game.get("difficulty", "medium"))
    payload["round"] = int(payload.get("round") or 1)
    gridcycles_start_round(game)


def valid_turn(current: str, proposed: str) -> bool:
    return proposed in DIRS and proposed != OPPOSITE.get(current)


def gridcycles_set_input(game: dict[str, Any], player: dict[str, Any], direction: str) -> None:
    payload = sync_players(game)
    mark = player_mark(player)
    state = payload.setdefault("players", {}).get(mark)
    direction = str(direction or "").lower()
    if not state or direction not in DIRS:
        return
    current = str(state.get("dir") or "right")
    queued = str(state.get("nextDir") or current)
    if valid_turn(current, direction) and valid_turn(queued, direction):
        state["nextDir"] = direction


def open_cell(payload: dict[str, Any], x: int, y: int) -> bool:
    settings = payload.get("settings") if isinstance(payload.get("settings"), dict) else {}
    return 0 <= x < int(settings.get("gridW") or 80) and 0 <= y < int(settings.get("gridH") or 45) and f"{x},{y}" not in (payload.get("occupied") or {})


def flood_score(payload: dict[str, Any], start: tuple[int, int], limit: int) -> int:
    sx, sy = start
    if not open_cell(payload, sx, sy):
        return -1
    seen = {(sx, sy)}
    queue: deque[tuple[int, int]] = deque([(sx, sy)])
    while queue and len(seen) < limit:
        x, y = queue.popleft()
        for dx, dy in DIRS.values():
            nx, ny = x + dx, y + dy
            if (nx, ny) not in seen and open_cell(payload, nx, ny):
                seen.add((nx, ny))
                queue.append((nx, ny))
    return len(seen)


def choose_bot_direction(payload: dict[str, Any], mark: str, difficulty: str) -> str:
    state = payload.get("players", {}).get(mark) or {}
    current = str(state.get("dir") or "right")
    x = int(state.get("x") or 0)
    y = int(state.get("y") or 0)
    lookahead = {"easy": 18, "medium": 45, "hard": 85, "expert": 130}.get(str(difficulty or "medium").lower(), 45)
    choices = []
    for direction, (dx, dy) in DIRS.items():
        if direction == OPPOSITE.get(current):
            continue
        nx, ny = x + dx, y + dy
        score = flood_score(payload, (nx, ny), lookahead)
        if score >= 0:
            bias = 0 if direction == current else random.randint(-4, 4)
            choices.append((score + bias, direction))
    if not choices:
        return current
    choices.sort(reverse=True)
    if difficulty in {"hard", "expert"} and len(choices) > 1 and random.random() < 0.12:
        return choices[1][1]
    if difficulty == "easy" and len(choices) > 1 and random.random() < 0.32:
        return random.choice(choices[: min(3, len(choices))])[1]
    return choices[0][1]


def alive_marks(payload: dict[str, Any]) -> list[str]:
    return [mark for mark, state in (payload.get("players") or {}).items() if isinstance(state, dict) and state.get("alive")]


def finish_round(game: dict[str, Any], crashed: set[str]) -> None:
    payload = game.setdefault("payload", {})
    living = alive_marks(payload)
    winner: str | None = living[0] if len(living) == 1 else None
    if not living:
        distances = {
            mark: int(state.get("distance") or 0)
            for mark, state in (payload.get("players") or {}).items()
            if isinstance(state, dict)
        }
        top = max(distances.values() or [0])
        leaders = [mark for mark, value in distances.items() if value == top]
        winner = leaders[0] if len(leaders) == 1 else "draw"
    payload["phase"] = "roundOver"
    payload["winner"] = winner
    payload["roundWinners"] = list(payload.get("roundWinners") or []) + [winner or "draw"]
    if winner and winner != "draw":
        scores = payload.setdefault("scores", {})
        scores[winner] = int(scores.get(winner) or 0) + 1
    payload["events"] = [{"type": "crash", "marks": sorted(crashed), "at": now_ms()}]
    rounds_to_win = int((payload.get("settings") or {}).get("roundsToWin") or 3)
    if winner and winner != "draw" and int(payload.get("scores", {}).get(winner) or 0) >= rounds_to_win:
        payload["phase"] = "gameOver"
        game["status"] = "complete"
        game["winner"] = winner
        game["resultPending"] = True


def advance_one_tick(game: dict[str, Any]) -> None:
    payload = sync_players(game)
    settings = payload.get("settings") if isinstance(payload.get("settings"), dict) else {}
    difficulty = str(game.get("difficulty") or "medium").lower()
    players = payload.get("players") if isinstance(payload.get("players"), dict) else {}
    for mark, state in players.items():
        if isinstance(state, dict) and state.get("alive") and state.get("isBot"):
            state["nextDir"] = choose_bot_direction(payload, mark, difficulty)

    intents: dict[str, tuple[int, int, str]] = {}
    target_counts: dict[str, int] = {}
    for mark, state in players.items():
        if not isinstance(state, dict) or not state.get("alive"):
            continue
        direction = str(state.get("nextDir") or state.get("dir") or "right")
        current = str(state.get("dir") or direction)
        if not valid_turn(current, direction):
            direction = current
        dx, dy = DIRS[direction]
        nx = int(state.get("x") or 0) + dx
        ny = int(state.get("y") or 0) + dy
        key = f"{nx},{ny}"
        intents[mark] = (nx, ny, direction)
        target_counts[key] = target_counts.get(key, 0) + 1

    occupied = payload.setdefault("occupied", {})
    crashed: set[str] = set()
    grid_w = int(settings.get("gridW") or 80)
    grid_h = int(settings.get("gridH") or 45)
    for mark, (nx, ny, _direction) in intents.items():
        key = f"{nx},{ny}"
        # Resolve all targets before moving anyone so head-on crashes and
        # same-cell collisions are deterministic across every client.
        if nx < 0 or ny < 0 or nx >= grid_w or ny >= grid_h or key in occupied or target_counts.get(key, 0) > 1:
            state = players.get(mark) or {}
            if state.get("shield"):
                state["shield"] = False
                state["nextDir"] = OPPOSITE.get(str(state.get("dir") or "right"), "left")
            else:
                crashed.add(mark)

    current_ms = now_ms()
    for mark, state in players.items():
        if mark in crashed and isinstance(state, dict):
            state["alive"] = False
            state["crashedAt"] = current_ms

    for mark, (nx, ny, direction) in intents.items():
        state = players.get(mark)
        if not isinstance(state, dict) or not state.get("alive"):
            continue
        state["x"] = nx
        state["y"] = ny
        state["dir"] = direction
        state["nextDir"] = direction
        state["distance"] = int(state.get("distance") or 0) + 1
        state["survivalMs"] = max(0, current_ms - int(payload.get("startedAt") or current_ms))
        occupied[f"{nx},{ny}"] = mark

    mode = str(settings.get("mode") or "classic")
    duration_ms = int(settings.get("duration") or 90) * 1000
    timed_out = mode == "timed" and payload.get("startedAt") and current_ms >= int(payload.get("startedAt") or 0) + duration_ms
    if len(alive_marks(payload)) <= 1 or timed_out:
        if timed_out:
            distances = {mark: int((state or {}).get("distance") or 0) for mark, state in players.items() if isinstance(state, dict)}
            top = max(distances.values() or [0])
            leaders = [mark for mark, value in distances.items() if value == top]
            payload["winner"] = leaders[0] if len(leaders) == 1 else "draw"
            for mark, state in players.items():
                if isinstance(state, dict):
                    state["alive"] = False
            finish_round(game, set(players.keys()) - set(leaders))
        else:
            finish_round(game, crashed)


def gridcycles_advance(game: dict[str, Any]) -> bool:
    payload = sync_players(game)
    phase = str(payload.get("phase") or "lobby")
    current = now_ms()
    changed = False
    if phase == "countdown" and current >= int(payload.get("countdownUntil") or 0):
        payload["phase"] = "running"
        payload["startedAt"] = current
        payload["lastTick"] = current
        changed = True
    if payload.get("phase") != "running":
        return changed
    settings = payload.get("settings") if isinstance(payload.get("settings"), dict) else {}
    tick_ms = clamp_int(settings.get("tickMs"), 105, 55, 180)
    last_tick = int(payload.get("lastTick") or current)
    if current - last_tick < tick_ms:
        return changed
    # Do not catch up multiple grid moves after a slow browser frame or delayed
    # poll. A catch-up burst makes the bike appear frozen client-side while the
    # authoritative state keeps moving, which causes unfair invisible crashes.
    advance_one_tick(game)
    payload["lastTick"] = current
    changed = True
    return changed


def gridcycles_next_round(game: dict[str, Any]) -> None:
    payload = sync_players(game)
    if payload.get("phase") == "gameOver":
        return
    payload["round"] = int(payload.get("round") or 1) + 1
    game["round"] = int(game.get("round") or 1) + 1
    gridcycles_start_round(game)


def gridcycles_reset_game(game: dict[str, Any]) -> None:
    prior = game.get("payload") if isinstance(game.get("payload"), dict) else {}
    settings = prior.get("settings") if isinstance(prior.get("settings"), dict) else {}
    game["payload"] = gridcycles_new_payload(
        str(settings.get("mode") or "classic"),
        str(game.get("difficulty") or "medium"),
        kid_mode=bool(settings.get("kidMode")),
        rounds_to_win=int(settings.get("roundsToWin") or 3),
        duration=int(settings.get("duration") or 90),
    )
    game["status"] = "waiting"
    game["winner"] = ""
    game["turn"] = "all"
    game["round"] = 1
    sync_players(game)


def gridcycles_public_payload(game: dict[str, Any], player_id: str = "") -> dict[str, Any]:
    payload = sync_players(game)
    if game.get("status") == "active":
        gridcycles_advance(game)
    public_payload = {
        "phase": payload.get("phase") or "lobby",
        "settings": dict(payload.get("settings") or {}),
        "players": dict(payload.get("players") or {}),
        "occupied": dict(payload.get("occupied") or {}),
        "round": int(payload.get("round") or 1),
        "scores": dict(payload.get("scores") or {}),
        "winner": payload.get("winner"),
        "roundWinners": list(payload.get("roundWinners") or []),
        "countdownRemainingMs": max(0, int(payload.get("countdownUntil") or 0) - now_ms()),
        "events": list(payload.get("events") or [])[-6:],
    }
    return public_payload
