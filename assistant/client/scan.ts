import type { L3, Lang } from "@/contract/lang";
import type { StoreMeta } from "@/contract";
import type { CartLine, Ctx } from "@/assistant/agent/state";
import { checkoutUi } from "@/assistant/agent/checkout";
import { emptyAction, type Action } from "@/assistant/agent/schema";
import { facetById } from "@/assistant/content/facets";

/**
 * One key mode. Omnikart reads each choice in turn and the shopper presses Space on the one they hear.
 * The choices depend on where the shopper is, and in the guided journey they are the current question's
 * options. Every choice is a normal action or answer, so nothing here can do more than the voice commands can.
 */

const t = (en: string, hi: string, te: string): L3 => ({ en, hi, te });

export const SCAN_LABEL = {
  talk: t("Talk to Omnikart", "ओम्नीकार्ट से बात करें", "ఓమ్నీకార్ట్‌తో మాట్లాడండి"),
  cart: t("Open the cart", "कार्ट खोलें", "కార్ట్ తెరవండి"),
  help: t("Hear help", "मदद सुनें", "సహాయం వినండి"),
  addToCart: t("Add to cart", "कार्ट में डालें", "కార్ట్‌లో వేయండి"),
  reviews: t("Hear reviews", "रिव्यू सुनें", "రివ్యూలు వినండి"),
  delivery: t("Hear delivery time", "डिलीवरी का समय सुनें", "డెలివరీ సమయం వినండి"),
  photo: t("Describe the photo", "फ़ोटो का वर्णन सुनें", "ఫోటో వివరణ వినండి"),
  facts: t("Hear key facts", "ज़रूरी बातें सुनें", "ముఖ్య విషయాలు వినండి"),
  simple: t("Explain in simple words", "आसान शब्दों में समझाएँ", "సులభంగా వివరించండి"),
  back: t("Go back", "पीछे जाएँ", "వెనక్కి వెళ్ళండి"),
  checkout: t("Go to checkout", "चेकआउट पर जाएँ", "చెక్‌అవుట్‌కు వెళ్ళండి"),
  placeOrder: t("Place the order", "ऑर्डर करें", "ఆర్డర్ చేయండి"),
  hearAgain: t("Hear the summary again", "सार फिर से सुनें", "సారాంశం మళ్ళీ వినండి"),
  cancel: t("Cancel", "रद्द करें", "రద్దు చేయండి"),
  home: t("Go to the home page", "होम पेज पर जाएँ", "హోమ్ పేజీకి వెళ్ళండి"),
  skip: t("Skip this question", "यह सवाल छोड़ें", "ఈ ప్రశ్న వదిలేయండి"),
  showMatches: t("Show the best matches now", "अभी सबसे अच्छे विकल्प दिखाएँ", "ఇప్పుడే ఉత్తమ ఎంపికలు చూపించండి"),
  changeFilters: t("Change the filters", "फ़िल्टर बदलें", "ఫిల్టర్లు మార్చండి"),
} as const;

export interface ScanChoice {
  id: string;
  label: string;
  /** DOM id to highlight, if the page has one */
  domId?: string;
  /** what to do when chosen */
  act:
    | { kind: "talk" }
    | { kind: "action"; action: Action; productId?: string }
    | { kind: "answer"; facet: string; option: string }
    | { kind: "placeOrder" };
}

/** What the choices need from the store: its categories and filters, and the names of the products on offer. */
export interface ScanView {
  meta: StoreMeta;
  names: Record<string, L3>;
}

