/**
 * Sounds that tell a blind shopper what the app is doing, made with the Web Audio API
 * (no files to download). Every sound also vibrates the phone and flashes the screen edge,
 * so nothing depends on hearing alone.
 *
 *   listening  two quick rising notes
 *   thinking   a soft two note wind chime: "I heard you, thinking now"
 *   problem    one low note
 *   done       one bright note
 */

export type ChimeKind = "listening" | "thinking" | "problem" | "done";

interface Note {
  freq: number;
  at: number;
  dur: number;
  gain?: number;
  type?: OscillatorType;
}

const SCORES: Record<ChimeKind, Note[]> = {
  listening: [
    { freq: 523.25, at: 0, dur: 0.12, type: "sine" },
    { freq: 659.25, at: 0.1, dur: 0.16, type: "sine" },
  ],
  thinking: [
    { freq: 783.99, at: 0, dur: 0.55, gain: 0.09, type: "triangle" },
    { freq: 987.77, at: 0.22, dur: 0.7, gain: 0.08, type: "triangle" },
  ],
  problem: [{ freq: 220, at: 0, dur: 0.38, gain: 0.14, type: "sine" }],
  done: [{ freq: 1046.5, at: 0, dur: 0.28, gain: 0.1, type: "sine" }],
};

const VIBRATION: Record<ChimeKind, number[]> = {
  listening: [40],
  thinking: [30, 60, 30],
  problem: [200],
  done: [60],
};

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
  }
  return ctx;
}

/** Call from a tap or key press: browsers keep audio locked until then. */
export async function unlockAudio(): Promise<void> {
  const c = context();
  if (!c) return;
  if (c.state === "suspended") {
    try {
      await c.resume();
    } catch {
      /* stays locked; captions still work */
    }
  }
}

export const FLASH_EVENT = "omnikart:flash";

export function playChime(kind: ChimeKind, opts: { sound?: boolean } = {}): void {
  if (typeof window === "undefined") return;
  try {
    navigator.vibrate?.(VIBRATION[kind]);
  } catch {
    /* some browsers throw when vibration is blocked */
  }
  window.dispatchEvent(new CustomEvent(FLASH_EVENT, { detail: kind }));
  if (opts.sound === false) return;
  const c = context();
  if (!c || c.state !== "running") return;
  const t0 = c.currentTime;
  for (const n of SCORES[kind]) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = n.type ?? "sine";
    osc.frequency.value = n.freq;
    const peak = n.gain ?? 0.12;
    g.gain.setValueAtTime(0.0001, t0 + n.at);
    g.gain.exponentialRampToValueAtTime(peak, t0 + n.at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0 + n.at);
    osc.stop(t0 + n.at + n.dur + 0.05);
  }
}
