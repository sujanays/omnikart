import { composeLines } from "@/assistant/groq";
import { rewriteIsSafe } from "@/assistant/agent/compose";
import { isLang } from "@/contract/lang";
import { ApiError } from "@/assistant/errors";
import { fail, faultsOf, metaForClient, readJson } from "@/assistant/server/http";

export const maxDuration = 20;

/**
 * POST { lang, lines: string[] }. Returns { lines: (string | null)[] }: a friendlier version of each sentence,
 * or null where the rewrite changed a number, a name or the language. The numbers in `lines` were filled in
 * by code; this route only ever lets them through unchanged.
 */
export async function POST(req: Request) {
  try {
    const faults = faultsOf(req);
    const body = await readJson(req);
    if (!isLang(body.lang)) throw new ApiError("bad_input", "lang must be en, hi or te");
    const lang = body.lang;
    // English only unless switched on: Hindi and Telugu keep their carefully written lines (COMPOSE_HI_TE=1 to allow)
    if (lang !== "en" && process.env.COMPOSE_HI_TE !== "1") return Response.json({ lines: [], source: "none", reason: "english_only" });
    const lines = Array.isArray(body.lines) ? body.lines.filter((x): x is string => typeof x === "string").slice(0, 12) : [];
    if (lines.length === 0 || lines.some((l) => l.length > 400)) throw new ApiError("bad_input", "lines must be 1 to 12 short sentences");
    const r = await composeLines(lang, lines, { fault429: faults.has("groq_429") });
    const safe = r.lines.map((x, i) => (x && rewriteIsSafe(lines[i], x, lang) ? x : null));
    return Response.json({ lines: safe, source: r.source, reason: r.reason, meta: metaForClient(r.meta) });
  } catch (e) {
    return fail(e);
  }
}
