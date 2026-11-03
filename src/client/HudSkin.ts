// AlexFront: layouts for the in-game bottom panel (control panel and build
// bar), picked in the in-game menu: other button shapes and fonts, same
// buttons in the same order. Colours stay with the UI theme. The panel gets
// `hud-skin-<name>`; the rules live in chrome-theme.css.

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
  for (const s of HUD_SKINS) {
    if (s !== "classic") el.classList.toggle(`hud-skin-${s}`, s === skin);
  }
}

let listening = false;

/** Applies the saved layout and follows later changes. */
export function initHudSkin(): void {
  applyHudSkin();
  if (listening) return;
  listening = true;
  globalThis.addEventListener(HUD_SKIN_CHANGED_EVENT, applyHudSkin);
}
