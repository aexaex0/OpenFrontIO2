// AlexFront: real names players type on the main menu, per game and
// clientID. Never broadcast; only the owner can read them
// (GET /api/owner/realnames/:gameID, checked with isOwnerKey).

const MAX_GAMES = 300;
const games = new Map<string, Map<string, string>>();

function clean(v: string): string {
  return v
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

export function noteRealName(
  gameID: string,
  clientID: string,
  realName: string | undefined,
): void {
  if (realName === undefined) return;
  const name = clean(realName);
  if (name === "") return;
  let names = games.get(gameID);
  if (names === undefined) {
    names = new Map();
    games.set(gameID, names);
    // Forget the oldest games (Map keeps insertion order).
    while (games.size > MAX_GAMES) {
      const oldest = games.keys().next().value;
      if (oldest === undefined) break;
      games.delete(oldest);
    }
  }
  names.set(clientID, name);
}

export function realNamesFor(gameID: string): Record<string, string> {
  return Object.fromEntries(games.get(gameID) ?? []);
}
