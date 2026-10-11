export const STAFF_PERMISSIONS = [
  "sales.use",
  "inventory.view",
  "inventory.adjust",
  "orders.manage",
  "expenses.manage",
  "shifts.manage",
  "reports.view",
  "staff.manage",
  "audit.view",
  "notifications.send",
] as const;

export type StaffPermission = (typeof STAFF_PERMISSIONS)[number];
export type StaffRole = "owner" | "pharmacist" | "cashier" | "viewer";
export type StaffStatus = "active" | "frozen" | "disabled";

export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: "مالك الصيدلية",
  pharmacist: "صيدلي",
  cashier: "كاشير",
  viewer: "مراجعة فقط",
};

export const STATUS_LABELS: Record<StaffStatus, string> = {
  active: "نشط",
  frozen: "مجمّد مؤقتًا",
  disabled: "معطّل",
};

export const PERMISSION_LABELS: Record<StaffPermission, string> = {
  "sales.use": "استخدام نقطة البيع",
  "inventory.view": "عرض المخزون",
  "inventory.adjust": "تعديل كمية المخزون",
  "orders.manage": "إدارة الطلبيات",
  "expenses.manage": "إدارة المصروفات",
  "shifts.manage": "إدارة الشيفتات والخزينة",
  "reports.view": "عرض التقارير",
  "staff.manage": "إدارة أفراد الصيدلية",
  "audit.view": "عرض سجل النشاط",
  "notifications.send": "إرسال الإشعارات",
};

const ALL_PERMISSIONS = [...STAFF_PERMISSIONS];

export const DEFAULT_ROLE_PERMISSIONS: Record<StaffRole, StaffPermission[]> = {
  owner: ALL_PERMISSIONS,
  pharmacist: ["sales.use", "inventory.view", "inventory.adjust", "orders.manage", "expenses.manage", "shifts.manage", "reports.view"],
  cashier: ["sales.use", "inventory.view", "shifts.manage"],
  viewer: ["inventory.view", "reports.view"],
};

export function permissionsForRole(role: StaffRole): StaffPermission[] {
  return [...DEFAULT_ROLE_PERMISSIONS[role]];
}

export function normalizePermissions(value: unknown): StaffPermission[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is StaffPermission => typeof item === "string" && STAFF_PERMISSIONS.includes(item as StaffPermission));
}
