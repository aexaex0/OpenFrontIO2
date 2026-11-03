// AlexFront: the real names of a game's players, for the owner only (the
// server checks the owner key; see src/server/RealNames.ts).

import { ClientEnv } from "./ClientEnv";
import { isOwner, ownerKey } from "./OwnerAccess";

const REFRESH_MS = 20_000;
let cache: { gameID: string; at: number; names: Record<string, string> } = {
  gameID: "",
  at: 0,
  names: {},
};
let loading: Promise<void> | null = null;

async function load(gameID: string): Promise<void> {
  const key = ownerKey();
  if (key === null) return;
  try {
    const res = await fetch(
      `${ClientEnv.serverHttpBase()}/${ClientEnv.workerPath(gameID)}/api/owner/realnames/${encodeURIComponent(gameID)}`,
      { headers: { "x-owner-key": key }, cache: "no-store" },
    );
    if (!res.ok) return;
    const body = (await res.json()) as { names?: Record<string, string> };
    cache = { gameID, at: Date.now(), names: body.names ?? {} };
  } catch {
    // Offline or not the owner: no names.
  }
}

/**
 * The real name behind clientID in this game, or null. Kicks off a refresh
 * when the cache is stale and calls onLoaded once it lands.
 */
export function ownerRealName(
  gameID: string,
  clientID: string | null,
  onLoaded: () => void,
): string | null {
  if (!isOwner() || clientID === null) return null;
  const fresh = cache.gameID === gameID && Date.now() - cache.at < REFRESH_MS;
  if (!fresh && loading === null) {
    loading = load(gameID).finally(() => {
      loading = null;
      onLoaded();
    });
  }
  return cache.gameID === gameID ? (cache.names[clientID] ?? null) : null;
}
