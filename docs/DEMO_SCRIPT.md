# The five minute live demo

Rehearse it twice with a timer. Keep a second tab on the laptop build in case the hosted one misbehaves.

**Before you go on:** `/judge` shows every service green (press "Check every service now"). Volume up. Microphone allowed. Phone on the same link. Fault switches all off. Settings: voice on, calm off, one key off.

| Time | Do | Say or point at | What it proves |
|---|---|---|---|
| 0:00 | Stand at the laptop. | "Shopping used to be a conversation. Online shopping turned it into a catalogue, and locked out everyone who cannot see it. Omnikart brings the conversation back." | The problem and the idea |
| 0:20 | Close your eyes, or put on a blindfold. Press Space. In **Hindi**: "पंद्रह सौ रुपये से कम का तीन लीटर प्रेशर कुकर दिखाओ" | The wind chime plays. It answers in Hindi with **three options or fewer, each with a reason**. | Visual condition, the live chain: ASR, translation, AI, translation, TTS |
| 0:50 | Say "पहला वाला खोलो", then "लोग इसके बारे में क्या कहते हैं" | It reads the **notes from shoppers with disabilities first**, then liked, did not like, verdict, "based on 64 written reviews". It tells the truth about the handle. | Honest reviews, community notes, accessible output |
| 1:20 | Say "यह दिखता कैसा है" | The photo, in words. | Describing images |
| 1:35 | Say "जवाब तेलुगु में दो", then ask anything: "इसकी कीमत कितनी है" | The answer comes back in **Telugu**. Hand the mic to a judge: "give it any sentence." | Cross-language, a judge's own prompt through the full chain |
| 2:10 | Open `/judge`. Pick the kurta. Press "Play the review summary". | Raw reviews on the left, the spoken summary on the right. Press "Play simple words" on the phone: "5000 milliamp hours" becomes "about two days on one charge". | Raw against accessible, side by side. Explain simpler |
| 2:45 | Back on a product. With a mitten on (or a fingertip), tap the page three times missing every button. | Omnikart: "Would you like to shop with one key?" Say "yes". It reads each choice. Press **Space** on "Add to cart". | Hand-motor, noticed automatically, offered once |
| 3:25 | On `/judge` set the **Calm** toggle off. Say "what?" twice, then "slower". | "Would you like me to speak slower and show one thing at a time?" Say "yes". Open a product: **one large fact per card, "1 / 3"**, slower voice. | Ageing, noticed automatically |
| 4:00 | Say "checkout". Let the read-back play. Interrupt it with Space, then say "yes place order". | "I stopped the summary, so nothing is ordered." Say "repeat", let it finish, say only "yes": nothing. Say "yes, place order": placed. Order number read digit by digit. | Safe checkout |
| 4:35 | `/judge`: switch on **Cut the network**. Say "show phones". | "Connection lost. I will retry when you are back online." Switch it off: it answers by itself. Point at the **decision log**. | Graceful failure, transparency |
| 4:50 | Close. | Read one quote from the real-user test (see `docs/TESTING.md`). | Impact |

## If something breaks on stage

| Symptom | Do |
|---|---|
| No sound | Captions are always on. Carry on; say "the voice is off, the captions carry the same words." |
| Speech not recognised | Type into the box, or tap a phrase button. |
| Network down | Switch to the laptop build. The voice pack still plays saved lines. |
| Everything silent | Open `/judge`, press "Check every service now", and read out the failing row. |

## Questions judges ask

- **"Where does the price come from?"** The catalogue. Show the decision log line "Cart total computed by code from catalogue prices". The AI cannot write a number.
- **"What if it mishears?"** A lone number is confirmed. Every number is read back. An order needs an exact phrase after the read-back.
- **"How does it know the condition?"** It does not ask. Signals add up and it offers a change once. `/judge` section 4 shows the counters.
- **"Why not just a screen reader?"** A screen reader reads the whole shop one element at a time. Omnikart chooses three, says why, and keeps the rest out of the way.
