import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Banknote,
  Smartphone,
  Pill,
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { formatCurrency, formatNumber } from '../utils/format';

export const ReportsScreen: React.FC = () => {
  const { sales, expenses } = usePharmacy();

  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('today');

  const filteredData = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oneWeekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const filterFn = (dateStr: string) => {
      const t = new Date(dateStr).getTime();
      if (period === 'today') return t >= startOfToday;
      if (period === 'week') return t >= oneWeekAgo;
      if (period === 'month') return t >= startOfMonth;
      return true;
    };

    const periodSales = sales.filter((s) => filterFn(s.createdAt));
    const periodExpenses = expenses.filter((e) => filterFn(e.createdAt));

    return { periodSales, periodExpenses };
  }, [sales, expenses, period]);

  const { periodSales, periodExpenses } = filteredData;

  const totalSales = periodSales.reduce((sum, s) => sum + s.total, 0);
  const totalExpenses = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalSales - totalExpenses;
  const averageTicket = periodSales.length > 0 ? totalSales / periodSales.length : 0;

  // Best selling products
  const topProducts = useMemo(() => {
    const counts: Record<string, { name: string; qty: number; revenue: number }> = {};

    periodSales.forEach((s) => {
      s.items.forEach((item) => {
        if (!counts[item.medicationId]) {
          counts[item.medicationId] = { name: item.name, qty: 0, revenue: 0 };
        }
        counts[item.medicationId].qty += item.quantity;
        counts[item.medicationId].revenue += item.unitPrice * item.quantity;
      });
    });

    return Object.values(counts)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [periodSales]);

  // Payment Breakdown
  const cashTotal = periodSales
    .filter((s) => s.paymentMethod === 'نقدي')
    .reduce((sum, s) => sum + s.total, 0);
  const vodafoneTotal = periodSales
    .filter((s) => s.paymentMethod === 'فودافون كاش')
    .reduce((sum, s) => sum + s.total, 0);

  return (
    <div className="space-y-6">
      {/* Title & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0D2420]">التقارير المالية والتحليلات</h1>
          <p className="text-xs text-[#7A817E] font-medium">
            مؤشرات الأداء، الأرباح الصافية، أكثر الأصناف مبيعًا، وتوزيع طرق الدفع
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-[#ECECE8] shadow-sm self-start sm:self-auto">
          {[
            { id: 'today', label: 'اليوم' },
            { id: 'week', label: 'آخر 7 أيام' },
            { id: 'month', label: 'هذا الشهر' },
            { id: 'all', label: 'الكل' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setPeriod(item.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${
                period === item.id
                  ? 'bg-[#1FA47A] text-white shadow-sm'
                  : 'text-[#7A817E] hover:text-[#0D2420]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Financial Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#ECECE8] p-5 rounded-3xl shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#7A817E]">إجمالي المبيعات</span>
            <TrendingUp className="w-4 h-4 text-[#1FA47A]" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#0D2420]">
            {formatCurrency(totalSales)}
          </div>
          <span className="text-[11px] text-[#7A817E] mt-1 block">
            عدد الفواتير: {formatNumber(periodSales.length)}
          </span>
        </div>

        <div className="bg-white border border-[#ECECE8] p-5 rounded-3xl shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#7A817E]">إجمالي المصروفات</span>
            <TrendingDown className="w-4 h-4 text-[#C64536]" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#C64536]">
            {formatCurrency(totalExpenses)}
          </div>
          <span className="text-[11px] text-[#7A817E] mt-1 block">
            عدد البنود: {formatNumber(periodExpenses.length)}
          </span>
        </div>

        <div className="bg-white border border-[#ECECE8] p-5 rounded-3xl shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#7A817E]">صافي الأرباح</span>
            <BarChart3 className="w-4 h-4 text-[#15906B]" />
          </div>
          <div
            className={`text-2xl sm:text-3xl font-black ${
              netProfit >= 0 ? 'text-[#1FA47A]' : 'text-[#C64536]'
            }`}
          >
            {formatCurrency(netProfit)}
          </div>
          <span className="text-[11px] text-[#7A817E] mt-1 block">المبيعات ناقص المصروفات</span>
        </div>

        <div className="bg-white border border-[#ECECE8] p-5 rounded-3xl shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#7A817E]">متوسط الفاتورة</span>
            <CreditCard className="w-4 h-4 text-[#7A817E]" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#0D2420]">
            {formatCurrency(averageTicket)}
          </div>
          <span className="text-[11px] text-[#7A817E] mt-1 block">لكل عملية بيع</span>
        </div>
      </div>

      {/* Grid: Top Selling & Payment Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Products */}
        <div className="bg-white border border-[#ECECE8] p-6 rounded-3xl shadow-sm space-y-4">
          <h2 className="text-base font-black text-[#0D2420] flex items-center gap-2">
            <Pill className="w-5 h-5 text-[#1FA47A]" />
            <span>الأدوية الأكثر مبيعًا خلال الفترة</span>
          </h2>

          <div className="space-y-3">
            {topProducts.map((p, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-2xl bg-[#FAF9F6] border border-[#ECECE8]"
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-xl bg-[#E5F5EF] text-[#1FA47A] font-black text-xs flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div>
                    <h4 className="font-bold text-xs text-[#0D2420]">{p.name}</h4>
                    <span className="text-[11px] text-[#7A817E]">
                      تم بيع {formatNumber(p.qty)} عبوة
                    </span>
                  </div>
                </div>
                <div className="font-black text-xs text-[#1FA47A]">
                  {formatCurrency(p.revenue)}
                </div>
              </div>
            ))}

            {topProducts.length === 0 && (
              <p className="text-center py-6 text-xs text-[#7A817E]">
                لا توجد مبيعات في الفترة المحددة
              </p>
            )}
          </div>
        </div>

        {/* Payment Methods Breakdown */}
        <div className="bg-white border border-[#ECECE8] p-6 rounded-3xl shadow-sm space-y-4">
          <h2 className="text-base font-black text-[#0D2420] flex items-center gap-2">
            <Banknote className="w-5 h-5 text-[#1FA47A]" />
            <span>توزيع طرق الدفع</span>
          </h2>

          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#E5F5EF]/60 border border-[#1FA47A]/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1FA47A] text-white flex items-center justify-center">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-sm text-[#0D2420]">الدفع النقدي (كاش)</h4>
                  <span className="text-xs text-[#15906B]">
                    {totalSales > 0 ? ((cashTotal / totalSales) * 100).toFixed(0) : 0}% من إجمالي المبيعات
                  </span>
                </div>
              </div>
              <div className="text-lg font-black text-[#1FA47A]">{formatCurrency(cashTotal)}</div>
            </div>

            <div className="p-4 rounded-2xl bg-[#FDE5D8]/60 border border-[#E35B2D]/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E35B2D] text-white flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-sm text-[#0D2420]">فودافون كاش</h4>
                  <span className="text-xs text-[#8E462C]">
                    {totalSales > 0 ? ((vodafoneTotal / totalSales) * 100).toFixed(0) : 0}% من إجمالي المبيعات
                  </span>
                </div>
              </div>
              <div className="text-lg font-black text-[#E35B2D]">{formatCurrency(vodafoneTotal)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
