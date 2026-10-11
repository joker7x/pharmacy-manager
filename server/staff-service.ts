import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, desc, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";

import { staffAuditLogs, staffNotifications, staffProfiles, staffPushDeliveries, staffPushDevices, staffSessions, users } from "../drizzle/schema";
import { chunkPushMessages, isExpoPushToken, type ExpoPushMessage } from "../lib/expo-push";
import { normalizePermissions, permissionsForRole, type StaffPermission, type StaffRole, type StaffStatus } from "../lib/staff-access";
import { getDb } from "./db";

const scrypt = promisify(scryptCallback);
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export type DeviceContext = {
  deviceName?: string;
  devicePlatform?: string;
  deviceModel?: string;
  osVersion?: string;
  appVersion?: string;
  userAgent?: string;
  networkAddress?: string | null;
};

export type PublicStaffProfile = {
  userId: number;
  username: string;
  displayName: string;
  role: StaffRole;
  permissions: StaffPermission[];
  status: StaffStatus;
  frozenUntil: Date | null;
  createdAt: Date;
  lastSignedIn: Date;
};

function requireDb(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) throw new Error("قاعدة بيانات إدارة المستخدمين غير متاحة حاليًا.");
  return db;
}

function cleanUsername(username: string) { return username.trim().toLowerCase(); }
function newOpenId() { return `staff_${randomBytes(18).toString("hex")}`; }
function newSessionId() { return `session_${randomBytes(18).toString("hex")}`; }
function safeDeviceName(input?: string) { return input?.trim().slice(0, 255) || "جهاز غير معروف"; }
function safePlatform(input?: string) { return input?.trim().slice(0, 64) || "unknown"; }

export function maskNetworkAddress(value: string | undefined | null) {
  if (!value) return null;
  const first = value.split(",")[0]?.trim() ?? "";
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(first)) return `${first.split(".").slice(0, 3).join(".")}.0`;
  const blocks = first.split(":");
  return blocks.length > 2 ? `${blocks.slice(0, 3).join(":")}::` : first.slice(0, 64);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, stored] = storedHash.split(":");
  if (algorithm !== "scrypt" || !salt || !stored) return false;
  const derived = await scrypt(password, salt, 64) as Buffer;
  const storedBuffer = Buffer.from(stored, "hex");
  return storedBuffer.length === derived.length && timingSafeEqual(storedBuffer, derived);
}

function serializeProfile(profile: typeof staffProfiles.$inferSelect, user: typeof users.$inferSelect): PublicStaffProfile {
  return {
    userId: profile.userId,
    username: profile.username,
    displayName: profile.displayName,
    role: profile.role as StaffRole,
    permissions: normalizePermissions(JSON.parse(profile.permissions || "[]")),
    status: profile.status as StaffStatus,
    frozenUntil: profile.frozenUntil,
    createdAt: profile.createdAt,
    lastSignedIn: user.lastSignedIn,
  };
}

export function isProfileActive(profile: Pick<PublicStaffProfile, "status" | "frozenUntil">, now = new Date()) {
  if (profile.status === "disabled") return false;
  if (profile.status === "frozen" && (!profile.frozenUntil || profile.frozenUntil > now)) return false;
  return true;
}

/** Returns frozen accounts to active once their admin-selected expiry has passed. */
export async function releaseExpiredFreezes(now = new Date()) {
  const db = requireDb(await getDb());
  const expired = await db.select({ userId: staffProfiles.userId, displayName: staffProfiles.displayName })
    .from(staffProfiles)
    .where(and(eq(staffProfiles.status, "frozen"), lte(staffProfiles.frozenUntil, now)));
  if (!expired.length) return 0;
  await db.update(staffProfiles).set({ status: "active", frozenUntil: null })
    .where(and(eq(staffProfiles.status, "frozen"), lte(staffProfiles.frozenUntil, now)));
  await Promise.all(expired.map((profile) => recordAudit({
    action: "staff.auto_unfrozen",
    entityType: "staff",
    entityId: String(profile.userId),
    detail: `أُعيد تفعيل حساب ${profile.displayName} تلقائيًا بعد انتهاء مدة التجميد.`,
    metadata: { reason: "freeze_expired" },
  })));
  return expired.length;
}

export async function hasStaffConfigured() {
  const db = requireDb(await getDb());
  const result = await db.select({ userId: staffProfiles.userId }).from(staffProfiles).limit(1);
  return result.length > 0;
}

