/// <reference types="vitest" />
import { describe, expect, it } from "vitest";

import { normalizePermissions, permissionsForRole } from "../lib/staff-access";
import { hashPassword, maskNetworkAddress, verifyPassword } from "../server/staff-service";

describe("صلاحيات فريق الصيدلية", () => {
  it("يمنح المالك جميع الصلاحيات ويمنع الكاشير من إدارة الأفراد", () => {
    expect(permissionsForRole("owner")).toContain("staff.manage");
    expect(permissionsForRole("cashier")).toContain("sales.use");
    expect(permissionsForRole("cashier")).not.toContain("staff.manage");
  });

  it("يحذف أي صلاحية غير معروفة من القائمة القادمة من العميل", () => {
    expect(normalizePermissions(["sales.use", "not.allowed", 5, "reports.view"])).toEqual(["sales.use", "reports.view"]);
  });
});

describe("بيانات جلسات العاملين", () => {
  it("يخزّن كلمات المرور بصيغة مشتقة ويتحقق منها دون الاحتفاظ بالنص", async () => {
    const hash = await hashPassword("strong-password-2026");
    expect(hash).not.toContain("strong-password-2026");
    await expect(verifyPassword("strong-password-2026", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("يخفي الجزء الأخير من عنوان IPv4 قبل حفظه", () => {
    expect(maskNetworkAddress("196.20.15.77")).toBe("196.20.15.0");
  });
});
