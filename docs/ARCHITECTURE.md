# Architecture: a store, an assistant, and a contract between them

Two things in one repository. They share **nothing** except `contract/`.

```
contract/          types and the names of the page events. No logic. Version "1.0".
store/             "Haat": the reference store. Catalogue, filters, cart, orders, its own pages. Runs alone.
assistant/         "Omnikart": the voice guide. Works with any store that implements the contract.
app/(store)/       the store's pages          app/api/store/*   the store's API (the contract over HTTP)
app/api/*          the assistant's routes: agent, ask, asr, mt, tts, compose, health
app/layout.tsx     the host page: the one place where both are mounted side by side
```

**The wall.** `eslint.config.mjs` fails the build if `store/**` imports `assistant/**`, if `assistant/**` imports `store/**`,
or if `contract/**` imports either. Tests are exempt (they build a store in memory to talk to).

## How they talk

| Direction | How | What |
|---|---|---|
| assistant to store | HTTP, `HttpStoreAdapter` (`assistant/adapter/http.ts`) to `/api/store/*` | `meta`, `search`, `getProduct(s)`, `getReviews`, `compare`, `getCart`, `setCart`, `checkout`, `getOrders`, `track`, `returnItem` |
| assistant to page | `CustomEvent` on `window`, names in `contract` (`UI_EVENT`) | `navigate`, `highlight`, `mark`, `announce`, `setFilters`, `setLanguage`, `checkoutLock` |
| page to assistant | the same | `page` (which page is showing), `filtersChanged`, `languageChanged`, `paymentChanged`, `cartChanged` |

Everything the store sends is **data**: numbers for prices, ratings, stock and delivery days; text in three languages; no HTML.
The store's address, name, categories, filter questions and URL patterns come from `meta()`, so the assistant has no category,
brand, filter, URL or element id of its own. `tests/stub-store.test.ts` proves it: a made-up mug shop with other categories,
filters and addresses runs the whole journey with the same assistant code.

The cart and orders live in the store's cookie (`haat_session`), read and written only by `/api/store/*`.
Set `STORE_BASE_URL` (server) and `NEXT_PUBLIC_STORE_BASE_URL` (browser) to point the assistant at a store on another origin.

## Guard rails (unchanged, now on both sides of the wall)

- The AI picks **one typed action** (`assistant/agent/schema.ts`). It never writes a price, rating, date or total:
  executor lines take their numbers from the store's data and add them up in code.
- **LLM words, code numbers.** On English replies the AI may reword a sentence (`/api/compose`, `assistant/agent/compose.ts`).
  A rewrite is used only if it adds or changes no number, loses no name, keeps its language and about its length;
  never at the checkout or for the order; slow or failed means the original sentence is spoken. `COMPOSE=0` turns it off.
  Hindi and Telugu keep their written lines (`COMPOSE_HI_TE=1` to allow rewording).
- **Safe order.** The assistant needs the full read-back heard to the end, then the exact phrase (yes plus an order word) or its labelled button,
  and holds the page's Place order button until then (`checkoutLock`). The store independently **refuses** an order with no confirmation (`store/service.ts`).
- Page text, reviews and descriptions are data. The number guard on free answers (`assistant/server/facts.ts`) is unchanged.

## Run

- `npm run dev` runs both layers as the demo (store with the guide on top).
- `NEXT_PUBLIC_ASSISTANT=off npm run dev` serves the store alone: no guide, no microphone, nothing of ours on the page.
- `npm run catalogue` rebuilds the 60 products and their drawings. `npm run smoke -- --no-audio` runs the typed 10-turn journey over HTTP.

## What was removed in the split

The voice-pack and precompute scripts: they pre-stored sentences and summaries, and every reply is now produced live from the store's current data.
The player still plays a saved-audio manifest if one exists (`public/audio/manifest.json`, empty by default).
