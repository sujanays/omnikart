import type { ProductDTO } from "@/contract";
import { protectedTokens } from "@/assistant/speakable";

/** Everything the store says about a product, as plain English lines. This is the only source the LLM may use. */
export function factsFor(p: ProductDTO): string {
  const s = p.reviewSummary;
  const lines = [
    `Name: ${p.name.en}`,
    `Brand: ${p.brand}`,
    `Category: ${p.category}`,
    `Price: ${p.price} rupees`,
    `Rating: ${p.rating} out of 5 from ${s.count} written reviews`,
    `Delivery: ${p.deliveryDays} days, free`,
    `Sold by: ${p.seller.en}`,
    `Returns: within ${p.returnDays} days`,
    `In stock: ${p.stock}`,
    ...p.specs.map((x) => `${x.label.en}: ${x.value.en}`),
    `Appearance: ${p.look.en}`,
    s.pros.en.length ? `Buyers liked: ${s.pros.en.join("; ")}` : "",
    s.cons.en.length ? `Buyers did not like: ${s.cons.en.join("; ")}` : "",
    ...p.access.map((a) => `Note from ${a.by.en}: ${a.text.en}`),
    p.sizes ? `Sizes in stock: ${p.sizes.join(", ")}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

/** Every number or size in the answer must exist in the facts. Otherwise the answer is dropped. */
export function numbersAllowed(answer: string, facts: string): boolean {
  const allowed = new Set(protectedTokens(facts));
  return protectedTokens(answer).every((t) => allowed.has(t));
}
