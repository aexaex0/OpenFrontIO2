import { ClientID } from "@openfront/engine-api/Schemas";
import { z } from "zod";
import { Execution, Game } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type { ExecRecord } from "../snapshot/SnapshotContext";

/**
 * AlexFront: a client stops playing. Its nation stays on the map as it is,
 * with nobody at the helm (no AI takes over, it simply does nothing), and
 * the client watches on as a spectator. A client co-controlling someone
 * else's nation just lets go of it. Finishes inside init.
 */
export class LeaveNationExecution implements Execution {
  private active = true;

  constructor(private clientID: ClientID) {}

  init(mg: Game, ticks: number): void {
    this.active = false;
    const player = mg.playerByClientID(this.clientID);
    mg.clearCoController(this.clientID);
    if (player === null || !player.isAlive()) return;
    if (player.clientID() !== this.clientID) return; // was co-controlling
    player.releaseControl();
  }

  tick(ticks: number): void {}

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(): ExecRecord {
    return LeaveNationExecutionSnapshot.write({
      active: this.active,
      clientID: this.clientID,
    });
  }

  restoreSnapshot(s: LeaveNationState): void {
    this.active = s.active;
    this.clientID = s.clientID;
  }
}

const LeaveNationStateSchema = z.object({
  active: z.boolean(),
  clientID: z.string(),
});
type LeaveNationState = z.infer<typeof LeaveNationStateSchema>;

export const LeaveNationExecutionSnapshot = execSnapshotType({
  name: "LeaveNation",
  version: 1,
  schema: LeaveNationStateSchema,
  cls: () => LeaveNationExecution,
});
