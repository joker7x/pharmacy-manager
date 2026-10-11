import React, { useState } from 'react';
import {
  AlertTriangle,
  Plus,
  Truck,
  CheckCircle,
  Trash2,
  X,
  PackageCheck,
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { formatNumber, formatDate } from '../utils/format';

export const AlertsScreen: React.FC = () => {
  const {
    reorderNeeds,
    medications,
    suppliers,
    logShortage,
    markReorderOrdered,
    markReorderReceived,
    deleteReorderRecord,
  } = usePharmacy();

  const [activeTab, setActiveTab] = useState<'needed' | 'ordered' | 'received'>('needed');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedSupplierModalItem, setSelectedSupplierModalItem] = useState<string | null>(null);
  const [chosenSupplier, setChosenSupplier] = useState<string>('');

  // Form state for adding new shortage
  const [selectedMedId, setSelectedMedId] = useState('');
  const [desiredQty, setDesiredQty] = useState('10');
  const [urgency, setUrgency] = useState<'critical' | 'high' | 'normal'>('high');
  const [note, setNote] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const neededList = reorderNeeds.filter((r) => r.status === 'needed');
  const orderedList = reorderNeeds.filter((r) => r.status === 'ordered');
  const receivedList = reorderNeeds.filter((r) => r.status === 'received');

  const currentList =
    activeTab === 'needed' ? neededList : activeTab === 'ordered' ? orderedList : receivedList;

  const handleAddShortage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedId) return;

    logShortage({
      medicationId: selectedMedId,
      desiredQuantity: parseInt(desiredQty, 10) || 10,
      urgency,
      notes: note,
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
    });

    setIsAddModalOpen(false);
    setSelectedMedId('');
    setNote('');
    setCustomerName('');
    setCustomerPhone('');
  };

  const handleOrderConfirm = (medicationId: string) => {
    markReorderOrdered(medicationId, chosenSupplier || 'المتحدة للأدوية');
    setSelectedSupplierModalItem(null);
    setChosenSupplier('');
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0D2420]">النواقص وطلبيات الموردين</h1>
          <p className="text-xs text-[#7A817E] font-medium">
            متابعة الأصناف الناقصة، وإرسال طلبيات التوريد، واستلام الشحنات إلى المخزن
          </p>
        </div>

        <button
          onClick={() => {
            if (medications.length > 0) setSelectedMedId(medications[0].id);
            setIsAddModalOpen(true);
          }}
          className="bg-[#E35B2D] hover:bg-[#D66A42] text-white px-4 py-2.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>تسجيل صنف ناقص</span>
        </button>
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-[#ECECE8] space-x-2 space-x-reverse">
        <button
          onClick={() => setActiveTab('needed')}
          className={`pb-3 px-4 font-black text-xs transition border-b-2 flex items-center gap-2 ${
            activeTab === 'needed'
              ? 'border-[#E35B2D] text-[#E35B2D]'
              : 'border-transparent text-[#7A817E] hover:text-[#0D2420]'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>مطلوبة ({formatNumber(neededList.length)})</span>
        </button>

        <button
          onClick={() => setActiveTab('ordered')}
          className={`pb-3 px-4 font-black text-xs transition border-b-2 flex items-center gap-2 ${
            activeTab === 'ordered'
              ? 'border-[#0D2420] text-[#0D2420]'
              : 'border-transparent text-[#7A817E] hover:text-[#0D2420]'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>قيد التوريد ({formatNumber(orderedList.length)})</span>
        </button>

        <button
          onClick={() => setActiveTab('received')}
          className={`pb-3 px-4 font-black text-xs transition border-b-2 flex items-center gap-2 ${
            activeTab === 'received'
              ? 'border-[#1FA47A] text-[#1FA47A]'
              : 'border-transparent text-[#7A817E] hover:text-[#0D2420]'
          }`}
        >
          <CheckCircle className="w-4 h-4" />
          <span>تم الاستلام ({formatNumber(receivedList.length)})</span>
        </button>
      </div>

      {/* List Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {currentList.map((item) => {
          const isCritical = item.urgency === 'critical';
          const isHigh = item.urgency === 'high';

          return (
            <div
              key={item.medicationId}
              className="bg-white border border-[#ECECE8] rounded-3xl p-5 shadow-sm space-y-3 flex flex-col justify-between hover:border-[#1FA47A]/40 transition"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      isCritical
                        ? 'bg-[#FCE8E2] text-[#C64536]'
                        : isHigh
                        ? 'bg-[#FDE5D8] text-[#E35B2D]'
                        : 'bg-[#E5F5EF] text-[#1FA47A]'
                    }`}
                  >
                    {isCritical ? 'حرج جدًا' : isHigh ? 'عاجل' : 'عادي'}
                  </span>

                  <span className="text-[11px] font-medium text-[#7A817E]">
                    {formatDate(item.markedAt)}
                  </span>
                </div>

                <h3 className="font-black text-base text-[#0D2420] leading-snug">
                  {item.medication.name}
                </h3>
                <p className="text-xs text-[#7A817E] font-medium mt-1">
                  المخزون الحالي:{' '}
                  <strong className="text-[#0D2420]">{formatNumber(item.medication.quantity)}</strong> ·
                  الكمية المطلوبة:{' '}
                  <strong className="text-[#1FA47A]">{formatNumber(item.desiredQuantity)} علبة</strong>
                </p>

                {item.customerName && (
                  <div className="bg-[#FAF9F6] p-2.5 rounded-xl border border-[#ECECE8] mt-2.5 text-xs text-[#0D2420]">
                    <span className="text-[#7A817E] font-bold block mb-0.5">طلب لعميل:</span>
                    <p className="font-bold">
                      {item.customerName} {item.customerPhone ? `(${item.customerPhone})` : ''}
                    </p>
                  </div>
                )}

                {item.notes && (
                  <p className="text-xs text-[#7A817E] bg-gray-50 p-2 rounded-xl mt-2 font-medium">
                    ملاحظة: {item.notes}
                  </p>
                )}

                {item.supplierName && (
                  <p className="text-xs text-[#1FA47A] font-bold mt-2">
                    المورد المكلّف: {item.supplierName}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#ECECE8] flex items-center justify-between gap-2">
                {activeTab === 'needed' && (
                  <button
                    onClick={() => {
                      setSelectedSupplierModalItem(item.medicationId);
                      setChosenSupplier(suppliers[0]?.name || 'المتحدة للأدوية');
                    }}
                    className="flex-1 bg-[#0D2420] hover:bg-[#1FA47A] text-white py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>طلب من المورد</span>
                  </button>
                )}

                {activeTab === 'ordered' && (
                  <button
                    onClick={() => markReorderReceived(item.medicationId, item.desiredQuantity, true)}
                    className="flex-1 bg-[#1FA47A] hover:bg-[#15906B] text-white py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <PackageCheck className="w-3.5 h-3.5" />
                    <span>استلام وإضافة للمخزون (+{item.desiredQuantity})</span>
                  </button>
                )}

                {activeTab === 'received' && (
                  <div className="flex items-center gap-1 text-xs font-bold text-[#1FA47A]">
                    <CheckCircle className="w-4 h-4" />
                    <span>تم الاستلام ({item.receivedQty || item.desiredQuantity} وحدة)</span>
                  </div>
                )}

                <button
                  onClick={() => deleteReorderRecord(item.medicationId)}
                  className="text-[#7A817E] hover:text-[#C64536] p-2 hover:bg-[#FCE8E2] rounded-xl transition"
                  title="حذف من القائمة"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {currentList.length === 0 && (
          <div className="col-span-full bg-white rounded-3xl p-12 text-center text-[#7A817E] border border-[#ECECE8]">
            <CheckCircle className="w-12 h-12 mx-auto text-[#1FA47A] mb-3" />
            <h3 className="font-black text-base text-[#0D2420]">
              {activeTab === 'needed'
                ? 'لا توجد نواقص بحاجة للطلب'
                : activeTab === 'ordered'
                ? 'لا توجد طلبيات قيد التوريد حاليًا'
                : 'لا توجد أصناف مستلمة سابقة'}
            </h3>
            <p className="text-xs mt-1">جميع احتياجات الصيدلية متوفرة ومكتملة</p>
          </div>
        )}
      </div>

      {/* Add Shortage Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative border border-[#ECECE8]">
            <div className="flex items-center justify-between pb-3 border-b border-[#ECECE8]">
              <h2 className="text-base font-black text-[#0D2420]">تسجيل صنف ناقص جديد</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-[#7A817E] p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddShortage} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#0D2420] block mb-1">اختر الدواء من القائمة *</label>
                <select
                  value={selectedMedId}
                  onChange={(e) => setSelectedMedId(e.target.value)}
                  className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl px-3 py-2.5 text-xs font-bold text-[#0D2420]"
                >
                  {medications.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} (المتاح: {m.quantity})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#0D2420] block mb-1">الكمية المطلوبة (علب) *</label>
                  <input
                    type="number"
                    value={desiredQty}
                    onChange={(e) => setDesiredQty(e.target.value)}
                    className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl px-3 py-2 text-xs font-bold text-[#0D2420]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#0D2420] block mb-1">درجة الأهمية</label>
                  <select
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value as any)}
                    className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl px-3 py-2 text-xs font-bold text-[#0D2420]"
                  >
                    <option value="critical">حرج (نفد تمامًا)</option>
                    <option value="high">عاجل (مطلوب لعميل)</option>
                    <option value="normal">عادي (مخزون احتياطي)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#0D2420] block mb-1">اسم العميل (اختياري)</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="اسم المريض/العميل"
                    className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl px-3 py-2 text-xs font-bold text-[#0D2420]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#0D2420] block mb-1">هاتف العميل</label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="010xxxxxxx"
                    className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl px-3 py-2 text-xs font-bold text-[#0D2420]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#0D2420] block mb-1">ملاحظات إضافية</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="مثال: يفضل تشغيلة حديثة"
                  className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl px-3 py-2 text-xs font-bold text-[#0D2420]"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-[#E35B2D] hover:bg-[#D66A42] text-white py-2.5 rounded-xl text-xs font-black shadow-md transition"
                >
                  إضافة لقائمة النواقص
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

      {/* Supplier Selection Modal */}
      {selectedSupplierModalItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative border border-[#ECECE8]">
            <h3 className="font-black text-base text-[#0D2420]">إرسال طلبية للمورد</h3>
            <p className="text-xs text-[#7A817E]">
              اختر شركة التوزيع أو المورد الذي سيوفر هذا الصنف
            </p>

            <div className="space-y-2">
              {suppliers.map((sup) => (
                <div
                  key={sup.id}
                  onClick={() => setChosenSupplier(sup.company || sup.name)}
                  className={`p-3 rounded-2xl border cursor-pointer transition flex items-center justify-between text-xs font-bold ${
                    chosenSupplier === (sup.company || sup.name)
                      ? 'border-[#1FA47A] bg-[#E5F5EF] text-[#1FA47A]'
                      : 'border-[#ECECE8] hover:bg-[#FAF9F6] text-[#0D2420]'
                  }`}
                >
                  <div>
                    <p className="font-black">{sup.company}</p>
                    <p className="text-[11px] text-[#7A817E]">{sup.name} ({sup.phone})</p>
                  </div>
                  {chosenSupplier === (sup.company || sup.name) && (
                    <CheckCircle className="w-4 h-4 text-[#1FA47A]" />
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => handleOrderConfirm(selectedSupplierModalItem)}
                className="flex-1 bg-[#0D2420] hover:bg-[#1FA47A] text-white py-2.5 rounded-xl text-xs font-black transition"
              >
                تأكيد الإرسال للتوريد
              </button>
              <button
                onClick={() => setSelectedSupplierModalItem(null)}
                className="bg-[#FAF9F6] text-[#0D2420] px-4 py-2.5 rounded-xl text-xs font-bold"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
