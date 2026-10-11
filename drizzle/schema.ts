import { bigint, boolean, decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const staffProfiles = mysqlTable("staff_profiles", {
  userId: int("userId").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  displayName: varchar("displayName", { length: 160 }).notNull(),
  role: mysqlEnum("role", ["owner", "pharmacist", "cashier", "viewer"]).notNull().default("cashier"),
  permissions: text("permissions").notNull(),
  status: mysqlEnum("status", ["active", "frozen", "disabled"]).notNull().default("active"),
  frozenUntil: timestamp("frozenUntil"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("staff_profiles_status_idx").on(table.status), index("staff_profiles_role_idx").on(table.role)]);

export const staffSessions = mysqlTable("staff_sessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  deviceName: varchar("deviceName", { length: 255 }).notNull(),
  devicePlatform: varchar("devicePlatform", { length: 64 }).notNull(),
  deviceModel: varchar("deviceModel", { length: 128 }),
  osVersion: varchar("osVersion", { length: 64 }),
  appVersion: varchar("appVersion", { length: 64 }),
  userAgent: varchar("userAgent", { length: 512 }),
  networkAddress: varchar("networkAddress", { length: 96 }),
  lastActiveAt: timestamp("lastActiveAt").defaultNow().notNull(),
  signedOutAt: timestamp("signedOutAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("staff_sessions_user_idx").on(table.userId), index("staff_sessions_last_active_idx").on(table.lastActiveAt)]);

/** الأجهزة التي منحت إذن إشعارات الهاتف؛ لا يخزّن النظام معرّفًا دائمًا للجهاز. */
export const staffPushDevices = mysqlTable("staff_push_devices", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expoPushToken: varchar("expoPushToken", { length: 255 }).notNull().unique(),
  deviceName: varchar("deviceName", { length: 255 }).notNull(),
  devicePlatform: varchar("devicePlatform", { length: 64 }).notNull(),
  deviceModel: varchar("deviceModel", { length: 128 }),
  osVersion: varchar("osVersion", { length: 64 }),
  appVersion: varchar("appVersion", { length: 64 }),
  permissionStatus: mysqlEnum("permissionStatus", ["granted", "denied", "undetermined"]).notNull().default("undetermined"),
  isEnabled: boolean("isEnabled").notNull().default(true),
  lastRegisteredAt: timestamp("lastRegisteredAt").defaultNow().notNull(),
  lastDeliveredAt: timestamp("lastDeliveredAt"),
  invalidatedAt: timestamp("invalidatedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("staff_push_user_idx").on(table.userId), index("staff_push_enabled_idx").on(table.isEnabled)]);

export const staffAuditLogs = mysqlTable("staff_audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  actorUserId: int("actorUserId").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 120 }).notNull(),
  entityType: varchar("entityType", { length: 80 }).notNull(),
  entityId: varchar("entityId", { length: 128 }),
  detail: varchar("detail", { length: 500 }).notNull(),
  metadata: text("metadata"),
  deviceName: varchar("deviceName", { length: 255 }),
  networkAddress: varchar("networkAddress", { length: 96 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("staff_audit_actor_idx").on(table.actorUserId), index("staff_audit_created_idx").on(table.createdAt)]);

export const staffNotifications = mysqlTable("staff_notifications", {
  id: int("id").autoincrement().primaryKey(),
  recipientUserId: int("recipientUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  sentByUserId: int("sentByUserId").references(() => users.id, { onDelete: "set null" }),
  title: varchar("title", { length: 120 }).notNull(),
  body: varchar("body", { length: 500 }).notNull(),
  route: varchar("route", { length: 255 }),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("staff_notifications_recipient_idx").on(table.recipientUserId), index("staff_notifications_created_idx").on(table.createdAt)]);

/** حالة تسليم كل إشعار هاتفي، حتى تميّز لوحة المسؤول بين الصندوق الداخلي وطلب Push. */
export const staffPushDeliveries = mysqlTable("staff_push_deliveries", {
  id: int("id").autoincrement().primaryKey(),
  notificationId: int("notificationId").references(() => staffNotifications.id, { onDelete: "set null" }),
  pushDeviceId: int("pushDeviceId").references(() => staffPushDevices.id, { onDelete: "set null" }),
  recipientUserId: int("recipientUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: mysqlEnum("status", ["accepted", "failed", "skipped"]).notNull().default("skipped"),
  ticketId: varchar("ticketId", { length: 128 }),
  errorMessage: varchar("errorMessage", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("staff_push_delivery_recipient_idx").on(table.recipientUserId), index("staff_push_delivery_notification_idx").on(table.notificationId)]);

export type StaffProfile = typeof staffProfiles.$inferSelect;
export type InsertStaffProfile = typeof staffProfiles.$inferInsert;

export const productCatalog = mysqlTable("product_catalog", {
  externalId: varchar("externalId", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 512 }).notNull(),
  arabicName: varchar("arabicName", { length: 512 }).notNull(),
  currentPrice: decimal("currentPrice", { precision: 12, scale: 2 }).notNull(),
  previousPrice: decimal("previousPrice", { precision: 12, scale: 2 }),
  soldTimes: int("soldTimes").notNull().default(0),
  activeIngredient: text("activeIngredient"),
  imagePath: varchar("imagePath", { length: 512 }),
  category: varchar("category", { length: 255 }),
  company: varchar("company", { length: 255 }),
  dosageForm: varchar("dosageForm", { length: 128 }),
  unitsPerPackage: int("unitsPerPackage").notNull().default(1),
  barcode: varchar("barcode", { length: 128 }),
  administrationRoute: varchar("administrationRoute", { length: 128 }),
  description: text("description"),
  sourceUpdatedAt: bigint("sourceUpdatedAt", { mode: "number" }).notNull(),
  syncedAt: timestamp("syncedAt").defaultNow().notNull(),
}, (table) => [
  index("product_catalog_name_idx").on(table.name),
  index("product_catalog_arabic_name_idx").on(table.arabicName),
  index("product_catalog_barcode_idx").on(table.barcode),
  index("product_catalog_company_idx").on(table.company),
  index("product_catalog_updated_idx").on(table.sourceUpdatedAt),
]);

export const catalogSyncState = mysqlTable("catalog_sync_state", {
  id: varchar("id", { length: 40 }).primaryKey(),
  nextOffset: int("nextOffset").notNull().default(0),
  isComplete: boolean("isComplete").notNull().default(false),
  lastFullSyncAt: timestamp("lastFullSyncAt"),
  lastLatestSyncAt: timestamp("lastLatestSyncAt"),
  lastError: varchar("lastError", { length: 512 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductCatalog = typeof productCatalog.$inferSelect;
export type InsertProductCatalog = typeof productCatalog.$inferInsert;
