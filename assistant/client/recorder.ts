import { ASR_RECORD_CAP_SECONDS, ASR_SAMPLE_RATE, NO_SPEECH_TIMEOUT_MS, SILENCE_MS_DEFAULT } from "@/assistant/config";

/**
 * Microphone to a 16 kHz mono 16 bit WAV, which is what AnuvaadHub speech recognition accepts.
 * Browsers record webm or mp4, so we decode that and write the WAV ourselves.
 *
 * Turn taking: recording stops by itself after `silenceMs` of quiet once the shopper has spoken,
 * after 15 seconds (the service takes about 20), or when stop() is called.
 */

export type RecorderErrorCode = "denied" | "unsupported" | "failed";

export class RecorderError extends Error {
  code: RecorderErrorCode;
  constructor(code: RecorderErrorCode, message?: string) {
    super(message ?? code);
    this.name = "RecorderError";
    this.code = code;
  }
}

export type RecordResult =
  | { kind: "audio"; wav: Blob; seconds: number; reason: "silence" | "cap" | "manual" }
  | { kind: "none"; reason: "no_speech" | "cancelled" };

export interface RecordingHandle {
  /** finish now and send what we have */
  stop: () => void;
  /** throw the recording away */
  cancel: () => void;
  result: Promise<RecordResult>;
}

export function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return undefined;
}

/** 16 bit PCM WAV bytes from float samples. Pure, so it can be tested. */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const bytes = samples.length * 2;
  const buf = new ArrayBuffer(44 + bytes);
  const v = new DataView(buf);
  const w = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  w(0, "RIFF");
  v.setUint32(4, 36 + bytes, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, bytes, true);
  let o = 44;
  for (let i = 0; i < samples.length; i++, o += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

/** Decode whatever the browser recorded and resample to 16 kHz mono. */
export async function toWav16k(blob: Blob): Promise<{ wav: Blob; seconds: number }> {
  const arr = await blob.arrayBuffer();
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const decoded = await ctx.decodeAudioData(arr.slice(0));
    const length = Math.max(1, Math.ceil(decoded.duration * ASR_SAMPLE_RATE));
    const off = new OfflineAudioContext(1, length, ASR_SAMPLE_RATE);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start();
    const rendered = await off.startRendering();
    const wav = new Blob([encodeWav(rendered.getChannelData(0), ASR_SAMPLE_RATE)], { type: "audio/wav" });
    return { wav, seconds: decoded.duration };
  } finally {
    void ctx.close();
  }
}

export interface RecordOptions {
  silenceMs?: number;
  noSpeechMs?: number;
  capSeconds?: number;
}

/**
 * Start recording. Rejects with RecorderError("denied") when the microphone is blocked.
 * Needs a user gesture (a tap or the Space key) the first time.
 */
export async function startRecording(opts: RecordOptions = {}): Promise<RecordingHandle> {
  const silenceMs = opts.silenceMs ?? SILENCE_MS_DEFAULT;
  const noSpeechMs = opts.noSpeechMs ?? NO_SPEECH_TIMEOUT_MS;
  const capMs = (opts.capSeconds ?? ASR_RECORD_CAP_SECONDS) * 1000;

  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    throw new RecorderError("unsupported", "This browser cannot record audio");
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (e) {
    const name = e instanceof DOMException ? e.name : "";
    throw new RecorderError(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "failed");
  }

  const mime = pickMimeType();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new Ctx();
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 1024;
  audioCtx.createMediaStreamSource(stream).connect(analyser);
  const data = new Float32Array(analyser.fftSize);

  let finishReason: "silence" | "cap" | "manual" | "no_speech" | "cancelled" | null = null;
  let resolveResult!: (r: RecordResult) => void;
  const result = new Promise<RecordResult>((res) => (resolveResult = res));

  const startedAt = performance.now();
  let speechStarted = false;
  let speechMs = 0;
  let lastLoudAt = startedAt;
  let floor = 0;
  let floorSamples = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const cleanup = () => {
    if (timer) clearInterval(timer);
    stream.getTracks().forEach((t) => t.stop());
    void audioCtx.close();
  };

  rec.onstop = async () => {
    cleanup();
    const reason = finishReason ?? "manual";
    if (reason === "cancelled" || reason === "no_speech") {
      resolveResult({ kind: "none", reason });
      return;
    }
    try {
      const blob = new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" });
      const { wav, seconds } = await toWav16k(blob);
      resolveResult({ kind: "audio", wav, seconds, reason });
    } catch {
      resolveResult({ kind: "none", reason: "no_speech" });
    }
  };

  const finish = (why: NonNullable<typeof finishReason>) => {
    if (finishReason) return;
    finishReason = why;
    if (rec.state !== "inactive") rec.stop();
  };

  const TICK = 50;
  timer = setInterval(() => {
    analyser.getFloatTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    const rms = Math.sqrt(sum / data.length);
    const now = performance.now();
    const elapsed = now - startedAt;

    // The first 400 ms set the room's noise floor.
    if (elapsed < 400) {
      floor = (floor * floorSamples + rms) / (floorSamples + 1);
      floorSamples++;
      return;
    }
    const threshold = Math.max(0.015, floor * 2.5);
    if (rms > threshold) {
      speechMs += TICK;
      lastLoudAt = now;
      if (speechMs >= 120) speechStarted = true;
    }
    if (elapsed >= capMs) finish("cap");
    else if (speechStarted && now - lastLoudAt >= silenceMs) finish("silence");
    else if (!speechStarted && elapsed >= noSpeechMs) finish("no_speech");
  }, TICK);

  rec.start(250);
  return {
    stop: () => finish(speechStarted ? "manual" : "no_speech"),
    cancel: () => finish("cancelled"),
    result,
  };
}
