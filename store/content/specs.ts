import type { Category } from "@/contract";
import type { AttrValue, Spec } from "@/store/catalogue-types";
import { COLOUR, NO, VALUE, YES } from "@/store/content/dictionary";
import type { L3 } from "@/contract/lang";

const num = (v: AttrValue | undefined): number => (typeof v === "number" ? v : 0);
const str = (v: AttrValue | undefined): string => String(v ?? "");
const yn = (v: AttrValue | undefined): L3 => (v ? YES : NO);
const word = (key: string, fallback: L3): L3 => VALUE[key] ?? fallback;
const colour = (v: AttrValue | undefined): L3 => COLOUR[str(v)] ?? { en: str(v), hi: str(v), te: str(v) };
const sizesText = (v: AttrValue | undefined): L3 => {
  const t = Array.isArray(v) ? v.join(", ") : "";
  return { en: t, hi: t, te: t };
};

/** The full specification table, built from the product's filter attributes so the two can never disagree. */
export function specsFor(category: Category, a: Record<string, AttrValue>): Spec[] {
  switch (category) {
    case "phones":
      return [
        { key: "battery", value: num(a.battery), unit: "mah" },
        { key: "ram", value: num(a.ram), unit: "gb" },
        { key: "storage", value: num(a.storage), unit: "gb" },
        { key: "screen", value: num(a.screen), unit: "inch" },
        { key: "camera", value: num(a.camera), unit: "mp" },
        { key: "network", value: a.fiveG ? VALUE.fiveG : VALUE.fourG },
        { key: "colour", value: colour(a.colour) },
      ];
    case "jeans":
      return [
        { key: "gender", value: word(str(a.gender), VALUE.men) },
        { key: "fit", value: word(str(a.fit), VALUE.regular) },
        { key: "fabric", value: a.stretch ? VALUE.cottonStretch : VALUE.cotton },
        { key: "stretch", value: a.stretch ? VALUE.stretchYes : VALUE.stretchNo },
        { key: "colour", value: colour(a.colour) },
        { key: "sizes", value: sizesText(a.sizes) },
        { key: "care", value: VALUE.machineWash },
      ];
    case "cookers":
      return [
        { key: "capacity", value: num(a.capacity), unit: "litre" },
        { key: "material", value: word(str(a.material), VALUE.steel) },
        { key: "induction", value: yn(a.induction) },
        { key: "lid", value: a.lid === "inner" ? VALUE.innerLid : VALUE.outerLid },
        { key: "warranty", value: num(a.warranty), unit: "year" },
      ];
    case "earbuds":
      return [
        { key: "hours", value: num(a.hours), unit: "hour" },
        { key: "anc", value: yn(a.anc) },
        { key: "ipx", value: num(a.ipx) > 0 ? { en: `IPX${num(a.ipx)}`, hi: `आईपीएक्स${num(a.ipx)}`, te: `ఐపీఎక్స్${num(a.ipx)}` } : NO },
        { key: "driver", value: num(a.driver), unit: "mm" },
        { key: "bluetooth", value: { en: str(a.bluetooth), hi: str(a.bluetooth), te: str(a.bluetooth) } },
        { key: "colour", value: colour(a.colour) },
      ];
    case "shoes":
      return [
        { key: "gender", value: word(str(a.gender), VALUE.men) },
        { key: "type", value: word(str(a.type), VALUE.casual) },
        { key: "material", value: word(str(a.material), VALUE.synthetic) },
        { key: "closure", value: a.closure === "slipOn" ? VALUE.slipOn : VALUE.laces },
        { key: "colour", value: colour(a.colour) },
        { key: "sizes", value: sizesText(a.sizes) },
      ];
    default:
      return [];
  }
}