export async function getProfileByUserId(userId: number) {
  await releaseExpiredFreezes();
  const db = requireDb(await getDb());
  const rows = await db.select({ profile: staffProfiles, user: users }).from(staffProfiles).innerJoin(users, eq(staffProfiles.userId, users.id)).where(eq(staffProfiles.userId, userId)).limit(1);
  return rows[0] ? serializeProfile(rows[0].profile, rows[0].user) : null;
}

export async function getStaffIdentity(userId: number) {
  const db = requireDb(await getDb());
  const [user] = await db.select({ openId: users.openId }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("لم يتم العثور على هوية حساب العامل.");
  return user;
}

export async function listProfiles() {
  await releaseExpiredFreezes();
  const db = requireDb(await getDb());
  const rows = await db.select({ profile: staffProfiles, user: users }).from(staffProfiles).innerJoin(users, eq(staffProfiles.userId, users.id)).orderBy(desc(staffProfiles.createdAt));
  return rows.map((row) => serializeProfile(row.profile, row.user));
}

export async function createStaff(input: { username: string; password: string; displayName: string; role: StaffRole; permissions?: StaffPermission[]; createdBy?: number }) {
  const db = requireDb(await getDb());
  const username = cleanUsername(input.username);
  const [duplicate] = await db.select({ userId: staffProfiles.userId }).from(staffProfiles).where(eq(staffProfiles.username, username)).limit(1);
  if (duplicate) throw new Error("اسم المستخدم مستخدم بالفعل.");
  const passwordHash = await hashPassword(input.password);
  const openId = newOpenId();
  await db.insert(users).values({ openId, name: input.displayName.trim(), email: null, loginMethod: "staff-password", role: input.role === "owner" ? "admin" : "user", lastSignedIn: new Date() });
  const [createdUser] = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  if (!createdUser) throw new Error("تعذر إنشاء حساب العامل.");
  const permissions = input.permissions?.length ? normalizePermissions(input.permissions) : permissionsForRole(input.role);
  await db.insert(staffProfiles).values({ userId: createdUser.id, username, passwordHash, displayName: input.displayName.trim(), role: input.role, permissions: JSON.stringify(permissions), createdBy: input.createdBy ?? null });
  const profile = await getProfileByUserId(createdUser.id);
  if (!profile) throw new Error("تعذر قراءة حساب العامل بعد إنشائه.");
  return profile;
}

export async function bootstrapOwner(input: { username: string; password: string; displayName: string }) {
  if (await hasStaffConfigured()) throw new Error("تم إعداد حساب مسؤول بالفعل. أنشئ الحسابات الجديدة من لوحة الإدارة.");
  return createStaff({ ...input, role: "owner", permissions: permissionsForRole("owner") });
}

export async function authenticateStaff(usernameInput: string, password: string) {
  await releaseExpiredFreezes();
  const db = requireDb(await getDb());
  const username = cleanUsername(usernameInput);
  const rows = await db.select({ profile: staffProfiles, user: users }).from(staffProfiles).innerJoin(users, eq(staffProfiles.userId, users.id)).where(eq(staffProfiles.username, username)).limit(1);
  const row = rows[0];
  if (!row || !(await verifyPassword(password, row.profile.passwordHash))) throw new Error("اسم المستخدم أو كلمة المرور غير صحيحين.");
  const profile = serializeProfile(row.profile, row.user);
  if (!isProfileActive(profile)) throw new Error(profile.status === "disabled" ? "هذا الحساب معطّل. راجع مسؤول الصيدلية." : "هذا الحساب مجمّد مؤقتًا. راجع مسؤول الصيدلية.");
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, profile.userId));
  return { profile: { ...profile, lastSignedIn: new Date() }, openId: row.user.openId };
}

export async function createStaffSession(userId: number, device: DeviceContext) {
  const db = requireDb(await getDb());
  const id = newSessionId();
  await db.insert(staffSessions).values({ id, userId, deviceName: safeDeviceName(device.deviceName), devicePlatform: safePlatform(device.devicePlatform), deviceModel: device.deviceModel?.slice(0, 128) ?? null, osVersion: device.osVersion?.slice(0, 64) ?? null, appVersion: device.appVersion?.slice(0, 64) ?? null, userAgent: device.userAgent?.slice(0, 512) ?? null, networkAddress: maskNetworkAddress(device.networkAddress), lastActiveAt: new Date() });
  return { id, expiresAt: new Date(Date.now() + SESSION_TTL_MS) };
}

