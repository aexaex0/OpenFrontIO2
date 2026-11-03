// AlexFront: the owner's in-game admin panel (see OwnerAccess.ts). A small
// floating box with the latest player reports from the server and a few
// facts about the running game. Only shown to the owner, while it is on.

import { ClientEnv } from "../ClientEnv";
import { ownerKey } from "../OwnerAccess";
import { UserSettings } from "../UserSettings";
import { translateText } from "../Utils";
import type { GameView } from "../view/GameView";

interface Report {
  at: number;
  gameID: string;
  reporter: string;
  reported: string;
  reason: string;
}

export class OwnerAdminPanel {
  private root = document.createElement("div");
  private body = document.createElement("div");
  private reportsEl = document.createElement("div");
  private gameEl = document.createElement("div");
  private timer = 0;
  private open = true;

  constructor(
    private game: GameView,
    private gameID: string,
  ) {
    const r = this.root;
    r.style.cssText =
      "position:fixed;left:12px;bottom:12px;z-index:9000;width:300px;max-height:45vh;overflow:auto;" +
      "background:rgba(10,12,18,.92);border:1px solid rgba(250,204,21,.5);border-radius:10px;" +
      "color:#fff;font:12px system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.5)";
    const head = document.createElement("div");
    head.style.cssText =
      "display:flex;justify-content:space-between;align-items:center;padding:6px 10px;" +
      "background:rgba(250,204,21,.15);font-weight:800;letter-spacing:.08em;cursor:pointer";
    head.textContent = `⚙ ${translateText("admin_panel.title")}`;
    const toggle = document.createElement("span");
    toggle.textContent = "–";
    head.appendChild(toggle);
    head.addEventListener("click", () => {
      this.open = !this.open;
      this.body.style.display = this.open ? "block" : "none";
      toggle.textContent = this.open ? "–" : "+";
    });
    this.body.style.padding = "8px 10px";
    const h1 = document.createElement("div");
    h1.style.cssText = "font-weight:700;opacity:.7;margin-bottom:4px";
    h1.textContent = translateText("admin_panel.reports");
    const h2 = h1.cloneNode() as HTMLDivElement;
    h2.style.marginTop = "10px";
    h2.textContent = translateText("admin_panel.this_game");
    const dev = document.createElement("label");
    dev.style.cssText =
      "display:flex;gap:6px;align-items:center;margin-top:10px;cursor:pointer";
    const box = document.createElement("input");
    box.type = "checkbox";
    const settings = new UserSettings();
    box.checked = settings.devMode();
    box.addEventListener("change", () => {
      if (box.checked !== settings.devMode()) settings.toggleDevMode();
    });
    dev.append(box, translateText("admin_panel.dev_mode"));
    this.body.append(h1, this.reportsEl, h2, this.gameEl, dev);
    r.append(head, this.body);
    document.body.appendChild(r);
    void this.refresh();
    this.timer = window.setInterval(() => void this.refresh(), 15000);
  }

  private async refresh(): Promise<void> {
    this.renderGame();
    const key = ownerKey();
    if (key === null) return;
    let reports: Report[] = [];
    try {
      const res = await fetch(
        `${ClientEnv.serverHttpBase()}/w0/api/owner/reports`,
        { headers: { "x-owner-key": key }, cache: "no-store" },
      );
      if (!res.ok) return;
      reports = ((await res.json()) as { reports?: Report[] }).reports ?? [];
    } catch {
      return;
    }
    this.reportsEl.innerHTML = "";
    if (reports.length === 0) {
      this.reportsEl.textContent = translateText("admin_panel.no_reports");
      return;
    }
    for (const rep of reports.slice(0, 30)) {
      const line = document.createElement("div");
      line.style.cssText =
        "padding:3px 0;border-top:1px solid rgba(255,255,255,.08)";
      const here = rep.gameID === this.gameID ? " ★" : "";
      const time = new Date(rep.at).toLocaleTimeString();
      line.textContent = `${time}${here} · ${rep.reporter} → ${rep.reported} (${rep.reason})`;
      this.reportsEl.appendChild(line);
    }
  }

  private renderGame(): void {
    const players = this.game.players();
    const humans = players.filter((p) => p.clientID() !== null).length;
    this.gameEl.textContent = translateText("admin_panel.game_info", {
      id: this.gameID,
      players: players.length,
      humans,
    });
  }

  dispose(): void {
    clearInterval(this.timer);
    this.root.remove();
  }
}
