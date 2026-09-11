import {
  GameState,
  MoveIntent,
  Position,
  ShadeState,
  posEquals,
  posKey,
} from "./types";

/**
 * Resolve simultaneous Shade movement. All rules are independent of entity
 * iteration order.
 *
 *  - Two Shades targeting the same tile both stay.
 *  - A Shade may not enter a tile occupied by a Shade that is staying, or whose
 *    own move was cancelled. Chains resolve to a fixpoint.
 *  - Two Shades may not swap tiles.
 *
 * Returns a map of shade id -> destination for the Shades that actually move.
 */
export function resolveCollisions(
  state: GameState,
  intents: MoveIntent[],
): Map<string, Position> {
  const active = new Map<string, MoveIntent>();
  for (const intent of intents) active.set(intent.entityId, intent);

  let changed = true;
  while (changed) {
    changed = false;

    // (1) Same destination: cancel every claimant.
    const claimants = new Map<string, string[]>();
    for (const intent of active.values()) {
      const key = posKey(intent.to);
      const list = claimants.get(key) ?? [];
      list.push(intent.entityId);
      claimants.set(key, list);
    }
    for (const [, ids] of claimants) {
      if (ids.length > 1) {
        for (const id of ids) if (active.delete(id)) changed = true;
      }
    }

    // (2) Destination occupied by a Shade that is not actively moving.
    for (const [id, intent] of [...active]) {
      for (const shade of state.shades) {
        if (shade.buried || shade.id === id) continue;
        if (!posEquals(shade.position, intent.to)) continue;
        if (!active.has(shade.id)) {
          active.delete(id);
          changed = true;
        }
        break;
      }
    }

    // (3) Swaps: both stay.
    for (const [id, intent] of [...active]) {
      for (const [otherId, other] of active) {
        if (id >= otherId) continue;
        if (
          posKey(intent.to) === posKey(other.from) &&
          posKey(other.to) === posKey(intent.from)
        ) {
          if (active.delete(id)) changed = true;
          if (active.delete(otherId)) changed = true;
        }
      }
    }
  }

  const result = new Map<string, Position>();
  for (const [id, intent] of active) result.set(id, intent.to);
  return result;
}

/** Build the raw intent list, ignoring other Shades. */
export function collectIntents(
  state: GameState,
  intentFor: (shade: ShadeState) => Position | null,
): MoveIntent[] {
  const intents: MoveIntent[] = [];
  for (const shade of state.shades) {
    const to = intentFor(shade);
    if (to) {
      intents.push({ entityId: shade.id, from: { ...shade.position }, to });
    }
  }
  return intents;
}
