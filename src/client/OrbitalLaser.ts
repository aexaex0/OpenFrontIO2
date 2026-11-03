import type { TileRef } from "@openfront/engine-api/game/GameMap";
import { GameEvent } from "@openfront/shared/EventBus";

/** The orbital-laser hotkey was pressed (fires at the tile under the cursor). */
export class OrbitalLaserKeyEvent implements GameEvent {}

/**
 * The hotbar's laser button was toggled (armed: the next map click fires
 * there), or a shot went off and the button should reset.
 */
export class OrbitalLaserArmEvent implements GameEvent {
  constructor(public readonly armed: boolean) {}
}

/** Send an orbital laser strike on this tile to the server. */
export class SendOrbitalLaserIntentEvent implements GameEvent {
  constructor(public readonly tile: TileRef) {}
}

/** Charge-up time and scorch radius, mirrored from OrbitalLaserExecution. */
export const LASER_CHARGE_MS = 3000;
export const LASER_RADIUS_TILES = 16;

interface Beam {
  x: number;
  y: number;
  start: number;
  strikeAt: number | null;
  color: string;
}

/**
 * Draws orbital laser strikes over the map on a 2D canvas: a thin targeting
 * beam and a closing ring while it charges, then a blinding column, a flash
 * and a shockwave when it hits. Positions are map tiles; `toScreen` maps
 * them to screen pixels and `tilePx` gives the current zoom.
 */
export class OrbitalLaserOverlay {
  private canvas = document.createElement("canvas");
  private ctx = this.canvas.getContext("2d");
  private beams: Beam[] = [];
  private raf = 0;

  constructor(
    private toScreen: (x: number, y: number) => { x: number; y: number },
    private tilePx: () => number,
  ) {
    this.canvas.style.cssText =
      "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:50";
    document.body.appendChild(this.canvas);
  }

  charge(x: number, y: number, color: string): void {
    this.beams.push({ x, y, start: performance.now(), strikeAt: null, color });
    this.run();
  }

  strike(x: number, y: number, color: string): void {
    const now = performance.now();
    const b = this.beams.find(
      (e) => e.strikeAt === null && e.x === x && e.y === y,
    );
    if (b) b.strikeAt = now;
    else
      this.beams.push({
        x,
        y,
        start: now - LASER_CHARGE_MS,
        strikeAt: now,
        color,
      });
    this.run();
  }

  private run(): void {
    if (this.raf === 0) this.raf = requestAnimationFrame(this.frame);
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
    this.beams = this.beams.filter((b) =>
      b.strikeAt === null
        ? now - b.start < LASER_CHARGE_MS * 3
        : now - b.strikeAt < 1400,
    );
    for (const b of this.beams) this.drawBeam(ctx, b, now, h);
    if (this.beams.length > 0) this.run();
  };

  private drawBeam(
    ctx: CanvasRenderingContext2D,
    b: Beam,
    now: number,
    h: number,
  ): void {
    const p = this.toScreen(b.x + 0.5, b.y + 0.5);
    const R = LASER_RADIUS_TILES * this.tilePx();
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    if (b.strikeAt === null) {
      // Charging: a flickering aim beam and a ring closing on the target.
      const k = Math.min(1, (now - b.start) / LASER_CHARGE_MS);
      const flick = 0.5 + 0.5 * Math.sin(now / 30);
      ctx.strokeStyle = `rgba(255,80,80,${0.35 + 0.4 * flick})`;
      ctx.lineWidth = 1.5 + 2 * k;
      ctx.beginPath();
      ctx.moveTo(p.x, 0);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,60,60,${0.5 + 0.5 * k})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -now / 20;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(6, R * (1.6 - 0.6 * k)), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(255,120,120,${0.6 * flick})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3 + 4 * k, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Strike: a white-hot column from the sky, a flash and a shockwave.
      const t = (now - b.strikeAt) / 1400;
      const fade = 1 - t;
      const width = Math.max(8, R * 0.9) * (t < 0.15 ? t / 0.15 : 1) * fade;
      const col = ctx.createLinearGradient(p.x - width, 0, p.x + width, 0);
      col.addColorStop(0, "rgba(120,200,255,0)");
      col.addColorStop(0.35, `rgba(120,220,255,${0.6 * fade})`);
      col.addColorStop(0.5, `rgba(255,255,255,${fade})`);
      col.addColorStop(0.65, `rgba(120,220,255,${0.6 * fade})`);
      col.addColorStop(1, "rgba(120,200,255,0)");
      ctx.fillStyle = col;
      ctx.fillRect(p.x - width, 0, width * 2, p.y);
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R * 1.4);
      glow.addColorStop(0, `rgba(255,255,255,${0.9 * fade})`);
      glow.addColorStop(0.4, `rgba(255,170,60,${0.6 * fade})`);
      glow.addColorStop(1, "rgba(255,80,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, R * 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,230,180,${fade})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, R * (0.5 + 1.8 * t), 0, Math.PI * 2);
      ctx.stroke();
      if (t < 0.12) {
        ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - t / 0.12)})`;
        ctx.fillRect(0, 0, ctx.canvas.width, h);
      }
    }
    ctx.restore();
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.canvas.remove();
  }
}
