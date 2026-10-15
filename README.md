# Omnikart: a shopkeeper you can talk to

> **Two apps, one contract.** `store/` is a stand-alone demo shop (Haat); `assistant/` is the voice guide (Omnikart) and works with any store that implements `contract/`. They talk only over HTTP and page events, and a lint rule fails the build if either imports the other. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Megathon 2026, "Accessible AI for All", shopping track.

Online shopping turned a conversation into a catalogue. A screen reader makes a blind shopper listen to the whole shop, one element at a time. Omnikart puts the conversation back: you speak English, Hindi or Telugu, and it answers the way a good shopkeeper does. It asks one question, offers three options, says what buyers liked and did not like, describes the photo, and reads every number back before money moves.

**Conditions covered:** visual impairment (primary), hand-motor impairment, ageing, and hearing (bonus).
**Languages:** English, Hindi, Telugu. Speak one, hear another.

```
Mic -> ASR (AnuvaadHub) -> MT to English (AnuvaadHub) -> LLM picks ONE typed action (Groq)
    -> plain code runs it on the catalogue -> accessible output
    -> MT / saved audio -> TTS (AnuvaadHub) + captions
```

## Run it (3 commands)

```bash
npm install
cp .env.example .env.local     # then fill in your keys (see the table below)
npm run dev                    # http://localhost:3000
```

No keys yet? It still runs. Set `MOCK_LLM=1` in `.env.local` and everything except speech works: type into the box at the bottom. Speech needs the AnuvaadHub endpoints. Open `/judge` to see what is configured.

Needs Node 20 or newer. The microphone needs HTTPS or `localhost`.

## What to put in `.env.local`

| Variable | What it is |
|---|---|
| `GROQ_API_KEYS` | Groq keys, comma separated (up to 10). The LLM only picks an action. |
| `GROQ_MODEL_PRIMARY`, `GROQ_MODEL_SECONDARY` | Defaults `openai/gpt-oss-120b` and `openai/gpt-oss-20b`. The second is used when every key is rate limited on the first. |
| `ANUVAAD_ASR_{EN,HI,TE}_URLS` and `_TOKENS` | Speech recognition, one model per language. URLs and tokens in matching order, one pair per token set. |
| `ANUVAAD_MT_{EN_HI,HI_EN,EN_TE,TE_EN}_URLS` and `_TOKENS` | Translation, one model per direction. |
| `ANUVAAD_TTS_{EN,HI,TE}_URLS` and `_TOKENS` | Speech synthesis, one model per language. |
| `MOCK_LLM` | `1`: never call Groq (saves quota while coding). |
| `ALLOW_FAULTS` | `0`: turn off the judge page's fail-on-purpose switches. |
| `NEXT_PUBLIC_TTS_DIGITS` | `words` (default, safe) or `digits`. Decide after `npm run spike`. |

**Key pools.** We hold 10 Groq keys and 4 AnuvaadHub token sets. `assistant/keypool.ts` rotates them round robin; a key that gets a 429 rests for the time the service says and the next key takes the call at once. Key values never reach the browser or the logs, only "key 4 of 10".

## Scripts

| Command | What it does |
|---|---|
| `npm run spike` | **Do this first.** Calls every endpoint and every key once, saves WAV files so you can listen to how digits and punctuation sound, round-trips text to speech into speech recognition per language, and reads your real Groq rate limits. |
| `npm test` | Unit tests (211). Includes the checkout safety rules, number protection, key pool, turn taking, fallbacks. |
| `npm run smoke` | The scripted 10 turn conversation (find, filter, compare, open, reviews, photo, add, checkout, confirm, track) in English, Hindi, Telugu, code-mixed Hinglish, and speak-Hindi-hear-Telugu, through the real services. `-- --no-audio` types instead of speaking. |
| `npm run catalogue` | Rebuilds `data/products.json` and the product pictures. Deterministic. |
| `npm run lint`, `npm run typecheck`, `npm run build` | The usual. |

## Features, and the condition each one is for

