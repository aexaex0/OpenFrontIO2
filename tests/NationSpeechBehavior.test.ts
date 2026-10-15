import { PlayerInfo, PlayerType } from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { AttackExecution } from "@openfront/engine/execution/AttackExecution";
import { NationSpeechBehavior } from "@openfront/engine/execution/nation/NationSpeechBehavior";
import { QuickChatExecution } from "@openfront/engine/execution/QuickChatExecution";
import { Execution, Game, Player } from "@openfront/engine/game/Game";
import { setup } from "./util/Setup";

let game: Game;
let human: Player;
let nation: Player;
let enemy: Player;
let speech: NationSpeechBehavior;
let added: Execution[];

async function setupGame() {
  game = await setup("big_plains", { instantBuild: true });
  human = game.addPlayer(
    new PlayerInfo("human", PlayerType.Human, null, "human"),
  );
  nation = game.addPlayer(
    new PlayerInfo("nation", PlayerType.Nation, null, "nation"),
  );
  enemy = game.addPlayer(
    new PlayerInfo("enemy", PlayerType.Human, null, "enemy"),
  );
  // Three vertical stripes: human | nation | enemy.
  game.map().forEachTile((tile) => {
    const x = game.x(tile);
    if (x < 70) human.conquer(tile);
    else if (x < 140) nation.conquer(tile);
    else enemy.conquer(tile);
  });
  speech = new NationSpeechBehavior(new PseudoRandom(7), game, nation);
  added = [];
  const original = game.addExecution.bind(game);
  vi.spyOn(game, "addExecution").mockImplementation((...execs) => {
    added.push(...execs);
    original(...execs);
  });
}

function ally(a: Player, b: Player) {
  a.createAllianceRequest(b)!.accept();
  a.updateRelation(b, 100);
  b.updateRelation(a, 100);
}

// Speaking is random per tick; give it plenty of chances. The quick chat
// cooldown only starts once a message executes, so nothing blocks retries.
function speakALot() {
  for (let i = 0; i < 40; i++) speech.speak();
}

function said(): { to: string; key: string; target?: string }[] {
  return added
    .filter((e): e is QuickChatExecution => e instanceof QuickChatExecution)
    .filter((e) => (e as any).sender === nation)
    .map((e) => ({
      to: (e as any).recipientID,
      key: (e as any).quickChatKey,
      target: (e as any).target,
    }));
}

function enemyAttacksNation(troops: number) {
  game.addExecution(new AttackExecution(troops, enemy, nation.id()));
  game.executeNextTick();
  added.length = 0;
}

describe("NationSpeechBehavior", () => {
  beforeEach(() => setupGame());

  test("says nothing when nothing is going on", () => {
    ally(human, nation);
    speakALot();
    expect(said()).toEqual([]);
  });

  test("begs an ally for troops only when really losing a fight", () => {
    ally(human, nation);
    nation.setTroops(1_000);
    human.setTroops(500_000);
    enemy.setTroops(500_000);
    enemyAttacksNation(100_000);

    speakALot();
    // (It may also plead with the enemy, who is human too.)
    const msgs = said().filter((m) => m.to === human.id());
    expect(msgs.length).toBeGreaterThan(0);
    expect(msgs.map((m) => m.key)).toContain("help.troops");
  });

  test("asks for help against the attacker when not short of troops", () => {
    ally(human, nation);
    nation.setTroops(game.config().maxTroops(nation) * 0.9);
    human.setTroops(1_000);
    enemy.setTroops(500_000);
    enemyAttacksNation(100_000);

    speakALot();
    const msgs = said();
    expect(msgs.map((m) => m.key)).not.toContain("help.troops");
    expect(msgs).toContainEqual({
      to: human.id(),
      key: "help.help_defend",
      target: enemy.id(),
    });
  });

  test("pleads with a human attacker only when clearly beaten", () => {
    nation.setTroops(1_000);
    enemy.setTroops(500_000);
    enemyAttacksNation(100_000);

    speakALot();
    expect(said()).toContainEqual({
      to: enemy.id(),
      key: "help.no_attack",
      target: undefined,
    });
  });

  test("never begs a player who is not its friend", () => {
    nation.setTroops(1_000);
    human.setTroops(500_000);
    enemy.setTroops(500_000);
    enemyAttacksNation(100_000);

    speakALot();
    expect(said().filter((m) => m.to === human.id())).toEqual([]);
  });

  test("calls its ally to the player it is actually attacking", () => {
    ally(human, nation);
    nation.setTroops(game.config().maxTroops(nation) * 0.9);
    game.addExecution(new AttackExecution(10_000, nation, enemy.id()));
    game.executeNextTick();
    added.length = 0;

    speakALot();
    expect(said()).toContainEqual({
      to: human.id(),
      key: "attack.focus",
      target: enemy.id(),
    });
  });
});
