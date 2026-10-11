import React, { useState } from 'react';
import {
  Plus,
  Phone,
  CheckCircle,
  X,
  DollarSign,
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { formatCurrency, formatNumber, formatDate } from '../utils/format';

export const DebtsScreen: React.FC = () => {
  const { debts, addDebt, settleDebt } = usePharmacy();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [settlingDebtId, setSettlingDebtId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  // Add Debt form
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [total, setTotal] = useState('');
  const [note, setNote] = useState('');

  const totalOutstanding = debts.reduce((sum, d) => sum + (d.total - d.paid), 0);
  const totalCollected = debts.reduce((sum, d) => sum + d.paid, 0);

  const handleAddDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !total) return;

    addDebt({
      customerName: customerName.trim(),
      phone: phone.trim() || undefined,
      total: parseFloat(total) || 0,
      note: note.trim() || undefined,
    });

    setIsAddModalOpen(false);
    setCustomerName('');
    setPhone('');
    setTotal('');
    setNote('');
  };

  const handleSettle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingDebtId || !paymentAmount) return;

    settleDebt(settlingDebtId, parseFloat(paymentAmount) || 0);
    setSettlingDebtId(null);
    setPaymentAmount('');
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0D2420]">حسابات الآجل والعملاء</h1>
          <p className="text-xs text-[#7A817E] font-medium">
            تسجيل ديون الزبائن، متابعة الأرصدة المستحقة، وتسجيل دفعات السداد
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-[#1FA47A] hover:bg-[#15906B] text-white px-4 py-2.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة حساب آجل</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#ECECE8] p-5 rounded-3xl shadow-sm">
          <span className="text-xs font-bold text-[#7A817E] block mb-1">إجمالي الديون المستحقة</span>
          <div className="text-2xl font-black text-[#E35B2D]">
            {formatCurrency(totalOutstanding)}
          </div>
        </div>

        <div className="bg-white border border-[#ECECE8] p-5 rounded-3xl shadow-sm">
          <span className="text-xs font-bold text-[#7A817E] block mb-1">المبالغ المسددة</span>
          <div className="text-2xl font-black text-[#1FA47A]">
            {formatCurrency(totalCollected)}
          </div>
        </div>

        <div className="bg-white border border-[#ECECE8] p-5 rounded-3xl shadow-sm">
          <span className="text-xs font-bold text-[#7A817E] block mb-1">عدد حسابات العملاء</span>
          <div className="text-2xl font-black text-[#0D2420]">
            {formatNumber(debts.length)} عميل
          </div>
        </div>
      </div>

      {/* Customer Debts List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {debts.map((debt) => {
          const remaining = debt.total - debt.paid;
          const isSettled = remaining <= 0;

          return (
            <div
              key={debt.id}
              className={`bg-white border rounded-3xl p-5 shadow-sm space-y-3 flex flex-col justify-between transition ${
                isSettled ? 'border-[#ECECE8] opacity-75' : 'border-[#ECECE8] hover:border-[#1FA47A]/40'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      isSettled
                        ? 'bg-[#E5F5EF] text-[#1FA47A]'
                        : 'bg-[#FDE5D8] text-[#E35B2D]'
                    }`}
                  >
                    {isSettled ? 'تم السداد بالكامل' : 'متبقي حساب'}
                  </span>
                  <span className="text-[11px] text-[#7A817E]">{formatDate(debt.createdAt)}</span>
                </div>

                <h3 className="font-black text-base text-[#0D2420]">{debt.customerName}</h3>

                {debt.phone && (
                  <div className="flex items-center gap-1.5 text-xs text-[#7A817E] mt-1">
                    <Phone className="w-3.5 h-3.5" />
                    <span className="font-mono">{debt.phone}</span>
                  </div>
                )}

                {debt.note && (
                  <p className="text-xs text-[#7A817E] bg-[#FAF9F6] p-2.5 rounded-xl border border-[#ECECE8] mt-2.5">
                    {debt.note}
                  </p>
                )}

                <div className="mt-4 pt-3 border-t border-[#ECECE8] space-y-1.5 text-xs">
                  <div className="flex justify-between font-bold text-[#7A817E]">
                    <span>إجمالي الدين:</span>
                    <span>{formatCurrency(debt.total)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-[#1FA47A]">
                    <span>تم سداد:</span>
                    <span>{formatCurrency(debt.paid)}</span>
                  </div>
                  <div className="flex justify-between font-black text-sm text-[#0D2420] pt-1 border-t border-dashed border-[#ECECE8]">
                    <span>المتبقي:</span>
                    <span className={remaining > 0 ? 'text-[#E35B2D]' : 'text-[#1FA47A]'}>
                      {formatCurrency(remaining)}
                    </span>
                  </div>
                </div>
              </div>

              {!isSettled && (
                <div className="pt-2">
                  <button
                    onClick={() => {
                      setSettlingDebtId(debt.id);
                      setPaymentAmount(String(remaining));
                    }}
                    className="w-full bg-[#1FA47A] hover:bg-[#15906B] text-white py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>سداد دفعة</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {debts.length === 0 && (
          <div className="col-span-full bg-white rounded-3xl p-12 text-center text-[#7A817E] border border-[#ECECE8]">
            <CheckCircle className="w-12 h-12 mx-auto text-[#1FA47A] mb-3" />
            <h3 className="font-black text-base text-[#0D2420]">لا توجد ديون مسجلة</h3>
            <p className="text-xs mt-1">سجل معاملات الآجل مع العملاء لإدارتها ومتابعتها بسهولة</p>
          </div>
        )}
      </div>

      {/* Add Debt Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative border border-[#ECECE8]">
            <div className="flex items-center justify-between pb-3 border-b border-[#ECECE8]">
              <h2 className="text-base font-black text-[#0D2420]">تسجيل حساب آجل جديد</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-[#7A817E] p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddDebt} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#0D2420] block mb-1">اسم العميل *</label>
                <input
                  required
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="محمد أحمد"
                  className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl px-3 py-2 text-xs font-bold text-[#0D2420]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#0D2420] block mb-1">رقم الهاتف (اختياري)</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010xxxxxxx"
                  className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl px-3 py-2 text-xs font-bold text-[#0D2420]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#0D2420] block mb-1">المبلغ الإجمالي (ج.م) *</label>
                <input
                  required
                  type="number"
                  step="0.5"
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                  placeholder="150"
                  className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl px-3 py-2 text-xs font-bold text-[#0D2420]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#0D2420] block mb-1">ملاحظة / الأدوية المسحوبة</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="علاج شهري، مضاد..."
                  className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl px-3 py-2 text-xs font-bold text-[#0D2420]"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-[#1FA47A] hover:bg-[#15906B] text-white py-2.5 rounded-xl text-xs font-black shadow-md transition"
                >
                  حفظ الحساب
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="bg-[#FAF9F6] text-[#0D2420] px-4 py-2.5 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle Debt Modal */}
      {settlingDebtId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative border border-[#ECECE8]">
            <h3 className="font-black text-base text-[#0D2420]">تسجيل دفعة سداد</h3>
            <p className="text-xs text-[#7A817E]">أدخل المبلغ الذي قام العميل بسداده نقدًا</p>

            <form onSubmit={handleSettle} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#0D2420] block mb-1">المبلغ المسدد (ج.م) *</label>
                <input
                  required
                  type="number"
                  step="0.5"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl px-3 py-2 text-xs font-bold text-[#0D2420]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-[#1FA47A] hover:bg-[#15906B] text-white py-2.5 rounded-xl text-xs font-black transition"
                >
                  تأكيد السداد
                </button>
                <button
                  type="button"
                  onClick={() => setSettlingDebtId(null)}
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
