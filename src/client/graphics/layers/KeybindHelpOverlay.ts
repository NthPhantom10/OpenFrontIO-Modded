import { html, LitElement } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import {
  getDefaultKeybinds,
  USER_SETTINGS_CHANGED_EVENT,
  UserSettings,
} from "../../../core/game/UserSettings";
import { Platform } from "../../Platform";
import { translateText } from "../../Utils";

interface KeybindEntry {
  action: string;
  labelKey: string;
  fallbackLabel: string;
}

interface KeybindSection {
  titleKey: string;
  fallbackTitle: string;
  entries: KeybindEntry[];
}

const SECTIONS: KeybindSection[] = [
  {
    titleKey: "user_setting.view_options",
    fallbackTitle: "View",
    entries: [
      {
        action: "toggleView",
        labelKey: "user_setting.toggle_view",
        fallbackLabel: "Toggle terrain view",
      },
      {
        action: "coordinateGrid",
        labelKey: "user_setting.coordinate_grid_label",
        fallbackLabel: "Toggle coordinate grid",
      },
    ],
  },
  {
    titleKey: "user_setting.camera_movement",
    fallbackTitle: "Camera",
    entries: [
      {
        action: "moveUp",
        labelKey: "user_setting.move_up",
        fallbackLabel: "Move up",
      },
      {
        action: "moveLeft",
        labelKey: "user_setting.move_left",
        fallbackLabel: "Move left",
      },
      {
        action: "moveDown",
        labelKey: "user_setting.move_down",
        fallbackLabel: "Move down",
      },
      {
        action: "moveRight",
        labelKey: "user_setting.move_right",
        fallbackLabel: "Move right",
      },
      {
        action: "zoomIn",
        labelKey: "user_setting.zoom_in",
        fallbackLabel: "Zoom in",
      },
      {
        action: "zoomOut",
        labelKey: "user_setting.zoom_out",
        fallbackLabel: "Zoom out",
      },
      {
        action: "centerCamera",
        labelKey: "user_setting.center_camera",
        fallbackLabel: "Center on player",
      },
    ],
  },
  {
    titleKey: "user_setting.build_controls",
    fallbackTitle: "Build",
    entries: [
      {
        action: "buildCity",
        labelKey: "user_setting.build_city",
        fallbackLabel: "Build city",
      },
      {
        action: "buildFactory",
        labelKey: "user_setting.build_factory",
        fallbackLabel: "Build factory",
      },
      {
        action: "buildPort",
        labelKey: "user_setting.build_port",
        fallbackLabel: "Build port",
      },
      {
        action: "buildDefensePost",
        labelKey: "user_setting.build_defense_post",
        fallbackLabel: "Build defense post",
      },
      {
        action: "buildMissileSilo",
        labelKey: "user_setting.build_missile_silo",
        fallbackLabel: "Build missile silo",
      },
      {
        action: "buildSamLauncher",
        labelKey: "user_setting.build_sam_launcher",
        fallbackLabel: "Build SAM launcher",
      },
      {
        action: "buildWarship",
        labelKey: "user_setting.build_warship",
        fallbackLabel: "Build warship",
      },
      {
        action: "buildAtomBomb",
        labelKey: "user_setting.build_atom_bomb",
        fallbackLabel: "Build atom bomb",
      },
      {
        action: "buildHydrogenBomb",
        labelKey: "user_setting.build_hydrogen_bomb",
        fallbackLabel: "Build hydrogen bomb",
      },
      {
        action: "buildMIRV",
        labelKey: "user_setting.build_mirv",
        fallbackLabel: "Build MIRV",
      },
    ],
  },
  {
    titleKey: "user_setting.attack_keybinds",
    fallbackTitle: "Attack",
    entries: [
      {
        action: "boatAttack",
        labelKey: "user_setting.boat_attack",
        fallbackLabel: "Boat attack",
      },
      {
        action: "groundAttack",
        labelKey: "user_setting.ground_attack",
        fallbackLabel: "Ground attack",
      },
      {
        action: "swapDirection",
        labelKey: "user_setting.swap_direction",
        fallbackLabel: "Swap attack direction",
      },
      {
        action: "selectAllWarships",
        labelKey: "keybind_help.select_all_warships",
        fallbackLabel: "Select all warships",
      },
    ],
  },
  {
    titleKey: "user_setting.attack_ratio_controls",
    fallbackTitle: "Attack ratio",
    entries: [
      {
        action: "attackRatioDown",
        labelKey: "user_setting.attack_ratio_down",
        fallbackLabel: "Decrease attack ratio",
      },
      {
        action: "attackRatioUp",
        labelKey: "user_setting.attack_ratio_up",
        fallbackLabel: "Increase attack ratio",
      },
    ],
  },
  {
    titleKey: "user_setting.ally_keybinds",
    fallbackTitle: "Diplomacy",
    entries: [
      {
        action: "requestAlliance",
        labelKey: "user_setting.request_alliance",
        fallbackLabel: "Request alliance",
      },
      {
        action: "breakAlliance",
        labelKey: "user_setting.break_alliance",
        fallbackLabel: "Break alliance",
      },
    ],
  },
  {
    titleKey: "user_setting.menu_shortcuts",
    fallbackTitle: "Game controls",
    entries: [
      {
        action: "pauseGame",
        labelKey: "user_setting.pause_game",
        fallbackLabel: "Pause / unpause",
      },
      {
        action: "gameSpeedUp",
        labelKey: "user_setting.game_speed_up",
        fallbackLabel: "Speed up",
      },
      {
        action: "gameSpeedDown",
        labelKey: "user_setting.game_speed_down",
        fallbackLabel: "Slow down",
      },
      {
        action: "modifierKey",
        labelKey: "user_setting.build_menu_modifier",
        fallbackLabel: "Build menu modifier",
      },
      {
        action: "altKey",
        labelKey: "user_setting.emoji_menu_modifier",
        fallbackLabel: "Emoji menu modifier",
      },
      {
        action: "resetGfx",
        labelKey: "keybind_help.reset_graphics",
        fallbackLabel: "Reset graphics",
      },
    ],
  },
];

