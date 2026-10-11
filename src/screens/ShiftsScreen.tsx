import React, { useState } from 'react';
import {
  Clock,
  Plus,
  Lock,
  X,
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { formatCurrency, formatDateTime } from '../utils/format';

export const ShiftsScreen: React.FC = () => {
  const { shifts, activeShift, sales, expenses, startShift, closeShift } = usePharmacy();

  // Modals
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);

  // Start Form
  const [pharmacistName, setPharmacistName] = useState('د. محمد علي');
  const [openingCash, setOpeningCash] = useState('500');

  // Close Form
  const [actualCash, setActualCash] = useState('');
  const [closeNote, setCloseNote] = useState('');

  // Shift financial calculations
  const shiftCashSales = activeShift
    ? sales
        .filter((s) => s.shiftId === activeShift.id && s.paymentMethod === 'نقدي')
        .reduce((sum, s) => sum + s.total, 0)
    : 0;

  const shiftExpenses = activeShift
    ? expenses
        .filter((e) => e.shiftId === activeShift.id)
        .reduce((sum, e) => sum + e.amount, 0)
    : 0;

  const expectedDrawerCash = activeShift
    ? activeShift.openingCash + shiftCashSales - shiftExpenses
    : 0;

  const parsedActualCash = parseFloat(actualCash) || 0;
  const difference = parsedActualCash - expectedDrawerCash;

  const handleStartShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pharmacistName.trim()) return;

    startShift(pharmacistName.trim(), parseFloat(openingCash) || 0);
    setIsStartModalOpen(false);
  };

  const handleCloseShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;

    closeShift(activeShift.id, parsedActualCash, closeNote || undefined);
    setIsCloseModalOpen(false);
    setActualCash('');
    setCloseNote('');
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0D2420]">الورديات وخزينة الدرج</h1>
          <p className="text-xs text-[#7A817E] font-medium">
            متابعة رصيد الدرج، جرد الكاش، وإغلاق الشيفتات مع حساب العجز أو الزيادة
          </p>
        </div>

        {!activeShift ? (
          <button
            onClick={() => setIsStartModalOpen(true)}
            className="bg-[#1FA47A] hover:bg-[#15906B] text-white px-4 py-2.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition active:scale-95 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>بدء وردية جديدة</span>
          </button>
        ) : (
          <button
            onClick={() => {
              setActualCash(String(expectedDrawerCash));
              setIsCloseModalOpen(true);
            }}
            className="bg-[#0D2420] hover:bg-[#1A453D] text-white px-4 py-2.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition active:scale-95 self-start sm:self-auto"
          >
            <Lock className="w-4 h-4" />
            <span>إغلاق الوردية الحالية وجرد الخزينة</span>
          </button>
        )}
      </div>

      {/* Active Shift Card */}
      {activeShift ? (
        <div className="bg-gradient-to-br from-[#0D2420] to-[#163B34] text-white p-6 sm:p-8 rounded-3xl shadow-lg relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-2 text-[#82E4C2] text-xs font-bold mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#1FA47A] animate-pulse"></span>
                <span>وردية قيد التشغيل والعمل الآن</span>
              </div>
              <h2 className="text-2xl font-black">{activeShift.pharmacistName}</h2>
              <p className="text-xs text-[#A8BDB4] mt-1">
                بدأت في: {formatDateTime(activeShift.startedAt)}
              </p>

              <div className="grid grid-cols-3 gap-3 sm:gap-6 mt-6 pt-6 border-t border-white/10 text-center sm:text-right">
                <div>
                  <span className="text-[11px] text-[#A8BDB4] font-bold block">الرصيد الافتتاحي</span>
                  <span className="text-base sm:text-lg font-black text-white">
                    {formatCurrency(activeShift.openingCash)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-[#A8BDB4] font-bold block">المبيعات النقدية (+)</span>
                  <span className="text-base sm:text-lg font-black text-[#82E4C2]">
                    +{formatCurrency(shiftCashSales)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-[#A8BDB4] font-bold block">مصروفات الوردية (-)</span>
                  <span className="text-base sm:text-lg font-black text-[#F28C67]">
                    -{formatCurrency(shiftExpenses)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/15 text-center min-w-[220px]">
              <span className="text-xs text-[#82E4C2] font-bold block mb-1">
                المبلغ المتوقع في الدرج الآن
              </span>
              <div className="text-2xl sm:text-3xl font-black text-white">
                {formatCurrency(expectedDrawerCash)}
              </div>
              <button
                onClick={() => {
                  setActualCash(String(expectedDrawerCash));
                  setIsCloseModalOpen(true);
                }}
                className="mt-4 w-full bg-[#1FA47A] hover:bg-[#15906B] text-white py-2.5 rounded-xl text-xs font-black transition"
              >
                جرد وإغلاق الوردية
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#ECECE8] p-8 rounded-3xl text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#FDE5D8] text-[#E35B2D] flex items-center justify-center mx-auto">
            <Clock className="w-6 h-6" />
          </div>
          <h3 className="font-black text-lg text-[#0D2420]">لا توجد وردية مفتوحة حاليًا</h3>
          <p className="text-xs text-[#7A817E] max-w-md mx-auto">
            يُرجى بدء وردية وتسجيل الرصيد الافتتاحي في درج الكاشير حتى يتم ربط المبيعات والمصروفات بدقة.
          </p>
          <button
            onClick={() => setIsStartModalOpen(true)}
            className="bg-[#1FA47A] hover:bg-[#15906B] text-white px-5 py-2.5 rounded-xl text-xs font-black transition shadow-sm"
          >
            بدء وردية جديدة الآن
          </button>
        </div>
      )}

      {/* Shift History Table */}
      <div className="bg-white rounded-3xl border border-[#ECECE8] p-6 shadow-sm space-y-4">
        <h2 className="text-base font-black text-[#0D2420]">سجل الورديات السابقة</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-[#FAF9F6] border-b border-[#ECECE8] text-[#7A817E] font-bold">
              <tr>
                <th className="py-3.5 pr-4">الصيدلي المسؤول</th>
                <th className="py-3.5 pr-3">البداية والنهاية</th>
                <th className="py-3.5 pr-3">الرصيد الافتتاحي</th>
                <th className="py-3.5 pr-3">العد الفعلي</th>
                <th className="py-3.5 pr-3">الفارق (عجز / زيادة)</th>
                <th className="py-3.5 pr-3">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECECE8]">
              {shifts.map((s) => {
                const diff = s.difference ?? 0;
                const isClosed = Boolean(s.closedAt);

                return (
                  <tr key={s.id} className="hover:bg-[#FAF9F6]/60 transition">
                    <td className="py-3.5 pr-4 font-black text-sm text-[#0D2420]">
                      {s.pharmacistName}
                    </td>
                    <td className="py-3.5 pr-3 text-[#7A817E]">
                      <div>من: {formatDateTime(s.startedAt)}</div>
                      {s.closedAt && <div>إلى: {formatDateTime(s.closedAt)}</div>}
                    </td>
                    <td className="py-3.5 pr-3 font-bold text-[#0D2420]">
                      {formatCurrency(s.openingCash)}
                    </td>
                    <td className="py-3.5 pr-3 font-bold text-[#0D2420]">
                      {s.actualCash !== undefined ? formatCurrency(s.actualCash) : '—'}
                    </td>
                    <td className="py-3.5 pr-3">
                      {isClosed ? (
                        <span
                          className={`font-black text-xs px-2 py-0.5 rounded-lg ${
                            diff === 0
                              ? 'bg-[#E5F5EF] text-[#1FA47A]'
                              : diff < 0
                              ? 'bg-[#FCE8E2] text-[#C64536]'
                              : 'bg-[#E5F5EF] text-[#1FA47A]'
                          }`}
                        >
                          {diff === 0
                            ? 'مطابق تمامًا'
                            : diff < 0
                            ? `عجز: ${formatCurrency(Math.abs(diff))}`
                            : `زيادة: +${formatCurrency(diff)}`}
                        </span>
                      ) : (
                        <span className="text-[#7A817E]">قيد التشغيل</span>
                      )}
                    </td>
                    <td className="py-3.5 pr-3">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          isClosed
                            ? 'bg-[#FAF9F6] text-[#7A817E]'
                            : 'bg-[#E5F5EF] text-[#1FA47A]'
                        }`}
                      >
                        {isClosed ? 'مغلقة' : 'جارية'}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {shifts.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#7A817E]">
                    لا توجد ورديات سابقة مسجلة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Start Shift Modal */}
      {isStartModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative border border-[#ECECE8]">
            <div className="flex items-center justify-between pb-3 border-b border-[#ECECE8]">
              <h2 className="text-base font-black text-[#0D2420]">بدء وردية جديدة</h2>
              <button onClick={() => setIsStartModalOpen(false)} className="text-[#7A817E] p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStartShift} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#0D2420] block mb-1">اسم الصيدلي المسؤول *</label>
                <input
                  required
                  type="text"
                  value={pharmacistName}
                  onChange={(e) => setPharmacistName(e.target.value)}
                  placeholder="د. أحمد محمود"
                  className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl px-3 py-2 text-xs font-bold text-[#0D2420]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#0D2420] block mb-1">الرصيد الافتتاحي بالدرج (ج.م) *</label>
                <input
                  required
                  type="number"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  placeholder="500"
                  className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl px-3 py-2 text-xs font-bold text-[#0D2420]"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-[#1FA47A] hover:bg-[#15906B] text-white py-2.5 rounded-xl text-xs font-black shadow-md transition"
                >
                  تأكيد فتح الوردية
                </button>
                <button
                  type="button"
                  onClick={() => setIsStartModalOpen(false)}
                  className="bg-[#FAF9F6] text-[#0D2420] px-4 py-2.5 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {isCloseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative border border-[#ECECE8]">
            <div className="flex items-center justify-between pb-3 border-b border-[#ECECE8]">
              <h2 className="text-base font-black text-[#0D2420]">جرد وإغلاق الوردية</h2>
              <button onClick={() => setIsCloseModalOpen(false)} className="text-[#7A817E] p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCloseShift} className="space-y-3.5">
              <div className="bg-[#FAF9F6] p-3 rounded-2xl border border-[#ECECE8] space-y-1">
                <span className="text-[11px] text-[#7A817E] font-bold block">المبلغ المحسوب بالدرج:</span>
                <span className="text-xl font-black text-[#1FA47A]">
                  {formatCurrency(expectedDrawerCash)}
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-[#0D2420] block mb-1">
                  المبلغ الفعلي بعد عدّ النقود (ج.م) *
                </label>
                <input
                  required
                  type="number"
                  value={actualCash}
                  onChange={(e) => setActualCash(e.target.value)}
                  className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl px-3 py-2 text-xs font-bold text-[#0D2420]"
                />
              </div>

              {actualCash && (
                <div className="p-3 rounded-2xl border text-xs font-bold flex items-center justify-between bg-[#FAF9F6]">
                  <span>الفارق في الدرج:</span>
                  <span
                    className={`text-sm font-black ${
                      difference === 0
                        ? 'text-[#1FA47A]'
                        : difference < 0
                        ? 'text-[#C64536]'
                        : 'text-[#1FA47A]'
                    }`}
                  >
                    {difference === 0
                      ? 'مطابق تمامًا'
                      : difference < 0
                      ? `عجز: ${formatCurrency(Math.abs(difference))}`
                      : `زيادة: +${formatCurrency(difference)}`}
                  </span>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-[#0D2420] block mb-1">ملاحظة الإغلاق (اختياري)</label>
                <input
                  type="text"
                  value={closeNote}
                  onChange={(e) => setCloseNote(e.target.value)}
                  placeholder="ملاحظات التسليم والتسلم..."
                  className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl px-3 py-2 text-xs font-bold text-[#0D2420]"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-[#0D2420] hover:bg-[#1FA47A] text-white py-2.5 rounded-xl text-xs font-black shadow-md transition"
                >
                  إغلاق الوردية واعتماد الجرد
                </button>
                <button
                  type="button"
                  onClick={() => setIsCloseModalOpen(false)}
                  className="bg-[#FAF9F6] text-[#0D2420] px-4 py-2.5 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
