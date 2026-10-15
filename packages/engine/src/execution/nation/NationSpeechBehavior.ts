import { PlayerType } from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { Game, Player } from "../../game/Game";
import { QuickChatExecution } from "../QuickChatExecution";

// A nation only begs for troops when it is really in trouble: under attack,
// below this share of its troop cap, and the ally has clearly more to give.
export const BEG_TROOP_SHARE = 0.3;
export const BEG_ALLY_TROOP_RATIO = 1.5;
// ...and for gold when its ally is much richer.
export const BEG_ALLY_GOLD_RATIO = 5;
export const BEG_MIN_ALLY_GOLD = 50_000;
// Pleads with a human attacker only when clearly losing to them.
export const PLEAD_STRENGTH_RATIO = 0.5;
// Each message that is true right now is said with 1-in-N odds per decision
// tick, on top of the quick chat cooldown, so nations don't spam.
export const SPEAK_ODDS = 3;

/**
 * Lets a nation talk to human players with the quick chat presets, and only
 * ever say what is actually true: it begs its allies when it is really losing
 * a fight, names the attacker it needs help against, calls its allies to the
 * target it is actually attacking, and pleads with a human who is beating it.
 * Holds no state: built on demand from the nation's random and player.
 */
export class NationSpeechBehavior {
  constructor(
    private random: PseudoRandom,
    private game: Game,
    private player: Player,
  ) {}

  speak(): void {
    if (!this.player.isAlive()) return;
    const spokenTo = new Set<Player>();
    const humans = this.game
      .players()
      .filter(
        (p) =>
          p !== this.player && p.type() === PlayerType.Human && p.isAlive(),
      );
    const friends = humans.filter((h) => this.player.isFriendly(h));

    const incoming = this.player
      .incomingAttacks()
      .filter((a) => a.attacker().isAlive());
    if (incoming.length > 0) {
      // The attacker hitting us hardest.
      const main = incoming.reduce((a, b) => (b.troops() > a.troops() ? b : a));
      const attacker = main.attacker();
      const maxTroops = this.game.config().maxTroops(this.player);
      const losing = this.player.troops() < maxTroops * BEG_TROOP_SHARE;

      for (const friend of friends) {
        if (spokenTo.has(friend)) continue;
        if (
          losing &&
          friend.troops() > this.player.troops() * BEG_ALLY_TROOP_RATIO &&
          this.say(friend, "help.troops")
        ) {
          spokenTo.add(friend);
          continue;
        }
        const friendGold = Number(friend.gold());
        if (
          friendGold >= BEG_MIN_ALLY_GOLD &&
          friendGold > Number(this.player.gold()) * BEG_ALLY_GOLD_RATIO &&
          this.say(friend, "help.gold")
        ) {
          spokenTo.add(friend);
          continue;
        }
        if (
          attacker !== friend &&
          !friend.isFriendly(attacker) &&
          this.say(friend, "help.help_defend", attacker)
        ) {
          spokenTo.add(friend);
        }
      }

      // Plead with a human who is beating us.
      for (const attack of incoming) {
        const human = attack.attacker();
        if (
          human.type() === PlayerType.Human &&
          !spokenTo.has(human) &&
          !this.player.isFriendly(human) &&
          this.player.troops() < human.troops() * PLEAD_STRENGTH_RATIO &&
          this.say(human, "help.no_attack")
        ) {
          spokenTo.add(human);
        }
      }
    }

    // Call allies to the player we are actually attacking right now.
    const targets = this.player
      .outgoingAttacks()
      .map((a) => a.target())
      .filter((t): t is Player => t.isPlayer() && t.isAlive());
    if (targets.length > 0) {
      const target = targets[0];
      for (const friend of friends) {
        if (spokenTo.has(friend)) continue;
        if (friend === target || friend.isFriendly(target)) continue;
        if (this.say(friend, "attack.focus", target)) spokenTo.add(friend);
      }
    }
  }

  private say(to: Player, key: string, target?: Player): boolean {
    if (!this.player.canSendQuickChat(to)) return false;
    if (!this.random.chance(SPEAK_ODDS)) return false;
    this.game.addExecution(
      new QuickChatExecution(this.player, to.id(), key, target?.id()),
    );
    return true;
  }
}