const SPECIAL_KEY_LABELS: Record<string, string> = {
  ShiftLeft: "⇧ Shift",
  ShiftRight: "⇧ Shift",
  ControlLeft: "Ctrl",
  ControlRight: "Ctrl",
  AltLeft: "Alt",
  AltRight: "Alt",
  MetaLeft: "⌘",
  MetaRight: "⌘",
  Space: "Space",
  Escape: "Esc",
  Enter: "↵ Return",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Period: ">",
  Comma: "<",
};

function keyLabel(code: string): string {
  if (!code) return "—";
  if (SPECIAL_KEY_LABELS[code]) return SPECIAL_KEY_LABELS[code];
  if (code.startsWith("Key") && code.length === 4) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `Num ${code.slice(6)}`;
  return code;
}

function tt(key: string, fallback: string): string {
  const out = translateText(key);
  // translateText returns the key unchanged when there is no translation.
  return out === key ? fallback : out;
}

@customElement("keybind-help-overlay")
export class KeybindHelpOverlay extends LitElement {
  private userSettings = new UserSettings();

  @state()
  private isVisible = false;

  @state()
  private keybinds: Record<string, string> = this.userSettings.keybinds(
    Platform.isMac,
  );

  @query(".keybind-help-overlay-root")
  private overlayRoot!: HTMLElement;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("click", this.handleOutsideClick, true);
    window.addEventListener(
      USER_SETTINGS_CHANGED_EVENT,
      this.handleSettingsChanged,
    );
  }

  disconnectedCallback() {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("click", this.handleOutsideClick, true);
    window.removeEventListener(
      USER_SETTINGS_CHANGED_EVENT,
      this.handleSettingsChanged,
    );
    super.disconnectedCallback();
  }

  public open() {
    this.refreshKeybinds();
    this.isVisible = true;
  }

  public close() {
    this.isVisible = false;
  }

  public toggle() {
    if (this.isVisible) {
      this.close();
    } else {
      this.open();
    }
  }

  private handleSettingsChanged = () => {
    if (this.isVisible) this.refreshKeybinds();
  };

  private refreshKeybinds() {
    this.keybinds = this.userSettings.keybinds(Platform.isMac);
  }

  private handleOutsideClick = (event: MouseEvent) => {
    if (!this.isVisible) return;
    if (this.overlayRoot && event.target === this.overlayRoot) {
      this.close();
    }
  };

  private handleKeyDown = (event: KeyboardEvent) => {
    if (this.isInputFocused()) return;

    if (this.isVisible && event.key === "Escape") {
      event.preventDefault();
      this.close();
      return;
    }

    // Toggle on `?` (Shift+/ on most layouts) — `event.key` resolves to "?".
    if (event.key === "?" && !event.repeat) {
      event.preventDefault();
      this.toggle();
    }
  };

  private isInputFocused(): boolean {
    const active = document.activeElement as HTMLElement | null;
    if (!active) return false;
    const tag = active.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (active.isContentEditable) return true;
    return false;
  }

  private renderKey(code: string) {
    return html`<span
      class="inline-block min-w-[34px] text-center px-2 py-1 rounded
        bg-[#262626] border border-white/10 border-b-2 border-b-black/60
        text-white font-mono text-xs font-bold"
      >${keyLabel(code)}</span
    >`;
  }

  private renderEntry(entry: KeybindEntry) {
    const code = this.keybinds[entry.action];
    const defaults = getDefaultKeybinds(Platform.isMac);
    const isCustom = code !== undefined && code !== defaults[entry.action];
    return html`
      <div
        class="flex items-center justify-between gap-3 py-1.5
          border-b border-white/5 last:border-b-0"
      >
        <span class="text-gray-200 text-sm leading-snug">
          ${tt(entry.labelKey, entry.fallbackLabel)}
          ${isCustom
            ? html`<span
                class="ml-1.5 text-[10px] uppercase tracking-wide text-amber-400/80"
                title="Customised from default"
                >${tt("keybind_help.custom_badge", "custom")}</span
              >`
            : null}
        </span>
        ${this.renderKey(code ?? "")}
      </div>
    `;
  }

  private renderSection(section: KeybindSection) {
    return html`
      <section class="rounded-lg bg-white/5 p-4">
        <h3
          class="text-blue-200 text-sm font-semibold uppercase tracking-wider
            mb-2 pb-2 border-b border-white/10"
        >
          ${tt(section.titleKey, section.fallbackTitle)}
        </h3>
        <div class="flex flex-col">
          ${section.entries.map((e) => this.renderEntry(e))}
        </div>
      </section>
    `;
  }

  render() {
    if (!this.isVisible) return null;
    const title = tt("keybind_help.title", "Keyboard shortcuts");
    const hint = tt(
      "keybind_help.hint",
      "Press ? to toggle this overlay, Esc to close. Edit bindings in Settings → Keybinds.",
    );
    return html`
      <div
        class="keybind-help-overlay-root fixed inset-0 bg-black/70
          backdrop-blur-sm z-[2100] flex items-start justify-center
          overflow-y-auto p-4 sm:p-8"
        @contextmenu=${(e: Event) => e.preventDefault()}
      >
        <div
          class="w-full max-w-5xl bg-gray-900/95 border border-white/10
            rounded-xl shadow-2xl text-white
            my-4"
          @click=${(e: Event) => e.stopPropagation()}
        >
          <header
            class="flex items-start justify-between gap-4 px-5 py-4
              border-b border-white/10"
          >
            <div>
              <h2 class="text-xl font-bold">${title}</h2>
              <p class="text-xs text-gray-400 mt-1 max-w-2xl">${hint}</p>
            </div>
            <button
              class="shrink-0 rounded-md bg-white/5 hover:bg-white/10
                border border-white/10 px-3 py-1.5 text-sm transition-colors"
              @click=${() => this.close()}
              aria-label=${tt("common.close", "Close")}
            >
              ${tt("common.close", "Close")}
              ${this.renderKey("Escape")}
            </button>
          </header>
          <div
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-5"
          >
            ${SECTIONS.map((s) => this.renderSection(s))}
          </div>
        </div>
      </div>
    `;
  }
}
