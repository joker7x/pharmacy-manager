import type { ReorderRecord } from "./pharmacy-context";

export type ShortageUnit = "علبة" | "شريط" | "قطعة";

export type LogShortageInput = {
  medicationId: string;
  qty: number;
  at: string;
  baselineQuantity: number;
  unit?: ShortageUnit;
  urgent?: boolean;
  note?: string;
  supplierName?: string;
  customerName?: string;
  customerPhone?: string;
  requestedByName?: string;
  manual?: boolean;
};

/**
 * تسجيل صنف ناقص: لو فيه صنف مفتوح بالفعل بتزيد كميته فقط،
 * ويحتفظ بتاريخ طلبه الأصلي، وتصبح عاجل لو أي من الطلبين عاجل.
 */
export function logShortage(records: ReorderRecord[], input: LogShortageInput): { records: ReorderRecord[]; merged: boolean } {
  const existing = records.find((record) => record.medicationId === input.medicationId);
  const isOpen = !existing?.status || existing.status === "needed";
  if (existing && isOpen) {
    const mergedRecord: ReorderRecord = {
      ...existing,
      desiredQuantity: (existing.desiredQuantity ?? 0) + Math.max(1, Math.trunc(input.qty)),
      urgent: Boolean(existing.urgent || input.urgent),
      unit: existing.unit ?? input.unit,
      notes: [existing.notes, input.note].filter((value, index, list) => value && list.indexOf(value) === index).join(" · ") || existing.notes,
      supplierName: existing.supplierName ?? input.supplierName,
      customerName: existing.customerName ?? input.customerName,
      customerPhone: existing.customerPhone ?? input.customerPhone,
      requestedByName: existing.requestedByName ?? input.requestedByName,
      demandCount: (existing.demandCount ?? 1) + 1,
    };
    return { records: records.map((record) => record.medicationId === input.medicationId ? mergedRecord : record), merged: true };
  }

  const record: ReorderRecord = {
    medicationId: input.medicationId,
    markedAt: input.at,
    quantityAtMark: input.baselineQuantity,
    manual: input.manual ?? true,
    status: "needed",
    desiredQuantity: Math.max(1, Math.trunc(input.qty)),
    unit: input.unit,
    urgent: input.urgent,
    notes: input.note,
    supplierName: input.supplierName,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    requestedByName: input.requestedByName,
    demandCount: 1,
  };
  return { records: [record, ...records.filter((item) => item.medicationId !== input.medicationId)], merged: false };
}

/** صنف مش متوفر عند مورد: يفضل مفتوح ويتشيل المورد الحالي عشان يتعرض على مورد تاني. */
export function markShortageUnavailable(records: ReorderRecord[], medicationId: string, supplierName: string | null): ReorderRecord[] {
  return records.map((record) => {
    if (record.medicationId !== medicationId) return record;
    const list = new Set(record.unavailableSuppliers ?? []);
    if (supplierName) list.add(supplierName);
    return { ...record, unavailableSuppliers: [...list], supplierName: supplierName ? undefined : record.supplierName };
  });
}

export function clearShortageUnavailable(records: ReorderRecord[], medicationId: string, supplierName: string | null): ReorderRecord[] {
  return records.map((record) => {
    if (record.medicationId !== medicationId || !record.unavailableSuppliers?.length) return record;
    const list = record.unavailableSuppliers.filter((name) => name !== supplierName);
    return { ...record, unavailableSuppliers: list.length ? list : undefined };
  });
}

export type OrderCommit = { supplier: string | null; orderedIds: string[]; unavailableIds: string[]; desiredQuantities?: Record<string, number>; orderedByName?: string; at: string };

/** إنهاء مكالمة المورد: المشطوب يطلب، المرفوض ينتقل لـ «من غير مورد»، والباقي زي ما هو. */
export function commitSupplierOrder(records: ReorderRecord[], commit: OrderCommit): { records: ReorderRecord[]; changed: number } {
  const ordered = new Set(commit.orderedIds);
  const unavailable = new Set(commit.unavailableIds);
  let changed = 0;
  const next = records.map((record) => {
    if (ordered.has(record.medicationId)) {
      changed += 1;
      return { ...record, status: "ordered" as const, desiredQuantity: Math.max(1, Math.trunc(commit.desiredQuantities?.[record.medicationId] ?? record.desiredQuantity ?? 1)), orderedAt: commit.at, orderedByName: commit.orderedByName, supplierName: commit.supplier ?? record.supplierName };
    }
    if (unavailable.has(record.medicationId)) {
      changed += 1;
      const list = new Set(record.unavailableSuppliers ?? []);
      if (commit.supplier) list.add(commit.supplier);
      return { ...record, supplierName: undefined, unavailableSuppliers: [...list] };
    }
    return record;
  });
  return { records: next, changed };
}

/** استلام بالترتيب الزمني (الأقدم أولًا) مع دعم الاستلام الجزئي. */
export function receiveShortages(records: ReorderRecord[], delivered: Array<{ medicationId: string; qty: number }>, at: string): { records: ReorderRecord[]; received: number; partial: number } {
  let working = [...records];
  let received = 0;
  let partial = 0;
  for (const entry of delivered) {
    let remaining = Math.max(0, Math.trunc(entry.qty));
    // نفس الصنف ممكن يكون ليه أكتر من طلبية مفتوحة، فالتوزيع بالموضع مش بالمعرّف.
    const candidates = working
      .map((record, index) => ({ record, index }))
      .filter(({ record }) => record.medicationId === entry.medicationId && record.status === "ordered")
      .sort((a, b) => (a.record.orderedAt ?? a.record.markedAt).localeCompare(b.record.orderedAt ?? b.record.markedAt));
    for (const { record: candidate, index } of candidates) {
      if (remaining <= 0) break;
      const need = Math.max(1, candidate.desiredQuantity ?? 1);
      const already = candidate.receivedQty ?? 0;
      const take = Math.min(remaining, need - already);
      if (take <= 0) continue;
      remaining -= take;
      working = working.map((item, position) => position !== index ? item : {
        ...item,
        receivedQty: already + take,
        status: already + take >= need ? "received" as const : "ordered" as const,
        receivedAt: already + take >= need ? at : item.receivedAt,
      });
      if (already + take >= need) received += 1; else partial += 1;
    }
  }
  return { records: working, received, partial };
}
