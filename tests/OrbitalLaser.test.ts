import {
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import {
  ORBITAL_LASER_CHARGE,
  OrbitalLaserExecution,
} from "@openfront/engine/execution/OrbitalLaserExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { setup } from "./util/Setup";

let game: Game;
let shooter: Player;
let victim: Player;

function human(name: string): PlayerInfo {
  return new PlayerInfo(
    name,
    PlayerType.Human,
    `${name}C`,
    `${name}Id`,
    false,
    null,
  );
}

function grab(p: Player, x0: number, y0: number, size: number): void {
  for (let x = x0; x < x0 + size; x++)
    for (let y = y0; y < y0 + size; y++) p.conquer(game.ref(x, y));
}

describe("orbital laser", () => {
  beforeEach(async () => {
    game = await setup("plains", {}, [human("s"), human("v")]);
    shooter = game.player("sId");
    victim = game.player("vId");
    grab(shooter, 5, 5, 6);
    grab(victim, 60, 60, 10);
    while (game.inSpawnPhase()) game.executeNextTick();
  });

  function fire(): void {
    game.addExecution(new OrbitalLaserExecution(shooter, game.ref(65, 65)));
    for (let i = 0; i < ORBITAL_LASER_CHARGE + 3; i++) game.executeNextTick();
  }

  test("with a silo and MIRV gold, it scorches the target", () => {
    shooter.buildUnit(UnitType.MissileSilo, game.ref(7, 7), {});
    const cost = game.unitInfo(UnitType.MIRV).cost(game, shooter);
    shooter.addGold(cost);
    const goldBefore = shooter.gold();
    const tilesBefore = victim.numTilesOwned();
    fire();
    expect(victim.numTilesOwned()).toBeLessThan(tilesBefore);
    expect(shooter.gold()).toBeLessThan(goldBefore);
  });

  test("without a silo nothing happens", () => {
    shooter.addGold(game.unitInfo(UnitType.MIRV).cost(game, shooter));
    const tilesBefore = victim.numTilesOwned();
    fire();
    expect(victim.numTilesOwned()).toBe(tilesBefore);
  });
});
