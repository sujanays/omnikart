import { tts } from "@/assistant/anuvaad";
import { TTS_MAX_WORDS } from "@/assistant/config";
import { cleanForTts, wordCount } from "@/assistant/speakable";
import { ApiError } from "@/assistant/errors";
import { fail, faultsOf, metaForClient, readJson, readLang, readText } from "@/assistant/server/http";

export const maxDuration = 30;

/**
 * POST { lang, text, gender? }. Returns { url, meta } where url is a WAV file.
 * The browser sends one chunk at a time (see splitForSpeech); we clean it again and refuse over 30 words.
 */
export async function POST(req: Request) {
  try {
    const faults = faultsOf(req);
    const body = await readJson(req);
    const lang = readLang(body.lang);
    const raw = readText(body.text, "text", 600);
    const gender = body.gender === "male" ? "male" : "female";
    const text = cleanForTts(raw, lang);
    if (!text) throw new ApiError("bad_input", "Nothing to say after cleaning");
    if (wordCount(text) > TTS_MAX_WORDS) throw new ApiError("too_long", "More than 30 words");
    if (faults.has("tts_fail")) throw new ApiError("fault", "Injected text to speech failure (judge page)");
    const r = await tts(lang, text, gender);
    return Response.json({ url: r.value, meta: metaForClient(r.meta) });
  } catch (e) {
    return fail(e);
  }
}
