import type { L3, Lang } from "@/contract/lang";
import type { Category } from "@/contract";
import type { AttrValue } from "@/store/catalogue-types";
import { brandIn } from "@/store/content/brands";
import { COLOUR, VALUE } from "@/store/content/dictionary";

/**
 * Titles in three languages, built from parts so a native speaker checks about forty phrases,
 * not two hundred titles. The English title has the model name. Hindi and Telugu say the brand in
 * their own script and then the features that tell two products of that brand apart; the model name
 * is added only when a script version is given (a Latin model name is read badly by a Hindi voice).
 */

export interface NameInput {
  category: Category;
  brand: string;
  model: string;
  attrs: Record<string, AttrValue>;
  /** how to say the model name in Devanagari and Telugu */
  modelHi?: string;
  modelTe?: string;
}

const join = (...parts: (string | false | undefined)[]): string => parts.filter(Boolean).join(" ").replace(/\s+,/g, ",");

const gen = (g: string, lang: Lang): string =>
  g === "men" ? { en: "Men's", hi: "पुरुषों की", te: "పురుషుల" }[lang] : { en: "Women's", hi: "महिलाओं की", te: "మహిళల" }[lang];

const colourWord = (key: unknown, lang: Lang): string => COLOUR[String(key)]?.[lang] ?? String(key);
const valueWord = (key: string, lang: Lang): string => VALUE[key]?.[lang] ?? key;

export function buildName(i: NameInput): L3 {
  const a = i.attrs;
  const out = {} as L3;
  for (const lang of ["en", "hi", "te"] as Lang[]) {
    const brand = brandIn(i.brand, lang);
    const model = lang === "en" ? i.model : lang === "hi" ? i.modelHi : i.modelTe;
    switch (i.category) {
      case "phones": {
        const ram = a.ram as number;
        const sto = a.storage as number;
        out[lang] =
          lang === "en"
            ? join(brand, model, a.fiveG && !/5G/.test(String(model)) ? "5G" : "", `(${ram} GB RAM, ${sto} GB)`)
            : lang === "hi"
              ? join(brand, "स्मार्टफ़ोन", model, `${ram} जीबी रैम,`, `${sto} जीबी`)
              : join(brand, "స్మార్ట్‌ఫోన్", model, `${ram} జీబీ ర్యామ్,`, `${sto} జీబీ`);
        break;
      }
      case "jeans": {
        const fit = valueWord(String(a.fit), lang);
        const col = colourWord(a.colour, lang);
        out[lang] =
          lang === "en"
            ? join(brand, model, gen(String(a.gender), lang), fit, "Fit Jeans,", col)
            : lang === "hi"
              ? join(brand, model, gen(String(a.gender), lang), fit, "फ़िट जींस,", col)
              : join(brand, model, gen(String(a.gender), lang), fit, "ఫిట్ జీన్స్,", col);
        break;
      }
      case "cookers": {
        const cap = a.capacity as number;
        const mat = valueWord(String(a.material), lang);
        out[lang] =
          lang === "en"
            ? join(brand, model, `${cap} Litre`, mat, "Pressure Cooker")
            : lang === "hi"
              ? join(brand, model, `${cap} लीटर`, mat, "प्रेशर कुकर")
              : join(brand, model, `${cap} లీటర్ల`, mat, "ప్రెషర్ కుక్కర్");
        break;
      }
      case "earbuds": {
        const anc = a.anc as boolean;
        out[lang] =
          lang === "en"
            ? join(brand, model, "Bluetooth Earbuds", anc && "with Noise Cancelling")
            : lang === "hi"
              ? join(brand, model, "ब्लूटूथ ईयरबड्स", anc && ", शोर रद्द करने वाले")
              : join(brand, model, "బ్లూటూత్ ఇయర్‌బడ్స్", anc && ", శబ్దం రద్దుతో");
        break;
      }
      case "shoes": {
        const type = valueWord(String(a.type), lang);
        const col = colourWord(a.colour, lang);
        out[lang] =
          lang === "en"
            ? join(brand, model, gen(String(a.gender), lang), type, "Shoes,", col)
            : lang === "hi"
              ? join(brand, model, gen(String(a.gender), lang), type, "जूते,", col)
              : join(brand, model, gen(String(a.gender), lang), type, "బూట్లు,", col);
        break;
      }
    }
  }
  return out;
}
