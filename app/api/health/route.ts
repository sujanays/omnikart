import { asr, asrPool, mtPool, translate, tts, ttsPool } from "@/assistant/anuvaad";
import { chatJson, models } from "@/assistant/groq";
import { getPool, type PoolStatus } from "@/assistant/keypool";
import { LANGS, type Lang } from "@/contract/lang";
import { isApiError } from "@/assistant/errors";
import { fail } from "@/assistant/server/http";

export const maxDuration = 60;

interface ServiceReport extends PoolStatus {
  /** only with ?deep=1 */
  ok?: boolean;
  ms?: number;
  error?: string;
}

/** A one second silent WAV: the ASR service should answer "nothing recognised", which still proves it is up. */
function silentWav(): ArrayBuffer {
  const rate = 16000;
  const bytes = rate * 2;
  const buf = new ArrayBuffer(44 + bytes);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  v.setUint32(4, 36 + bytes, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, bytes, true);
  return buf;
}

const MT_PAIRS: [Lang, Lang][] = [["en", "hi"], ["hi", "en"], ["en", "te"], ["te", "en"]];

async function probe(name: string, run: () => Promise<unknown>): Promise<Pick<ServiceReport, "ok" | "ms" | "error">> {
  const t0 = Date.now();
  try {
    await run();
    return { ok: true, ms: Date.now() - t0 };
  } catch (e) {
    // "empty" from ASR on silence means the service answered, which is what we are checking
    if (isApiError(e) && e.code === "empty" && name.startsWith("ANUVAAD_ASR")) return { ok: true, ms: Date.now() - t0 };
    return { ok: false, ms: Date.now() - t0, error: isApiError(e) ? e.code : "unexpected" };
  }
}

/**
 * GET /api/health          which pools are configured and how many keys are resting (no outside calls)
 * GET /api/health?deep=1   also calls every configured service once (uses a little quota)
 * Key values are never returned.
 */
export async function GET(req: Request) {
  try {
    const deep = new URL(req.url).searchParams.get("deep") === "1";
    const jobs: { name: string; run: () => Promise<unknown> }[] = [
      {
        name: "GROQ",
        run: () =>
          chatJson({
            model: models().primary,
            system: "Reply with the JSON {\"ok\": true}.",
            user: "ping",
            schemaName: "ping",
            schema: { type: "object", additionalProperties: false, required: ["ok"], properties: { ok: { type: "boolean" } } },
            maxTokens: 200,
          }),
      },
      ...LANGS.map((l) => ({ name: asrPool(l), run: () => asr(l, silentWav()) })),
      ...MT_PAIRS.map(([a, b]) => ({ name: mtPool(a, b), run: () => translate(a, b, "hello") })),
      ...LANGS.map((l) => ({ name: ttsPool(l), run: () => tts(l, "hello") })),
    ];

    const reports: ServiceReport[] = await Promise.all(
      jobs.map(async (j) => {
        const status = getPool(j.name).status();
        if (!deep || status.total === 0) return status;
        return { ...status, ...(await probe(j.name, j.run)) };
      }),
    );
    const configured = reports.filter((r) => r.total > 0).length;
    return Response.json({
      deep,
      configured,
      of: reports.length,
      mockLlm: process.env.MOCK_LLM === "1",
      faultsAllowed: process.env.ALLOW_FAULTS !== "0",
      services: reports,
    });
  } catch (e) {
    return fail(e);
  }
}
