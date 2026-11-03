// AlexFront: the owner's hidden access. Typing the owner's code into the
// "Referral code" field in the settings marks this browser as the owner's;
// only a hash of the code is kept here. The owner sees players' reports and
// gets an in-game admin panel, which only the owner can switch off.

const OWNER_HASH =
  "e8dc279ed2f869c7e9ff06c93073f79e32c97fc84cdbfdcf641edda316810ce1";
const CODE_KEY = "settings.referralCode";
const OK_KEY = "settings.referralOk";
const PANEL_KEY = "settings.adminPanel";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage blocked: nothing is remembered.
  }
}

async function sha256Hex(text: string): Promise<string | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Checks a typed referral code; remembers it when it is the owner's. */
export async function setReferralCode(code: string): Promise<boolean> {
  const trimmed = code.trim();
  const ok = trimmed !== "" && (await sha256Hex(trimmed)) === OWNER_HASH;
  write(CODE_KEY, ok ? trimmed : null);
  write(OK_KEY, ok ? "1" : null);
  return ok;
}

export function isOwner(): boolean {
  return read(OK_KEY) === "1" && read(CODE_KEY) !== null;
}

/** The owner's code, sent to the server to read the reports. */
export function ownerKey(): string | null {
  return isOwner() ? read(CODE_KEY) : null;
}

/** The in-game admin panel: on for the owner unless they turned it off. */
export function adminPanelOn(): boolean {
  return isOwner() && read(PANEL_KEY) !== "0";
}

export function setAdminPanel(on: boolean): void {
  if (!isOwner()) return;
  write(PANEL_KEY, on ? "1" : "0");
}
