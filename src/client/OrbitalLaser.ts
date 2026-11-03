import type { TileRef } from "@openfront/engine-api/game/GameMap";
import {
  ORBITAL_LASER_AREA_RADIUS,
  ORBITAL_LASER_BEAM_RADIUS,
  ORBITAL_LASER_CHARGE,
} from "@openfront/engine-lib/OrbitalLaser";
import { GameEvent } from "@openfront/shared/EventBus";

/** The orbital-laser hotkey was pressed: start (or stop) aiming. */
export class OrbitalLaserKeyEvent implements GameEvent {}

/** Right click while aiming: drop the points placed so far. */
export class OrbitalLaserCancelEvent implements GameEvent {}

/**
 * Aiming started (armed) or ended. The hotbar button sends it to start or
 * stop aiming, and the game sends it back when aiming ends.
 */
export class OrbitalLaserArmEvent implements GameEvent {
  constructor(public readonly armed: boolean) {}
}

/** Send an orbital laser along these three points to the server. */
export class SendOrbitalLaserIntentEvent implements GameEvent {
  constructor(public readonly points: TileRef[]) {}
}

/** Charge-up in ms (the engine's ticks at 10 ticks/s). */
const CHARGE_MS = ORBITAL_LASER_CHARGE * 100;

export interface Pt {
  x: number;
  y: number;
}

/** What the aiming overlay draws: the placed points and the cursor. */
export interface AimState {
  points: Pt[];
  cursor: Pt | null;
}

interface Beam {
  key: string;
  points: Pt[];
  pos: Pt;
  trail: Pt[];
  start: number;
  doneAt: number | null;
  lastSeen: number;
}

/**
 * Draws the orbital laser over the map on a 2D canvas:
 *  - while aiming, the circle the three points must fall in, the beam's
 *    size at the cursor, and the path so far;
 *  - while charging, a dashed preview of the path and a flickering target;
 *  - while sweeping, a white-hot column moving along the path with a
 *    glowing scorched trail; a flash when it ends.
 * Positions are map tiles; `toScreen` maps them to screen pixels and
 * `tilePx` gives the current zoom.
 */
export class OrbitalLaserOverlay {
  private canvas = document.createElement("canvas");
  private ctx = this.canvas.getContext("2d");
  private beams = new Map<string, Beam>();
  private raf = 0;

  constructor(
    private toScreen: (x: number, y: number) => Pt,
    private tilePx: () => number,
    private aim: () => AimState | null,
  ) {
    this.canvas.style.cssText =
      "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:50";
    document.body.appendChild(this.canvas);
  }

  /** Keeps drawing while aiming (call when aiming starts). */
  wake(): void {
    if (this.raf === 0) this.raf = requestAnimationFrame(this.frame);
  }

  update(
    playerSmallID: number,
    points: Pt[],
    pos: Pt,
    phase: "charge" | "sweep" | "done",
  ): void {
    const now = performance.now();
    const key = `${playerSmallID}:${points[0].x},${points[0].y}`;
    let b = this.beams.get(key);
    if (b === undefined) {
      b = {
        key,
        points,
        pos,
        trail: [],
        start: phase === "charge" ? now : now - CHARGE_MS,
        doneAt: null,
        lastSeen: now,
      };
      this.beams.set(key, b);
    }
    b.lastSeen = now;
    if (phase !== "charge") {
      b.pos = pos;
      b.trail.push(pos);
    }
    if (phase === "done") b.doneAt = now;
    this.wake();
  }

