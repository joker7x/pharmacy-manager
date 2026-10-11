/**
 * يبني نسخة الدليل التي تُشحن داخل التطبيق: ملف بيانات + ملف فهرس بحث موازٍ له بنفس الترتيب.
 * الاستخدام: npx tsx scripts/build-offline-catalog.ts
 */
import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { parse } from "csv-parse";

import { normalizeDrugListRecord } from "../server/druglist";

const DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g;
const ARABIC_DIGITS = /[\u0660-\u0669]/g;
const ARABIC_VARIANTS: Array<[RegExp, string]> = [
  [/[أإآٱ]/g, "ا"],
  [/ى/g, "ي"],
  [/ؤ/g, "و"],
  [/ئ/g, "ي"],
  [/ة/g, "ه"],
];
const DIGIT_MAP = "0123456789";

function normalize(value: string) {
  let text = value.toLowerCase().replace(DIACRITICS, "").replace(ARABIC_DIGITS, (digit) => DIGIT_MAP[digit.charCodeAt(0) - 0x0660]);
  for (const [pattern, replacement] of ARABIC_VARIANTS) text = text.replace(pattern, replacement);
  return text.replace(/[^0-9a-z\u0600-\u06FF .+\/%-]/g, " ").replace(/\s+/g, " ").trim();
}

const clean = (value: string | null | undefined) => (value ?? "").replace(/[\t\n\r|]/g, " ").trim();

async function main() {
  const source = path.resolve(process.cwd(), process.argv[2] ?? "data/druglist.csv");
  const outDir = path.resolve(process.cwd(), "assets/catalog");
  await mkdir(outDir, { recursive: true });

  const rows: string[] = [];
  const keys: string[] = [];
  const parser = createReadStream(source, { encoding: "utf8" }).pipe(
    parse({ relax_column_count: true, skip_records_with_error: true, bom: true }),
  );

  let lineNumber = 0;
  for await (const record of parser as AsyncIterable<string[]>) {
    lineNumber += 1;
    const product = normalizeDrugListRecord(record);
    if (!product) continue;
    rows.push([
      product.externalId,
      clean(product.arabicName),
      clean(product.name),
      clean(product.company),
      clean(product.category),
      product.currentPrice,
      clean(product.barcode),
      String(product.unitsPerPackage ?? 1),
    ].join("|"));
    const primary = [normalize(product.arabicName), normalize(product.name)].join(" ").replace(/\s+/g, " ").trim();
    keys.push([primary, primary.replace(/ا/g, ""), normalize(product.company ?? ""), normalize(product.barcode ?? ""), product.externalId].join(" ").replace(/\s+/g, " ").trim());
  }

  await writeFile(path.join(outDir, "items.catalog"), rows.join("\n"), "utf8");
  await writeFile(path.join(outDir, "index.catalog"), keys.join("\n"), "utf8");

  console.log(`تم بناء ${rows.length.toLocaleString("en")} صنف من سطر ${lineNumber.toLocaleString("en")}.`);
}

void main();
