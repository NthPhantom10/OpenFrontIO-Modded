import { GameView } from "../../../core/game/GameView";
import { UserSettings } from "../../../core/game/UserSettings";
import { Layer } from "./Layer";

/**
 * Roadmap §4 — cosmetic day/night cycle.
 *
 * Tints the rendered game with a slowly-shifting overlay driven by the
 * deterministic game tick, so every player sees the same time of day at the
 * same moment. Pure visuals — no impact on game state, units, or vision.
 *
 * Toggleable from settings (`UserSettings.dayNightCycle`); default off so we
 * don't surprise existing players.
 */
export class DayNightLayer implements Layer {
  // One full day takes this many ticks. At ~10 ticks/sec that is ~10 minutes.
  // Picked so an average match sees a couple of dawn/dusk transitions.
  private static readonly TICKS_PER_CYCLE = 6000;

  // Maximum tint opacity at peak night / peak noon. Kept gentle so the map
  // stays readable.
  private static readonly NIGHT_MAX_ALPHA = 0.32;
  private static readonly DAY_MAX_ALPHA = 0.06;

  // Cool blue for night, warm yellow for high noon.
  private static readonly NIGHT_COLOR = "20, 30, 70";
  private static readonly DAY_COLOR = "255, 220, 150";

  constructor(
    private game: GameView,
    private userSettings: UserSettings,
  ) {}

  shouldTransform(): boolean {
    // Tint covers the entire viewport, ignoring map pan/zoom.
    return false;
  }

  renderLayer(context: CanvasRenderingContext2D): void {
    if (!this.userSettings.dayNightCycle()) return;

    const ticks = this.game.ticks();
    if (ticks <= 0) return;

    // Phase ∈ [0, 1). 0 = sunrise, 0.25 = noon, 0.5 = sunset, 0.75 = midnight.
    const phase =
      (ticks % DayNightLayer.TICKS_PER_CYCLE) /
      DayNightLayer.TICKS_PER_CYCLE;

    // sin(phase * 2π) is +1 at noon, -1 at midnight, 0 at sunrise/sunset.
    const dayness = Math.sin(phase * Math.PI * 2);

    let color: string;
    let alpha: number;
    if (dayness >= 0) {
      color = DayNightLayer.DAY_COLOR;
      alpha = dayness * DayNightLayer.DAY_MAX_ALPHA;
    } else {
      color = DayNightLayer.NIGHT_COLOR;
      alpha = -dayness * DayNightLayer.NIGHT_MAX_ALPHA;
    }
    if (alpha < 0.01) return;

    const { width, height } = context.canvas;
    context.save();
    context.globalCompositeOperation = "multiply";
    context.fillStyle = `rgba(${color}, ${alpha.toFixed(3)})`;
    context.fillRect(0, 0, width, height);
    context.restore();
  }
}
