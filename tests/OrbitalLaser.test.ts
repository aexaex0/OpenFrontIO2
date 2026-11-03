import {
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import {
  ORBITAL_LASER_AREA_RADIUS,
  ORBITAL_LASER_CHARGE,
} from "@openfront/engine-lib/OrbitalLaser";
import { OrbitalLaserExecution } from "@openfront/engine/execution/OrbitalLaserExecution";
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

function grab(p: Player, x0: number, y0: number, w: number, h: number): void {
  for (let x = x0; x < x0 + w; x++)
    for (let y = y0; y < y0 + h; y++) p.conquer(game.ref(x, y));
}

describe("orbital laser", () => {
  beforeEach(async () => {
    game = await setup("plains", {}, [human("s"), human("v")]);
    shooter = game.player("sId");
    victim = game.player("vId");
    grab(shooter, 5, 5, 6, 6);
    grab(victim, 40, 40, 40, 20);
    while (game.inSpawnPhase()) game.executeNextTick();
  });

  function fire(points: [number, number][]): void {
    game.addExecution(
      new OrbitalLaserExecution(
        shooter,
        points.map(([x, y]) => game.ref(x, y)),
      ),
    );
    for (let i = 0; i < ORBITAL_LASER_CHARGE + 40; i++) game.executeNextTick();
  }

  function arm(): void {
    shooter.buildUnit(UnitType.MissileSilo, game.ref(7, 7), {});
    shooter.addGold(game.unitInfo(UnitType.MIRV).cost(game, shooter));
  }

  test("sweeps through all three points, leaving unowned fallout", () => {
    arm();
    const goldBefore = shooter.gold();
    fire([
      [45, 50],
      [60, 50],
      [75, 50],
    ]);
    for (const [x, y] of [
      [45, 50],
      [52, 50],
      [60, 50],
      [75, 50],
    ]) {
      const t = game.ref(x, y);
      expect(game.hasOwner(t)).toBe(false);
      expect(game.hasFallout(t)).toBe(true);
    }
    // Off the path the land is untouched.
    expect(game.owner(game.ref(60, 42))).toBe(victim);
    expect(shooter.gold()).toBeLessThan(goldBefore);
  });

  test("refuses points outside the circle around the first", () => {
    arm();
    // (45,50) → (45+R+5, 50) would leave the 100-wide map, so go diagonal.
    const tilesBefore = victim.numTilesOwned();
    expect(
      game.euclideanDistSquared(game.ref(45, 50), game.ref(99, 99)),
    ).toBeGreaterThan(ORBITAL_LASER_AREA_RADIUS * ORBITAL_LASER_AREA_RADIUS);
    fire([
      [45, 50],
      [50, 50],
      [99, 99],
    ]);
    expect(victim.numTilesOwned()).toBe(tilesBefore);
  });

  test("without a silo nothing happens", () => {
    shooter.addGold(game.unitInfo(UnitType.MIRV).cost(game, shooter));
    const tilesBefore = victim.numTilesOwned();
    fire([
      [45, 50],
      [60, 50],
      [75, 50],
    ]);
    expect(victim.numTilesOwned()).toBe(tilesBefore);
  });
});
