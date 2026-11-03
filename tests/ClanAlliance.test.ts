import { PlayerInfo, PlayerType } from "@openfront/engine-api/game/GameTypes";
import { ClanAllianceExecution } from "@openfront/engine/execution/ClanAllianceExecution";
import { BreakAllianceExecution } from "@openfront/engine/execution/alliance/BreakAllianceExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { setup } from "./util/Setup";

let game: Game;
let a: Player;
let b: Player;
let c: Player;

function human(name: string, clan: string | null): PlayerInfo {
  return new PlayerInfo(
    name,
    PlayerType.Human,
    `${name}C`,
    `${name}Id`,
    false,
    clan,
  );
}

describe("clans", () => {
  beforeEach(async () => {
    game = await setup("plains", {}, [
      human("a", "WOLF"),
      human("b", "wolf"),
      human("c", "BEAR"),
    ]);
    a = game.player("aId");
    b = game.player("bId");
    c = game.player("cId");
    a.conquer(game.ref(10, 10));
    b.conquer(game.ref(50, 50));
    c.conquer(game.ref(90, 90));
    game.addExecution(new ClanAllianceExecution());
    while (game.inSpawnPhase()) game.executeNextTick();
    for (let i = 0; i < 25; i++) game.executeNextTick();
  });

  test("clanmates ally on their own, other clans don't", () => {
    expect(a.isAlliedWith(b)).toBe(true);
    expect(a.isAlliedWith(c)).toBe(false);
  });

  test("a clan alliance cannot be broken", () => {
    game.addExecution(new BreakAllianceExecution(a, b.id()));
    game.executeNextTick();
    game.executeNextTick();
    expect(a.isAlliedWith(b)).toBe(true);
    expect(a.isTraitor()).toBe(false);
  });
});
