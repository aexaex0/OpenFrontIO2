// AlexFront: "restart" for solo games. The solo modal remembers the last
// start here (config, player, whether the map was random); the in-game
// restart button marks a restart and goes back to the menu, and Main starts
// the same game again on load — on a new random map if it was random.

import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
} from "@openfront/engine-api/game/GameTypes";
import type { WireGameStartInfo } from "@openfront/shared/WireSchemas";
import { generateID } from "@openfront/shared/SharedUtil";
import type { JoinLobbyEvent } from "./Main";
import { getRandomMapType } from "./utilities/GameConfigHelpers";

const LAST_KEY = "alexfront.soloLast";
/** The last solo settings, kept across visits for the menu's quick solo. */
const QUICK_KEY = "alexfront.soloLastConfig";
const PENDING_KEY = "alexfront.soloRestart";

interface SoloSetup {
  /** The game this setup last started, so other solo games get no button. */
  gameID: string;
  config: WireGameStartInfo["config"];
  player: Omit<WireGameStartInfo["players"][number], "clientID">;
  randomMap: boolean;
}

/** Remembers this solo start so the in-game restart button can repeat it. */
export function rememberSoloStart(
  info: WireGameStartInfo,
  randomMap: boolean,
): void {
  const first = info.players[0];
  if (first === undefined) return;
  const player = Object.fromEntries(
    Object.entries(first).filter(([k]) => k !== "clientID"),
  ) as SoloSetup["player"];
  const setup: SoloSetup = {
    gameID: info.gameID,
    config: info.config,
    player,
    randomMap,
  };
  try {
    sessionStorage.setItem(LAST_KEY, JSON.stringify(setup));
  } catch {
    // Storage full or blocked: no restart button for this game.
  }
  try {
    localStorage.setItem(QUICK_KEY, JSON.stringify(info.config));
  } catch {
    // Quick solo falls back to the default settings.
  }
}

/** The settings of the last solo game started from the solo menu, if any. */
export function lastSoloConfig(): WireGameStartInfo["config"] | null {
  try {
    const raw = localStorage.getItem(QUICK_KEY);
    return raw === null
      ? null
      : (JSON.parse(raw) as WireGameStartInfo["config"]);
  } catch {
    return null;
  }
}

/**
 * The settings for a quick solo game on `gameMap`: the last solo settings
 * (or the solo menu's defaults), with the nation count back to the map's
 * default, since a count picked for another map may not fit this one.
 */
export function quickSoloConfig(
  gameMap: GameMapType,
): WireGameStartInfo["config"] {
  const last = lastSoloConfig();
  const base =
    last ??
    ({
      gameMapSize: GameMapSize.Normal,
      gameType: GameType.Singleplayer,
      gameMode: GameMode.FFA,
      playerTeams: 2,
      difficulty: Difficulty.Easy,
      bots: 400,
      infiniteGold: false,
      donateGold: false,
      donateTroops: false,
      infiniteTroops: false,
      instantBuild: false,
      randomSpawn: false,
      disabledUnits: [],
      nations: "default",
    } as Omit<WireGameStartInfo["config"], "gameMap">);
  return {
    ...base,
    gameMap,
    gameType: GameType.Singleplayer,
    nations: base.nations === "disabled" ? "disabled" : "default",
  } as WireGameStartInfo["config"];
}

/** A random map, different from `not` when possible. */
export function randomQuickMap(not?: GameMapType): GameMapType {
  let map = getRandomMapType();
  for (let i = 0; i < 10 && map === not; i++) map = getRandomMapType();
  return map;
}

function lastSetup(): SoloSetup | null {
  try {
    const raw = sessionStorage.getItem(LAST_KEY);
    return raw === null ? null : (JSON.parse(raw) as SoloSetup);
  } catch {
    return null;
  }
}

/** Whether this solo game was started from a remembered setup. */
export function canRestartSolo(gameID: string): boolean {
  return lastSetup()?.gameID === gameID;
}

/** Marks a restart and reloads the menu, which then starts it again. */
export function requestSoloRestart(homeHref: string): void {
  try {
    sessionStorage.setItem(PENDING_KEY, "1");
  } catch {
    return;
  }
  window.location.href = homeHref;
}

/**
 * The join-lobby detail for a pending restart (consumed: a second call
 * returns null), with a fresh game and client ID and, if the last map was
 * random, a new random map.
 */
export function takeSoloRestart(): JoinLobbyEvent | null {
  let pending: string | null = null;
  try {
    pending = sessionStorage.getItem(PENDING_KEY);
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    return null;
  }
  if (pending === null) return null;
  const setup = lastSetup();
  if (setup === null) return null;
  let gameMap = setup.config.gameMap;
  if (setup.randomMap) {
    // A different map than last time, if the dice allow it.
    for (let i = 0; i < 10 && gameMap === setup.config.gameMap; i++) {
      gameMap = getRandomMapType();
    }
  }
  const gameID = generateID();
  try {
    sessionStorage.setItem(LAST_KEY, JSON.stringify({ ...setup, gameID }));
  } catch {
    // The button just won't show on the restarted game.
  }
  return {
    gameID,
    gameStartInfo: {
      gameID,
      players: [{ ...setup.player, clientID: generateID() }],
      config: { ...setup.config, gameMap },
      lobbyCreatedAt: Date.now(),
    },
    source: "singleplayer",
  };
}
