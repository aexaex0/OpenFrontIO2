import { TileRef } from "@openfront/engine-api/game/GameMap";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import {
  ORBITAL_LASER_AREA_RADIUS,
  ORBITAL_LASER_BEAM_RADIUS,
  ORBITAL_LASER_CHARGE,
  ORBITAL_LASER_POINTS,
  ORBITAL_LASER_SPEED,
} from "@openfront/engine-lib/OrbitalLaser";
import { zPlayerRef, zTile } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game, Player } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";

export { ORBITAL_LASER_CHARGE } from "@openfront/engine-lib/OrbitalLaser";

const ALL_UNIT_TYPES = Object.values(UnitType) as UnitType[];

/**
 * AlexFront's orbital laser: a superweapon for the price of a MIRV that
 * needs a missile silo like one. The player clicks three points (the 2nd
 * and 3rd within ORBITAL_LASER_AREA_RADIUS of the 1st); after a charge-up
 * the beam touches down on the 1st and sweeps to the 2nd and on to the 3rd.
 * Everything under it is destroyed: tiles lose their owner and turn to
 * fallout, units are deleted, and their owners lose troops for the land.
 */
export class OrbitalLaserExecution implements Execution {
  private active = true;
  private mg: Game | null = null;
  private strikeAt = 0;
  /** Distance travelled along the path, in tiles. */
  private progress = 0;

  constructor(
    private player: Player,
    private points: TileRef[],
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    if (!this.valid(mg)) {
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
    this.report("charge", this.points[0]);
  }

  private valid(mg: Game): boolean {
    if (
      mg.inSpawnPhase() ||
      !this.player.isAlive() ||
      mg.config().isUnitDisabled(UnitType.MIRV) ||
      this.player.units(UnitType.MissileSilo).length === 0 ||
      this.points.length !== ORBITAL_LASER_POINTS ||
      !this.points.every((t) => mg.isValidRef(t))
    ) {
      return false;
    }
    const r2 = ORBITAL_LASER_AREA_RADIUS * ORBITAL_LASER_AREA_RADIUS;
    return this.points.every(
      (t) => mg.euclideanDistSquared(this.points[0], t) <= r2,
    );
  }

  tick(ticks: number): void {
    const mg = this.mg;
    if (mg === null || ticks < this.strikeAt) return;
    const total = this.pathLength(mg);
    const from = this.progress;
    const to = Math.min(total, from + ORBITAL_LASER_SPEED);
    // Burn every tile-step in between, so a fast beam leaves no gaps.
    for (let d = from; d <= to; d += 1) this.burn(mg, this.pointAt(mg, d));
    this.burn(mg, this.pointAt(mg, to));
    this.progress = to;
    const at = this.pointAt(mg, to);
    this.report("sweep", mg.ref(at.x, at.y));
    if (to >= total) {
      this.active = false;
      this.report("done", mg.ref(at.x, at.y));
    }
  }

  private pathLength(mg: Game): number {
    let len = 0;
    for (let i = 1; i < this.points.length; i++) {
      len += this.segLength(mg, this.points[i - 1], this.points[i]);
    }
    return len;
  }

  private segLength(mg: Game, a: TileRef, b: TileRef): number {
    return Math.sqrt(mg.euclideanDistSquared(a, b));
  }

  /** The tile `d` tiles along the path from the first point. */
  private pointAt(mg: Game, d: number): { x: number; y: number } {
    let left = d;
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1];
      const b = this.points[i];
      const len = this.segLength(mg, a, b);
      if (left <= len || i === this.points.length - 1) {
        const k = len === 0 ? 0 : Math.min(1, left / len);
        return {
          x: Math.round(mg.x(a) + (mg.x(b) - mg.x(a)) * k),
          y: Math.round(mg.y(a) + (mg.y(b) - mg.y(a)) * k),
        };
      }
      left -= len;
    }
    const last = this.points[this.points.length - 1];
    return { x: mg.x(last), y: mg.y(last) };
  }

  private burn(mg: Game, c: { x: number; y: number }): void {
    const r = ORBITAL_LASER_BEAM_RADIUS;
    const lost = new Map<Player, number>();
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const x = c.x + dx;
        const y = c.y + dy;
        if (!mg.isValidCoord(x, y)) continue;
        const t = mg.ref(x, y);
        const owner = mg.owner(t);
        if (owner.isPlayer()) {
          owner.relinquish(t);
          lost.set(owner, (lost.get(owner) ?? 0) + 1);
        }
        if (mg.isLand(t) && !mg.hasFallout(t)) mg.setFallout(t, true);
      }
    }
    for (const [victim, n] of lost) {
      const before = victim.numTilesOwned() + n;
      victim.removeTroops(
        Math.floor((victim.troops() * n) / Math.max(1, before)),
      );
    }
    const center = mg.ref(c.x, c.y);
    for (const unit of mg.nearbyUnits(center, r, ALL_UNIT_TYPES)) {
      if (unit.unit.isActive()) unit.unit.delete(true, this.player);
    }
  }

  private report(phase: "charge" | "sweep" | "done", pos: TileRef): void {
    this.mg?.addUpdate({
      type: GameUpdateType.OrbitalLaser,
      playerSmallID: this.player.smallID(),
      points: this.points,
      pos,
      phase,
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
      points: this.points,
      strikeAt: this.strikeAt,
      progress: this.progress,
    });
  }

  restoreSnapshot(s: OrbitalLaserState, r: SnapshotReader): void {
    this.active = s.active;
    this.mg = s.initialized ? r.game : null;
    this.player = r.player(s.player);
    this.points = s.points;
    this.strikeAt = s.strikeAt;
    this.progress = s.progress;
  }
}

const OrbitalLaserStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  player: zPlayerRef(),
  points: z.array(zTile()),
  strikeAt: z.number(),
  progress: z.number(),
});
type OrbitalLaserState = z.infer<typeof OrbitalLaserStateSchema>;

export const OrbitalLaserExecutionSnapshot = execSnapshotType({
  name: "OrbitalLaser",
  version: 2,
  schema: OrbitalLaserStateSchema,
  cls: () => OrbitalLaserExecution,
});