export function buildScanChoices(ctx: Ctx, cart: CartLine[], lang: Lang, view: ScanView): ScanChoice[] {
  const a = (name: Parameters<typeof emptyAction>[0], extra: Partial<Action> = {}): Action => ({ ...emptyAction(name), ...extra });
  const choices: ScanChoice[] = [];
  const L = (k: keyof typeof SCAN_LABEL) => SCAN_LABEL[k][lang];

  switch (ctx.screen) {
    case "home":
      for (const c of view.meta.categories) choices.push({ id: `cat-${c.id}`, label: c.name[lang], act: { kind: "action", action: a("search", { category: c.id }) } });
      if (cart.length) choices.push({ id: "cart", label: L("cart"), act: { kind: "action", action: a("read_cart") } });
      break;
    case "results": {
      const facet = ctx.category ? facetById(view.meta.categories.find((c) => c.id === ctx.category)?.facets ?? [], ctx.asking) : undefined;
      if (facet) {
        const ids = facet.askOptions ?? facet.options.map((o) => o.id);
        if (facet.kind === "bool") {
          choices.push({ id: "yes", label: { en: "Yes", hi: "हाँ", te: "అవును" }[lang], domId: facet.domId, act: { kind: "answer", facet: facet.id, option: facet.options[0].id } });
        } else {
          for (const id of ids) {
            const o = facet.options.find((x) => x.id === id)!;
            choices.push({ id: `opt-${id}`, label: o.label[lang], domId: facet.domId, act: { kind: "answer", facet: facet.id, option: id } });
          }
        }
        choices.push({ id: "skip", label: L("skip"), act: { kind: "action", action: a("skip_filter") } });
        choices.push({ id: "matches", label: L("showMatches"), act: { kind: "action", action: a("show_matches") } });
      } else {
        ctx.options.forEach((id, i) => {
          const name = view.names[id];
          if (name) choices.push({ id: `open-${id}`, label: name[lang], domId: `product-${id}`, act: { kind: "action", action: a("open", { pick: (i + 1) as 1 | 2 | 3 }) } });
        });
        choices.push({ id: "filters", label: L("changeFilters"), act: { kind: "action", action: a("change_filters") } });
        if (cart.length) choices.push({ id: "cart", label: L("cart"), act: { kind: "action", action: a("read_cart") } });
      }
      break;
    }
    case "product":
      choices.push({ id: "reviews", label: L("reviews"), act: { kind: "action", action: a("reviews") } });
      choices.push({ id: "delivery", label: L("delivery"), act: { kind: "action", action: a("delivery_info") } });
      choices.push({ id: "add", label: L("addToCart"), domId: view.meta.elements.addToCart, act: { kind: "action", action: a("add_to_cart") } });
      choices.push({ id: "photo", label: L("photo"), act: { kind: "action", action: a("describe_photo") } });
      choices.push({ id: "facts", label: L("facts"), act: { kind: "action", action: a("top_facts") } });
      choices.push({ id: "simple", label: L("simple"), act: { kind: "action", action: a("explain_simpler") } });
      if (cart.length) choices.push({ id: "checkout", label: L("checkout"), act: { kind: "action", action: a("checkout") } });
      choices.push({ id: "back", label: L("back"), act: { kind: "action", action: a("go_back") } });
      break;
    case "cart":
      if (cart.length) choices.push({ id: "checkout", label: L("checkout"), domId: view.meta.elements.goCheckout, act: { kind: "action", action: a("checkout") } });
      choices.push({ id: "home", label: L("home"), act: { kind: "action", action: a("go_back") } });
      break;
    case "checkout":
      if (checkoutUi(ctx).canPlace) choices.push({ id: "place", label: L("placeOrder"), domId: view.meta.elements.placeOrder, act: { kind: "placeOrder" } });
      choices.push({ id: "again", label: L("hearAgain"), act: { kind: "action", action: a("checkout", { payment: ctx.checkout?.payment ?? null }) } });
      choices.push({ id: "cancel", label: L("cancel"), act: { kind: "action", action: a("go_back") } });
      break;
    case "ordered":
      choices.push({ id: "home", label: L("home"), act: { kind: "action", action: a("go_back") } });
      break;
  }
  choices.push({ id: "talk", label: L("talk"), domId: "talk-button", act: { kind: "talk" } });
  choices.push({ id: "help", label: L("help"), act: { kind: "action", action: a("help") } });
  return choices;
}