  private frame = (now: number) => {
    this.raf = 0;
    const ctx = this.ctx;
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (this.canvas.width !== Math.round(w * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (const [key, b] of this.beams) {
      const gone =
        b.doneAt !== null
          ? now - b.doneAt > 1600
          : now - b.lastSeen > CHARGE_MS + 4000;
      if (gone) this.beams.delete(key);
    }
    for (const b of this.beams.values()) this.drawBeam(ctx, b, now, w, h);
    const aim = this.aim();
    if (aim !== null) this.drawAim(ctx, aim, now);
    if (this.beams.size > 0 || aim !== null) this.wake();
  };

  private px(p: Pt): Pt {
    return this.toScreen(p.x + 0.5, p.y + 0.5);
  }

  private drawAim(ctx: CanvasRenderingContext2D, aim: AimState, now: number) {
    const s = this.tilePx();
    const area = ORBITAL_LASER_AREA_RADIUS * s;
    const beam = ORBITAL_LASER_BEAM_RADIUS * s;
    const first = aim.points[0] ?? aim.cursor;
    if (first === null) return;
    const c = this.px(first);
    ctx.save();
    // The area the 2nd and 3rd points must fall in.
    ctx.fillStyle = "rgba(255,40,40,0.08)";
    ctx.strokeStyle = "rgba(255,90,90,0.9)";
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 7]);
    ctx.lineDashOffset = -now / 40;
    ctx.beginPath();
    ctx.arc(c.x, c.y, area, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    // The path so far, then on to the cursor.
    const path = aim.points.map((p) => this.px(p));
    const cur = aim.cursor === null ? null : this.px(aim.cursor);
    const inside =
      aim.cursor === null ||
      aim.points.length === 0 ||
      (aim.cursor.x - first.x) ** 2 + (aim.cursor.y - first.y) ** 2 <=
        ORBITAL_LASER_AREA_RADIUS ** 2;
    if (path.length > 0) {
      ctx.strokeStyle = "rgba(103,232,249,0.55)";
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(2, beam * 2);
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (const p of path.slice(1)) ctx.lineTo(p.x, p.y);
      if (cur !== null && inside) ctx.lineTo(cur.x, cur.y);
      ctx.stroke();
    }
    // Numbered points.
    path.forEach((p, i) => {
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#b91c1c";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), p.x, p.y + 0.5);
    });
    // The beam's own size at the cursor.
    if (cur !== null) {
      ctx.strokeStyle = inside ? "rgba(103,232,249,1)" : "rgba(248,113,113,1)";
      ctx.fillStyle = inside
        ? "rgba(103,232,249,0.25)"
        : "rgba(248,113,113,0.2)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cur.x, cur.y, Math.max(4, beam), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBeam(
    ctx: CanvasRenderingContext2D,
    b: Beam,
    now: number,
    w: number,
    h: number,
  ): void {
    const s = this.tilePx();
    const r = Math.max(4, ORBITAL_LASER_BEAM_RADIUS * s);
    const path = b.points.map((p) => this.px(p));
    ctx.save();
    if (b.trail.length === 0) {
      // Charging: a dashed preview of the path and a flickering target.
      const k = Math.min(1, (now - b.start) / CHARGE_MS);
      const flick = 0.5 + 0.5 * Math.sin(now / 30);
      ctx.strokeStyle = `rgba(255,70,70,${0.35 + 0.45 * k})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -now / 25;
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (const p of path.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = `rgba(255,80,80,${0.3 + 0.5 * flick})`;
      ctx.lineWidth = 1 + 3 * k;
      ctx.beginPath();
      ctx.moveTo(path[0].x, 0);
      ctx.lineTo(path[0].x, path[0].y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(path[0].x, path[0].y, r * (2 - k), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return;
    }
    const fade =
      b.doneAt === null ? 1 : Math.max(0, 1 - (now - b.doneAt) / 1600);
    // The scorched trail.
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const trail = b.trail.map((p) => this.px(p));
    trail.unshift(path[0]);
    ctx.strokeStyle = `rgba(255,120,40,${0.55 * fade})`;
    ctx.lineWidth = r * 2.4;
    ctx.beginPath();
    ctx.moveTo(trail[0].x, trail[0].y);
    for (const p of trail.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,240,200,${0.7 * fade})`;
    ctx.lineWidth = r * 0.8;
    ctx.stroke();
    if (b.doneAt === null) {
      // The column from the sky and its glowing foot.
      const p = this.px(b.pos);
      const jitter = 0.85 + 0.15 * Math.sin(now / 17);
      const half = r * 1.1 * jitter;
      const col = ctx.createLinearGradient(p.x - half, 0, p.x + half, 0);
      col.addColorStop(0, "rgba(120,200,255,0)");
      col.addColorStop(0.3, "rgba(120,220,255,0.7)");
      col.addColorStop(0.5, "rgba(255,255,255,1)");
      col.addColorStop(0.7, "rgba(120,220,255,0.7)");
      col.addColorStop(1, "rgba(120,200,255,0)");
      ctx.fillStyle = col;
      ctx.fillRect(p.x - half, 0, half * 2, p.y);
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3);
      glow.addColorStop(0, "rgba(255,255,255,0.95)");
      glow.addColorStop(0.35, "rgba(255,180,80,0.65)");
      glow.addColorStop(1, "rgba(255,60,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const t = (now - b.doneAt) / 1600;
      const p = this.px(b.pos);
      ctx.strokeStyle = `rgba(255,230,180,${fade})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * (1 + 6 * t), 0, Math.PI * 2);
      ctx.stroke();
      if (t < 0.1) {
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = `rgba(255,255,255,${0.3 * (1 - t / 0.1)})`;
        ctx.fillRect(0, 0, w, h);
      }
    }
    ctx.restore();
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.canvas.remove();
  }
}
