import { html, LitElement } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import {
  getRealName,
  REAL_NAME_MAX,
  REAL_NAME_REQUIRED_EVENT,
  setRealName,
} from "../RealName";
import { translateText } from "../Utils";

/** The "Real name" field under the username on the main menu. */
@customElement("real-name-input")
export class RealNameInput extends LitElement {
  @state() private value = getRealName();
  @state() private missing = false;
  @query("input") private input!: HTMLInputElement;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener(REAL_NAME_REQUIRED_EVENT, this.onRequired);
  }

  disconnectedCallback() {
    document.removeEventListener(REAL_NAME_REQUIRED_EVENT, this.onRequired);
    super.disconnectedCallback();
  }

  private onRequired = () => {
    this.missing = true;
    this.updateComplete.then(() => this.input?.focus());
  };

  private onInput(e: Event) {
    this.value = (e.target as HTMLInputElement).value;
    setRealName(this.value);
    if (getRealName() !== "") this.missing = false;
  }

  render() {
    return html`
      <div class="flex flex-col gap-1">
        <label class="flex items-center gap-2 w-full">
          <span class="shrink-0 text-sm font-semibold text-white/70">
            ${translateText("username.real_name_label")}
          </span>
          <input
            type="text"
            maxlength=${REAL_NAME_MAX}
            autocomplete="name"
            class="flex-1 min-w-0 h-9 px-3 rounded-lg bg-white/5 text-white placeholder-white/40 border ${this
              .missing
              ? "border-red-400"
              : "border-white/10"} focus:outline-none focus:border-malibu-blue/60"
            placeholder=${translateText("username.real_name_placeholder")}
            .value=${this.value}
            @input=${this.onInput}
          />
        </label>
        ${this.missing
          ? html`<div class="text-sm text-red-300">
              ${translateText("username.real_name_required")}
            </div>`
          : html`<div class="text-xs text-white/40">
              ${translateText("username.real_name_note")}
            </div>`}
      </div>
    `;
  }
}
