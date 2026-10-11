import React, { useState } from 'react';
import {
  Receipt,
  Plus,
  X,
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { formatCurrency, formatDateTime } from '../utils/format';

export const ExpensesScreen: React.FC = () => {
  const { expenses, addExpense, activeShift } = usePharmacy();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<'تشغيل' | 'توريد' | 'أخرى'>('تشغيل');

  const todayStr = new Date().toDateString();
  const todaysExpenses = expenses.filter((e) => new Date(e.createdAt).toDateString() === todayStr);

  const totalExpenseAll = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalExpenseToday = todaysExpenses.reduce((sum, e) => sum + e.amount, 0);

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amount) return;

    addExpense({
      title: title.trim(),
      amount: parseFloat(amount) || 0,
      category,
    });

    setIsAddModalOpen(false);
    setTitle('');
    setAmount('');
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0D2420]">المصروفات اليومية والتشغيلية</h1>
          <p className="text-xs text-[#7A817E] font-medium">
            تسجيل نثريات الصيدلية، تكاليف التوريد والتشغيل، وخصمها من خزينة الوردية
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-[#C64536] hover:bg-[#B33A2C] text-white px-4 py-2.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>تسجيل مصروف جديد</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-[#ECECE8] p-5 rounded-3xl shadow-sm">
          <span className="text-xs font-bold text-[#7A817E] block mb-1">مصروفات اليوم</span>
          <div className="text-3xl font-black text-[#C64536]">
            {formatCurrency(totalExpenseToday)}
          </div>
          <span className="text-[11px] text-[#7A817E] mt-1 block">
            عدد بنود اليوم: {todaysExpenses.length}
          </span>
        </div>

        <div className="bg-white border border-[#ECECE8] p-5 rounded-3xl shadow-sm">
          <span className="text-xs font-bold text-[#7A817E] block mb-1">إجمالي المصروفات المسجلة</span>
          <div className="text-3xl font-black text-[#0D2420]">
            {formatCurrency(totalExpenseAll)}
          </div>
          <span className="text-[11px] text-[#7A817E] mt-1 block">
            عدد البنود الكلي: {expenses.length}
          </span>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-3xl border border-[#ECECE8] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-[#FAF9F6] border-b border-[#ECECE8] text-[#7A817E] font-bold">
              <tr>
                <th className="py-3.5 pr-4">بند المصروف</th>
                <th className="py-3.5 pr-3">التصنيف</th>
                <th className="py-3.5 pr-3">المبلغ</th>
                <th className="py-3.5 pr-3">التاريخ والوقت</th>
                <th className="py-3.5 pr-3">حالة الوردية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECECE8]">
              {expenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-[#FAF9F6]/60 transition">
                  <td className="py-3.5 pr-4 font-black text-sm text-[#0D2420]">{exp.title}</td>
                  <td className="py-3.5 pr-3">
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        exp.category === 'تشغيل'
                          ? 'bg-[#E5F5EF] text-[#1FA47A]'
                          : exp.category === 'توريد'
                          ? 'bg-[#FDE5D8] text-[#E35B2D]'
                          : 'bg-[#FAF9F6] text-[#7A817E]'
                      }`}
                    >
                      {exp.category}
                    </span>
                  </td>
                  <td className="py-3.5 pr-3 font-black text-sm text-[#C64536]">
                    {formatCurrency(exp.amount)}
                  </td>
                  <td className="py-3.5 pr-3 text-[#7A817E]">{formatDateTime(exp.createdAt)}</td>
                  <td className="py-3.5 pr-3 text-[#7A817E]">
                    {exp.shiftId ? (
                      <span className="text-[11px] font-bold text-[#1FA47A]">
                        مربوط بوردية الخزينة
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#7A817E]">خارج الوردية</span>
                    )}
                  </td>
                </tr>
              ))}

              {expenses.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#7A817E]">
                    <Receipt className="w-10 h-10 mx-auto text-[#ECECE8] mb-2" />
                    <p className="text-sm font-bold">لا توجد مصروفات مسجلة</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative border border-[#ECECE8]">
            <div className="flex items-center justify-between pb-3 border-b border-[#ECECE8]">
              <h2 className="text-base font-black text-[#0D2420]">تسجيل مصروف جديد</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-[#7A817E] p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#0D2420] block mb-1">بيان المصروف *</label>
                <input
                  required
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: فاتورة كهرباء، أكياس، صيانة..."
                  className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl px-3 py-2 text-xs font-bold text-[#0D2420]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#0D2420] block mb-1">المبلغ (ج.م) *</label>
                <input
                  required
                  type="number"
                  step="0.5"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="50"
                  className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl px-3 py-2 text-xs font-bold text-[#0D2420]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#0D2420] block mb-1">نوع المصروف</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl px-3 py-2 text-xs font-bold text-[#0D2420]"
                >
                  <option value="تشغيل">مصروف تشغيل (فواتير، صيانة، نظافة)</option>
                  <option value="توريد">توريد بضاعة ونقل</option>
                  <option value="أخرى">أخرى ونثريات</option>
                </select>
              </div>

              {activeShift && (
                <p className="text-[11px] text-[#1FA47A] font-bold bg-[#E5F5EF] p-2 rounded-xl">
                  سيتم خصم هذا المبلغ تلقائيًا من الدرج للوردية الحالية: {activeShift.pharmacistName}
                </p>
              )}

              <div className="pt-3 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-[#C64536] hover:bg-[#B33A2C] text-white py-2.5 rounded-xl text-xs font-black shadow-md transition"
                >
                  تسجيل وخصم المصروف
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
    </div>
  );
};
