import { PlayerID, PlayerType } from "@openfront/engine-api/game/GameTypes";
import { ClientID } from "@openfront/engine-api/Schemas";
import { z } from "zod";
import { Execution, Game } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type { ExecRecord } from "../snapshot/SnapshotContext";

/**
 * A client with no living player (a spectator, or someone whose nation
 * died) starts co-controlling a living human player: from now on its intents
 * act as that player, who keeps playing as well. Finishes inside init.
 */
export class ParasitePlayerExecution implements Execution {
  private active = true;

  constructor(
    private clientID: ClientID,
    private playerID: PlayerID,
  ) {}

  init(mg: Game, ticks: number): void {
    this.active = false;
    if (mg.inSpawnPhase()) return;
    if (!mg.hasPlayer(this.playerID)) return;
    const target = mg.player(this.playerID);
    if (target.type() !== PlayerType.Human || !target.isAlive()) return;
    if (target.clientID() === this.clientID) return;
    // Own living player: play that one instead.
    const current = mg.playerByClientID(this.clientID);
    if (
      current !== null &&
      current.isAlive() &&
      current.clientID() === this.clientID
    ) {
      return;
    }
    mg.setCoController(this.clientID, this.playerID);
  }

  tick(ticks: number): void {}

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(): ExecRecord {
    return ParasitePlayerExecutionSnapshot.write({
      active: this.active,
      clientID: this.clientID,
      playerID: this.playerID,
    });
  }

  restoreSnapshot(s: ParasitePlayerState): void {
    this.active = s.active;
    this.clientID = s.clientID;
    this.playerID = s.playerID;
  }
}

const ParasitePlayerStateSchema = z.object({
  active: z.boolean(),
  clientID: z.string(),
  playerID: z.string(),
});
type ParasitePlayerState = z.infer<typeof ParasitePlayerStateSchema>;

export const ParasitePlayerExecutionSnapshot = execSnapshotType({
  name: "ParasitePlayer",
  version: 1,
  schema: ParasitePlayerStateSchema,
  cls: () => ParasitePlayerExecution,
});
