import type { Category } from "@/contract";
import { COLOUR_HEX } from "@/store/content/dictionary";

/**
 * Our own drawings of the products: one flat shape per category, in the product's colour, three views each.
 * No brand logos are drawn. The description of the picture (look) carries the meaning for a screen reader.
 */

const svg = (title: string, body: string, bg: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="400" height="400"><title>${title}</title><rect width="200" height="200" fill="${bg}"/>${body}</svg>\n`;

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt)));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const VIEWS = ["front", "back", "detail"] as const;

function phone(c: string, view: string, cams: number): string {
  if (view === "front") {
    return `<rect x="66" y="18" width="68" height="164" rx="12" fill="#1a1a1a"/><rect x="71" y="28" width="58" height="144" rx="6" fill="${shade(c, 70)}"/><circle cx="100" cy="23" r="2.4" fill="#444"/>`;
  }
  if (view === "back") {
    const lens = Array.from({ length: cams }, (_, i) => `<circle cx="84" cy="${38 + i * 15}" r="6" fill="#111" stroke="#666" stroke-width="2"/>`).join("");
    return `<rect x="66" y="18" width="68" height="164" rx="12" fill="${c}"/><rect x="74" y="26" width="22" height="${cams * 15 + 6}" rx="8" fill="${shade(c, -30)}"/>${lens}`;
  }
  return `<rect x="92" y="18" width="16" height="164" rx="6" fill="${c}"/><rect x="95" y="60" width="3" height="22" rx="1.5" fill="${shade(c, -50)}"/><rect x="95" y="90" width="3" height="12" rx="1.5" fill="${shade(c, -50)}"/>`;
}

function earbuds(c: string, view: string): string {
  const bud = (x: number, y: number) => `<ellipse cx="${x}" cy="${y}" rx="11" ry="13" fill="${c}"/><rect x="${x - 3}" y="${y + 8}" width="6" height="30" rx="3" fill="${c}"/>`;
  if (view === "front") return `<rect x="55" y="70" width="90" height="70" rx="30" fill="${c}"/><rect x="55" y="92" width="90" height="4" fill="${shade(c, -40)}"/><circle cx="100" cy="126" r="4" fill="${shade(c, 90)}"/>`;
  if (view === "back") return `<rect x="55" y="70" width="90" height="70" rx="30" fill="${shade(c, -25)}"/><rect x="55" y="62" width="90" height="34" rx="16" fill="${c}" transform="rotate(-18 100 80)"/>${bud(78, 112)}${bud(122, 112)}`;
  return `${bud(76, 80)}${bud(124, 80)}`;
}

function cooker(c: string, view: string): string {
  if (view === "front") {
    return `<rect x="52" y="92" width="96" height="66" rx="8" fill="${c}"/><ellipse cx="100" cy="90" rx="52" ry="14" fill="${shade(c, 35)}"/><rect x="28" y="106" width="24" height="10" rx="4" fill="#222"/><rect x="148" y="106" width="24" height="10" rx="4" fill="#222"/><circle cx="100" cy="76" r="7" fill="#222"/><rect x="95" y="62" width="10" height="8" fill="#a33"/>`;
  }
  if (view === "back") return `<ellipse cx="100" cy="100" rx="62" ry="62" fill="${shade(c, 30)}"/><ellipse cx="100" cy="100" rx="50" ry="50" fill="${c}"/><circle cx="100" cy="100" r="9" fill="#222"/><rect x="150" y="94" width="34" height="12" rx="5" fill="#222"/>`;
  return `<rect x="62" y="70" width="76" height="88" rx="10" fill="${c}"/><rect x="62" y="70" width="76" height="16" rx="8" fill="${shade(c, 35)}"/><rect x="138" y="96" width="30" height="10" rx="4" fill="#222"/>`;
}

function jeans(c: string, view: string): string {
  const legs = `<path d="M62 26 H138 L146 176 H108 L100 78 L92 176 H54 Z" fill="${c}"/>`;
  if (view === "front") return `${legs}<rect x="62" y="26" width="76" height="12" fill="${shade(c, -30)}"/><circle cx="100" cy="32" r="3" fill="#caa"/><path d="M70 44 q12 14 24 4" stroke="${shade(c, 45)}" stroke-width="2" fill="none"/><path d="M130 44 q-12 14 -24 4" stroke="${shade(c, 45)}" stroke-width="2" fill="none"/>`;
  if (view === "back") return `${legs}<rect x="62" y="26" width="76" height="12" fill="${shade(c, -30)}"/><path d="M72 52 h20 v22 l-10 8 l-10 -8 Z" fill="none" stroke="${shade(c, 50)}" stroke-width="2"/><path d="M108 52 h20 v22 l-10 8 l-10 -8 Z" fill="none" stroke="${shade(c, 50)}" stroke-width="2"/>`;
  return `<rect x="30" y="70" width="140" height="60" rx="10" fill="${c}"/><rect x="30" y="70" width="140" height="18" fill="${shade(c, -30)}"/><circle cx="100" cy="79" r="8" fill="#caa"/><rect x="96" y="92" width="8" height="30" fill="${shade(c, -45)}"/>`;
}

function shoe(c: string, view: string): string {
  if (view === "front") {
    return `<path d="M30 128 q4 -50 40 -52 l30 14 q22 8 54 18 q22 6 22 20 v6 H30 Z" fill="${c}"/><rect x="28" y="136" width="146" height="14" rx="7" fill="${shade(c, 90)}"/><path d="M86 90 l14 -8 M96 98 l14 -8 M106 104 l14 -8" stroke="#fff" stroke-width="3"/>`;
  }
  if (view === "back") return `<path d="M52 150 v-60 q0 -22 22 -22 h52 q22 0 22 22 v60 Z" fill="${c}"/><rect x="48" y="150" width="104" height="14" rx="7" fill="${shade(c, 90)}"/><rect x="92" y="76" width="16" height="30" rx="6" fill="${shade(c, -35)}"/>`;
  return `<ellipse cx="100" cy="100" rx="38" ry="78" fill="${c}"/><ellipse cx="100" cy="68" rx="20" ry="26" fill="${shade(c, -35)}"/><path d="M84 86 h32 M82 100 h36 M84 114 h32" stroke="#fff" stroke-width="3"/>`;
}

const SHAPE: Record<Category, (c: string, view: string, extra: number) => string> = {
  phones: (c, v, n) => phone(c, v, n),
  earbuds: (c, v) => earbuds(c, v),
  cookers: (c, v) => cooker(c, v),
  jeans: (c, v) => jeans(c, v),
  shoes: (c, v) => shoe(c, v),
};

/** Three drawings of one product: front, back, detail. */
export function drawGallery(category: Category, id: string, colourKey: string, cams = 2): { name: string; svg: string }[] {
  const hex = COLOUR_HEX[colourKey] ?? "#8b8f94";
  const bg = category === "earbuds" || category === "phones" ? "#eef1f4" : "#f6f1e7";
  return VIEWS.map((v, i) => ({
    name: i === 0 ? `${id}.svg` : `${id}-${i + 1}.svg`,
    svg: svg(`${id} ${v}`, SHAPE[category](hex, v, cams), bg),
  }));
}
