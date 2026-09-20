import { supabase } from "./supabase";

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

let lastSweepAt = 0;
let inFlight: Promise<void> | null = null;

/**
 * Marks visas Finished once their confirmed leave date has passed, so the
 * Active list never keeps someone who has already gone. Throttled because
 * several pages call it before loading.
 */
export function finishDueVisas(): Promise<void> {
  if (inFlight) return inFlight;
  if (Date.now() - lastSweepAt < SWEEP_INTERVAL_MS) return Promise.resolve();

  inFlight = (async () => {
    try {
      await supabase.rpc("finish_due_visas");
    } catch {
      // A failed sweep only leaves statuses stale until the next one.
    }
    lastSweepAt = Date.now();
    inFlight = null;
  })();

  return inFlight;
}
