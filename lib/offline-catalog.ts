export type OfflineCatalogItem = {
  externalId: string;
  arabicName: string;
  name: string;
  company: string | null;
  category: string | null;
  currentPrice: string;
  previousPrice: string | null;
  barcode: string | null;
  unitsPerPackage: number;
};

const DIACRITICS = /[ً-ْٰـ]/g;
const ARABIC_DIGITS = /[٠-٩]/g;
const VARIANTS: Array<[RegExp, string]> = [
  [/[أإآٱ]/g, "ا"],
  [/ى/g, "ي"],
  [/ؤ/g, "و"],
  [/ئ/g, "ي"],
  [/ة/g, "ه"],
];

/** نفس تسوية الفهرس المبني في scripts/build-offline-catalog.ts */
export function normalizeCatalogText(value: string) {
  let text = value.toLowerCase().replace(DIACRITICS, "").replace(ARABIC_DIGITS, (digit) => String(digit.charCodeAt(0) - 0x0660));
  for (const [pattern, replacement] of VARIANTS) text = text.replace(pattern, replacement);
  return text.replace(/[^0-9a-z\u0600-\u06FF .+\/%-]/g, " ").replace(/\s+/g, " ").trim();
}

async function readAsset(moduleId: number) {
  const { Asset } = await import("expo-asset");
  const asset = Asset.fromModule(moduleId as never);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  // على الويب الأصل يُخدَّم كمسار نسبي/HTTP، وعلى الجهاز كملف محلي.
  if (uri.startsWith("/") || /^https?:/.test(uri)) {
    const response = await fetch(uri);
    if (!response.ok) throw new Error(`تعذّر تحميل أصل الدليل (${response.status}).`);
    return response.text();
  }
  const { File } = await import("expo-file-system");
  return new File(uri).text();
}

type CatalogSource = { keys: string[]; rows: string[] };

let source: Promise<CatalogSource> | null = null;

function loadSource() {
  if (!source) {
    source = Promise.all([
      readAsset(require("../assets/catalog/items.catalog")),
      readAsset(require("../assets/catalog/index.catalog")),
    ]).then(([items, index]) => {
      const rows = items.split("\n");
      const keys = index.split("\n");
      if (rows.length !== keys.length) throw new Error(`أصول الدليل غير متوافقة: ${rows.length} مقابل ${keys.length}.`);
      return { rows, keys };
    });
    source.catch(() => { source = null; });
  }
  return source;
}

export async function prepareOfflineCatalog() {
  const { rows } = await loadSource();
  return rows.length;
}

export async function offlineCatalogSize() {
  try {
    return (await loadSource()).rows.length;
  } catch {
    return 0;
  }
}

export function parseOfflineRow(line: string): OfflineCatalogItem | null {
  const fields = line.split("|");
  if (fields.length < 8) return null;
  const [externalId, arabicName, name, company, category, currentPrice, barcode, units] = fields;
  if (!externalId) return null;
  return {
    externalId,
    arabicName,
    name,
    company: company || null,
    category: category || null,
    currentPrice,
    previousPrice: null,
    barcode: barcode || null,
    unitsPerPackage: Number(units) || 1,
  };
}

/** بحث محلي بالكامل: لا شبكة ولا سيرفر. يطابق الاسم أو الشركة أو الباركود أو الكود. */
export async function searchOfflineCatalog(query: string, limit = 40): Promise<OfflineCatalogItem[]> {
  const needle = normalizeCatalogText(query);
  if (needle.length < 2) return [];
  const { rows, keys } = await loadSource();
  // الألف الزائدة في الأسماء المنقولة تُتجاهل في المطابقة المرنة (بانادول = بنادول).
  const looseNeedle = needle.replace(/ا/g, "");
  const scored: Array<{ index: number; score: number }> = [];
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    let score = -1;
    if (key.startsWith(needle)) score = 0;
    else if (key.includes(needle)) score = 1;
    else if (looseNeedle.length >= 3 && key.includes(looseNeedle)) score = 2;
    if (score === -1) continue;
    scored.push({ index, score });
    if (scored.length > 600) break;
  }
  scored.sort((a, b) => a.score - b.score || a.index - b.index);
  const items: OfflineCatalogItem[] = [];
  for (const { index } of scored.slice(0, Math.max(1, limit))) {
    const item = parseOfflineRow(rows[index]);
    if (item) items.push(item);
  }
  return items;
}

/** أحدث الأصناف بترتيب المصدر نفسه، بدون أي إعادة ترتيب. */
export async function listOfflineCatalog(limit = 100, offset = 0): Promise<OfflineCatalogItem[]> {
  const { rows } = await loadSource();
  const items: OfflineCatalogItem[] = [];
  for (let index = offset; index < rows.length && items.length < limit; index += 1) {
    const item = parseOfflineRow(rows[index]);
    if (item) items.push(item);
  }
  return items;
}
