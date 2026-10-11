import {
  UI_THEME_KEY,
  USER_SETTINGS_CHANGED_EVENT,
  UserSettings,
} from "./UserSettings";

/**
 * The opt-in "Chrome & Silver" UI theme: a class on <html> that the `chrome:`
 * Tailwind variant keys off (styles/core/chrome-theme.css).
 */
export const CHROME_THEME_CLASS = "theme-chrome";

/** Fired on globalThis when the setting changes; detail is the new theme. */
export const UI_THEME_CHANGED_EVENT = `${USER_SETTINGS_CHANGED_EVENT}:${UI_THEME_KEY}`;

/**
 * Reads the setting rather than <html>'s class, so components that connect
 * before initUiTheme() runs, or that hear the change event first, agree.
 */
export function isChromeTheme(): boolean {
  return new UserSettings().uiTheme() === "chrome";
}

function applyUiTheme() {
  document.documentElement.classList.toggle(
    CHROME_THEME_CLASS,
    isChromeTheme(),
  );
}

/** Applies the saved theme and follows later changes to the setting. */
export function initUiTheme() {
  applyUiTheme();
  globalThis.addEventListener(UI_THEME_CHANGED_EVENT, applyUiTheme);
}
