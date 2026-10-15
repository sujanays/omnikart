/**
 * Builds data/products.json and the product pictures.
 *   npm run catalogue
 *
 * 60 products, 12 in each of phones, jeans, cookers, earbuds, shoes.
 * Brand names are used for a realistic demo. Models, specifications, prices and reviews are ILLUSTRATIVE,
 * written for this hackathon. The reviews are SYNTHETIC: generated from a seeded random generator and
 * phrase banks, so the same command always gives the same file. The access notes are written by hand.
 * See DECLARATIONS.md.
 */
import fs from "node:fs";
import path from "node:path";
import type { Category } from "@/contract";
import type { Product } from "@/store/catalogue-types";
import { drawGallery } from "@/store/scripts/catalogue/art";
import { productFrom, type Seed } from "@/store/scripts/catalogue/common";
import { COOKERS } from "@/store/scripts/catalogue/cookers";
import { EARBUDS } from "@/store/scripts/catalogue/earbuds";
import { JEANS } from "@/store/scripts/catalogue/jeans";
import { PHONES } from "@/store/scripts/catalogue/phones";
import { SHOES } from "@/store/scripts/catalogue/shoes";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const PUBLIC_PRODUCTS = path.join(ROOT, "public", "products");

const ALL: [Category, Seed[]][] = [
  ["phones", PHONES],
  ["jeans", JEANS],
  ["cookers", COOKERS],
  ["earbuds", EARBUDS],
  ["shoes", SHOES],
];

/** Colour of the drawing. Cookers have no colour attribute, so the material decides. */
function artColour(category: Category, s: Seed): string {
  if (category === "cookers") return s.attrs.material === "steel" ? "silver" : s.attrs.material === "aluminium" ? "grey" : "black";
  return String(s.attrs.colour);
}

function check(seeds: Seed[], category: Category) {
  const ids = new Set<string>();
  for (const s of seeds) {
    if (ids.has(s.id)) throw new Error(`duplicate id ${s.id}`);
    ids.add(s.id);
    if (s.mrp < s.price) throw new Error(`${s.id}: price is above MRP`);
  }
  if (seeds.length !== 12) throw new Error(`${category} has ${seeds.length} products, expected 12`);
  if (seeds.filter((s) => s.hero).length !== 3) throw new Error(`${category} needs exactly 3 hero products`);
  if (seeds.filter((s) => s.access?.length).length !== 1) throw new Error(`${category} needs exactly 1 product with access notes`);
}

const products: Product[] = [];
fs.mkdirSync(PUBLIC_PRODUCTS, { recursive: true });
for (const f of fs.readdirSync(PUBLIC_PRODUCTS)) if (f.endsWith(".svg")) fs.unlinkSync(path.join(PUBLIC_PRODUCTS, f));

for (const [category, seeds] of ALL) {
  check(seeds, category);
  for (const s of seeds) {
    const cams = category === "phones" && (s.attrs.camera as number) >= 100 ? 3 : 2;
    const drawings = drawGallery(category, s.id, artColour(category, s), cams);
    for (const d of drawings) fs.writeFileSync(path.join(PUBLIC_PRODUCTS, d.name), d.svg);
    products.push(
      productFrom(s, category, {
        photo: `/products/${drawings[0].name}`,
        gallery: drawings.map((d) => `/products/${d.name}`),
      }),
    );
  }
}

fs.mkdirSync(path.join(ROOT, "store", "data"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "store", "data", "products.json"), JSON.stringify(products));
const derivedPath = path.join(ROOT, "store", "data", "derived.json");
// keep saved summaries only for products that still exist (an old catalogue's ids must not linger)
{
  const ids = new Set(products.map((p) => p.id));
  const old: Record<string, unknown> = fs.existsSync(derivedPath) ? JSON.parse(fs.readFileSync(derivedPath, "utf8")) : {};
  const kept = Object.fromEntries(Object.entries(old).filter(([id]) => ids.has(id)));
  fs.writeFileSync(derivedPath, JSON.stringify(kept, null, 2) + "\n");
}

const kb = Math.round(fs.statSync(path.join(ROOT, "store", "data", "products.json")).size / 1024);
console.log(`Wrote ${products.length} products (${kb} KB).`);
for (const [category] of ALL) {
  const list = products.filter((p) => p.category === category);
  const lo = Math.min(...list.map((p) => p.price));
  const hi = Math.max(...list.map((p) => p.price));
  const reviews = list.reduce((n, p) => n + p.reviews.length, 0);
  console.log(`  ${category.padEnd(8)} ${list.length} products, ${reviews} reviews, price ₹${lo.toLocaleString("en-IN")} to ₹${hi.toLocaleString("en-IN")}, ratings ${Math.min(...list.map((p) => p.rating))} to ${Math.max(...list.map((p) => p.rating))}`);
}
