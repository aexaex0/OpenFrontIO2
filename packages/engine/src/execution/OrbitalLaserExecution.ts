import { TileRef } from "@openfront/engine-api/game/GameMap";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { zPlayerRef, zTile } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game, Player } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";

/** Ticks between firing and the beam hitting (the charge-up). */
export const ORBITAL_LASER_CHARGE = 30;
/** Radius of the scorched circle, in tiles. */
export const ORBITAL_LASER_RADIUS = 16;

/**
 * AlexFront's orbital laser: a superweapon fired from space at any tile,
 * for the same price as a MIRV and needing a missile silo like one. After
 * a short charge-up the beam scorches a circle: every tile there that
 * belongs to a non-friendly player is lost, their units in it are
 * destroyed and their troops thinned. Land stays land.
 */
export class OrbitalLaserExecution implements Execution {
  private active = true;
  private mg: Game | null = null;
  private strikeAt = 0;

  constructor(
    private player: Player,
    private tile: TileRef,
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    if (
      mg.inSpawnPhase() ||
      !this.player.isAlive() ||
      !mg.isValidRef(this.tile) ||
      mg.config().isUnitDisabled(UnitType.MIRV) ||
      this.player.units(UnitType.MissileSilo).length === 0
    ) {
      this.active = false;
      return;
    }
    const cost = mg.unitInfo(UnitType.MIRV).cost(mg, this.player);
    if (this.player.gold() < cost) {
      this.active = false;
      return;
    }
    this.player.removeGold(cost);
    this.strikeAt = ticks + ORBITAL_LASER_CHARGE;
    mg.addUpdate({
      type: GameUpdateType.OrbitalLaser,
      playerSmallID: this.player.smallID(),
      tile: this.tile,
      strike: false,
    });
  }

  tick(ticks: number): void {
    const mg = this.mg;
    if (mg === null || ticks < this.strikeAt) return;
    this.active = false;
    const r2 = ORBITAL_LASER_RADIUS * ORBITAL_LASER_RADIUS;
    const tiles = mg.bfs(
      this.tile,
      (_, n: TileRef) => mg.euclideanDistSquared(this.tile, n) <= r2,
    );
    const lost = new Map<Player, number>();
    for (const t of tiles) {
      const owner = mg.owner(t);
      if (!owner.isPlayer() || owner === this.player) continue;
      if (this.player.isFriendly(owner)) continue;
      owner.relinquish(t);
      lost.set(owner, (lost.get(owner) ?? 0) + 1);
    }
    for (const [victim, n] of lost) {
      const before = victim.numTilesOwned() + n;
      const share = Math.min(1, (n / Math.max(1, before)) * 1.5);
      victim.removeTroops(Math.floor(victim.troops() * share));
    }
    for (const unit of mg.units()) {
      if (mg.euclideanDistSquared(this.tile, unit.tile()) > r2) continue;
      const owner = unit.owner();
      if (owner === this.player || this.player.isFriendly(owner)) continue;
      unit.delete(true, this.player);
    }
    mg.addUpdate({
      type: GameUpdateType.OrbitalLaser,
      playerSmallID: this.player.smallID(),
      tile: this.tile,
      strike: true,
    });
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return OrbitalLaserExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== null,
      player: w.player(this.player),
      tile: this.tile,
      strikeAt: this.strikeAt,
    });
  }

  restoreSnapshot(s: OrbitalLaserState, r: SnapshotReader): void {
    this.active = s.active;
    this.mg = s.initialized ? r.game : null;
    this.player = r.player(s.player);
    this.tile = s.tile;
    this.strikeAt = s.strikeAt;
  }
}

const OrbitalLaserStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  player: zPlayerRef(),
  tile: zTile(),
  strikeAt: z.number(),
});
type OrbitalLaserState = z.infer<typeof OrbitalLaserStateSchema>;

export const OrbitalLaserExecutionSnapshot = execSnapshotType({
  name: "OrbitalLaser",
  version: 1,
  schema: OrbitalLaserStateSchema,
  cls: () => OrbitalLaserExecution,
});
