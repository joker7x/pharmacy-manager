import { z } from "zod";

import { COOKIE_NAME } from "../shared/const";
import { normalizePermissions, type StaffPermission, type StaffRole, type StaffStatus } from "../lib/staff-access";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, staffAdminProcedure, staffProcedure } from "./_core/trpc";
import * as catalogService from "./dwaprices";
import * as db from "./db";
import * as staff from "./staff-service";

const roleSchema = z.enum(["owner", "pharmacist", "cashier", "viewer"]);
const statusSchema = z.enum(["active", "frozen", "disabled"]);
const permissionSchema = z.enum(["sales.use", "inventory.view", "inventory.adjust", "orders.manage", "expenses.manage", "shifts.manage", "reports.view", "staff.manage", "audit.view", "notifications.send"]);
const credentialSchema = z.object({
  username: z.string().trim().min(3, "اسم المستخدم لا يقل عن 3 أحرف.").max(64).regex(/^[a-zA-Z0-9_.-]+$/, "استخدم حروفًا إنجليزية أو أرقامًا أو . _ - فقط."),
  password: z.string().min(8, "كلمة المرور لا تقل عن 8 أحرف.").max(128),
  displayName: z.string().trim().min(2).max(160),
});
const rawDeviceSchema = z.object({
  deviceName: z.string().trim().max(255).optional(),
  devicePlatform: z.string().trim().max(64).optional(),
  deviceModel: z.string().trim().max(128).optional(),
  osVersion: z.string().trim().max(64).optional(),
  appVersion: z.string().trim().max(64).optional(),
  userAgent: z.string().trim().max(512).optional(),
});
const deviceSchema = rawDeviceSchema.default({});

type DeviceInput = z.infer<typeof deviceSchema>;
type RequestWithHeaders = { headers: Record<string, string | string[] | undefined> };

function deviceWithNetwork(req: RequestWithHeaders, device: DeviceInput) {
  const forwarded = req.headers["x-forwarded-for"];
  const networkAddress = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return { ...device, networkAddress };
}

