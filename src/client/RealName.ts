// AlexFront: the player's real name, asked for on the main menu next to the
// username. It is sent with each join, and the server hands it only to the
// owner (see OwnerAccess.ts and src/server/RealNames.ts).

const KEY = "settings.realName";
export const REAL_NAME_MAX = 40;

export function cleanRealName(v: string): string {
  return v
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, REAL_NAME_MAX);
}

export function getRealName(): string {
  try {
    return cleanRealName(localStorage.getItem(KEY) ?? "");
  } catch {
    return "";
  }
}

export function setRealName(v: string): void {
  try {
    localStorage.setItem(KEY, cleanRealName(v));
  } catch {
    // Private mode: the name lasts for this page only.
  }
}

/** Fired on document when a join is refused for a missing real name. */
export const REAL_NAME_REQUIRED_EVENT = "real-name-required";