export async function recordAudit(input: { actorUserId?: number | null; action: string; entityType: string; entityId?: string | null; detail: string; metadata?: Record<string, unknown>; device?: DeviceContext }) {
  const db = requireDb(await getDb());
  await db.insert(staffAuditLogs).values({ actorUserId: input.actorUserId ?? null, action: input.action.slice(0, 120), entityType: input.entityType.slice(0, 80), entityId: input.entityId?.slice(0, 128) ?? null, detail: input.detail.slice(0, 500), metadata: input.metadata ? JSON.stringify(input.metadata).slice(0, 20_000) : null, deviceName: input.device?.deviceName?.slice(0, 255) ?? null, networkAddress: maskNetworkAddress(input.device?.networkAddress) });
}

export async function updateStaffProfile(input: { actorUserId: number; userId: number; role?: StaffRole; permissions?: StaffPermission[]; status?: StaffStatus; frozenUntil?: Date | null }) {
  const db = requireDb(await getDb());
  if (input.actorUserId === input.userId && input.status && input.status !== "active") throw new Error("لا يمكنك تعطيل أو تجميد حسابك أثناء استخدامه.");
  const updates: Partial<typeof staffProfiles.$inferInsert> = {};
  if (input.role) updates.role = input.role;
  if (input.permissions) updates.permissions = JSON.stringify(normalizePermissions(input.permissions));
  if (input.status === "frozen") {
    if (!input.frozenUntil || input.frozenUntil.getTime() <= Date.now()) throw new Error("اختر مدة تجميد مستقبلية للحساب.");
    updates.status = "frozen";
    updates.frozenUntil = input.frozenUntil;
  } else if (input.status) { updates.status = input.status; updates.frozenUntil = null; }
  await db.update(staffProfiles).set(updates).where(eq(staffProfiles.userId, input.userId));
  const updated = await getProfileByUserId(input.userId);
  if (!updated) throw new Error("لم يتم العثور على حساب العامل.");
  await recordAudit({ actorUserId: input.actorUserId, action: "staff.updated", entityType: "staff", entityId: String(input.userId), detail: `تم تحديث حساب ${updated.displayName}.`, metadata: { role: input.role, status: input.status } });
  return updated;
}

export async function resetStaffPassword(actorUserId: number, userId: number, password: string) {
  const db = requireDb(await getDb());
  const passwordHash = await hashPassword(password);
  await db.update(staffProfiles).set({ passwordHash }).where(eq(staffProfiles.userId, userId));
  const profile = await getProfileByUserId(userId);
  if (!profile) throw new Error("لم يتم العثور على حساب العامل.");
  await recordAudit({ actorUserId, action: "staff.password_reset", entityType: "staff", entityId: String(userId), detail: `تمت إعادة تعيين كلمة مرور ${profile.displayName}.` });
  return { success: true };
}

export async function finishRecentSession(userId: number, deviceName?: string) {
  const db = requireDb(await getDb());
  const matching = deviceName ? and(eq(staffSessions.userId, userId), eq(staffSessions.deviceName, deviceName), isNull(staffSessions.signedOutAt)) : and(eq(staffSessions.userId, userId), isNull(staffSessions.signedOutAt));
  const recent = await db.select().from(staffSessions).where(matching).orderBy(desc(staffSessions.lastActiveAt)).limit(1);
  if (recent[0]) await db.update(staffSessions).set({ signedOutAt: new Date(), lastActiveAt: new Date() }).where(eq(staffSessions.id, recent[0].id));
}

export async function listSessions(limit = 80) {
  const db = requireDb(await getDb());
  const rows = await db.select({ session: staffSessions, profile: staffProfiles }).from(staffSessions).innerJoin(staffProfiles, eq(staffSessions.userId, staffProfiles.userId)).orderBy(desc(staffSessions.lastActiveAt)).limit(limit);
  return rows.map(({ session, profile }) => ({ ...session, displayName: profile.displayName, username: profile.username }));
}

export async function listAudits(limit = 120) {
  const db = requireDb(await getDb());
  const rows = await db.select({ audit: staffAuditLogs, profile: staffProfiles }).from(staffAuditLogs).leftJoin(staffProfiles, eq(staffAuditLogs.actorUserId, staffProfiles.userId)).orderBy(desc(staffAuditLogs.createdAt)).limit(limit);
  return rows.map(({ audit, profile }) => ({ ...audit, actorName: profile?.displayName ?? "النظام" }));
}

