import { Difficulty, GameMapType } from "@openfront/engine-api/game/GameTypes";

/**
 * The daily challenge: one solo game per calendar day that is the same for
 * everyone — same map, same difficulty and the same game id, which seeds the
 * whole simulation (nations, tribes, spawns). Results are kept in this
 * browser.
 */

const DAILY_MAPS: readonly GameMapType[] = [
  GameMapType.Asia,
  GameMapType.EastAsia,
  GameMapType.Oceania,
  GameMapType.FaroeIslands,
  GameMapType.GatewayToTheAtlantic,
  GameMapType.BetweenTwoSeas,
  GameMapType.Mars,
  GameMapType.Hungary,
  GameMapType.Budapest,
  GameMapType.World,
  GameMapType.Europe,
  GameMapType.Africa,
  GameMapType.NorthAmerica,
  GameMapType.SouthAmerica,
  GameMapType.Australia,
  GameMapType.Britannia,
  GameMapType.Italia,
  GameMapType.Japan,
  GameMapType.Iceland,
  GameMapType.BlackSea,
  GameMapType.Mena,
  GameMapType.Pangaea,
];

const DAILY_DIFFICULTIES: readonly Difficulty[] = [
  Difficulty.Medium,
  Difficulty.Hard,
  Difficulty.Hard,
  Difficulty.Impossible,
];

const ID_ALPHABET =
  "123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const STORAGE_PREFIX = "alexfront.daily.";

/**
 * One twist per day on top of the map and difficulty, so no two days play
 * alike. The solo modal applies it (SinglePlayerModal.startDailyChallenge).
 */
export const DAILY_MODIFIERS = [
  "none",
  "compact",
  "random_spawn",
  "instant_build",
  "starting_gold",
  "gold_rush",
  "doomsday",
  "no_bots",
] as const;
export type DailyModifier = (typeof DAILY_MODIFIERS)[number];

export interface DailyChallenge {
  /** Local calendar day, "YYYY-MM-DD". */
  day: string;
  gameID: string;
  map: GameMapType;
  difficulty: Difficulty;
  modifier: DailyModifier;
}

export interface DailyResult {
  attempts: number;
  /** Fastest win in game seconds, if won. */
  bestSeconds: number | null;
}

export function dailyDayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** FNV-1a then xorshift: a small stable hash stream from the day key. */
function hashStream(seed: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return () => {
    h ^= h << 13;
    h >>>= 0;
    h ^= h >>> 17;
    h ^= h << 5;
    h >>>= 0;
    return h;
  };
}

/** Whole days since 2026-01-01 in local time (DST-proof: noon to noon). */
function dayNumber(date: Date): number {
  const noon = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    12,
  );
  const epoch = new Date(2026, 0, 1, 12);
  return Math.round((noon.getTime() - epoch.getTime()) / 86_400_000);
}

/** A seeded shuffle of `list` (Fisher–Yates). */
function shuffled<T>(list: readonly T[], seed: string): T[] {
  const next = hashStream(seed);
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = next() % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Item `n` of an endless rotation through `list`: every item once per round,
 * in a new order each round, never the same item twice in a row.
 */
function rotation<T>(list: readonly T[], n: number, salt: string): T {
  const len = list.length;
  const round = Math.floor(n / len);
  const at = ((n % len) + len) % len;
  const order = shuffled(list, `${salt}-${round}`);
  // The new round must not start with the item the last round ended on.
  if (at === 0 || at === 1) {
    const prevLast = shuffled(list, `${salt}-${round - 1}`)[len - 1];
    if (order[0] === prevLast) [order[0], order[1]] = [order[1], order[0]];
  }
  return order[at];
}

export function dailyChallenge(date: Date = new Date()): DailyChallenge {
  const day = dailyDayKey(date);
  const next = hashStream(`alexfront-daily-${day}`);
  let gameID = "";
  for (let i = 0; i < 8; i++)
    gameID += ID_ALPHABET[next() % ID_ALPHABET.length];
  const n = dayNumber(date);
  return {
    day,
    gameID,
    // Every map once before any repeats, and never yesterday's map.
    map: rotation(DAILY_MAPS, n, "map"),
    difficulty: DAILY_DIFFICULTIES[next() % DAILY_DIFFICULTIES.length],
    modifier: rotation(DAILY_MODIFIERS, n, "modifier"),
  };
}

/** Milliseconds until the next local midnight, when a new daily starts. */
export function msUntilNextDaily(now: Date = new Date()): number {
  const midnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );
  return Math.max(1000, midnight.getTime() - now.getTime() + 1000);
}

function load(day: string): DailyResult {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + day);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DailyResult>;
      return {
        attempts: typeof parsed.attempts === "number" ? parsed.attempts : 0,
        bestSeconds:
          typeof parsed.bestSeconds === "number" ? parsed.bestSeconds : null,
      };
    }
  } catch {
    // Storage unavailable or corrupt: start fresh.
  }
  return { attempts: 0, bestSeconds: null };
}

function save(day: string, result: DailyResult): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + day, JSON.stringify(result));
  } catch {
    // Storage unavailable: the result just isn't kept.
  }
}

export function dailyResult(day: string = dailyDayKey()): DailyResult {
  return load(day);
}

export function recordDailyAttempt(day: string): void {
  const r = load(day);
  save(day, { ...r, attempts: r.attempts + 1 });
}

/** Records a win if `gameID` is today's (or yesterday's late-night) daily. */
export function recordDailyWin(gameID: string, seconds: number): boolean {
  const now = new Date();
  for (const date of [now, new Date(now.getTime() - 86_400_000)]) {
    const daily = dailyChallenge(date);
    if (daily.gameID !== gameID) continue;
    const r = load(daily.day);
    const best =
      r.bestSeconds === null ? seconds : Math.min(r.bestSeconds, seconds);
    save(daily.day, { ...r, bestSeconds: best });
    return true;
  }
  return false;
}

export function formatDailyTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
