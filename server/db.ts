import { and, count, desc, eq, isNotNull, like, ne, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { catalogSyncState, InsertProductCatalog, InsertUser, productCatalog, users } from "../drizzle/schema";
import { localCatalogStatus, localGetProduct, localListRecentPriceChanges, localSearchProducts, recordLiveCatalogPrices, type LatestPriceSort } from "./local-catalog";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

const CATALOG_STATE_ID = "dwaprices";

export async function getCatalogStatus() {
  const db = await getDb();
  if (!db) return localCatalogStatus();
  const [summary] = await db.select({ total: count() }).from(productCatalog);
  const [state] = await db.select().from(catalogSyncState).where(eq(catalogSyncState.id, CATALOG_STATE_ID)).limit(1);
  const nextOffset = state?.nextOffset ?? 0;
  return {
    productCount: Number(summary?.total ?? 0),
    nextOffset,
    isComplete: state?.isComplete ?? false,
    progress: state?.isComplete ? 100 : Math.min(100, Math.round((nextOffset / 60_000) * 100)),
    lastFullSyncAt: state?.lastFullSyncAt?.toISOString() ?? null,
    lastLatestSyncAt: state?.lastLatestSyncAt?.toISOString() ?? null,
    lastError: state?.lastError ?? null,
  };
}

export async function upsertCatalogProducts(products: InsertProductCatalog[]) {
  if (!products.length) return;
  const db = await getDb();
  // بدون قاعدة بيانات يُدمج ما يجيء من المصدر الحيّ فوق صفوف ملف الدليل نفس المعرف.
  if (!db) return recordLiveCatalogPrices(products);
  const syncedAt = new Date();
  await db.insert(productCatalog).values(products.map((product) => ({ ...product, syncedAt }))).onDuplicateKeyUpdate({
    set: {
      name: sql`VALUES(${productCatalog.name})`,
      arabicName: sql`VALUES(${productCatalog.arabicName})`,
      currentPrice: sql`VALUES(${productCatalog.currentPrice})`,
      previousPrice: sql`COALESCE(VALUES(${productCatalog.previousPrice}), ${productCatalog.previousPrice})`,
      soldTimes: sql`VALUES(${productCatalog.soldTimes})`,
      activeIngredient: sql`COALESCE(VALUES(${productCatalog.activeIngredient}), ${productCatalog.activeIngredient})`,
      imagePath: sql`COALESCE(VALUES(${productCatalog.imagePath}), ${productCatalog.imagePath})`,
      category: sql`COALESCE(VALUES(${productCatalog.category}), ${productCatalog.category})`,
      company: sql`COALESCE(VALUES(${productCatalog.company}), ${productCatalog.company})`,
      dosageForm: sql`COALESCE(VALUES(${productCatalog.dosageForm}), ${productCatalog.dosageForm})`,
      barcode: sql`COALESCE(VALUES(${productCatalog.barcode}), ${productCatalog.barcode})`,
      administrationRoute: sql`COALESCE(VALUES(${productCatalog.administrationRoute}), ${productCatalog.administrationRoute})`,
      description: sql`COALESCE(VALUES(${productCatalog.description}), ${productCatalog.description})`,
      sourceUpdatedAt: sql`GREATEST(VALUES(${productCatalog.sourceUpdatedAt}), ${productCatalog.sourceUpdatedAt})`,
      syncedAt,
    },
  });
}

export async function saveCatalogSyncState(input: {
  nextOffset: number;
  isComplete: boolean;
  lastFullSyncAt?: Date;
  lastLatestSyncAt?: Date;
  lastError?: string | null;
}) {
  const db = await getDb();
  // حالة الدليل المحلي تُشتق من ملف druglist.csv نفسه فلا حاجة لتخزينها.
  if (!db) return;
  const updatedAt = new Date();
  await db.insert(catalogSyncState).values({ id: CATALOG_STATE_ID, ...input, updatedAt }).onDuplicateKeyUpdate({
    set: { ...input, updatedAt },
  });
}

export async function searchCatalogProducts(query: string, limit: number, offset: number) {
  const db = await getDb();
  if (!db) return localSearchProducts(query, limit, offset);
  const term = `%${query.trim()}%`;
  const filter = or(
    like(productCatalog.arabicName, term),
    like(productCatalog.name, term),
    like(productCatalog.externalId, term),
    like(productCatalog.barcode, term),
    like(productCatalog.company, term),
    like(productCatalog.category, term),
    like(productCatalog.activeIngredient, term),
  );
  const [summary] = await db.select({ total: count() }).from(productCatalog).where(filter);
  const items = await db.select().from(productCatalog).where(filter).orderBy(desc(productCatalog.sourceUpdatedAt)).limit(limit).offset(offset);
  return { items, total: Number(summary?.total ?? 0) };
}

export async function getCatalogProduct(externalId: string) {
  const db = await getDb();
  if (!db) return localGetProduct(externalId);
  const [product] = await db.select().from(productCatalog).where(eq(productCatalog.externalId, externalId)).limit(1);
  return product ?? null;
}

export async function updateCatalogPackageUnits(products: Array<Pick<InsertProductCatalog, "externalId" | "unitsPerPackage">>) {
  if (!products.length) return;
  const db = await getDb();
  // عدد الوحدات لكل عبوة يأتي مع صفوف الملف فلا حاجة لتحديث إضافي بدونه.
  if (!db) return;
  await db.insert(productCatalog).values(products.map((product) => ({
    externalId: product.externalId,
    name: "",
    arabicName: "",
    currentPrice: "0.00",
    soldTimes: 0,
    sourceUpdatedAt: 0,
    unitsPerPackage: Math.max(1, product.unitsPerPackage ?? 1),
  }))).onDuplicateKeyUpdate({ set: { unitsPerPackage: sql`GREATEST(VALUES(${productCatalog.unitsPerPackage}), 1)` } });
}

export type { LatestPriceSort } from "./local-catalog";

export async function listRecentPriceChanges(limit: number, offset: number, sort: LatestPriceSort) {
  const db = await getDb();
  if (!db) return localListRecentPriceChanges(limit, offset, sort);
  const changedPrice = and(isNotNull(productCatalog.previousPrice), ne(productCatalog.previousPrice, productCatalog.currentPrice));
  const [summary] = await db.select({ total: count() }).from(productCatalog).where(changedPrice);
  const total = Number(summary?.total ?? 0);
  if (sort === "largest_change") {
    const items = await db.select().from(productCatalog).where(changedPrice).orderBy(desc(sql`ABS(${productCatalog.currentPrice} - ${productCatalog.previousPrice})`), desc(productCatalog.sourceUpdatedAt)).limit(limit).offset(offset);
    return { items, total };
  }
  if (sort === "best_selling") {
    const items = await db.select().from(productCatalog).where(changedPrice).orderBy(desc(productCatalog.soldTimes), desc(productCatalog.sourceUpdatedAt)).limit(limit).offset(offset);
    return { items, total };
  }
  const items = await db.select().from(productCatalog).where(changedPrice).orderBy(desc(productCatalog.sourceUpdatedAt)).limit(limit).offset(offset);
  return { items, total };
}