async function issueStaffSession(userId: number, displayName: string, device: DeviceInput, req: RequestWithHeaders) {
  const identity = await staff.getStaffIdentity(userId);
  const [token] = await Promise.all([
    sdk.createSessionToken(identity.openId, { name: displayName, expiresInMs: staff.getSessionTtl() }),
    staff.createStaffSession(userId, deviceWithNetwork(req, device)),
  ]);
  return token;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  staff: router({
    status: publicProcedure.query(async () => ({ configured: await staff.hasStaffConfigured() })),
    bootstrap: publicProcedure.input(credentialSchema.extend({ device: deviceSchema })).mutation(async ({ input, ctx }) => {
      const profile = await staff.bootstrapOwner(input);
      const token = await issueStaffSession(profile.userId, profile.displayName, input.device, ctx.req);
      await staff.recordAudit({ actorUserId: profile.userId, action: "staff.bootstrap", entityType: "staff", entityId: String(profile.userId), detail: "تم إعداد حساب مسؤول الصيدلية لأول مرة.", device: deviceWithNetwork(ctx.req, input.device) });
      return { token, profile };
    }),
    login: publicProcedure.input(z.object({ username: z.string().trim().min(3).max(64), password: z.string().min(1).max(128), device: deviceSchema })).mutation(async ({ input, ctx }) => {
      const authenticated = await staff.authenticateStaff(input.username, input.password);
      const token = await issueStaffSession(authenticated.profile.userId, authenticated.profile.displayName, input.device, ctx.req);
      await staff.recordAudit({ actorUserId: authenticated.profile.userId, action: "session.signed_in", entityType: "session", detail: "تم تسجيل الدخول إلى التطبيق.", device: deviceWithNetwork(ctx.req, input.device) });
      return { token, profile: authenticated.profile };
    }),
    me: staffProcedure.query(async ({ ctx }) => {
      const profile = await staff.getProfileByUserId(ctx.user!.id);
      if (!profile) throw new Error("لم يتم العثور على ملف العامل.");
      return profile;
    }),
    logout: staffProcedure.input(deviceSchema).mutation(async ({ ctx, input }) => {
      await staff.finishRecentSession(ctx.user!.id, input.deviceName);
      await staff.recordAudit({ actorUserId: ctx.user!.id, action: "session.signed_out", entityType: "session", detail: "تم تسجيل الخروج من التطبيق.", device: deviceWithNetwork(ctx.req, input) });
      return { success: true };
    }),
    list: staffAdminProcedure.query(() => staff.listProfiles()),
    create: staffAdminProcedure.input(credentialSchema.extend({ role: roleSchema.default("cashier"), permissions: z.array(permissionSchema).optional() })).mutation(async ({ input, ctx }) => {
      const profile = await staff.createStaff({ ...input, role: input.role as StaffRole, permissions: input.permissions as StaffPermission[] | undefined, createdBy: ctx.user!.id });
      await staff.recordAudit({ actorUserId: ctx.user!.id, action: "staff.created", entityType: "staff", entityId: String(profile.userId), detail: `تم إنشاء حساب ${profile.displayName}.`, metadata: { role: profile.role } });
      return profile;
    }),
    resetPassword: staffAdminProcedure.input(z.object({ userId: z.number().int().positive(), password: z.string().min(8, "كلمة المرور لا تقل عن 8 أحرف.").max(128) })).mutation(({ input, ctx }) => staff.resetStaffPassword(ctx.user!.id, input.userId, input.password)),
    update: staffAdminProcedure.input(z.object({ userId: z.number().int().positive(), role: roleSchema.optional(), permissions: z.array(permissionSchema).optional(), status: statusSchema.optional(), frozenUntil: z.date().nullable().optional() })).mutation(({ input, ctx }) => staff.updateStaffProfile({ actorUserId: ctx.user!.id, userId: input.userId, role: input.role as StaffRole | undefined, permissions: input.permissions ? normalizePermissions(input.permissions) : undefined, status: input.status as StaffStatus | undefined, frozenUntil: input.frozenUntil })),
    sessions: staffAdminProcedure.query(() => staff.listSessions()),
    audits: staffAdminProcedure.query(async ({ ctx }) => {
      const profile = await staff.getProfileByUserId(ctx.user!.id);
      if (!profile?.permissions.includes("audit.view")) throw new Error("لا تملك صلاحية عرض سجل النشاط.");
      return staff.listAudits();
    }),
    logAction: staffProcedure.input(z.object({ action: z.string().trim().min(3).max(120), entityType: z.string().trim().min(2).max(80), entityId: z.string().trim().max(128).optional(), detail: z.string().trim().min(2).max(500), metadata: z.record(z.string(), z.unknown()).optional(), device: deviceSchema })).mutation(async ({ input, ctx }) => {
      await staff.recordAudit({ actorUserId: ctx.user!.id, action: input.action, entityType: input.entityType, entityId: input.entityId, detail: input.detail, metadata: input.metadata, device: deviceWithNetwork(ctx.req, input.device) });
      return { success: true };
    }),
    notifications: staffProcedure.query(({ ctx }) => staff.listNotifications(ctx.user!.id)),
    markNotificationRead: staffProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input, ctx }) => staff.markNotificationRead(ctx.user!.id, input.id)),
    pushStatus: staffProcedure.query(({ ctx }) => staff.getPushStatus(ctx.user!.id)),
    registerPushDevice: staffProcedure.input(rawDeviceSchema.extend({ expoPushToken: z.string().trim().min(10).max(255), permissionStatus: z.enum(["granted", "denied", "undetermined"]) })).mutation(({ input, ctx }) => staff.registerPushDevice(ctx.user!.id, input)),
    pushDevices: staffAdminProcedure.query(() => staff.listPushDevices()),
    sendNotification: staffProcedure.input(z.object({ title: z.string().trim().min(2).max(120), body: z.string().trim().min(2).max(500), route: z.string().trim().max(255).optional(), target: z.object({ type: z.enum(["all", "role", "user"]), role: roleSchema.optional(), userId: z.number().int().positive().optional() }) })).mutation(async ({ input, ctx }) => {
      const profile = await staff.getProfileByUserId(ctx.user!.id);
      if (!profile?.permissions.includes("notifications.send")) throw new Error("لا تملك صلاحية إرسال الإشعارات.");
      const created = await staff.createNotifications({ senderId: ctx.user!.id, ...input, target: { ...input.target, role: input.target.role as StaffRole | undefined } });
      const push = await staff.deliverPushNotifications({ senderId: ctx.user!.id, title: input.title, body: input.body, route: input.route, notifications: created.notifications });
      return { recipients: created.recipients, push };
    }),
  }),
  catalog: router({
    // الحالة التفصيلية تحتاج قاعدة بيانات الدليل؛ بدونها نُرجع صفرًا
    // ويبقى الـ feed المباشر هو المصدر الوحيد للعرض.
    status: publicProcedure.query(async () => {
      try {
        return await db.getCatalogStatus();
      } catch {
        return { productCount: 0, nextOffset: 0, isComplete: false, progress: 0, lastFullSyncAt: null, lastLatestSyncAt: null, lastError: null };
      }
    }),
    product: publicProcedure.input(z.object({ externalId: z.string().trim().min(1).max(64) })).query(({ input }) => db.getCatalogProduct(input.externalId)),
    search: publicProcedure.input(z.object({ query: z.string().trim().min(2).max(120), limit: z.number().int().min(1).max(100).default(100), offset: z.number().int().min(0).max(100_000).default(0) })).query(({ input }) => db.searchCatalogProducts(input.query, input.limit, input.offset)),
    latest: publicProcedure.input(z.object({ limit: z.number().int().min(1).max(100).default(100), offset: z.number().int().min(0).max(100_000).default(0), sort: z.enum(["latest", "largest_change", "best_selling"]).default("latest") })).query(({ input }) => db.listRecentPriceChanges(input.limit, input.offset, input.sort)),
    latestFeed: publicProcedure.input(z.object({ offset: z.number().int().min(0).max(100_000).default(0), pages: z.number().int().min(1).max(10).default(10) })).query(({ input }) => catalogService.fetchLatestPriceFeed(input.offset, input.pages)),
    syncNextBatch: publicProcedure.input(z.object({ maxPages: z.number().int().min(1).max(20).default(20) })).mutation(({ input }) => catalogService.syncCatalogBatch(input.maxPages)),
    refreshLatest: publicProcedure.mutation(() => catalogService.refreshLatestPrices()),
  }),
});

export type AppRouter = typeof appRouter;
