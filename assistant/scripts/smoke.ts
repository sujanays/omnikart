/**
 * The scripted 10 turn shopping conversation, run end to end through the REAL services:
 *   ask, filters (answered locally), best matches, open, reviews, delivery, add, checkout, confirm.
 *
 *   npm run smoke                          against http://localhost:3000 (start `npm run dev` first)
 *   npm run smoke -- --lang hi             one language (en, hi, te, hinglish, hi-to-te)
 *   npm run smoke -- --no-audio            skip speech: type the sentences instead (tests translation, AI, executor)
 *
 * With audio, each sentence is first SPOKEN by text to speech, then sent to speech recognition as if
 * the shopper had said it. That is a fair test of the whole chain without a microphone.
 * Runs: English, Hindi, Telugu, code-mixed Hinglish, and cross-language (speak Hindi, hear Telugu).
 * The turns follow the app's own input order: checkout phrase, then an answer to the open filter question
 * (no translation or AI), then common commands, then translation and the AI.
 * Exit code 1 if any turn fails. A service with no key is reported as SKIPPED, not as a pass.
 */
import { execute } from "@/assistant/agent/executor";
import { handleCheckoutUtterance } from "@/assistant/agent/checkout";
import { answerFacetText } from "@/assistant/agent/flow";
import { initialCtx, type Ctx, type Order, type Outcome, type Snapshot, type CartLine } from "@/assistant/agent/state";
import type { StoreMeta } from "@/contract";
import { HttpStoreAdapter } from "@/assistant/adapter/http";
import type { Action } from "@/assistant/agent/schema";
import { matchCommand } from "@/assistant/lexicon";
import { numbersPreserved } from "@/assistant/speakable";
import type { Lang } from "@/contract/lang";

const BASE = process.env.SMOKE_URL ?? "http://localhost:3000";
const NO_AUDIO = process.argv.includes("--no-audio");
const ONLY = process.argv.includes("--lang") ? process.argv[process.argv.indexOf("--lang") + 1] : undefined;

interface Turn {
  say: string;
  /** actions the AI may reasonably choose */
  actions?: string[];
  /** text the reply must contain (checked on the English-language run only, in captions) */
  expect?: RegExp;
  /** handled without the AI: the checkout phrase, or the answer to the open filter question */
  local?: "checkout" | "filter";
}

/**
 * The same ten steps in every language. The shopper asks for a phone, answers the budget and brand questions,
 * jumps ahead to the matches, opens the first, hears reviews and delivery, adds it, pays and confirms.
 * With under ₹15,000 and Samsung the first match is always the Samsung Galaxy M35 at ₹14,999.
 */
