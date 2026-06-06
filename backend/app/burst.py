from __future__ import annotations

import random
from typing import Any


BURST_THRESHOLD = 21
BURST_HAND_LIMIT = 3
BURST_TARGET_SCORE = 100
BURST_MAX_PLAYERS = 6

BURST_DECK_DEFINITIONS: list[dict[str, Any]] = [
    {"value": -3, "count": 4, "effect": "reset", "name": "Reset"},
    {"value": -2, "count": 4, "effect": None},
    {"value": -1, "count": 4, "effect": None},
    {"value": 0, "count": 4, "effect": "wild", "name": "Wild"},
    {"value": 1, "count": 5, "effect": None},
    {"value": 2, "count": 5, "effect": None},
    {"value": 3, "count": 5, "effect": "remove", "name": "Remove"},
    {"value": 4, "count": 5, "effect": "remove", "name": "Remove"},
    {"value": 5, "count": 5, "effect": "reverse", "name": "Reverse"},
    {"value": 6, "count": 5, "effect": "skip", "name": "Skip"},
    {"value": 7, "count": 5, "effect": "draw_target", "name": "Draw One"},
    {"value": 8, "count": 5, "effect": "swap_hands", "name": "Swap Hands"},
    {"value": 9, "count": 5, "effect": "double_total", "name": "Double"},
    {"value": 10, "count": 5, "effect": None},
    {"value": 11, "count": 4, "effect": None},
    {"value": 12, "count": 4, "effect": None},
    {"value": 13, "count": 4, "effect": None},
    {"value": 14, "count": 3, "effect": None},
    {"value": 15, "count": 3, "effect": None},
]

BURST_DECK_COUNT = sum(int(item["count"]) for item in BURST_DECK_DEFINITIONS)


def burst_player_mark(index: int) -> str:
    return ("A", "B", "C", "D", "E", "F")[index % BURST_MAX_PLAYERS]


def burst_card_points(card: dict[str, Any]) -> int:
    if card.get("effect") == "wild":
        return int(card.get("selectedValue") if card.get("selectedValue") is not None else 0)
    return int(card.get("value") or 0)


def burst_hand_score(hand: list[dict[str, Any]]) -> int:
    return sum(0 if card.get("effect") == "wild" else int(card.get("value") or 0) for card in hand)


def burst_new_deck() -> list[dict[str, Any]]:
    deck: list[dict[str, Any]] = []
    counter = 0
    for definition in BURST_DECK_DEFINITIONS:
        for _ in range(int(definition["count"])):
            counter += 1
            value = int(definition["value"])
            name = str(definition.get("name") or value)
            deck.append(
                {
                    "id": f"burst-{counter}",
                    "value": value,
                    "label": name,
                    "name": name,
                    "effect": definition.get("effect"),
                }
            )
    if len(deck) != BURST_DECK_COUNT:
        raise ValueError(f"Burst deck generated {len(deck)} cards, expected {BURST_DECK_COUNT}.")
    random.shuffle(deck)
    return deck


def burst_new_payload(target_score: int = BURST_TARGET_SCORE) -> dict[str, Any]:
    return {
        "threshold": BURST_THRESHOLD,
        "deckCountExpected": BURST_DECK_COUNT,
        "handLimit": BURST_HAND_LIMIT,
        "targetScore": int(target_score or BURST_TARGET_SCORE),
        "drawPile": burst_new_deck(),
        "discard": [],
        "centerCards": [],
        "centerTotal": 0,
        "hands": {},
        "scores": {},
        "roundScores": {},
        "turnOrder": [],
        "currentPlayerIndex": 0,
        "direction": 1,
        "roundOver": False,
        "roundNumber": 0,
        "lastMove": None,
        "lastRound": None,
    }


def burst_recalculate_total(center_cards: list[dict[str, Any]]) -> int:
    total = 0
    for card in center_cards:
        if card.get("removed"):
            continue
        effect = card.get("effect")
        if effect == "reset":
            total = 0
            continue
        total += burst_card_points(card)
        if effect == "double_total":
            total *= 2
    return total


def burst_validate_payload(payload: dict[str, Any]) -> None:
    for mark, hand in (payload.get("hands") or {}).items():
        if isinstance(hand, list) and len(hand) > BURST_HAND_LIMIT:
            raise ValueError(f"Player {mark} has too many Burst cards.")