export async function createNotifications(input: { senderId: number; title: string; body: string; route?: string | null; target: { type: "all" | "role" | "user"; role?: StaffRole; userId?: number } }) {
  await releaseExpiredFreezes();
  const db = requireDb(await getDb());
  let recipients: Array<{ userId: number }> = [];
  const activeFilter = and(eq(staffProfiles.status, "active"), or(isNull(staffProfiles.frozenUntil), gt(staffProfiles.frozenUntil, new Date())));
  if (input.target.type === "user" && input.target.userId) recipients = await db.select({ userId: staffProfiles.userId }).from(staffProfiles).where(and(activeFilter, eq(staffProfiles.userId, input.target.userId)));
  else if (input.target.type === "role" && input.target.role) recipients = await db.select({ userId: staffProfiles.userId }).from(staffProfiles).where(and(activeFilter, eq(staffProfiles.role, input.target.role)));
  else recipients = await db.select({ userId: staffProfiles.userId }).from(staffProfiles).where(activeFilter);
  if (!recipients.length) throw new Error("لا يوجد مستخدمون نشطون لاستلام الإشعار.");
  const created = [] as Array<{ id: number; userId: number }>;
  for (const recipient of recipients) {
    const result = await db.insert(staffNotifications).values({ recipientUserId: recipient.userId, sentByUserId: input.senderId, title: input.title.trim(), body: input.body.trim(), route: input.route?.trim() || null });
    created.push({ id: Number(result[0].insertId), userId: recipient.userId });
  }
  await recordAudit({ actorUserId: input.senderId, action: "notification.sent", entityType: "notification", detail: `تم إرسال إشعار إلى ${recipients.length} مستخدم/مستخدمين.`, metadata: { target: input.target.type, recipients: recipients.length } });
  return { recipients: recipients.length, notifications: created };
}

export type PushRegistration = DeviceContext & { expoPushToken: string; permissionStatus: "granted" | "denied" | "undetermined" };

export async function registerPushDevice(userId: number, input: PushRegistration) {
  const db = requireDb(await getDb());
  if (!isExpoPushToken(input.expoPushToken)) throw new Error("رمز إشعار الهاتف غير صالح.");
  const now = new Date();
  await db.insert(staffPushDevices).values({
    userId,
    expoPushToken: input.expoPushToken,
    deviceName: safeDeviceName(input.deviceName),
    devicePlatform: safePlatform(input.devicePlatform),
    deviceModel: input.deviceModel?.slice(0, 128) ?? null,
    osVersion: input.osVersion?.slice(0, 64) ?? null,
    appVersion: input.appVersion?.slice(0, 64) ?? null,
    permissionStatus: input.permissionStatus,
    isEnabled: input.permissionStatus === "granted",
    lastRegisteredAt: now,
    invalidatedAt: null,
  }).onDuplicateKeyUpdate({ set: {
    userId, deviceName: safeDeviceName(input.deviceName), devicePlatform: safePlatform(input.devicePlatform), deviceModel: input.deviceModel?.slice(0, 128) ?? null, osVersion: input.osVersion?.slice(0, 64) ?? null, appVersion: input.appVersion?.slice(0, 64) ?? null, permissionStatus: input.permissionStatus, isEnabled: input.permissionStatus === "granted", lastRegisteredAt: now, invalidatedAt: null,
  } });
  await recordAudit({ actorUserId: userId, action: "push.registered", entityType: "push_device", detail: `تم تفعيل إشعارات الهاتف على ${safeDeviceName(input.deviceName)}.`, metadata: { platform: input.devicePlatform, model: input.deviceModel } });
  return getPushStatus(userId);
}

export async function getPushStatus(userId: number) {
  const db = requireDb(await getDb());
  const rows = await db.select().from(staffPushDevices).where(eq(staffPushDevices.userId, userId)).orderBy(desc(staffPushDevices.lastRegisteredAt));
  return {
    enabledDevices: rows.filter((row) => row.isEnabled && row.permissionStatus === "granted" && !row.invalidatedAt).length,
    devices: rows.map((row) => ({ id: row.id, deviceName: row.deviceName, devicePlatform: row.devicePlatform, deviceModel: row.deviceModel, osVersion: row.osVersion, appVersion: row.appVersion, permissionStatus: row.permissionStatus, isEnabled: row.isEnabled, lastRegisteredAt: row.lastRegisteredAt, lastDeliveredAt: row.lastDeliveredAt })),
  };
}