| Feature | Where to see it |
|---|---|
| Three options at a time, each with an honest reason ("cheapest of these") | say "pressure cooker under fifteen hundred rupees" |
| Reviews turned into liked, did not like, verdict, "based on N written reviews" | say "reviews" on a product |
| Notes from shoppers with disabilities, read first | product page, and "reviews" |
| Photo and size chart described in words | "what does it look like", "size M" or "my chest is 41" |
| Two products compared, ending "the main difference is..." | "compare the first two" |
| Explain simpler: specs become everyday meaning ("5000 mAh" -> "about two days on one charge") | "explain in simple words" |
| Safe checkout: reads items, address, delivery date, payment, total (twice, digit by digit). Needs "yes, place order" **after** the read-back finishes. Silence, "maybe", a bare "yes" do nothing. Interrupting the read-back cancels it. | say "checkout" |
| Wind chime when it heard you, plus phone vibration and a screen-edge flash | automatic |
| Interrupt any time: Space, a tap, or Escape stops the voice at once | try it mid-sentence |
| Noticing, not asking: three mis-taps offer **one key mode**; "what?" or "slower" twice, or two long silences, offer **calm mode**; zoom 150% or a contrast preference offers **larger text**. Each is offered once and the shopper can say no. | `/judge`, section 4 |
| One key mode: Omnikart reads each choice, Space picks | accept the offer, or Settings |
| Calm mode: slower voice, large text, one fact per card ("1 / 3"), longer wait before the chime | accept the offer, or Settings |
| Decision log: every step in plain words | Settings, or `/judge` |
| Raw against accessible, side by side | `/judge`, section 1 |
| Fail on purpose: cut the network, garble speech recognition, rate limit the AI, break text to speech | `/judge`, section 3 |
| Ask someone to check the cart on WhatsApp before paying | cart and checkout |
| Screen reader mode: voice off, replies go to the live region | Settings |
| Typing box for anyone who cannot or does not want to speak | bottom bar |

## How it fails well

| What goes wrong | What the shopper hears |
|---|---|
| Microphone blocked | "I cannot hear you. Please allow the microphone, or type your request in the box." Phrase buttons appear. |
| Nothing recognised | "I did not catch that. Please say it again." After two misses, phrase buttons appear. |
| Speech hard to hear, a lone number | "I heard ten. Is that right?" It never acts on it until you say yes. |
| Network drops | "Connection lost. I will retry when you are back online." The request is queued and retried by itself. |
| One AI key rate limited | Nothing. The next key takes over. |
| Every AI key limited | Slightly simpler answers from a keyword matcher. |
| Text to speech fails | Saved audio, then the browser's voice, and captions are always on. |
| Translation changes a number | The change is detected (numbers and sizes are compared before and after) and the original words are used instead. |
| The AI invents a number in a free answer | The answer is dropped: "The seller has not said." |

## Hosting

Deploy to Vercel (free). Add the same variables in the project settings. HTTPS is needed for the microphone on phones. If the AnuvaadHub endpoints only answer from the campus network, run the demo from the laptop and use a tunnel for the phone. `npm run spike` on the hosted build's network tells you which.

## Testing it was built to pass

See [docs/TESTING.md](docs/TESTING.md): automated tests, axe accessibility checks, the three timed condition walkthroughs and the real-user test. Judges: see [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) for the five-minute path through everything.

## Declarations

Every outside API, model, library and dataset is listed in [DECLARATIONS.md](DECLARATIONS.md).

## Limits we are honest about

- Hindi and Telugu wording was drafted by us and is waiting for a native speaker to read it aloud once.
- The reviews are synthetic demo data, generated by a seeded script. The notes from shoppers with disabilities are written by hand as examples of the feature.
- The product photos are simple drawings; the description of each is written by hand.
- Speech recognition returns no confidence score, so instead of "confidence 0.62" the app confirms any lone number, repeats every number back, and requires an exact phrase to pay.
- A shopper interrupts by pressing a key or tapping, not by talking over it. An open microphone hears Omnikart's own voice in a noisy hall.
- The payment is a demo. No money moves.
