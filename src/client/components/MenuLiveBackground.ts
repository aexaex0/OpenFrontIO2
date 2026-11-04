// AlexFront: a living map behind the main menu. A real map's land mask
// (the small map16x/map4x terrain file) with a handful of made-up nations
// slowly spreading over it, then a new map. It is drawn at the map file's
// own resolution, a few times a second, and sleeps in game, in background
// tabs and when it is turned off in the settings ("Live menu background").

import { GameMapType } from "@openfront/engine-api/game/GameTypes";
import { LitElement, html } from "lit";
import { customElement, query } from "lit/decorators.js";
import { terrainMapFileLoader } from "../TerrainMapFileLoader";
import {
  MENU_LIVE_BACKGROUND_KEY,
  USER_SETTINGS_CHANGED_EVENT,
  UserSettings,
} from "../UserSettings";

const STEP_MS = 160;
const NATIONS = 9;
/** A map is played out after this many steps (or when it is full). */
const MAX_STEPS = 600;
const LAST_MAP_KEY = "alexfront.menuBgLastMap";
const LAND_BIT = 1 << 7;
const SHOWN_OPACITY = "0.35";

const PALETTE: [number, number, number][] = [
  [239, 68, 68],
  [59, 130, 246],
  [34, 197, 94],
  [234, 179, 8],
  [168, 85, 247],
  [236, 72, 153],
  [20, 184, 166],
  [249, 115, 22],
  [148, 163, 184],
];

interface World {
  w: number;
  h: number;
  land: Uint8Array;
  owner: Int8Array; // -1 = nobody
  landCount: number;
  steps: number;
}

function pickMap(): GameMapType {
  const maps = Object.values(GameMapType) as GameMapType[];
  let last: string | null = null;
  try {
    last = localStorage.getItem(LAST_MAP_KEY);
  } catch {
    // No storage: any map will do.
  }
  let map = maps[Math.floor(Math.random() * maps.length)];
  for (let i = 0; i < 10 && map === last; i++) {
    map = maps[Math.floor(Math.random() * maps.length)];
  }
  try {
    localStorage.setItem(LAST_MAP_KEY, map);
  } catch {
    // Same as above.
  }
  return map;
}

@customElement("menu-live-background")
export class MenuLiveBackground extends LitElement {
  @query("canvas") private canvas!: HTMLCanvasElement;
  private world: World | null = null;
  private image: ImageData | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private loading = false;
  /** After a failed load, no new try before this time (ms). */
  private retryAt = 0;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    globalThis.addEventListener(
      `${USER_SETTINGS_CHANGED_EVENT}:${MENU_LIVE_BACKGROUND_KEY}`,
      this.sync,
    );
    document.addEventListener("visibilitychange", this.sync);
    this.updateComplete.then(this.sync);
  }

  disconnectedCallback() {
    globalThis.removeEventListener(
      `${USER_SETTINGS_CHANGED_EVENT}:${MENU_LIVE_BACKGROUND_KEY}`,
      this.sync,
    );
    document.removeEventListener("visibilitychange", this.sync);
    this.stop();
    super.disconnectedCallback();
  }

  private on(): boolean {
    return new UserSettings().menuLiveBackground();
  }

  private sync = () => {
    const on = this.on();
    this.style.display = on ? "" : "none";
    if (on && !document.hidden) this.start();
    else this.stop();
  };

  private start() {
    if (this.timer !== null) return;
    this.timer = setInterval(this.step, STEP_MS);
    if (this.world === null) void this.loadWorld();
  }

  private stop() {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  private async loadWorld() {
    if (this.loading || performance.now() < this.retryAt) return;
    this.loading = true;
    try {
      const map = pickMap();
      const data = terrainMapFileLoader.getMapData(map);
      const manifest = await data.manifest();
      const small = manifest.map16x.width >= 100;
      const meta = small ? manifest.map16x : manifest.map4x;
      const bytes = small ? await data.map16xBin() : await data.map4xBin();
      const { width: w, height: h } = meta;
      const land = new Uint8Array(w * h);
      let landCount = 0;
      for (let i = 0; i < w * h; i++) {
        if ((bytes[i] ?? 0) & LAND_BIT) {
          land[i] = 1;
          landCount++;
        }
      }
      const owner = new Int8Array(w * h).fill(-1);
      // Seed the nations on random land.
      for (let n = 0, tries = 0; n < NATIONS && tries < 5000; tries++) {
        const i = Math.floor(Math.random() * w * h);
        if (land[i] && owner[i] === -1) owner[i] = n++;
      }
      this.world = { w, h, land, owner, landCount, steps: 0 };
      this.canvas.width = w;
      this.canvas.height = h;
      this.image = new ImageData(w, h);
      this.canvas.style.opacity = "0";
      this.draw();
      requestAnimationFrame(() => (this.canvas.style.opacity = SHOWN_OPACITY));
    } catch {
      // The map files are not reachable: try another map in a while.
      this.world = null;
      this.retryAt = performance.now() + 30_000;
    } finally {
      this.loading = false;
    }
  }

  private step = () => {
    if (document.body.classList.contains("in-game")) return;
    const wd = this.world;
    if (wd === null) {
      void this.loadWorld();
      return;
    }
    const { w, h, land, owner } = wd;
    const next = owner.slice();
    let owned = 0;
    for (let i = 0; i < w * h; i++) {
      const o = owner[i];
      if (o === -1) continue;
      owned++;
      if (Math.random() > 0.45) continue;
      const x = i % w;
      const r = Math.floor(Math.random() * 4);
      const j =
        r === 0
          ? x > 0
            ? i - 1
            : -1
          : r === 1
            ? x < w - 1
              ? i + 1
              : -1
            : r === 2
              ? i - w
              : i + w;
      if (j < 0 || j >= w * h || !land[j]) continue;
      if (owner[j] === -1) next[j] = o;
      else if (owner[j] !== o && Math.random() < 0.08) next[j] = o;
    }
    wd.owner = next;
    wd.steps++;
    this.draw();
    if (wd.steps > MAX_STEPS || owned > wd.landCount * 0.97) {
      this.canvas.style.opacity = "0";
      this.world = null;
      setTimeout(() => void this.loadWorld(), 1200);
    }
  };

  private draw() {
    const wd = this.world;
    const img = this.image;
    if (wd === null || img === null) return;
    const ctx = this.canvas.getContext("2d");
    if (ctx === null) return;
    const px = img.data;
    for (let i = 0; i < wd.w * wd.h; i++) {
      const k = i * 4;
      if (!wd.land[i]) {
        px[k] = 14;
        px[k + 1] = 30;
        px[k + 2] = 52;
      } else if (wd.owner[i] === -1) {
        px[k] = 72;
        px[k + 1] = 84;
        px[k + 2] = 70;
      } else {
        const c = PALETTE[wd.owner[i] % PALETTE.length];
        px[k] = c[0];
        px[k + 1] = c[1];
        px[k + 2] = c[2];
      }
      px[k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  render() {
    return html`<canvas
      class="menu-live-bg fixed inset-0 w-full h-full pointer-events-none"
      style="object-fit:cover;z-index:-35;opacity:0.35;transition:opacity 1.2s ease;filter:blur(1px) saturate(0.9);"
      aria-hidden="true"
    ></canvas>`;
  }
}
