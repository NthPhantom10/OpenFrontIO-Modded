import { Execution, Game } from "../game/Game";
import { GameImpl } from "../game/GameImpl";

/**
 * Roadmap §3 — nuclear winter aftermath.
 *
 * Periodically sweeps the GameImpl fallout-tick map and clears tiles whose
 * fallout has been around longer than `Config.falloutDecayTicks()`. When the
 * config returns null (the default) this execution is a no-op so existing
 * replays remain bit-identical.
 *
 * The sweep is driven entirely from the deterministic game tick and the
 * insertion-ordered `Map` exposed by GameImpl, so every client computes the
 * same set of decayed tiles in the same order.
 */
export class FalloutDecayExecution implements Execution {
  // Tunable: only run the scan every N ticks to keep the per-tick cost low.
  private static readonly SCAN_INTERVAL_TICKS = 50;

  // Cap on the number of tiles cleared in a single sweep so a region nuked
  // long ago can't cause a multi-millisecond spike when it eventually decays.
  // Remaining stale tiles are picked up on the next scan.
  private static readonly MAX_CLEARS_PER_SCAN = 4096;

  private mg: GameImpl | null = null;

  init(mg: Game): void {
    // Cast is safe: the deterministic game graph only ever passes a GameImpl
    // here. We need the concrete type for the fallout-tick map accessors.
    this.mg = mg as GameImpl;
  }

  tick(currentTick: number): void {
    if (this.mg === null) return;
    if (currentTick % FalloutDecayExecution.SCAN_INTERVAL_TICKS !== 0) return;

    const decayTicks = this.mg.config().falloutDecayTicks();
    if (decayTicks === null) return; // Feature disabled — historical behaviour.

    const expiredCutoff = currentTick - decayTicks;
    let cleared = 0;
    const stale: number[] = [];
    const expired: number[] = [];

    for (const [tile, createdTick] of this.mg.falloutCreatedTicks()) {
      if (!this.mg.hasFallout(tile) || this.mg.hasOwner(tile)) {
        // Tile was conquered or turned into water elsewhere; just forget it.
        stale.push(tile);
        continue;
      }
      if (createdTick > expiredCutoff) {
        // Map iteration order = insertion order, and createdTick monotonically
        // increases with insertions. Once we hit an entry that's still fresh
        // every later entry is also fresh, so we can stop scanning.
        break;
      }
      expired.push(tile);
      cleared++;
      if (cleared >= FalloutDecayExecution.MAX_CLEARS_PER_SCAN) break;
    }

    for (const tile of stale) {
      this.mg.forgetFalloutTick(tile);
    }
    for (const tile of expired) {
      this.mg.setFallout(tile, false);
    }
  }

  isActive(): boolean {
    return true;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
