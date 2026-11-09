import { GameType } from "@openfront/engine-api/game/GameTypes";
import { GameConfig } from "@openfront/engine-api/Schemas";
import { Executor } from "@openfront/engine/execution/ExecutionManager";
import { GameRunner } from "@openfront/engine/GameRunner";
import { setup } from "./util/Setup";

// AlexFront: a solo game started as a spectator has no human to pick a
// spawn, so its spawn phase has to end on the timer.
async function soloRunner(soloSpectator: boolean) {
  const game = await setup(
    "plains",
    { gameType: GameType.Singleplayer, bots: 0 } as Partial<GameConfig>,
    [],
  );
  const runner = new GameRunner(
    game,
    new Executor(game, "solo_spectate", undefined),
    () => {},
  );
  runner.init(soloSpectator);
  for (let i = 0; i <= game.config().numSpawnPhaseTurns() + 2; i++) {
    game.executeNextTick();
  }
  return game;
}

describe("spectating a solo game", () => {
  test("the spawn phase ends on its own", async () => {
    expect((await soloRunner(true)).inSpawnPhase()).toBe(false);
  });

  test("a normal solo game still waits for the player's spawn", async () => {
    expect((await soloRunner(false)).inSpawnPhase()).toBe(true);
  });
});