const SCRIPT: Record<string, { speak: Lang; reply: Lang; turns: Turn[] }> = {
  en: {
    speak: "en",
    reply: "en",
    turns: [
      { say: "I want a phone", actions: ["search"], expect: /Phones\. I have 12/ },
      { say: "under fifteen thousand", local: "filter", expect: /under ₹15,000/ },
      { say: "samsung", local: "filter", expect: /Samsung/ },
      { say: "show me the best matches", actions: ["show_matches"], expect: /Number 1: Samsung Galaxy M35/ },
      { say: "open the first one", actions: ["open"], expect: /₹14,999/ },
      { say: "what do people say about it", actions: ["reviews"], expect: /Based on 57 written reviews/ },
      { say: "when will it arrive", actions: ["delivery_info"], expect: /ships on/ },
      { say: "add it to my cart", actions: ["add_to_cart"], expect: /₹14,999/ },
      { say: "I want to pay", actions: ["checkout"], expect: /The total is ₹14,999/ },
      { say: "yes place order", local: "checkout", expect: /Order number \d{5}/ },
    ],
  },
  hi: {
    speak: "hi",
    reply: "hi",
    turns: [
      { say: "मुझे एक फ़ोन चाहिए", actions: ["search"] },
      { say: "पंद्रह हज़ार से कम", local: "filter" },
      { say: "सैमसंग", local: "filter" },
      { say: "सबसे अच्छे विकल्प दिखाओ", actions: ["show_matches"], expect: /₹14,999/ },
      { say: "पहला वाला खोलो", actions: ["open"], expect: /₹14,999/ },
      { say: "लोग इसके बारे में क्या कहते हैं", actions: ["reviews"] },
      { say: "यह कब तक पहुँचेगा", actions: ["delivery_info"] },
      { say: "इसे कार्ट में डालो", actions: ["add_to_cart"], expect: /₹14,999/ },
      { say: "मुझे भुगतान करना है", actions: ["checkout"], expect: /₹14,999/ },
      { say: "हाँ ऑर्डर करो", local: "checkout", expect: /\d{5}/ },
    ],
  },
  te: {
    speak: "te",
    reply: "te",
    turns: [
      { say: "నాకు ఒక ఫోన్ కావాలి", actions: ["search"] },
      { say: "పదిహేను వేల లోపు", local: "filter" },
      { say: "శాంసంగ్", local: "filter" },
      { say: "ఉత్తమ ఎంపికలు చూపించు", actions: ["show_matches"], expect: /₹14,999/ },
      { say: "మొదటిది తెరవండి", actions: ["open"], expect: /₹14,999/ },
      { say: "దీని గురించి ప్రజలు ఏమంటున్నారు", actions: ["reviews"] },
      { say: "ఇది ఎప్పుడు వస్తుంది", actions: ["delivery_info"] },
      { say: "దీన్ని కార్ట్‌లో వేయండి", actions: ["add_to_cart"], expect: /₹14,999/ },
      { say: "నేను చెల్లించాలి", actions: ["checkout"], expect: /₹14,999/ },
      { say: "అవును ఆర్డర్ చేయండి", local: "checkout", expect: /\d{5}/ },
    ],
  },
  hinglish: {
    speak: "hi",
    reply: "hi",
    turns: [
      { say: "मुझे एक phone चाहिए", actions: ["search"] },
      { say: "fifteen thousand से कम", local: "filter" },
      { say: "samsung", local: "filter" },
      { say: "best options दिखाओ", actions: ["show_matches"], expect: /₹14,999/ },
      { say: "first वाला open करो", actions: ["open"], expect: /₹14,999/ },
      { say: "इसके reviews बताओ", actions: ["reviews"] },
      { say: "ये कब तक deliver होगा", actions: ["delivery_info"] },
      { say: "इसे cart में add करो", actions: ["add_to_cart"], expect: /₹14,999/ },
      { say: "मुझे checkout करना है", actions: ["checkout"], expect: /₹14,999/ },
      { say: "हाँ order करो", local: "checkout", expect: /\d{5}/ },
    ],
  },
  "hi-to-te": {
    speak: "hi",
    reply: "te",
    turns: [
      { say: "मुझे एक फ़ोन चाहिए", actions: ["search"] },
      { say: "पंद्रह हज़ार से कम", local: "filter" },
      { say: "सैमसंग", local: "filter" },
      { say: "सबसे अच्छे विकल्प दिखाओ", actions: ["show_matches"], expect: /₹14,999/ },
      { say: "पहला वाला खोलो", actions: ["open"], expect: /₹14,999/ },
      { say: "इसे कार्ट में डालो", actions: ["add_to_cart"], expect: /₹14,999/ },
      { say: "मुझे भुगतान करना है", actions: ["checkout"], expect: /₹14,999/ },
      { say: "हाँ ऑर्डर करो", local: "checkout", expect: /\d{5}/ },
    ],
  },
};

/* ---------------- calls ---------------- */

class Skip extends Error {}

async function api<T>(route: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${route}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } } & T;
  if (!res.ok) {
    if (j.error?.code === "not_configured") throw new Skip(`${route}: ${j.error.message}`);
    throw new Error(`${route} ${res.status}: ${j.error?.code ?? "?"} ${j.error?.message ?? ""}`);
  }
  return j;
}

