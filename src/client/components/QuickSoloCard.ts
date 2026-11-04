// AlexFront: the big "Quick solo" card in the middle of the main menu. One
// click starts a solo game on a random map with your last solo settings
// (or the solo menu's defaults). The dice picks another map first.

import { GameMapType, maps } from "@openfront/engine-api/game/GameTypes";
import { generateID } from "@openfront/shared/SharedUtil";
import { html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { getPlayerCosmetics } from "../Cosmetics";
import { GameStartingModal } from "../GameStartingModal";
import type { JoinLobbyEvent } from "../Main";
import { fallbackPlayerName } from "../PlayerName";
import {
  lastSoloConfig,
  quickSoloConfig,
  randomQuickMap,
  rememberSoloStart,
} from "../SoloRestart";
import { terrainMapFileLoader } from "../TerrainMapFileLoader";
import type { UsernameInput } from "../UsernameInput";
import { translateText } from "../Utils";

/** Longest wait for the name and cosmetics before starting on defaults. */
const PREPARE_MS = 4000;

function mapName(map: GameMapType): string {
  const info = maps.find((m) => m.type === map);
  return info ? translateText(info.translationKey) : String(map);
}

@customElement("quick-solo-card")
export class QuickSoloCard extends LitElement {
  @state() private map: GameMapType = randomQuickMap();
  @state() private starting = false;

  createRenderRoot() {
    return this;
  }

  private reroll(e: Event) {
    e.stopPropagation();
    this.map = randomQuickMap(this.map);
  }

  private async start() {
    if (this.starting) return;
    this.starting = true;
    const overlay = document.querySelector("game-starting-modal");
    const startingModal = overlay instanceof GameStartingModal ? overlay : null;
    startingModal?.show();
    let dispatched = false;
    try {
      const usernameInput = document.querySelector(
        "username-input",
      ) as UsernameInput | null;
      const nameNow = () =>
        usernameInput?.resolvedName() ?? fallbackPlayerName();
      const prepared = await Promise.race([
        (async () => {
          await usernameInput?.whenSeeded();
          const resolvedName = nameNow();
          return {
            resolvedName,
            cosmetics: await getPlayerCosmetics({
              verified: resolvedName.verified,
            }),
          };
        })(),
        new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), PREPARE_MS),
        ),
      ]);
      const resolvedName = prepared?.resolvedName ?? nameNow();
      const cosmetics =
        prepared?.cosmetics ??
        (resolvedName.verified ? { verified: true } : {});
      const gameID = generateID();
      const detail = {
        gameID,
        gameStartInfo: {
          gameID,
          players: [
            {
              clientID: generateID(),
              username: resolvedName.name,
              clanTag: usernameInput?.getClanTag() ?? null,
              cosmetics,
            },
          ],
          config: quickSoloConfig(this.map),
          lobbyCreatedAt: Date.now(),
        },
        source: "singleplayer",
      } satisfies JoinLobbyEvent;
      // The restart button then deals a new random map, like this card.
      rememberSoloStart(detail.gameStartInfo, true);
      this.dispatchEvent(
        new CustomEvent("join-lobby", {
          detail,
          bubbles: true,
          composed: true,
        }),
      );
      dispatched = true;
      this.map = randomQuickMap(this.map);
    } finally {
      this.starting = false;
      // Once dispatched, the join pipeline hides the overlay.
      if (!dispatched) startingModal?.hide();
    }
  }

  render() {
    const thumb = terrainMapFileLoader.getMapData(this.map).webpPath;
    const hasLast = lastSoloConfig() !== null;
    return html`
      <button
        type="button"
        data-quick-solo
        class="group/quick relative w-full h-44 sm:h-full overflow-hidden rounded-xl text-left text-white bg-surface chrome:chrome-panel transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
        ?disabled=${this.starting}
        @click=${() => void this.start()}
      >
        <img
          src=${thumb}
          alt=""
          class="absolute inset-0 w-full h-full object-cover opacity-60 transition-transform duration-[4000ms] ease-out group-hover/quick:scale-110"
        />
        <div
          class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10"
        ></div>
        <div class="relative h-full flex flex-col justify-end p-4 sm:p-6 gap-1">
          <div
            class="text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-white/70"
          >
            ${translateText("quick_solo.subtitle")}
          </div>
          <div
            class="text-3xl sm:text-5xl font-black uppercase tracking-wide drop-shadow-[0_3px_6px_rgba(0,0,0,0.8)] chrome:chrome-text"
          >
            ⚡ ${translateText("quick_solo.title")}
          </div>
          <div class="flex items-center gap-2 text-sm sm:text-base">
            <span class="font-semibold">🗺️ ${mapName(this.map)}</span>
            <span class="text-white/60"
              >·
              ${translateText(
                hasLast
                  ? "quick_solo.last_settings"
                  : "quick_solo.default_settings",
              )}</span
            >
          </div>
        </div>
        <span
          role="button"
          tabindex="0"
          title=${translateText("quick_solo.reroll")}
          aria-label=${translateText("quick_solo.reroll")}
          class="absolute top-3 right-3 size-10 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-xl transition-transform hover:rotate-90"
          @click=${this.reroll}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") this.reroll(e);
          }}
          >🎲</span
        >
      </button>
    `;
  }
}
