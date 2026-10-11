import { createReadStream } from "node:fs";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

import { parse } from "csv-parse";

import type { InsertProductCatalog } from "../drizzle/schema";
import { normalizeDrugListRecord } from "./druglist";

export type LatestPriceSort = "latest" | "largest_change" | "best_selling";

export type CatalogProduct = {
  externalId: string;
  name: string;
  arabicName: string;
  currentPrice: string;
  previousPrice: string | null;
  soldTimes: number;
  activeIngredient: string | null;
  imagePath: string | null;
  category: string | null;
  company: string | null;
  dosageForm: string | null;
  unitsPerPackage: number;
  barcode: string | null;
  administrationRoute: string | null;
  description: string | null;
  sourceUpdatedAt: number;
  syncedAt: string;
};

export const FEED_PAGE_SIZE = 100;

const CANDIDATE_PATHS = [process.env.DRUGLIST_CSV_PATH, "data/druglist.csv", "/home/ubuntu/upload/druglist.csv"]
  .filter((value): value is string => Boolean(value))
  .map((value) => path.resolve(process.cwd(), value));

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

/** يوحّد نصوص البحث: تشكيل وتطويل، بدائل الألف والياء، والأرقام العربية إلى لاتينية. */
export function normalizeSearchText(value: string) {
  let text = value.toLowerCase().replace(DIACRITICS, "").replace(ARABIC_DIGITS, (digit) => DIGIT_MAP[digit.charCodeAt(0) - 0x0660]);
  for (const [pattern, replacement] of ARABIC_VARIANTS) text = text.replace(pattern, replacement);
  return text.replace(/[^0-9a-z\u0600-\u06FF .+/%-]/g, " ").replace(/\s+/g, " ").trim();
}

const toNumber = (value: string | number | null) => (value === null ? null : Number(value));

function toProduct(record: InsertProductCatalog): CatalogProduct {
  return {
    externalId: record.externalId,
    name: record.name,
    arabicName: record.arabicName,
    currentPrice: String(record.currentPrice),
    previousPrice: record.previousPrice === null || record.previousPrice === undefined ? null : String(record.previousPrice),
    soldTimes: record.soldTimes ?? 0,
    activeIngredient: record.activeIngredient ?? null,
    imagePath: record.imagePath ?? null,
    category: record.category ?? null,
    company: record.company ?? null,
    dosageForm: record.dosageForm ?? null,
    unitsPerPackage: record.unitsPerPackage ?? 1,
    barcode: record.barcode ?? null,
    administrationRoute: record.administrationRoute ?? null,
    description: record.description ?? null,
    sourceUpdatedAt: record.sourceUpdatedAt ?? 0,
    syncedAt: new Date().toISOString(),
  };
}

type SearchKeys = { primary: string; loose: string; secondary: string; identifiers: string };

/** مفتاح البحث يلغي الألف الزائدة لأن أسماء الأدوية منقولة من اللاتينية (بانادول/بنادول). */
function keysFor(product: CatalogProduct): SearchKeys {
  const primary = normalizeSearchText(`${product.arabicName} ${product.name}`);
  return {
    primary,
    loose: primary.replace(/ا/g, ""),
    secondary: normalizeSearchText([product.company, product.category, product.activeIngredient, product.dosageForm, product.administrationRoute].filter(Boolean).join(" ")),
    identifiers: normalizeSearchText(`${product.externalId} ${product.barcode ?? ""}`),
  };
}

function scoreOf(keys: SearchKeys, term: string, looseTerm: string) {
  if (!term) return 0;
  if (keys.identifiers === term) return 95;
  if (keys.primary === term) return 90;
  if (keys.primary.startsWith(term)) return 70;
  if (keys.primary.includes(term)) return 50;
  if (keys.identifiers.includes(term)) return 40;
  if (looseTerm.length >= 3 && keys.loose.includes(looseTerm)) return 35;
  if (keys.secondary.includes(term)) return 25;
  return 0;
}

class LocalCatalog {
  readonly filePath: string;
  readonly products: CatalogProduct[];
  private readonly keys: SearchKeys[];
  private readonly byExternalId = new Map<string, number>();
  private loadedAt = Date.now();

  constructor(filePath: string, products: CatalogProduct[]) {
    this.filePath = filePath;
    this.products = products;
    this.keys = products.map(keysFor);
    products.forEach((product, index) => this.byExternalId.set(product.externalId, index));
  }

  get size() {
    return this.products.length;
  }

  get lastRefreshedAt() {
    return this.loadedAt;
  }

  private touch() {
    this.loadedAt = Date.now();
  }

  get(externalId: string) {
    const index = this.byExternalId.get(externalId);
    return index === undefined ? null : this.products[index];
  }

  /** يدمج أسعار المصدر الحيّ فوق صفوف الملف نفس المعرف، ويضيف غير الموجود. */
  record(records: InsertProductCatalog[]) {
    for (const record of records) {
      const incoming = toProduct(record);
      const index = this.byExternalId.get(incoming.externalId);
      if (index === undefined) {
        this.byExternalId.set(incoming.externalId, this.products.length);
        this.products.push(incoming);
        this.keys.push(keysFor(incoming));
        continue;
      }
      const current = this.products[index];
      const nextSourceUpdatedAt = Math.max(current.sourceUpdatedAt, incoming.sourceUpdatedAt);
      if (current.currentPrice === incoming.currentPrice && current.previousPrice === incoming.previousPrice && nextSourceUpdatedAt === current.sourceUpdatedAt) continue;
      const merged: CatalogProduct = {
        ...current,
        name: incoming.name || current.name,
        arabicName: incoming.arabicName || current.arabicName,
        previousPrice: incoming.previousPrice ?? current.previousPrice,
        currentPrice: incoming.currentPrice,
        soldTimes: Math.max(current.soldTimes, incoming.soldTimes),
        sourceUpdatedAt: nextSourceUpdatedAt,
        syncedAt: incoming.syncedAt,
      };
      this.products[index] = merged;
      this.keys[index] = keysFor(merged);
    }
    this.touch();
  }

