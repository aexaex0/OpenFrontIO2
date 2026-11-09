import { PlayerInfo, PlayerType } from "@openfront/engine-api/game/GameTypes";
import { LeaveNationExecution } from "@openfront/engine/execution/LeaveNationExecution";
import { ParasitePlayerExecution } from "@openfront/engine/execution/ParasitePlayerExecution";
import { TakeOverNationExecution } from "@openfront/engine/execution/TakeOverNationExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { setup } from "./util/Setup";

let game: Game;
let human: Player;
let nation: Player;

describe("a spectator taking over a nation", () => {
  beforeEach(async () => {
    game = await setup("plains", {}, [
      new PlayerInfo("human", PlayerType.Human, "humanClient", "humanId"),
    ]);
    human = game.player("humanId");
    nation = game.addPlayer(
      new PlayerInfo("Nation", PlayerType.Nation, null, "nationId"),
    );
    nation.conquer(game.ref(5, 5));
    human.conquer(game.ref(40, 40));
    while (game.inSpawnPhase()) game.executeNextTick();
  });

  function takeOver(clientID: string, nationID = nation.id()) {
    game.addExecution(new TakeOverNationExecution(clientID, nationID));
    game.executeNextTick();
  }

  test("turns the nation into the spectator's human player", () => {
    takeOver("spectator1");
    expect(nation.type()).toBe(PlayerType.Human);
    expect(nation.clientID()).toBe("spectator1");
    expect(game.playerByClientID("spectator1")).toBe(nation);
    // Same country: name and territory stay.
    expect(nation.name()).toBe("Nation");
    expect(nation.isAlive()).toBe(true);
  });

  test("only the first spectator gets it", () => {
    takeOver("spectator1");
    takeOver("spectator2");
    expect(nation.clientID()).toBe("spectator1");
    expect(game.playerByClientID("spectator2")).toBeNull();
  });

  test("a client that already plays cannot take a nation", () => {
    takeOver("humanClient");
    expect(nation.type()).toBe(PlayerType.Nation);
    expect(nation.clientID()).toBeNull();
  });

  test("a human player cannot be taken over", () => {
    takeOver("spectator1", human.id());
    expect(human.clientID()).toBe("humanClient");
    expect(game.playerByClientID("spectator1")).toBeNull();
  });
});

describe("after your own nation dies", () => {
  beforeEach(async () => {
    game = await setup("plains", {}, [
      new PlayerInfo("human", PlayerType.Human, "humanClient", "humanId"),
    ]);
    human = game.player("humanId");
    nation = game.addPlayer(
      new PlayerInfo("Nation", PlayerType.Nation, null, "nationId"),
    );
    nation.conquer(game.ref(5, 5));
    human.conquer(game.ref(40, 40));
    while (game.inSpawnPhase()) game.executeNextTick();
    // The nation takes the human's only tile.
    nation.conquer(game.ref(40, 40));
  });

  test("you can take a nation over and play on as it", () => {
    expect(human.isAlive()).toBe(false);
    game.addExecution(new TakeOverNationExecution("humanClient", nation.id()));
    game.executeNextTick();
    expect(nation.clientID()).toBe("humanClient");
    // The living nation, not the dead player, is who you act as.
    expect(game.playerByClientID("humanClient")).toBe(nation);
  });
});

describe("co-controlling a live player", () => {
  let other: Player;

  beforeEach(async () => {
    game = await setup("plains", {}, [
      new PlayerInfo("human", PlayerType.Human, "humanClient", "humanId"),
      new PlayerInfo("other", PlayerType.Human, "otherClient", "otherId"),
    ]);
    human = game.player("humanId");
    other = game.player("otherId");
    human.conquer(game.ref(40, 40));
    other.conquer(game.ref(10, 10));
    while (game.inSpawnPhase()) game.executeNextTick();
  });

  function parasite(clientID: string, playerID: string) {
    game.addExecution(new ParasitePlayerExecution(clientID, playerID));
    game.executeNextTick();
  }

  test("a spectator's intents act as the player, who keeps control", () => {
    parasite("spectator1", human.id());
    expect(game.playerByClientID("spectator1")).toBe(human);
    expect(game.playerByClientID("humanClient")).toBe(human);
    expect(human.clientID()).toBe("humanClient");
  });

  test("a client with a living player of its own cannot", () => {
    parasite("otherClient", human.id());
    expect(game.playerByClientID("otherClient")).toBe(other);
  });

  test("a dead player can; its own player comes first again if alive", () => {
    human.conquer(game.ref(10, 10));
    expect(other.isAlive()).toBe(false);
    parasite("otherClient", human.id());
    expect(game.playerByClientID("otherClient")).toBe(human);
    other.conquer(game.ref(60, 60));
    expect(game.playerByClientID("otherClient")).toBe(other);
  });
});

describe("leaving your nation", () => {
  let tribe: Player;

  beforeEach(async () => {
    game = await setup("plains", {}, [
      new PlayerInfo("human", PlayerType.Human, "humanClient", "humanId"),
    ]);
    human = game.player("humanId");
    tribe = game.addPlayer(
      new PlayerInfo("Tribe", PlayerType.Bot, null, "tribeId"),
    );
    human.conquer(game.ref(40, 40));
    tribe.conquer(game.ref(10, 10));
    while (game.inSpawnPhase()) game.executeNextTick();
  });

  function run(e: TakeOverNationExecution | LeaveNationExecution) {
    game.addExecution(e);
    game.executeNextTick();
  }

  test("the nation stays, with nobody playing it, and you spectate", () => {
    const tiles = human.numTilesOwned();
    run(new LeaveNationExecution("humanClient"));
    expect(human.isAlive()).toBe(true);
    expect(human.numTilesOwned()).toBe(tiles);
    expect(human.type()).toBe(PlayerType.Human);
    expect(human.clientID()).toBeNull();
    expect(game.playerByClientID("humanClient")).toBeNull();
  });

  test("after leaving you may take over a tribe or the nation you left", () => {
    run(new LeaveNationExecution("humanClient"));
    run(new TakeOverNationExecution("humanClient", tribe.id()));
    expect(tribe.type()).toBe(PlayerType.Human);
    expect(game.playerByClientID("humanClient")).toBe(tribe);
    // Someone else can step into the nation that was left.
    run(new TakeOverNationExecution("spectator1", human.id()));
    expect(human.clientID()).toBe("spectator1");
  });

  test("leaving a co-controlled nation only lets go of it", () => {
    run(new LeaveNationExecution("humanClient"));
    run(new TakeOverNationExecution("spectator1", human.id()));
    game.addExecution(new ParasitePlayerExecution("ghost", human.id()));
    game.executeNextTick();
    expect(game.playerByClientID("ghost")).toBe(human);
    run(new LeaveNationExecution("ghost"));
    expect(game.playerByClientID("ghost")).toBeNull();
    expect(human.clientID()).toBe("spectator1");
  });
});
