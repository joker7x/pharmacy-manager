import React from 'react';
import {
  ShoppingCart,
  Package,
  AlertTriangle,
  Clock,
  TrendingUp,
  ChevronLeft,
  CheckCircle2,
  Calendar,
  FileText,
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { formatCurrency, formatNumber, formatDateTime } from '../utils/format';
import { TabType } from '../components/Header';

interface DashboardScreenProps {
  onNavigate: (tab: TabType) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onNavigate }) => {
  const { sales, expenses, reorderNeeds, alerts, isReady, activeShift } = usePharmacy();

  const todayStr = new Date().toDateString();
  const todaysSales = sales.filter((s) => new Date(s.createdAt).toDateString() === todayStr);
  const todaysExpenses = expenses.filter((e) => new Date(e.createdAt).toDateString() === todayStr);

  const revenue = todaysSales.reduce((sum, s) => sum + s.total, 0);
  const expenseTotal = todaysExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netRevenue = revenue - expenseTotal;

  const urgentShortages = reorderNeeds.filter(
    (n) => n.status === 'needed' && (n.urgent || n.medication.quantity === 0)
  ).length;
  const activeReorders = reorderNeeds.filter((n) => n.status === 'needed').length;
  const expiryCount = alerts.filter((a) => a.kind === 'expiry').length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'صباح الخير' : hour < 17 ? 'نهارك سعيد' : 'مساء الخير';

  return (
    <div className="space-y-6">
      {/* Top Welcome & Shift Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-sm font-bold text-[#7A817E]">{greeting}، مرحبًا بك</span>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0D2420]">لوحة التحكم الصيدلانية</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-2xl border border-[#ECECE8] text-xs font-bold text-[#7A817E] shadow-sm">
            <Calendar className="w-4 h-4 text-[#1FA47A]" />
            <span>
              {new Date().toLocaleDateString('ar-EG', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Hero Financial KPI Card */}
      <div className="bg-gradient-to-br from-[#1FA47A] to-[#15906B] rounded-3xl p-6 sm:p-8 text-white shadow-lg shadow-[#1FA47A]/15 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full -translate-x-12 -translate-y-12 blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-[#D5F6E8] text-sm font-extrabold mb-2">
              <TrendingUp className="w-5 h-5" />
              <span>إجمالي مبيعات اليوم</span>
            </div>
            <div className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
              {formatCurrency(revenue)}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs font-bold bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 w-fit">
              <div>
                <span className="text-[#D5F6E8] ml-1.5">الصافي:</span>
                <span className="text-white font-black text-sm">{formatCurrency(netRevenue)}</span>
              </div>
              <div className="w-px h-4 bg-white/20" />
              <div>
                <span className="text-[#D5F6E8] ml-1.5">المصروفات:</span>
                <span className="text-white font-black text-sm">{formatCurrency(expenseTotal)}</span>
              </div>
              <div className="w-px h-4 bg-white/20" />
              <div>
                <span className="text-[#D5F6E8] ml-1.5">عدد الفواتير:</span>
                <span className="text-white font-black text-sm">{formatNumber(todaysSales.length)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 sm:self-end">
            <button
              onClick={() => onNavigate('sales')}
              className="bg-white text-[#1FA47A] hover:bg-[#FAF9F6] px-5 py-3 rounded-2xl text-sm font-black shadow-md transition flex items-center justify-center gap-2 active:scale-95"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>تسجيل بيع جديد</span>
            </button>
            <button
              onClick={() => onNavigate('reports')}
              className="bg-white/15 hover:bg-white/25 text-white border border-white/20 px-5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>عرض التقرير اليومي المفصل</span>
            </button>
          </div>
        </div>
      </div>

      {/* Urgent Notice Banners */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {urgentShortages > 0 ? (
          <div
            onClick={() => onNavigate('alerts')}
            className="cursor-pointer bg-[#FDE5D8] border border-[#E35B2D]/20 p-4 rounded-2xl flex items-center justify-between hover:bg-[#FCD2BF] transition group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#E35B2D] text-white flex items-center justify-center shadow-sm">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-black text-[#8E462C]">
                  {formatNumber(urgentShortages)} أصناف أدوية عاجلة ناقصة!
                </p>
                <p className="text-xs text-[#8E462C]/80 font-medium">
                  أصناف قاربت على النفاد أو مطلوبة بشدة من العملاء
                </p>
              </div>
            </div>
            <ChevronLeft className="w-5 h-5 text-[#8E462C] group-hover:-translate-x-1 transition" />
          </div>
        ) : (
          <div
            onClick={() => onNavigate('alerts')}
            className="cursor-pointer bg-[#E5F5EF] border border-[#1FA47A]/20 p-4 rounded-2xl flex items-center justify-between hover:bg-[#D5F6E8] transition group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1FA47A] text-white flex items-center justify-center shadow-sm">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-black text-[#15906B]">المخزون مستقر تمامًا</p>
                <p className="text-xs text-[#15906B]/80 font-medium">لا توجد نواقص حرجة حاليًا</p>
              </div>
            </div>
            <ChevronLeft className="w-5 h-5 text-[#15906B] group-hover:-translate-x-1 transition" />
          </div>
        )}

        {/* Expiry alerts */}
        {expiryCount > 0 ? (
          <div
            onClick={() => onNavigate('inventory')}
            className="cursor-pointer bg-[#FFF4E5] border border-[#F59E0B]/20 p-4 rounded-2xl flex items-center justify-between hover:bg-[#FEEBC8] transition group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#D97706] text-white flex items-center justify-center shadow-sm">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-black text-[#92400E]">
                  {formatNumber(expiryCount)} أصناف أوشكت صلاحيتها على الانتهاء
                </p>
                <p className="text-xs text-[#92400E]/80 font-medium">خلال 60 يومًا أو أقل — راجع الرفوف</p>
              </div>
            </div>
            <ChevronLeft className="w-5 h-5 text-[#92400E] group-hover:-translate-x-1 transition" />
          </div>
        ) : (
          <div
            onClick={() => onNavigate('shifts')}
            className="cursor-pointer bg-white border border-[#ECECE8] p-4 rounded-2xl flex items-center justify-between hover:border-[#1FA47A]/40 transition group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0D2420] text-white flex items-center justify-center shadow-sm">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-black text-[#0D2420]">
                  {activeShift ? `الوردية نشطة: ${activeShift.pharmacistName}` : 'لا توجد وردية نشطة حاليًا'}
                </p>
                <p className="text-xs text-[#7A817E] font-medium">
                  {activeShift ? 'اضغط لمتابعة الدرج وإغلاق الوردية' : 'اضغط لبدء وردية جديدة وتحديد الرصيد الافتتاحي'}
                </p>
              </div>
            </div>
            <ChevronLeft className="w-5 h-5 text-[#7A817E] group-hover:-translate-x-1 transition" />
          </div>
        )}
      </div>

      {/* Quick Action Navigation Grid */}
      <div>
        <h2 className="text-lg font-black text-[#0D2420] mb-3">اختصارات سريعة</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            onClick={() => onNavigate('sales')}
            className="bg-white hover:bg-[#E9F8F1] border border-[#ECECE8] hover:border-[#1FA47A]/30 p-4 rounded-2xl flex flex-col items-center text-center transition group active:scale-95 shadow-sm"
          >
            <div className="w-12 h-12 rounded-xl bg-[#E9F8F1] text-[#1FA47A] flex items-center justify-center mb-2.5 group-hover:scale-110 transition">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <span className="text-sm font-black text-[#0D2420]">الكاشير</span>
            <span className="text-[11px] text-[#7A817E]">بيع وتمرير سريع</span>
          </button>

          <button
            onClick={() => onNavigate('inventory')}
            className="bg-white hover:bg-[#F4FAF7] border border-[#ECECE8] hover:border-[#0D2420]/30 p-4 rounded-2xl flex flex-col items-center text-center transition group active:scale-95 shadow-sm"
          >
            <div className="w-12 h-12 rounded-xl bg-[#0D2420] text-white flex items-center justify-center mb-2.5 group-hover:scale-110 transition">
              <Package className="w-6 h-6" />
            </div>
            <span className="text-sm font-black text-[#0D2420]">المخزون</span>
            <span className="text-[11px] text-[#7A817E]">الأدوية والكميات</span>
          </button>

          <button
            onClick={() => onNavigate('alerts')}
            className="bg-white hover:bg-[#FDE5D8] border border-[#ECECE8] hover:border-[#E35B2D]/30 p-4 rounded-2xl flex flex-col items-center text-center transition group active:scale-95 shadow-sm relative"
          >
            {activeReorders > 0 && (
              <span className="absolute top-2 left-2 bg-[#E35B2D] text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                {formatNumber(activeReorders)}
              </span>
            )}
            <div className="w-12 h-12 rounded-xl bg-[#FDE5D8] text-[#E35B2D] flex items-center justify-center mb-2.5 group-hover:scale-110 transition">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <span className="text-sm font-black text-[#0D2420]">النواقص</span>
            <span className="text-[11px] text-[#7A817E]">طلبيات النواقص</span>
          </button>

          <button
            onClick={() => onNavigate('shifts')}
            className="bg-white hover:bg-[#FCE4D7] border border-[#ECECE8] hover:border-[#D66A42]/30 p-4 rounded-2xl flex flex-col items-center text-center transition group active:scale-95 shadow-sm"
          >
            <div className="w-12 h-12 rounded-xl bg-[#FCE4D7] text-[#D66A42] flex items-center justify-center mb-2.5 group-hover:scale-110 transition">
              <Clock className="w-6 h-6" />
            </div>
            <span className="text-sm font-black text-[#0D2420]">الشيفتات</span>
            <span className="text-[11px] text-[#7A817E]">الخزينة والدرج</span>
          </button>

          <button
            onClick={() => onNavigate('debts')}
            className="bg-white hover:bg-[#E6F6F1] border border-[#ECECE8] hover:border-[#2D8B75]/30 p-4 rounded-2xl flex flex-col items-center text-center transition group active:scale-95 shadow-sm"
          >
            <div className="w-12 h-12 rounded-xl bg-[#E6F6F1] text-[#2D8B75] flex items-center justify-center mb-2.5 group-hover:scale-110 transition">
              <Users className="w-6 h-6" />
            </div>
            <span className="text-sm font-black text-[#0D2420]">الآجل والعملاء</span>
            <span className="text-[11px] text-[#7A817E]">الديون والدفعات</span>
          </button>

          <button
            onClick={() => onNavigate('expenses')}
            className="bg-white hover:bg-[#FDE8E2] border border-[#ECECE8] hover:border-[#C64536]/30 p-4 rounded-2xl flex flex-col items-center text-center transition group active:scale-95 shadow-sm"
          >
            <div className="w-12 h-12 rounded-xl bg-[#FDE8E2] text-[#C64536] flex items-center justify-center mb-2.5 group-hover:scale-110 transition">
              <Receipt className="w-6 h-6" />
            </div>
            <span className="text-sm font-black text-[#0D2420]">المصروفات</span>
            <span className="text-[11px] text-[#7A817E]">مصاريف التشغيل</span>
          </button>
        </div>
      </div>

      {/* Recent Sales Activity */}
      <div className="bg-white rounded-3xl p-6 border border-[#ECECE8] shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-black text-[#0D2420]">أحدث المبيعات والفواتير</h2>
            <p className="text-xs text-[#7A817E]">آخر الفواتير الصادرة من الكاشير</p>
          </div>
          <button
            onClick={() => onNavigate('sales')}
            className="text-xs font-bold text-[#1FA47A] hover:underline flex items-center gap-1"
          >
            <span>شاشة الكاشير</span>
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {sales.length === 0 ? (
          <div className="text-center py-8 text-[#7A817E]">
            <ShoppingCart className="w-10 h-10 mx-auto text-[#ECECE8] mb-2" />
            <p className="text-sm font-bold">لا توجد مبيعات مسجلة حتى الآن</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b border-[#ECECE8] text-[#7A817E] text-xs font-bold">
                  <th className="pb-3 pr-2">رقم الفاتورة</th>
                  <th className="pb-3 pr-2">الوقت</th>
                  <th className="pb-3 pr-2">الأصناف</th>
                  <th className="pb-3 pr-2">طريقة الدفع</th>
                  <th className="pb-3 pr-2">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECECE8]">
                {sales.slice(0, 5).map((sale) => (
                  <tr key={sale.id} className="hover:bg-[#FAF9F6] transition">
                    <td className="py-3 pr-2 font-mono text-xs text-[#7A817E]">{sale.id}</td>
                    <td className="py-3 pr-2 text-xs font-medium text-[#7A817E]">
                      {formatDateTime(sale.createdAt)}
                    </td>
                    <td className="py-3 pr-2 font-bold text-[#0D2420]">
                      {sale.items.map((i) => `${i.name} (×${i.quantity})`).join('، ')}
                    </td>
                    <td className="py-3 pr-2">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          sale.paymentMethod === 'نقدي'
                            ? 'bg-[#E5F5EF] text-[#1FA47A]'
                            : 'bg-[#FDE5D8] text-[#E35B2D]'
                        }`}
                      >
                        {sale.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 pr-2 font-black text-[#1FA47A] text-base">
                      {formatCurrency(sale.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer Offline Ready Indicator */}
      <div className="flex items-center justify-center gap-2 text-xs text-[#7A817E] py-2">
        <span
          className={`w-2.5 h-2.5 rounded-full ${isReady ? 'bg-[#1FA47A]' : 'bg-[#E35B2D] animate-ping'}`}
        />
        <span className="font-bold">
          {isReady ? 'البيانات محفوظة محليًا على المتصفح وتعمل دون الحاجة لإنترنت' : 'جارٍ تهيئة البيانات...'}
        </span>
      </div>
    </div>
  );
};