async function speakThenHear(text: string, lang: Lang): Promise<string> {
  const { url } = await api<{ url: string }>("/api/tts", { lang, text: text.replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ") });
  const wav = await (await fetch(url)).arrayBuffer();
  const fd = new FormData();
  fd.append("lang", lang);
  fd.append("audio", new Blob([wav], { type: "audio/wav" }), "a.wav");
  const res = await fetch(`${BASE}/api/asr`, { method: "POST", body: fd });
  const j = (await res.json()) as { text?: string; error?: { code?: string; message?: string } };
  if (!res.ok) {
    if (j.error?.code === "not_configured") throw new Skip(`/api/asr: ${j.error.message}`);
    throw new Error(`/api/asr ${res.status} ${j.error?.code}`);
  }
  return j.text ?? "";
}

/* ---------------- one conversation ---------------- */

interface Result {
  turn: number;
  ok: boolean;
  said: string;
  heard: string;
  detail: string;
}

/** A fetch that remembers the store's cookie, as a browser would. */
function cookieFetch(): typeof fetch {
  let cookie = "";
  return async (input, init) => {
    const res = await fetch(input, { ...init, headers: { ...(init?.headers as Record<string, string> | undefined), ...(cookie ? { cookie } : {}) } });
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) cookie = c.split(";")[0];
    return res;
  };
}

async function runScript(name: string): Promise<Result[]> {
  const sc = SCRIPT[name];
  const adapter = new HttpStoreAdapter({ baseUrl: BASE, fetchImpl: cookieFetch() });
  const meta: StoreMeta = await adapter.meta();
  const results: Result[] = [];
  let ctx: Ctx = initialCtx();
  let cart: CartLine[] = [];
  let orders: Order[] = [];
  const snap = (userText: string): Snapshot => ({ lang: sc.reply, inputLang: sc.speak, cart, ctx, orders, calm: false, now: new Date(), userText, store: adapter, meta });
  const apply = (o: Outcome) => {
    if (o.cart) cart = o.cart;
    if (o.orders) orders = o.orders;
    if (o.ctx) ctx = { ...ctx, ...o.ctx };
  };

  for (let i = 0; i < sc.turns.length; i++) {
    const t = sc.turns[i];
    const r: Result = { turn: i + 1, ok: false, said: t.say, heard: "", detail: "" };
    try {
      // 1. speech: say it, hear it
      r.heard = t.say;
      if (!NO_AUDIO) r.heard = await speakThenHear(t.say, sc.speak);

      let lines: { caption: string }[] = [];
      let how = "";
      if (t.local === "checkout") {
        // the checkout phrase: the read-back must have finished, so we mark it so, as a real shopper's wait would
        if (ctx.checkout) ctx = { ...ctx, checkout: { ...ctx.checkout, readbackDone: true } };
        const o = (await handleCheckoutUtterance(r.heard, snap(r.heard))) ?? (await handleCheckoutUtterance(t.say, snap(t.say)));
        if (!o) throw new Error(`the spoken confirmation was not accepted (heard "${r.heard}")`);
        apply(o);
        lines = o.lines;
        how = "checkout phrase";
      } else {
        const cmd = matchCommand(r.heard, sc.speak, { hasOptions: ctx.options.length > 0 || !!ctx.asking });
        // while a filter question is open, the answer is matched against that filter's own options first
        const asking = ctx.asking;
        const local = asking ? ((await answerFacetText(r.heard, undefined, snap(r.heard))) ?? (await answerFacetText(t.say, undefined, snap(t.say)))) : null;
        if (t.local === "filter" && !local) throw new Error(`the answer was not understood as a filter option (heard "${r.heard}")`);
        if (t.local === "filter" && local) {
          apply(local);
          lines = local.lines;
          how = `filter "${asking}" matched locally, no translation or AI`;
        } else {
          let english = r.heard;
          if (!cmd && sc.speak !== "en") {
            try {
              english = (await api<{ text: string }>("/api/mt", { from: sc.speak, to: "en", text: r.heard })).text;
              if (/\d/.test(r.heard) && !numbersPreserved(r.heard, english)) english = r.heard;
            } catch (e) {
              if (e instanceof Skip) how += "no translation; ";
              else throw e;
              english = r.heard;
            }
          }
          const a = await api<{ action: Action; source: string }>("/api/agent", {
            text: english,
            state: { screen: ctx.screen, options: ctx.options, productId: ctx.productId, cartCount: cart.reduce((n, l) => n + l.qty, 0), category: ctx.category, asking: ctx.asking },
          });
          how += `${a.source}:${a.action.action}`;
          if (t.actions && !t.actions.includes(a.action.action)) throw new Error(`the AI chose "${a.action.action}", expected ${t.actions.join(" or ")} (English heard by AI: "${english}")`);
          const o = await execute(a.action, snap(english));
          apply(o);
          lines = o.lines;
        }
      }
      const text = lines.map((l) => l.caption).join(" ");
      if (t.expect && !t.expect.test(text)) throw new Error(`reply did not match ${t.expect}: "${text.slice(0, 160)}"`);
      r.ok = true;
      r.detail = how;
    } catch (e) {
      if (e instanceof Skip) throw e;
      r.detail = (e as Error).message;
    }
    results.push(r);
  }
  return results;
}

async function main() {
  console.log(`Smoke test against ${BASE}${NO_AUDIO ? " (typed, no audio)" : ""}\n`);
  try {
    await fetch(`${BASE}/api/health`);
  } catch {
    console.log(`Cannot reach ${BASE}. Start the app with: npm run dev`);
    process.exitCode = 1;
    return;
  }
  const names = ONLY ? [ONLY] : Object.keys(SCRIPT);
  let failed = 0;
  let skipped = 0;
  for (const name of names) {
    if (!SCRIPT[name]) {
      console.log(`Unknown script ${name}. Choose from: ${Object.keys(SCRIPT).join(", ")}`);
      process.exitCode = 1;
      return;
    }
    console.log(`=== ${name}: speak ${SCRIPT[name].speak}, hear ${SCRIPT[name].reply}`);
    try {
      for (const r of await runScript(name)) {
        console.log(`  ${r.ok ? "PASS" : "FAIL"} ${String(r.turn).padStart(2)}  ${r.said}${r.heard !== r.said ? `   (heard: ${r.heard})` : ""}  [${r.detail}]`);
        if (!r.ok) failed++;
      }
    } catch (e) {
      if (e instanceof Skip) {
        console.log(`  SKIPPED: ${e.message}`);
        skipped++;
      } else throw e;
    }
  }
  console.log(`\n${failed === 0 ? "All turns passed" : `${failed} turn(s) failed`}${skipped ? `, ${skipped} script(s) skipped because a service has no key` : ""}.`);
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
