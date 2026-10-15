# Testing

## 1. Automated (run these before every demo)

```bash
npm test            # 211 unit tests
npm run lint
npm run typecheck
npm run build
npm run spike       # needs keys: every endpoint and key, plus a text to speech -> speech recognition round trip
npm run smoke       # needs keys and `npm run dev`: the scripted 10 turn conversation, five variants
```

What the unit tests pin down (the rules the app must never break):

| Area | Rules checked |
|---|---|
| Checkout | A bare "yes", "ok", "maybe" and silence never place an order. "Yes, place order" works only after the read-back finished. An interrupted read-back cancels it. Any "no", "cancel" or "do not" wins. A second phrase after the order does nothing. The total is the sum of catalogue prices. Works in English, Hindi, Telugu. |
| Numbers | Digits become words for speech. Numbers and sizes survive translation or the original words are used. The AI's free answer is dropped if it contains a number that is not in the product facts. The order number and total are read digit by digit. |
| Limits | No spoken chunk over 25 words (15 in calm mode). No text to speech call over 30 words, none with special characters. Speech recognition refuses over 20 seconds, over 5 MB, or a non-WAV. Translation splits at 45 words. |
| Keys and failure | Keys rotate. A 429 rests that key and the next takes over at once. A bad token rests for ten minutes. All keys limited falls to the second model, then the keyword matcher. A key value never appears in a response. |
| Turn taking | The player stops at once on interrupt. A newer reply stops an older one. A device with no voice for a language never makes the app wait forever. |
| Conditions | Three mis-taps in ten seconds, two long presses, two double hits offer one key mode. Two "what?" or two long silences offer calm mode. Each offer is made once and a declined offer is never repeated. Stricter settings win when modes combine. |
| The AI | An unknown action, including "place_order", is rejected. Out of range values become null. Product names are looked up from ids, so the browser cannot put text into the prompt. |
| Languages | Every template exists in en, hi, te with the same slots. No stray English inside Hindi or Telugu text. Hindi uses feminine first person, matching the voice. |

## 2. Accessibility checks

Run axe-core on every page: `/`, `/product/cooker-3l`, `/product/kurta-cotton`, `/cart`, `/checkout`, `/orders`, `/judge`.

```bash
npx @axe-core/cli http://localhost:3000 http://localhost:3000/product/cooker-3l http://localhost:3000/cart http://localhost:3000/checkout http://localhost:3000/orders http://localhost:3000/judge
```

Result so far: **0 violations** on all seven pages under WCAG 2.0 A and AA, 2.1 A and AA, 2.2 AA and best-practice rules, including with the high-contrast theme and with the settings, log and captions open.

Manual, once each:
- **Keyboard only**, no mouse: complete a whole purchase. Tab order is skip link, header, page, assistant bar. Space talks when focus is on the page or the talk button; on any other button Space activates that button.
- **TalkBack on Android Chrome**: turn on "Screen reader mode" in Settings so Omnikart's voice and TalkBack do not talk at once. Complete a purchase.
- **Nothing by colour alone**: the offered products carry a text badge "Omnikart's pick, number 1" as well as an outline; the line being spoken has an outline; status is words.
- **Zoom to 200%** and **text size 200%**: nothing is cut off, no sideways scrolling.

## 3. Language and accuracy

`npm run smoke` runs the same 10 turns in English, Hindi, Telugu, code-mixed Hinglish, and speak-Hindi-hear-Telugu. It checks that the prices in the replies match the catalogue and that the order number is five digits.

Also by hand: read the **Hindi and Telugu** sentences in `assistant/agent/templates.ts`, `assistant/client/ui-text.ts` and `store/ui-text.ts` aloud and fix anything unnatural.

## 4. Condition walkthroughs (timed)

One task per condition. Write the time, the number of errors, the number of repeats, and the answer to "Did you trust the final price before paying?"

| Condition | Task | Tester | Time | Errors | Repeats | Trusted the price? |
|---|---|---|---|---|---|---|
| Visual | Blindfolded: buy the three litre cooker by voice | | | | | |
| Hand-motor | One finger in a mitten, or one key only: add to cart and check out | | | | | |
| Ageing | An older family member, slow speech, large text: order a phone | | | | | |

## 5. Real users

At least one blind or low-vision user and one older user, if time allows. Ask them to try the hosted link for five minutes without help. Write down:

- one quote, in their words, with their permission to use it
- the one thing that confused them
- what we changed because of it

Even one honest quote earns the bonus and belongs on a slide.

## Known gaps

- The voice and the recorder have been exercised in a real browser through typed input, the offline queue, offers, one key mode and calm mode. Real microphone input and the real AnuvaadHub and Groq services need your keys: run `npm run spike`, then `npm run smoke`.
- Whether text to speech reads digits well is decided by `npm run spike`. Until then the app turns every digit into words itself, which is always safe.
