// AlexFront: a counter that rolls to its new value (gold and troops in the
// bottom panel). Off in the settings ("Animated numbers"), it just shows the
// value.

import { renderNumber, renderTroops } from "@openfront/engine-lib/Format";
import { LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  ANIMATED_NUMBERS_KEY,
  USER_SETTINGS_CHANGED_EVENT,
  UserSettings,
} from "../UserSettings";

const DURATION_MS = 400;

let enabled: boolean | null = null;
function animationsOn(): boolean {
  if (enabled === null) {
    enabled = new UserSettings().animatedNumbers();
    globalThis.addEventListener?.(
      `${USER_SETTINGS_CHANGED_EVENT}:${ANIMATED_NUMBERS_KEY}`,
      () => {
        enabled = new UserSettings().animatedNumbers();
      },
    );
  }
  return enabled;
}

@customElement("anim-num")
export class AnimatedNumber extends LitElement {
  @property({ type: Number }) value = 0;
  /** "troops" shows troop units (a tenth of the raw count), "gold" plain. */
  @property() kind: "troops" | "gold" = "gold";

  private shown: number | null = null;
  private from = 0;
  private started = 0;
  private raf = 0;

  createRenderRoot() {
    return this;
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    super.disconnectedCallback();
  }

  willUpdate(changed: Map<string, unknown>) {
    if (!changed.has("value")) return;
    if (
      this.shown === null ||
      !Number.isFinite(this.shown) ||
      !Number.isFinite(this.value) ||
      !animationsOn() ||
      !this.isConnected
    ) {
      this.shown = this.value;
      return;
    }
    if (this.shown === this.value) return;
    this.from = this.shown;
    this.started = performance.now();
    if (this.raf === 0) this.raf = requestAnimationFrame(this.step);
  }

  private step = (now: number) => {
    this.raf = 0;
    const k = Math.min(1, (now - this.started) / DURATION_MS);
    const eased = 1 - (1 - k) * (1 - k) * (1 - k);
    this.shown = this.from + (this.value - this.from) * eased;
    this.requestUpdate();
    if (k < 1) this.raf = requestAnimationFrame(this.step);
    else this.shown = this.value;
  };

  render() {
    const raw = this.shown ?? this.value;
    const v = Number.isFinite(raw) ? Math.round(raw) : 0;
    return this.kind === "troops" ? renderTroops(v) : renderNumber(v);
  }
}
