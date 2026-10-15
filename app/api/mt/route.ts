import { translate } from "@/assistant/anuvaad";
import { fail, metaForClient, readJson, readLang, readText } from "@/assistant/server/http";

export const maxDuration = 30;

/** POST { from, to, text }. Returns { text, meta }. Long text is split into sentence chunks. */
export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const from = readLang(body.from, "from");
    const to = readLang(body.to, "to");
    const text = readText(body.text, "text", 1500);
    const r = await translate(from, to, text);
    return Response.json({ text: r.value, meta: metaForClient(r.meta) });
  } catch (e) {
    return fail(e);
  }
}
