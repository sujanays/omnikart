import { answerFromFacts } from "@/assistant/groq";
import { storeFor } from "@/assistant/server/store";
import { ApiError } from "@/assistant/errors";
import { factsFor, numbersAllowed } from "@/assistant/server/facts";
import { fail, faultsOf, metaForClient, readJson, readText } from "@/assistant/server/http";

export const maxDuration = 30;

const UNKNOWN = "The seller has not said.";

/** POST { productId, question }. Returns { answer, found, guarded, source, meta }. English only; the app translates. */
export async function POST(req: Request) {
  try {
    const faults = faultsOf(req);
    const body = await readJson(req);
    const productId = readText(body.productId, "productId", 60);
    const question = readText(body.question, "question", 200);
    const p = await storeFor(req).getProduct(productId);
    if (!p) throw new ApiError("bad_input", "Unknown product");

    const facts = factsFor(p);
    const r = await answerFromFacts(facts, question, { fault429: faults.has("groq_429") });
    let { answer, found } = r;
    let guarded = false;
    if (found && !numbersAllowed(answer, facts)) {
      answer = UNKNOWN;
      found = false;
      guarded = true;
    }
    if (!found) answer = UNKNOWN;
    return Response.json({ answer, found, guarded, source: r.source, reason: r.reason, meta: metaForClient(r.meta) });
  } catch (e) {
    return fail(e);
  }
}
