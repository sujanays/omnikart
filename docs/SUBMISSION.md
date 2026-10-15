# What to hand in

## Checklist

- [ ] Hosted link works in a private window, on a phone, over HTTPS (microphone needs it)
- [ ] Source repo with README and `DECLARATIONS.md`
- [ ] 7 slide write-up (below)
- [ ] Demo video, 4 minutes or less, narrated and captioned
- [ ] Live demo rehearsed twice (`docs/DEMO_SCRIPT.md`)
- [ ] `npm run spike` and `npm run smoke` both green on the final build
- [ ] One real-user quote

## The 7 slides

The brief asks for: conditions, user needs, design, Bhashini use, testing, limitations. Add one opening slide.

1. **The shopkeeper.** "Omnikart, a good three-litre cooker under fifteen hundred." The shopkeeper asks one question, shows two or three options, says what sells best and tells you the truth about the handle. Online shopping replaced that with a catalogue. A screen reader makes you listen to the whole shop. We put the conversation back.
2. **Conditions we cover.** Visual (primary), hand-motor, ageing, hearing (bonus). For each: the barrier, and the one thing you can see working. The app never asks "what disability do you have". It notices, offers once, and the shopper can say no.
3. **What the shopper needs.** Four things: fewer options chosen for them; the one or two facts that matter, in plain words; honest opinions from people like them; certainty before money leaves their account. In Hindi or Telugu as easily as English.
4. **Design.** The accessible output layer (specs to top five; reviews to liked, did not like, verdict, "based on N"; photos and size charts to words; two products to one sentence; "explain simpler" that translates rather than shortens). Wind chime turn taking. One large fact per card. Decision log. Show raw against accessible.
5. **Using AnuvaadHub (Bhashini's replacement).** The live chain: ASR, translation to English, the AI picks one typed action, plain code runs it on the catalogue, translation, TTS. English, Hindi, Telugu in and out, and cross-language. How the limits shaped the design: 50 words per translation, 30 per speech, WAV only, no confidence score. Numbers protected through translation. Saved audio for speed and for weak networks. Key pooling to survive rate limits.
6. **Testing.** 211 automated tests, axe-core clean on every page, scripted 10 turn conversation in five language variants, three timed condition walkthroughs, a fail-on-purpose panel, and the real-user quote (put it here, large).
7. **Limitations, honestly.** Hindi and Telugu drafted for a native speaker to check. Reviews are synthetic demo data. No confidence score from speech recognition, so we confirm numbers and require an exact phrase to pay. Interrupt by key or tap, not by talking over it. Demo payment only. What we would do next: real photos with OCR, more languages, a real catalogue feed, a test with many more users.

## Demo video (4 minutes or less, captioned)

Narrate each step as you do it; the captions are Omnikart's own on-screen text plus your narration subtitled.

| Time | Scene |
|---|---|
| 0:00 | The problem in two sentences over a screen-reader recording of a normal shop (the forty filters) |
| 0:25 | Blindfolded, Hindi: find a cooker, open it, hear the honest review, hear the photo |
| 1:15 | Hear it in Telugu; the judge's own sentence |
| 1:45 | Raw against accessible on `/judge` |
| 2:15 | Hand-motor: three mis-taps, the offer, one key purchase |
| 2:50 | Ageing: "what?" twice, the offer, calm cards |
| 3:20 | Checkout: the read-back, the interruption, the phrase |
| 3:45 | Network cut, recovery, the decision log |
| 3:55 | The user's quote |

## After you have keys: the order of work

1. `npm run spike`. Listen to the digit and punctuation WAV files in `.gstack/spike/`. Note which endpoints exist and your real Groq limits.
2. Optional: `COMPOSE=0` in the environment turns off AI rewording of English sentences if the free quota is tight.
3. Read the Hindi and Telugu sentences once (`assistant/agent/templates.ts`, `store/ui-text.ts`).
4. `npm run dev`, then `npm run smoke`.
5. Deploy. Open the hosted link in a private window and run one turn on a phone.
6. Real-user test. Write down the quote.
