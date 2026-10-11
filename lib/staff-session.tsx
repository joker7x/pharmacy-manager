import * as Device from "expo-device";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { AppState, Platform } from "react-native";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import * as Auth from "@/lib/_core/auth";
import { trpc } from "@/lib/trpc";
import { STAFF_PERMISSIONS, type StaffPermission } from "@/lib/staff-access";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
  });
}

type StaffUser = {
  userId: number;
  username: string;
  displayName: string;
  role: "owner" | "pharmacist" | "cashier" | "viewer";
  permissions: StaffPermission[];
  status: "active" | "frozen" | "disabled";
};

type Credentials = { username: string; password: string; displayName?: string };
type StaffSessionValue = {
  configured: boolean | undefined;
  ready: boolean;
  staff: StaffUser | null;
  can: (permission: StaffPermission) => boolean;
  login: (credentials: Credentials) => Promise<void>;
  bootstrap: (credentials: Required<Credentials>) => Promise<void>;
  logout: () => Promise<void>;
  enablePhoneNotifications: () => Promise<string>;
  refresh: () => Promise<void>;
};

const StaffSessionContext = createContext<StaffSessionValue | null>(null);

// التطبيق مفتوح للتشغيل اليومي بدون إجبار المستخدم على إنشاء جلسة.
// تظل إدارة الأفراد وسجل التدقيق وإرسال الإشعارات الإدارية محمية بالجلسة.
const PUBLIC_PERMISSIONS = STAFF_PERMISSIONS.filter(
  (permission) => !["staff.manage", "audit.view", "notifications.send"].includes(permission),
);

export async function getStaffDevice() {
  const browserAgent = Platform.OS === "web" && typeof navigator !== "undefined" ? navigator.userAgent : undefined;
  return {
    deviceName: Device.deviceName ?? (Platform.OS === "web" ? "متصفح الويب" : "هاتف غير معروف"),
    devicePlatform: Platform.OS,
    deviceModel: Device.modelName ?? undefined,
    osVersion: Device.osVersion ?? undefined,
    appVersion: Constants.expoConfig?.version ?? undefined,
    userAgent: browserAgent,
  };
}

export function StaffSessionProvider({ children }: { children: ReactNode }) {
  const utils = trpc.useUtils();
  const [tokenReady, setTokenReady] = useState(false);
  const status = trpc.staff.status.useQuery(undefined, { retry: false });
  const me = trpc.staff.me.useQuery(undefined, { enabled: tokenReady, retry: false, refetchOnMount: true });
  const loginMutation = trpc.staff.login.useMutation();
  const bootstrapMutation = trpc.staff.bootstrap.useMutation();
  const logoutMutation = trpc.staff.logout.useMutation();
  const registerPushDevice = trpc.staff.registerPushDevice.useMutation();

  useEffect(() => { Auth.getSessionToken().finally(() => setTokenReady(true)); }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active" && tokenReady) void me.refetch(); });
    return () => subscription.remove();
  }, [me, tokenReady]);
  useEffect(() => {
    if (!me.data || Platform.OS === "web") return;
    const received = Notifications.addNotificationReceivedListener(() => { void utils.staff.notifications.invalidate(); });
    const opened = Notifications.addNotificationResponseReceivedListener(() => { void utils.staff.notifications.invalidate(); });
    return () => { received.remove(); opened.remove(); };
  }, [me.data, utils.staff.notifications]);

  const establish = useCallback(async (result: { token: string; profile: StaffUser }) => {
    await Auth.setSessionToken(result.token);
    await Auth.setUserInfo({ id: result.profile.userId, openId: `staff-${result.profile.userId}`, name: result.profile.displayName, email: null, loginMethod: "staff-password", lastSignedIn: new Date() });
    await utils.staff.me.invalidate();
    await me.refetch();
  }, [me, utils.staff.me]);

  const login = useCallback(async ({ username, password }: Credentials) => {
    const device = await getStaffDevice();
    const result = await loginMutation.mutateAsync({ username, password, device });
    await establish(result);
  }, [establish, loginMutation]);

  const bootstrap = useCallback(async ({ username, password, displayName }: Required<Credentials>) => {
    const device = await getStaffDevice();
    const result = await bootstrapMutation.mutateAsync({ username, password, displayName, device });
    await establish(result);
    await status.refetch();
  }, [bootstrapMutation, establish, status]);

  const logout = useCallback(async () => {
    try { await logoutMutation.mutateAsync(await getStaffDevice()); } catch { /* A revoked session may no longer reach the server. */ }
    await Auth.removeSessionToken();
    await Auth.clearUserInfo();
    utils.staff.me.setData(undefined, undefined);
    utils.staff.status.setData(undefined, undefined);
    await me.refetch();
  }, [logoutMutation, me, utils]);

  const enablePhoneNotifications = useCallback(async () => {
    if (Platform.OS === "web") throw new Error("إشعارات الهاتف لا تُفعّل من معاينة الويب. استخدم بناء Android أو iOS على جهاز فعلي.");
    if (!Device.isDevice) throw new Error("فعّل الإشعارات من هاتف فعلي أو محاكي يدعم خدمات Google Play.");
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", { name: "إشعارات صيدليتي", importance: Notifications.AndroidImportance.MAX, vibrationPattern: [0, 250, 250, 250], lightColor: "#22A67A" });
    }
    const existing = await Notifications.getPermissionsAsync();
    const permission = existing.status === "granted" ? existing : await Notifications.requestPermissionsAsync();
    if (permission.status !== "granted") throw new Error("لم يتم منح إذن إشعارات الهاتف. يمكنك تفعيله لاحقًا من إعدادات الهاتف.");
    const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) throw new Error("يلزم بناء تطوير مرتبط بمشروع Expo لتفعيل إشعارات الهاتف.");
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const device = await getStaffDevice();
    await registerPushDevice.mutateAsync({ ...device, expoPushToken: token, permissionStatus: "granted" });
    await utils.staff.pushStatus.invalidate();
    return "تم تفعيل إشعارات الهاتف لهذا الجهاز.";
  }, [registerPushDevice, utils.staff.pushStatus]);

  const value = useMemo<StaffSessionValue>(() => ({
    configured: status.data?.configured,
    ready: tokenReady && !status.isLoading && !me.isLoading,
    staff: me.data ?? null,
    can: (permission) => Boolean(me.data?.permissions.includes(permission) ?? PUBLIC_PERMISSIONS.includes(permission)),
    login,
    bootstrap,
    logout,
    enablePhoneNotifications,
    refresh: async () => { await Promise.all([status.refetch(), me.refetch()]); },
  }), [bootstrap, enablePhoneNotifications, login, me.data, me.isLoading, status, tokenReady, logout]);

  return <StaffSessionContext.Provider value={value}>{children}</StaffSessionContext.Provider>;
}

export function useStaffSession() {
  const context = useContext(StaffSessionContext);
  if (!context) throw new Error("useStaffSession يجب أن يُستخدم داخل StaffSessionProvider.");
  return context;
}
