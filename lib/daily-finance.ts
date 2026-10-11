import type { Expense, Sale, Shift } from "@/lib/pharmacy-context";

export type DailyFinance = {
  dateKey: string;
  sales: Sale[];
  expenses: Expense[];
  shifts: Shift[];
  salesTotal: number;
  cashSalesTotal: number;
  vodafoneCashSalesTotal: number;
  cardSalesTotal: number;
  walletSalesTotal: number;
  expenseTotal: number;
  netTotal: number;
};

export function toLocalDayKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDaysToKey(dateKey: string, amount: number) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return toLocalDayKey(date);
}

export function formatArabicDay(dateKey: string) {
  return new Intl.DateTimeFormat("ar-EG", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${dateKey}T12:00:00`));
}

export function getDailyFinance(dateKey: string, sales: Sale[], expenses: Expense[], shifts: Shift[]): DailyFinance {
  const daySales = sales.filter((sale) => toLocalDayKey(sale.createdAt) === dateKey);
  const dayExpenses = expenses.filter((expense) => toLocalDayKey(expense.createdAt) === dateKey);
  const dayShifts = shifts.filter((shift) => toLocalDayKey(shift.startedAt) === dateKey);
  const salesTotal = daySales.reduce((sum, sale) => sum + sale.total, 0);
  const cashSalesTotal = daySales.filter((sale) => sale.paymentMethod === "نقدي").reduce((sum, sale) => sum + sale.total, 0);
  const vodafoneCashSalesTotal = daySales.filter((sale) => sale.paymentMethod === "فودافون كاش").reduce((sum, sale) => sum + sale.total, 0);
  const cardSalesTotal = daySales.filter((sale) => sale.paymentMethod === "بطاقة").reduce((sum, sale) => sum + sale.total, 0);
  const walletSalesTotal = daySales.filter((sale) => sale.paymentMethod === "محفظة").reduce((sum, sale) => sum + sale.total, 0);
  const expenseTotal = dayExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  return { dateKey, sales: daySales, expenses: dayExpenses, shifts: dayShifts, salesTotal, cashSalesTotal, vodafoneCashSalesTotal, cardSalesTotal, walletSalesTotal, expenseTotal, netTotal: salesTotal - expenseTotal };
}
