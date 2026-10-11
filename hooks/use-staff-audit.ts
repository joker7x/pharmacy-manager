import { useCallback } from "react";

import { getStaffDevice, useStaffSession } from "@/lib/staff-session";
import { trpc } from "@/lib/trpc";

export function useStaffAudit() {
  const { staff } = useStaffSession();
  const mutation = trpc.staff.logAction.useMutation();

  return useCallback((input: { action: string; entityType: string; entityId?: string; detail: string; metadata?: Record<string, unknown> }) => {
    if (!staff) return;
    void getStaffDevice().then((device) => mutation.mutate({ ...input, device })).catch(() => undefined);
  }, [mutation, staff]);
}