def burst_deal_round(payload: dict[str, Any], players: list[dict[str, Any]]) -> None:
    payload["drawPile"] = burst_new_deck()
    payload["discard"] = list(payload.get("discard") or []) + list(payload.get("centerCards") or [])
    payload["centerCards"] = []
    payload["centerTotal"] = 0
    payload["hands"] = {}
    order = [str(player.get("mark") or burst_player_mark(index)) for index, player in enumerate(players[:BURST_MAX_PLAYERS])]
    payload["turnOrder"] = order
    payload["scores"] = {mark: int((payload.get("scores") or {}).get(mark) or 0) for mark in order}
    payload["roundScores"] = {mark: 0 for mark in order}
    payload["currentPlayerIndex"] = 0
    payload["direction"] = 1
    payload["roundOver"] = False
    payload["roundNumber"] = int(payload.get("roundNumber") or 0) + 1
    payload["lastMove"] = None
    deck = payload["drawPile"]
    for mark in order:
        payload["hands"][mark] = []
        while len(payload["hands"][mark]) < BURST_HAND_LIMIT and deck:
            payload["hands"][mark].append(deck.pop())
    burst_validate_payload(payload)


def burst_start_game(game: dict[str, Any]) -> None:
    players = [player for player in game.get("players", []) if isinstance(player, dict)]
    if len(players) < 2:
        raise ValueError("Burst needs at least two players.")
    if len(players) > BURST_MAX_PLAYERS:
        players = players[:BURST_MAX_PLAYERS]
        game["players"] = players
    payload = game.setdefault("payload", burst_new_payload())
    burst_deal_round(payload, players)
    game["turn"] = payload["turnOrder"][0]
    game["status"] = "active"
    game["winner"] = ""


def burst_advance_turn(game: dict[str, Any], skip_next: bool = False) -> None:
    payload = game.setdefault("payload", burst_new_payload())
    order = payload.get("turnOrder") or [str(player.get("mark") or burst_player_mark(index)) for index, player in enumerate(game.get("players", []))]
    if not order:
        return
    step = int(payload.get("direction") or 1)
    if skip_next:
        step *= 2
    payload["currentPlayerIndex"] = (int(payload.get("currentPlayerIndex") or 0) + step) % len(order)
    game["turn"] = order[payload["currentPlayerIndex"]]


def burst_other_marks(payload: dict[str, Any], active_mark: str) -> list[str]:
    return [mark for mark in payload.get("turnOrder", []) if mark != active_mark]


def burst_end_round(game: dict[str, Any], bursting_mark: str) -> None:
    payload = game.setdefault("payload", burst_new_payload())
    scores = payload.setdefault("scores", {})
    round_scores: dict[str, int] = {}
    hands = payload.setdefault("hands", {})
    for mark in payload.get("turnOrder", []):
        points = 0 if mark == bursting_mark else burst_hand_score(hands.get(mark, []))
        round_scores[mark] = points
        scores[mark] = int(scores.get(mark) or 0) + points
    payload["roundScores"] = round_scores
    payload["roundOver"] = True
    payload["lastRound"] = {"burstingPlayer": bursting_mark, "roundScores": round_scores, "scores": scores.copy()}
    winners = [mark for mark, score in scores.items() if int(score or 0) >= int(payload.get("targetScore") or BURST_TARGET_SCORE)]
    if winners:
        high_score = max(int(scores[mark] or 0) for mark in winners)
        top = [mark for mark in winners if int(scores[mark] or 0) == high_score]
        game["status"] = "complete"
        game["winner"] = top[0] if len(top) == 1 else "draw"
    else:
        game["turn"] = ""


def burst_public_payload(game: dict[str, Any], player_id: str = "") -> dict[str, Any]:
    payload = game.setdefault("payload", burst_new_payload())
    player = next((item for item in game.get("players", []) if isinstance(item, dict) and str(item.get("id") or "") == str(player_id or "")), None)
    mark = str(player.get("mark") or "") if player else ""
    hands = payload.setdefault("hands", {})
    center_cards = list(payload.get("centerCards") or [])
    return {
        "threshold": int(payload.get("threshold") or BURST_THRESHOLD),
        "deckCountExpected": int(payload.get("deckCountExpected") or BURST_DECK_COUNT),
        "target": int(payload.get("threshold") or BURST_THRESHOLD),
        "handLimit": BURST_HAND_LIMIT,
        "targetScore": int(payload.get("targetScore") or BURST_TARGET_SCORE),
        "total": int(payload.get("centerTotal") or 0),
        "centerTotal": int(payload.get("centerTotal") or 0),
        "centerCards": center_cards,
        "pile": center_cards,
        "hand": list(hands.get(mark, []) if mark else []),
        "handCounts": {key: len(value or []) for key, value in hands.items() if isinstance(value, list)},
        "handScores": {key: burst_hand_score(value or []) for key, value in hands.items() if isinstance(value, list)},
        "scores": dict(payload.get("scores") or {}),
        "roundScores": dict(payload.get("roundScores") or {}),
        "drawPileCount": len(payload.get("drawPile") or []),
        "deckCount": len(payload.get("drawPile") or []),
        "direction": int(payload.get("direction") or 1),
        "roundOver": bool(payload.get("roundOver")),
        "roundNumber": int(payload.get("roundNumber") or 0),
        "lastMove": payload.get("lastMove"),
        "lastRound": payload.get("lastRound"),
        "effects": ["wild", "remove", "draw_target", "swap_hands"],
    }


