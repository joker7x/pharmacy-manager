import { IncomingOrder, Supplier } from "@/lib/pharmacy-context";

export type TopSupply = { name: string; quantity: number; cost: number };

export type SupplierStats = {
  orders: IncomingOrder[];
  orderCount: number;
  receivedCount: number;
  pendingCount: number;
  knownTotalCount: number;
  total: number;
  average: number;
  largest?: IncomingOrder;
  smallest?: IncomingOrder;
  invoiceCount: number;
  invoiceShare: number;
  itemsQuantity: number;
  topItems: TopSupply[];
  firstOrderAt?: string;
  lastOrderAt?: string;
  averageGapDays: number;
};

const DAY_MS = 86_400_000;

export function getSupplierStats(supplier: Supplier, incomingOrders: IncomingOrder[]): SupplierStats {
  const orders = incomingOrders
    .filter((order) => order.supplierName === supplier.company)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const priced = orders.filter((order) => typeof order.total === "number");
  const total = priced.reduce((sum, order) => sum + (order.total ?? 0), 0);
  const receivedCount = orders.filter((order) => order.status === "تم الاستلام").length;
  const invoiceCount = orders.filter((order) => Boolean(order.invoiceUri)).length;

  const items = new Map<string, TopSupply>();
  let itemsQuantity = 0;
  for (const order of orders) {
    for (const item of order.items ?? []) {
      const current = items.get(item.name) ?? { name: item.name, quantity: 0, cost: 0 };
      current.quantity += item.quantity;
      current.cost += item.quantity * item.unitCost;
      items.set(item.name, current);
      itemsQuantity += item.quantity;
    }
  }

  const first = orders[0];
  const last = orders[orders.length - 1];
  const span = first && last ? new Date(last.createdAt).getTime() - new Date(first.createdAt).getTime() : 0;

  return {
    orders,
    orderCount: orders.length,
    receivedCount,
    pendingCount: orders.length - receivedCount,
    knownTotalCount: priced.length,
    total,
    average: priced.length ? total / priced.length : 0,
    largest: priced.reduce<IncomingOrder | undefined>((max, order) => (!max || (order.total ?? 0) > (max.total ?? 0) ? order : max), undefined),
    smallest: priced.reduce<IncomingOrder | undefined>((min, order) => (!min || (order.total ?? 0) < (min.total ?? 0) ? order : min), undefined),
    invoiceCount,
    invoiceShare: orders.length ? Math.round((invoiceCount / orders.length) * 100) : 0,
    itemsQuantity,
    topItems: [...items.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5),
    firstOrderAt: first?.createdAt,
    lastOrderAt: last?.createdAt,
    averageGapDays: orders.length > 1 ? Math.max(1, Math.round(span / DAY_MS / (orders.length - 1))) : 0,
  };
}

export function formatCount(value: number) {
  return value.toLocaleString("ar-EG");
}

export function formatDays(days: number) {
  if (!days) return "—";
  if (days === 1) return "يوم واحد";
  if (days === 2) return "يومان";
  if (days <= 10) return `${formatCount(days)} أيام`;
  return `${formatCount(Math.round(days / 30))} شهر تقريبًا`;
}
