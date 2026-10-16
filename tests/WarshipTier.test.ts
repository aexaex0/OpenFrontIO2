import {
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { ShellExecution } from "@openfront/engine/execution/ShellExecution";
import { WarshipExecution } from "@openfront/engine/execution/WarshipExecution";
import { Game, Player, Unit } from "@openfront/engine/game/Game";
import { setup } from "./util/Setup";
import { executeTicks } from "./util/utils";

const coastX = 7;
let game: Game;
let player1: Player;
let player2: Player;

function buildPort(level: number): Unit {
  const port = player1.buildUnit(UnitType.Port, game.ref(coastX, 10), {});
  for (let i = 1; i < level; i++) port.increaseLevel();
  return port;
}

function launchWarship(owner: Player = player1): Unit {
  const before = new Set(owner.units(UnitType.Warship));
  game.addExecution(
    new WarshipExecution({ owner, patrolTile: game.ref(coastX + 5, 10) }),
  );
  game.executeNextTick();
  const ship = owner.units(UnitType.Warship).find((u) => !before.has(u));
  expect(ship).toBeDefined();
  return ship!;
}

describe("Warships built at an upgraded port", () => {
  beforeEach(async () => {
    game = await setup(
      "half_land_half_ocean",
      { infiniteGold: true, instantBuild: true },
      [
        new PlayerInfo("a", PlayerType.Human, null, "player_1_id"),
        new PlayerInfo("b", PlayerType.Human, null, "player_2_id"),
      ],
    );
    player1 = game.player("player_1_id");
    player2 = game.player("player_2_id");
    executeTicks(game, 50);
    // Building needs a living owner with gold.
    player1.conquer(game.ref(coastX, 10));
    player1.conquer(game.ref(coastX - 1, 10));
    player1.addGold(1_000_000_000n);
  });

  test("a level 1 port builds a normal warship", () => {
    buildPort(1);
    const ship = launchWarship();
    const base = game.config().unitInfo(UnitType.Warship).maxHealth!;
    expect(ship.level()).toBe(1);
    expect(ship.maxHealth()).toBe(base);
    expect(ship.health()).toBe(base);
  });

  test("an upgraded port builds a sturdier warship at full health", () => {
    buildPort(2);
    const ship = launchWarship();
    const base = game.config().unitInfo(UnitType.Warship).maxHealth!;
    const bonus = game.config().warshipTierHealthBonus();
    expect(ship.level()).toBe(2);
    expect(ship.maxHealth()).toBe(base + Math.floor((base * bonus) / 100));
    expect(ship.health()).toBe(ship.maxHealth());
  });

  test("the tier is capped", () => {
    const max = game.config().warshipMaxTier();
    buildPort(max + 3);
    expect(launchWarship().level()).toBe(max);
  });

  test("a tiered warship still counts as one ship", () => {
    buildPort(3);
    launchWarship();
    expect(player1.unitCount(UnitType.Warship)).toBe(1);
    expect(player1.unitsOwned(UnitType.Warship)).toBe(1);
  });

  test("a tiered warship hits harder", () => {
    buildPort(3);
    const strong = launchWarship();
    const weak = player2.buildUnit(UnitType.Warship, game.ref(coastX + 3, 12), {
      patrolTile: game.ref(coastX + 3, 12),
    });
    const target = player2.buildUnit(
      UnitType.Warship,
      game.ref(coastX + 6, 12),
      { patrolTile: game.ref(coastX + 6, 12) },
    );
    const bonus = game.config().warshipTierShellDamageBonus();
    for (let i = 0; i < 10; i++) {
      game.executeNextTick();
      const a = new ShellExecution(strong.tile(), player1, strong, target);
      const b = new ShellExecution(weak.tile(), player2, weak, target);
      a.init(game, game.ticks());
      b.init(game, game.ticks());
      const dWeak = b.getEffectOnTargetForTesting();
      expect(a.getEffectOnTargetForTesting()).toBe(
        Math.floor((dWeak * (100 + 2 * bonus)) / 100),
      );
    }
  });

  test("higher tiers move faster", () => {
    const cfg = game.config();
    expect(cfg.warshipTierExtraMoveInterval(1)).toBe(0);
    expect(cfg.warshipTierExtraMoveInterval(2)).toBeGreaterThan(0);
    expect(cfg.warshipTierExtraMoveInterval(3)).toBeLessThan(
      cfg.warshipTierExtraMoveInterval(2),
    );

    // Two ships on the same patrol route: the tier 3 one covers more water.
    buildPort(1);
    const slow = launchWarship();
    player1.units(UnitType.Port)[0].increaseLevel();
    player1.units(UnitType.Port)[0].increaseLevel();
    const fast = launchWarship();
    expect(fast.level()).toBe(3);
    let slowMoves = 0;
    let fastMoves = 0;
    for (let i = 0; i < 30; i++) {
      const s = slow.tile();
      const f = fast.tile();
      game.executeNextTick();
      slowMoves += game.manhattanDist(s, slow.tile());
      fastMoves += game.manhattanDist(f, fast.tile());
    }
    expect(fastMoves).toBeGreaterThan(slowMoves);
  });
});