def burst_apply_move(game: dict[str, Any], player: dict[str, Any], action: str, card_id: str = "", *, wild_value: Any = None, target_mark: str = "", remove_card_id: str = "") -> None:
    payload = game.setdefault("payload", burst_new_payload())
    if payload.get("roundOver"):
        if str(action or "").lower() in {"start", "next-round"}:
            burst_deal_round(payload, [p for p in game.get("players", []) if isinstance(p, dict)])
            game["turn"] = payload["turnOrder"][0]
            game["status"] = "active"
            return
        raise ValueError("Round is over. Start the next round.")
    mark = str(player.get("mark") or "")
    if mark != str(game.get("turn") or ""):
        raise ValueError("It is not your turn.")
    hand = payload.setdefault("hands", {}).setdefault(mark, [])
    draw_pile = payload.setdefault("drawPile", [])
    action = str(action or "play").lower()
    if action == "draw":
        if len(hand) >= BURST_HAND_LIMIT:
            raise ValueError("You already have three cards.")
        if not draw_pile:
            raise ValueError("The draw pile is empty.")
        hand.append(draw_pile.pop())
        payload["lastMove"] = {"mark": mark, "action": "draw", "total": payload.get("centerTotal") or 0}
        burst_validate_payload(payload)
        burst_advance_turn(game)
        return
    if action not in {"play", ""}:
        raise ValueError(f"Unsupported Burst action: {action}")
    if not card_id:
        raise ValueError("Choose a card to play.")
    index = next((i for i, card in enumerate(hand) if isinstance(card, dict) and str(card.get("id")) == str(card_id)), -1)
    if index < 0:
        raise ValueError("That card is not in your hand.")
    card = dict(hand.pop(index))
    effect = card.get("effect")
    if effect == "wild":
        try:
            selected = int(wild_value)
        except (TypeError, ValueError):
            raise ValueError("Choose a Wild value from -3 through 15.") from None
        if selected < -3 or selected > 15:
            raise ValueError("Wild value must be from -3 through 15.")
        card["selectedValue"] = selected
        card["label"] = f"Wild {selected}"
    center_cards = payload.setdefault("centerCards", [])
    center_cards.append(card)
    effect_note = ""
    if effect == "remove":
        removable = [item for item in center_cards[:-1] if not item.get("removed")]
        if removable:
            if not remove_card_id:
                raise ValueError("Choose a previous center card to remove.")
            target = next((item for item in removable if str(item.get("id")) == str(remove_card_id)), None)
            if not target:
                raise ValueError("That card cannot be removed.")
            target["removed"] = True
            effect_note = f"removed {target.get('label') or target.get('value')}"
    elif effect == "reverse":
        payload["direction"] = -1 if int(payload.get("direction") or 1) > 0 else 1
        effect_note = "reversed turn order"
    elif effect == "draw_target":
        targets = [other for other in burst_other_marks(payload, mark) if len(payload.setdefault("hands", {}).setdefault(other, [])) < BURST_HAND_LIMIT]
        if targets:
            if target_mark not in targets:
                raise ValueError("Choose a player with fewer than three cards.")
            if draw_pile:
                payload["hands"][target_mark].append(draw_pile.pop())
                effect_note = f"{target_mark} drew one"
    elif effect == "swap_hands":
        targets = burst_other_marks(payload, mark)
        if targets:
            if target_mark not in targets:
                raise ValueError("Choose a player to swap hands with.")
            payload["hands"][mark], payload["hands"][target_mark] = payload["hands"].setdefault(target_mark, []), payload["hands"][mark]
            effect_note = f"swapped with {target_mark}"
    payload["centerTotal"] = burst_recalculate_total(center_cards)
    payload["lastMove"] = {
        "mark": mark,
        "action": "play",
        "card": card,
        "effect": effect,
        "effectNote": effect_note,
        "total": payload["centerTotal"],
    }
    burst_validate_payload(payload)
    if int(payload["centerTotal"]) > BURST_THRESHOLD:
        payload["lastMove"]["action"] = "burst"
        burst_end_round(game, mark)
        return
    burst_advance_turn(game, skip_next=(effect == "skip"))