export async function listPushDevices() {
  const db = requireDb(await getDb());
  const rows = await db.select({ device: staffPushDevices, profile: staffProfiles }).from(staffPushDevices).innerJoin(staffProfiles, eq(staffPushDevices.userId, staffProfiles.userId)).orderBy(desc(staffPushDevices.lastRegisteredAt));
  return rows.map(({ device, profile }) => ({ ...device, displayName: profile.displayName, username: profile.username }));
}

export async function deliverPushNotifications(input: { senderId: number; title: string; body: string; route?: string | null; notifications: Array<{ id: number; userId: number }> }) {
  const db = requireDb(await getDb());
  if (!input.notifications.length) return { attempted: 0, accepted: 0, failed: 0 };
  const recipientIds = [...new Set(input.notifications.map((item) => item.userId))];
  const devices = await db.select().from(staffPushDevices).where(and(inArray(staffPushDevices.userId, recipientIds), eq(staffPushDevices.isEnabled, true), eq(staffPushDevices.permissionStatus, "granted"), isNull(staffPushDevices.invalidatedAt)));
  const notificationForUser = new Map(input.notifications.map((item) => [item.userId, item.id]));
  const targets = devices.filter((device) => isExpoPushToken(device.expoPushToken)).map((device) => ({ device, notificationId: notificationForUser.get(device.userId)! }));
  if (!targets.length) return { attempted: 0, accepted: 0, failed: 0 };
  let accepted = 0;
  let failed = 0;
  for (const chunk of chunkPushMessages(targets, 100)) {
    const messages: ExpoPushMessage[] = chunk.map(({ device }) => ({ to: device.expoPushToken, title: input.title, body: input.body, sound: "default", priority: "high", data: input.route ? { route: input.route } : undefined }));
    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", { method: "POST", headers: { Accept: "application/json", "Accept-Encoding": "gzip, deflate", "Content-Type": "application/json" }, body: JSON.stringify(messages) });
      const payload = await response.json().catch(() => ({})) as { data?: Array<{ status?: string; id?: string; message?: string; details?: { error?: string } }> };
      for (const [index, target] of chunk.entries()) {
        const ticket = payload.data?.[index];
        const ok = response.ok && ticket?.status === "ok";
        if (ok) { accepted += 1; await db.update(staffPushDevices).set({ lastDeliveredAt: new Date() }).where(eq(staffPushDevices.id, target.device.id)); }
        else { failed += 1; if (ticket?.details?.error === "DeviceNotRegistered") await db.update(staffPushDevices).set({ isEnabled: false, invalidatedAt: new Date() }).where(eq(staffPushDevices.id, target.device.id)); }
        await db.insert(staffPushDeliveries).values({ notificationId: target.notificationId, pushDeviceId: target.device.id, recipientUserId: target.device.userId, status: ok ? "accepted" : "failed", ticketId: ticket?.id ?? null, errorMessage: ok ? null : (ticket?.message ?? `تعذر إرسال الطلب (${response.status}).`).slice(0, 500) });
      }
    } catch (error) {
      failed += chunk.length;
      const message = error instanceof Error ? error.message.slice(0, 500) : "تعذر الاتصال بخدمة الإشعارات.";
      await db.insert(staffPushDeliveries).values(chunk.map(({ device, notificationId }) => ({ notificationId, pushDeviceId: device.id, recipientUserId: device.userId, status: "failed" as const, errorMessage: message })));
    }
  }
  await recordAudit({ actorUserId: input.senderId, action: "push.sent", entityType: "push_notification", detail: `تم طلب إرسال إشعار هاتفي إلى ${targets.length} جهاز/أجهزة.`, metadata: { accepted, failed, devices: targets.length } });
  return { attempted: targets.length, accepted, failed };
}

export async function listNotifications(userId: number) {
  const db = requireDb(await getDb());
  return db.select().from(staffNotifications).where(eq(staffNotifications.recipientUserId, userId)).orderBy(desc(staffNotifications.createdAt)).limit(100);
}

export async function markNotificationRead(userId: number, notificationId: number) {
  const db = requireDb(await getDb());
  await db.update(staffNotifications).set({ readAt: new Date() }).where(and(eq(staffNotifications.id, notificationId), eq(staffNotifications.recipientUserId, userId)));
}

export function getSessionTtl() { return SESSION_TTL_MS; }
