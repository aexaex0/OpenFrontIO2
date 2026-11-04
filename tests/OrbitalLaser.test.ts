import {
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import {
  ORBITAL_LASER_AREA_RADIUS,
  ORBITAL_LASER_BEAM_RADIUS,
  ORBITAL_LASER_CHARGE,
  orbitalLaserCost,
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

// big_plains is 200×200 land: room for the 195-tile aiming circle.
describe("orbital laser", () => {
  beforeEach(async () => {
    game = await setup("big_plains", {}, [human("s"), human("v")]);
    shooter = game.player("sId");
    victim = game.player("vId");
    grab(shooter, 2, 2, 6, 6);
    grab(victim, 20, 60, 160, 80);
    while (game.inSpawnPhase()) game.executeNextTick();
  });

  function fire(points: [number, number][]): void {
    game.addExecution(
      new OrbitalLaserExecution(
        shooter,
        points.map(([x, y]) => game.ref(x, y)),
      ),
    );
    for (let i = 0; i < ORBITAL_LASER_CHARGE + 80; i++) game.executeNextTick();
  }

  function arm(): void {
    shooter.buildUnit(UnitType.MissileSilo, game.ref(4, 4), {});
    shooter.addGold(game.unitInfo(UnitType.MIRV).cost(game, shooter));
  }

  test("sweeps through all three points, leaving unowned fallout", () => {
    arm();
    const goldBefore = shooter.gold();
    fire([
      [30, 100],
      [100, 100],
      [170, 100],
    ]);
    for (const [x, y] of [
      [30, 100],
      [65, 100],
      [100, 100],
      [170, 100],
      [100, 100 + ORBITAL_LASER_BEAM_RADIUS - 1],
    ]) {
      const t = game.ref(x, y);
      expect(game.hasOwner(t)).toBe(false);
      expect(game.hasFallout(t)).toBe(true);
    }
    // Off the path the land is untouched.
    expect(game.owner(game.ref(100, 135))).toBe(victim);
    expect(shooter.gold()).toBeLessThan(goldBefore);
  });

  test("refuses points outside the circle around the first", () => {
    arm();
    const tilesBefore = victim.numTilesOwned();
    expect(
      game.euclideanDistSquared(game.ref(10, 10), game.ref(190, 190)),
    ).toBeGreaterThan(ORBITAL_LASER_AREA_RADIUS * ORBITAL_LASER_AREA_RADIUS);
    fire([
      [10, 10],
      [100, 100],
      [190, 190],
    ]);
    expect(victim.numTilesOwned()).toBe(tilesBefore);
  });

  test("without a silo nothing happens", () => {
    shooter.addGold(game.unitInfo(UnitType.MIRV).cost(game, shooter));
    const tilesBefore = victim.numTilesOwned();
    fire([
      [30, 100],
      [100, 100],
      [170, 100],
    ]);
    expect(victim.numTilesOwned()).toBe(tilesBefore);
  });
});

describe("orbital laser price", () => {
  test("is halfway between a hydrogen bomb and a MIRV", () => {
    expect(orbitalLaserCost(35_000_000n, 5_000_000n)).toBe(20_000_000n);
    // No hydrogen bomb price known: fall back to the MIRV's.
    expect(orbitalLaserCost(35_000_000n, 0n)).toBe(35_000_000n);
  });
});
