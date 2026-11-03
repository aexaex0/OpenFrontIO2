import { GameMode } from "@openfront/engine-api/game/GameTypes";
import { z } from "zod";
import { clanOf } from "../game/Clans";
import { Execution, Game, Player } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type { ExecRecord, SnapshotReader } from "../snapshot/SnapshotContext";

/** Extend a clan alliance when it has fewer ticks left than this. */
const EXTEND_BEFORE = 600;

/**
 * AlexFront clans: in free-for-all games, players of the same clan are
 * always allied. Once spawning is over they ally automatically, and their
 * alliance is kept from expiring (breaking it is refused in GameImpl).
 */
export class ClanAllianceExecution implements Execution {
  private active = true;
  private mg: Game | null = null;

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    if (mg.config().gameConfig().gameMode !== GameMode.FFA) {
      this.active = false;
    }
  }

  tick(ticks: number): void {
    const mg = this.mg;
    if (mg === null || ticks % 10 !== 0 || mg.inSpawnPhase()) return;
    const clans = new Map<string, Player[]>();
    for (const p of mg.players()) {
      if (!p.isAlive()) continue;
      const clan = clanOf(p);
      if (clan === null) continue;
      const list = clans.get(clan);
      if (list) list.push(p);
      else clans.set(clan, [p]);
    }
    for (const members of clans.values()) {
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const a = members[i];
          const b = members[j];
          const alliance = a.allianceWith(b);
          if (alliance !== null) {
            if (alliance.expiresAt() - mg.ticks() < EXTEND_BEFORE) {
              alliance.extend();
            }
            continue;
          }
          // A request each way: the second one accepts the first.
          a.createAllianceRequest(b);
          if (!a.isAlliedWith(b)) b.createAllianceRequest(a);
        }
      }
    }
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return true;
  }

  snapshot(): ExecRecord {
    return ClanAllianceExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== null,
    });
  }

  restoreSnapshot(s: ClanAllianceState, r: SnapshotReader): void {
    this.active = s.active;
    this.mg = s.initialized ? r.game : null;
  }
}

const ClanAllianceStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
});
type ClanAllianceState = z.infer<typeof ClanAllianceStateSchema>;

export const ClanAllianceExecutionSnapshot = execSnapshotType({
  name: "ClanAlliance",
  version: 1,
  schema: ClanAllianceStateSchema,
  cls: () => ClanAllianceExecution,
});
