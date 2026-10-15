import { asr } from "@/assistant/anuvaad";
import { ASR_MAX_BYTES } from "@/assistant/config";
import { ApiError } from "@/assistant/errors";
import { fail, faultsOf, metaForClient, readLang } from "@/assistant/server/http";

export const maxDuration = 30;

/** POST multipart/form-data: audio (WAV file), lang (en | hi | te). Returns { text, meta }. */
export async function POST(req: Request) {
  try {
    const faults = faultsOf(req);
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new ApiError("bad_input", "Expected multipart form data");
    }
    const lang = readLang(form.get("lang"));
    const file = form.get("audio");
    if (!(file instanceof Blob)) throw new ApiError("bad_input", "audio file is missing");
    if (file.size === 0) throw new ApiError("empty", "Audio is empty");
    if (file.size > ASR_MAX_BYTES) throw new ApiError("too_long", "Audio is over 5 MB");

    if (faults.has("asr_garble")) {
      // Judge-page fault: pretend the recogniser misheard. The app must ask "I heard ten. Is that right?"
      return Response.json({ text: "ten", meta: { fault: "asr_garble" } });
    }

    const r = await asr(lang, await file.arrayBuffer());
    return Response.json({ text: r.value, meta: metaForClient(r.meta) });
  } catch (e) {
    return fail(e);
  }
}
