import React, { useState } from 'react';
import {
  Truck,
  Plus,
  Phone,
  Trash2,
  X,
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';

export const SuppliersScreen: React.FC = () => {
  const { suppliers, addSupplier, deleteSupplier } = usePharmacy();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');

  const handleAddSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !company.trim()) return;

    addSupplier({
      name: name.trim(),
      company: company.trim(),
      phone: phone.trim() || '—',
    });

    setIsAddModalOpen(false);
    setName('');
    setCompany('');
    setPhone('');
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0D2420]">دليل الموردين وشركات الأدوية</h1>
          <p className="text-xs text-[#7A817E] font-medium">
            جهات الاتصال بشركات التوزيع ومندوبي الأدوية لطلب النواقص وتتبع الشحنات
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-[#1FA47A] hover:bg-[#15906B] text-white px-4 py-2.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة مورد جديد</span>
        </button>
      </div>

      {/* Suppliers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {suppliers.map((sup) => (
          <div
            key={sup.id}
            className="bg-white border border-[#ECECE8] rounded-3xl p-5 shadow-sm space-y-3 flex flex-col justify-between hover:border-[#1FA47A]/40 transition"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="bg-[#E5F5EF] text-[#1FA47A] text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                  {sup.company}
                </span>
                <span className="text-[11px] text-[#7A817E] font-medium">
                  آخر طلب: {sup.lastOrder}
                </span>
              </div>

              <h3 className="font-black text-base text-[#0D2420]">{sup.name}</h3>

              <div className="flex items-center gap-2 text-xs font-mono text-[#0D2420] mt-2 bg-[#FAF9F6] p-2.5 rounded-xl border border-[#ECECE8]">
                <Phone className="w-4 h-4 text-[#1FA47A]" />
                <span className="font-bold">{sup.phone}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-[#ECECE8] flex items-center justify-between gap-2">
              <a
                href={`tel:${sup.phone}`}
                className="flex-1 bg-[#1FA47A] hover:bg-[#15906B] text-white py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>اتصال بالمندوب</span>
              </a>

              <button
                onClick={() => {
                  if (confirm(`هل أنت متأكد من حذف ${sup.name}؟`)) {
                    deleteSupplier(sup.id);
                  }
                }}
                className="text-[#7A817E] hover:text-[#C64536] p-2 hover:bg-[#FCE8E2] rounded-xl transition"
                title="حذف المورد"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {suppliers.length === 0 && (
          <div className="col-span-full bg-white rounded-3xl p-12 text-center text-[#7A817E] border border-[#ECECE8]">
            <Truck className="w-12 h-12 mx-auto text-[#ECECE8] mb-3" />
            <h3 className="font-black text-base text-[#0D2420]">لا يوجد موردون مسجلون</h3>
            <p className="text-xs mt-1">أضف شركات الأدوية والمخازن لربطها بطلبيات النواقص</p>
          </div>
        )}
      </div>

      {/* Add Supplier Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative border border-[#ECECE8]">
            <div className="flex items-center justify-between pb-3 border-b border-[#ECECE8]">
              <h2 className="text-base font-black text-[#0D2420]">إضافة مورد / شركة أدوية</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-[#7A817E] p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSupplier} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#0D2420] block mb-1">اسم المندوب / جهة الاتصال *</label>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: أحمد عبد الله"
                  className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl px-3 py-2 text-xs font-bold text-[#0D2420]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#0D2420] block mb-1">اسم الشركة / المخزن *</label>
                <input
                  required
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="مثال: المتحدة، ابن سينا، فارما أوفرسيز..."
                  className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl px-3 py-2 text-xs font-bold text-[#0D2420]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#0D2420] block mb-1">رقم الهاتف *</label>
                <input
                  required
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01012345678"
                  className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl px-3 py-2 text-xs font-bold text-[#0D2420]"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-[#1FA47A] hover:bg-[#15906B] text-white py-2.5 rounded-xl text-xs font-black shadow-md transition"
                >
                  حفظ المورد
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