  search(query: string, limit: number, offset: number) {
    const term = normalizeSearchText(query);
    const looseTerm = term.replace(/ا/g, "");
    const matched: Array<{ product: CatalogProduct; score: number }> = [];
    this.products.forEach((product, index) => {
      const score = scoreOf(this.keys[index], term, looseTerm);
      if (score) matched.push({ product, score });
    });
    matched.sort((a, b) => b.score - a.score || b.product.sourceUpdatedAt - a.product.sourceUpdatedAt || b.product.soldTimes - a.product.soldTimes);
    return { items: matched.slice(offset, offset + limit).map((entry) => entry.product), total: matched.length };
  }

  changedPriceRows() {
    return this.products.filter((product) => product.previousPrice !== null && toNumber(product.previousPrice) !== toNumber(product.currentPrice));
  }

  listRecentPriceChanges(limit: number, offset: number, sort: LatestPriceSort) {
    const rows = this.changedPriceRows();
    if (sort === "largest_change") {
      rows.sort((a, b) => changeOf(b) - changeOf(a) || b.sourceUpdatedAt - a.sourceUpdatedAt);
    } else if (sort === "best_selling") {
      rows.sort((a, b) => b.soldTimes - a.soldTimes || b.sourceUpdatedAt - a.sourceUpdatedAt);
    } else {
      rows.sort(byUpdated);
    }
    return { items: rows.slice(offset, offset + limit), total: rows.length };
  }

  /** أحدث الأسعار بترتيب المصدر نفسه المستخدم في الـ feed الحيّ. */
  listFeed(offset: number, pages: number) {
    const start = Math.max(0, Math.trunc(offset));
    const size = FEED_PAGE_SIZE * Math.min(10, Math.max(1, Math.trunc(pages)));
    const items = [...this.products].sort(byUpdated).slice(start, start + size);
    return { items, offset: start, nextOffset: start + items.length, hasMore: start + size < this.products.length };
  }
}

const byUpdated = (a: { sourceUpdatedAt: number }, b: { sourceUpdatedAt: number }) => b.sourceUpdatedAt - a.sourceUpdatedAt;
const changeOf = (product: CatalogProduct) => Math.abs(toNumber(product.currentPrice)! - toNumber(product.previousPrice)!);

let catalogPromise: Promise<LocalCatalog> | null = null;

async function readDrugList(filePath: string) {
  const products: CatalogProduct[] = [];
  const parser = createReadStream(filePath, { encoding: "utf8" }).pipe(parse({ bom: true, relax_column_count: true, skip_empty_lines: true, relax_quotes: true, trim: true }));
  for await (const record of parser as AsyncIterable<string[]>) {
    const product = normalizeDrugListRecord(record);
    if (product) products.push(toProduct(product));
  }
  return products;
}

async function build() {
  const filePath = CANDIDATE_PATHS.find((candidate) => existsSync(candidate));
  if (!filePath) throw new Error("ملف دليل الأصناف druglist.csv غير موجود داخل المشروع.");
  const products = await readDrugList(filePath);
  const seen = new Set<string>();
  const unique = products.filter((product) => (seen.has(product.externalId) ? false : (seen.add(product.externalId), true)));
  return new LocalCatalog(filePath, unique);
}

/** يحمّل الملف مرة واحدة لكل عملية تشغيل ويشارك النتيجة بين كل الطلبات. */
export function getLocalCatalog() {
  if (!catalogPromise) catalogPromise = build().catch((error) => { catalogPromise = null; throw error; });
  return catalogPromise;
}

export async function localCatalogStatus() {
  const catalog = await getLocalCatalog();
  const changed = catalog.changedPriceRows().reduce((best, product) => Math.max(best, product.sourceUpdatedAt), 0);
  let fileModifiedAt: string | null = null;
  try {
    fileModifiedAt = statSync(catalog.filePath).mtime.toISOString();
  } catch {
    fileModifiedAt = null;
  }
  return {
    productCount: catalog.size,
    nextOffset: 0,
    isComplete: true,
    progress: 100,
    lastFullSyncAt: fileModifiedAt,
    lastLatestSyncAt: new Date(changed || catalog.lastRefreshedAt).toISOString(),
    lastError: null,
  };
}

export async function localSearchProducts(query: string, limit: number, offset: number) {
  const catalog = await getLocalCatalog();
  const { items, total } = catalog.search(query, limit, offset);
  return { items, total };
}

export async function localGetProduct(externalId: string) {
  const catalog = await getLocalCatalog();
  return catalog.get(externalId);
}

export async function localListRecentPriceChanges(limit: number, offset: number, sort: LatestPriceSort) {
  const catalog = await getLocalCatalog();
  return catalog.listRecentPriceChanges(limit, offset, sort);
}

export async function localListFeed(offset: number, pages: number) {
  const catalog = await getLocalCatalog();
  return catalog.listFeed(offset, pages);
}

export async function recordLiveCatalogPrices(products: InsertProductCatalog[]) {
  if (!products.length) return;
  const catalog = await getLocalCatalog();
  catalog.record(products);
}
