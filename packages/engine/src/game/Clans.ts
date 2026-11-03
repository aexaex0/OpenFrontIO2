import { PlayerType } from "@openfront/engine-api/game/GameTypes";
import type { Player } from "./Game";

/** A human player's clan, normalised, or null when they have none. */
export function clanOf(p: Player): string | null {
  if (p.type() !== PlayerType.Human) return null;
  const tag = p.clanTag()?.trim().toUpperCase();
  return tag ? tag : null;
}

/** Two different human players in the same clan. */
export function sameClan(a: Player, b: Player): boolean {
  if (a === b) return false;
  const ca = clanOf(a);
  return ca !== null && ca === clanOf(b);
}
