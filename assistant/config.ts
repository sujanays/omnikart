/**
 * Limits that come from the services we call. Source: ANUVAADHUB_API_SPECIFICATIONS.pdf
 * ("CONSTRAINTS") and the Groq docs. Keep them in one place so tests and code agree.
 */

/** TTS accepts at most 30 words. We speak at most 25 per chunk to stay clear of the edge. */
export const TTS_MAX_WORDS = 30;
export const SPEECH_CHUNK_WORDS = 25;
/** Calm mode (ageing) uses shorter sentences. */
export const SPEECH_CHUNK_WORDS_CALM = 15;

/** MT accepts at most 50 words. We send at most 45. */
export const MT_MAX_WORDS = 50;
export const MT_CHUNK_WORDS = 45;

/** ASR accepts about 20 seconds and under 5 MB. We cut the recording at 15 seconds. */
export const ASR_MAX_SECONDS_SERVICE = 20;
export const ASR_RECORD_CAP_SECONDS = 15;
export const ASR_MAX_BYTES = 5 * 1024 * 1024;
export const ASR_SAMPLE_RATE = 16000;

/** Timeouts for outside calls, in milliseconds. */
export const ANUVAAD_TIMEOUT_MS = 8000;
export const GROQ_TIMEOUT_MS = 6000;

/** How long a rate limited key rests when the service does not say. */
export const DEFAULT_REST_SECONDS = 60;
export const AUTH_REST_SECONDS = 600;
export const MAX_REST_SECONDS = 120;

/** Turn taking. */
export const SILENCE_MS_DEFAULT = 2000;
export const SILENCE_MS_CALM = 3500;
export const NO_SPEECH_TIMEOUT_MS = 6000;

/** Safe checkout. */
export const GENDER = "female" as const;

/** Where the saved audio lines live (see scripts/voicepack.ts). */
export const VOICEPACK_DIR = "/audio";
export const VOICEPACK_MANIFEST = "/audio/manifest.json";

/** "words" turns digits into words before TTS. Default is the safe choice. */
export const DIGITS_MODE: "words" | "digits" =
  process.env.NEXT_PUBLIC_TTS_DIGITS === "digits" ? "digits" : "words";
