import { GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { WireGameStartInfo } from "@openfront/shared/WireSchemas";
import { beforeEach, describe, expect, it } from "vitest";
import {
  canRestartSolo,
  rememberSoloStart,
  takeSoloRestart,
} from "../../src/client/SoloRestart";

function info(gameMap: GameMapType): WireGameStartInfo {
  return {
    gameID: "game0001",
    players: [{ clientID: "client01", username: "Alex", clanTag: null }],
    config: { gameMap, bots: 50 },
    lobbyCreatedAt: 1,
  } as unknown as WireGameStartInfo;
}

function markPending(): void {
  sessionStorage.setItem("alexfront.soloRestart", "1");
}

describe("solo restart", () => {
  beforeEach(() => sessionStorage.clear());

  it("restarts the same setup with fresh IDs, once", () => {
    rememberSoloStart(info(GameMapType.Africa), false);
    expect(canRestartSolo("game0001")).toBe(true);
    expect(canRestartSolo("other")).toBe(false);
    expect(takeSoloRestart()).toBeNull(); // nothing pending yet
    markPending();
    const r = takeSoloRestart();
    expect(r?.source).toBe("singleplayer");
    expect(r?.gameStartInfo?.config.gameMap).toBe(GameMapType.Africa);
    expect(r?.gameStartInfo?.config.bots).toBe(50);
    expect(r?.gameStartInfo?.players[0].username).toBe("Alex");
    expect(r?.gameID).not.toBe("game0001");
    expect(r?.gameStartInfo?.players[0].clientID).not.toBe("client01");
    // The restarted game gets the button too.
    expect(canRestartSolo(r!.gameID)).toBe(true);
    expect(takeSoloRestart()).toBeNull();
  });

  it("picks a new random map when the map was random", () => {
    let changed = false;
    for (let i = 0; i < 5 && !changed; i++) {
      sessionStorage.clear();
      rememberSoloStart(info(GameMapType.Africa), true);
      markPending();
      changed =
        takeSoloRestart()?.gameStartInfo?.config.gameMap !== GameMapType.Africa;
    }
    expect(changed).toBe(true);
  });
});
