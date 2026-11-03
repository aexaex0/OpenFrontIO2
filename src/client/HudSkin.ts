// AlexFront: an own look for the in-game bottom panel (control panel and
// build bar), picked in the in-game menu. "auto" follows the UI theme; any
// other skin puts `theme-chrome` on the panel itself, so its `chrome:`
// classes apply even under the classic theme, plus `hud-skin-<name>`, which
// swaps the style variables for that panel only (chrome-theme.css).

import {
  HUD_SKIN_KEY,
  HUD_SKINS,
  USER_SETTINGS_CHANGED_EVENT,
  UserSettings,
} from "./UserSettings";

const PANEL_ID = "hud-bottom-panel";
export const HUD_SKIN_CHANGED_EVENT = `${USER_SETTINGS_CHANGED_EVENT}:${HUD_SKIN_KEY}`;

export function applyHudSkin(): void {
  const el = document.getElementById(PANEL_ID);
  if (el === null) return;
  const skin = new UserSettings().hudSkin();
  el.classList.toggle("theme-chrome", skin !== "auto");
  el.classList.toggle("hud-skin", skin !== "auto");
  for (const s of HUD_SKINS) {
    if (s !== "auto") el.classList.toggle(`hud-skin-${s}`, s === skin);
  }
}

let listening = false;

/** Applies the saved skin and follows later changes. */
export function initHudSkin(): void {
  applyHudSkin();
  if (listening) return;
  listening = true;
  globalThis.addEventListener(HUD_SKIN_CHANGED_EVENT, applyHudSkin);
}
