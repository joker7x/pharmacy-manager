import React, { useState, useMemo } from 'react';
import {
  Package,
  Search,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  Clock,
  X,
  TrendingDown,
  ShoppingBag,
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { Medication } from '../types/pharmacy';
import { formatCurrency, formatNumber, formatDate, daysUntil } from '../utils/format';

export const InventoryScreen: React.FC = () => {
  const { medications, addMedication, updateMedication, deleteMedication, logShortage } = usePharmacy();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'low' | 'out' | 'expiring'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
  const [shortageMedication, setShortageMedication] = useState<Medication | null>(null);
  const [desiredQty, setDesiredQty] = useState('10');
  const [shortageNote, setShortageNote] = useState('');

  // Form states
  const [formState, setFormState] = useState({
    name: '',
    category: 'مسكنات',
    sku: '',
    barcode: '',
    price: '',
    quantity: '',
    unitsPerPackage: '1',
    reorderLevel: '10',
    expiryDate: '',
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    medications.forEach((m) => m.category && set.add(m.category));
    return ['الكل', ...Array.from(set)];
  }, [medications]);

  // Filtered meds
  const filteredMedications = useMemo(() => {
    return medications.filter((m) => {
      // Category filter
      if (selectedCategory !== 'الكل' && m.category !== selectedCategory) return false;

      // Status filter
      if (filterType === 'out' && m.quantity > 0) return false;
      if (filterType === 'low' && (m.quantity > m.reorderLevel || m.quantity === 0)) return false;
      if (filterType === 'expiring' && daysUntil(m.expiryDate) > 60) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          m.name.toLowerCase().includes(q) ||
          m.sku.toLowerCase().includes(q) ||
          (m.barcode && m.barcode.includes(q))
        );
      }

      return true;
    });
  }, [medications, selectedCategory, filterType, searchQuery]);

  // Inventory stats
  const totalCount = medications.length;
  const outOfStockCount = medications.filter((m) => m.quantity === 0).length;
  const lowStockCount = medications.filter((m) => m.quantity > 0 && m.quantity <= m.reorderLevel).length;
  const expiringCount = medications.filter((m) => daysUntil(m.expiryDate) <= 60).length;

  const handleOpenAdd = () => {
    setFormState({
      name: '',
      category: 'مسكنات',
      sku: `SKU-${Date.now().toString().slice(-4)}`,
      barcode: '',
      price: '',
      quantity: '',
      unitsPerPackage: '1',
      reorderLevel: '10',
      expiryDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (med: Medication) => {
    setEditingMedication(med);
    setFormState({
      name: med.name,
      category: med.category,
      sku: med.sku,
      barcode: med.barcode || '',
      price: String(med.price),
      quantity: String(med.quantity),
      unitsPerPackage: String(med.unitsPerPackage || 1),
      reorderLevel: String(med.reorderLevel),
      expiryDate: med.expiryDate,
    });
  };

  const handleSaveMedication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name.trim() || !formState.price) return;

    const priceNum = parseFloat(formState.price) || 0;
    const qtyNum = parseInt(formState.quantity, 10) || 0;
    const reorderNum = parseInt(formState.reorderLevel, 10) || 5;
    const unitsNum = parseInt(formState.unitsPerPackage, 10) || 1;

    if (editingMedication) {
      updateMedication(editingMedication.id, {
        name: formState.name.trim(),
        category: formState.category,
        sku: formState.sku.trim(),
        barcode: formState.barcode.trim() || undefined,
        price: priceNum,
        quantity: qtyNum,
        reorderLevel: reorderNum,
        unitsPerPackage: unitsNum,
        expiryDate: formState.expiryDate,
      });
      setEditingMedication(null);
    } else {
      addMedication({
        name: formState.name.trim(),
        category: formState.category,
        sku: formState.sku.trim(),
        barcode: formState.barcode.trim() || undefined,
        price: priceNum,
        quantity: qtyNum,
        reorderLevel: reorderNum,
        unitsPerPackage: unitsNum,
        expiryDate: formState.expiryDate,
      });
      setIsAddModalOpen(false);
    }
  };

  const handleConfirmShortage = () => {
    if (!shortageMedication) return;
    const qty = parseInt(desiredQty, 10) || 10;
    logShortage({
      medicationId: shortageMedication.id,
      desiredQuantity: qty,
      urgency: shortageMedication.quantity === 0 ? 'critical' : 'high',
      notes: shortageNote || 'طلب سريع من شاشة المخزون',
    });
    setShortageMedication(null);
    setShortageNote('');
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0D2420]">إدارة المخزون والأدوية</h1>
          <p className="text-xs text-[#7A817E] font-medium">
            تتبع الكميات، تواريخ الصلاحية، أسعار البيع، وحدود إعادة الطلب
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="bg-[#1FA47A] hover:bg-[#15906B] text-white px-4 py-2.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة دواء جديد</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div
          onClick={() => setFilterType('all')}
          className={`cursor-pointer bg-white border p-4 rounded-2xl transition ${
            filterType === 'all' ? 'border-[#1FA47A] shadow-md bg-[#FAF9F6]' : 'border-[#ECECE8]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#7A817E]">إجمالي الأصناف</span>
            <Package className="w-4 h-4 text-[#1FA47A]" />
          </div>
          <div className="text-2xl font-black text-[#0D2420]">{formatNumber(totalCount)}</div>
        </div>

        <div
          onClick={() => setFilterType('low')}
          className={`cursor-pointer bg-white border p-4 rounded-2xl transition ${
            filterType === 'low' ? 'border-[#E35B2D] shadow-md bg-[#FDE5D8]/30' : 'border-[#ECECE8]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#7A817E]">مخزون منخفض</span>
            <TrendingDown className="w-4 h-4 text-[#E35B2D]" />
          </div>
          <div className="text-2xl font-black text-[#E35B2D]">{formatNumber(lowStockCount)}</div>
        </div>

        <div
          onClick={() => setFilterType('out')}
          className={`cursor-pointer bg-white border p-4 rounded-2xl transition ${
            filterType === 'out' ? 'border-[#C64536] shadow-md bg-[#FCE8E2]/30' : 'border-[#ECECE8]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#7A817E]">أصناف نافدة</span>
            <AlertTriangle className="w-4 h-4 text-[#C64536]" />
          </div>
          <div className="text-2xl font-black text-[#C64536]">{formatNumber(outOfStockCount)}</div>
        </div>

        <div
          onClick={() => setFilterType('expiring')}
          className={`cursor-pointer bg-white border p-4 rounded-2xl transition ${
            filterType === 'expiring' ? 'border-[#F59E0B] shadow-md bg-[#FFF4E5]/30' : 'border-[#ECECE8]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#7A817E]">صلاحية قريبة</span>
            <Clock className="w-4 h-4 text-[#F59E0B]" />
          </div>
          <div className="text-2xl font-black text-[#D97706]">{formatNumber(expiringCount)}</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-[#ECECE8] space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم، SKU، أو الباركود..."
              className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl pr-10 pl-4 py-2.5 text-xs font-bold text-[#0D2420] focus:outline-none focus:border-[#1FA47A]"
            />
            <Search className="w-4 h-4 text-[#7A817E] absolute right-3.5 top-1/2 -translate-y-1/2" />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-[#0D2420] text-white'
                    : 'bg-[#FAF9F6] text-[#7A817E] hover:bg-[#ECECE8]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Medication Table */}
      <div className="bg-white rounded-3xl border border-[#ECECE8] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-[#FAF9F6] border-b border-[#ECECE8] text-[#7A817E] font-bold">
              <tr>
                <th className="py-3.5 pr-4">الصنف الدوائي</th>
                <th className="py-3.5 pr-3">التصنيف</th>
                <th className="py-3.5 pr-3">السعر</th>
                <th className="py-3.5 pr-3">المخزون</th>
                <th className="py-3.5 pr-3">حد الطلب</th>
                <th className="py-3.5 pr-3">تاريخ الصلاحية</th>
                <th className="py-3.5 pr-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECECE8]">
              {filteredMedications.map((med) => {
                const daysLeft = daysUntil(med.expiryDate);
                const isExpired = daysLeft < 0;
                const isExpiringSoon = daysLeft <= 60;
                const isOutOfStock = med.quantity === 0;
                const isLowStock = !isOutOfStock && med.quantity <= med.reorderLevel;

                return (
                  <tr key={med.id} className="hover:bg-[#FAF9F6]/60 transition">
                    <td className="py-3.5 pr-4">
                      <div className="font-black text-sm text-[#0D2420]">{med.name}</div>
                      <div className="text-[11px] font-mono text-[#7A817E]">
                        SKU: {med.sku} {med.barcode ? `· باركود: ${med.barcode}` : ''}
                      </div>
                    </td>
                    <td className="py-3.5 pr-3">
                      <span className="bg-[#FAF9F6] text-[#7A817E] px-2.5 py-1 rounded-lg font-bold text-[11px]">
                        {med.category}
                      </span>
                    </td>
                    <td className="py-3.5 pr-3 font-black text-sm text-[#1FA47A]">
                      {formatCurrency(med.price)}
                    </td>
                    <td className="py-3.5 pr-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() =>
                            updateMedication(med.id, { quantity: Math.max(0, med.quantity - 1) })
                          }
                          className="w-6 h-6 rounded-md bg-[#FAF9F6] hover:bg-[#ECECE8] flex items-center justify-center font-bold"
                          title="إنقاص 1"
                        >
                          -
                        </button>
                        <span
                          className={`font-black text-sm px-2 py-0.5 rounded-lg ${
                            isOutOfStock
                              ? 'bg-[#FCE8E2] text-[#C64536]'
                              : isLowStock
                              ? 'bg-[#FDE5D8] text-[#E35B2D]'
                              : 'text-[#0D2420]'
                          }`}
                        >
                          {formatNumber(med.quantity)}
                        </span>
                        <button
                          onClick={() => updateMedication(med.id, { quantity: med.quantity + 1 })}
                          className="w-6 h-6 rounded-md bg-[#FAF9F6] hover:bg-[#ECECE8] flex items-center justify-center font-bold"
                          title="زيادة 1"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="py-3.5 pr-3 font-bold text-[#7A817E]">
                      {formatNumber(med.reorderLevel)}
                    </td>
                    <td className="py-3.5 pr-3">
                      <div className="flex items-center gap-1">
                        <span
                          className={`font-bold ${
                            isExpired
                              ? 'text-[#C64536]'
                              : isExpiringSoon
                              ? 'text-[#D97706]'
                              : 'text-[#7A817E]'
                          }`}
                        >
                          {formatDate(med.expiryDate)}
                        </span>
                        {isExpiringSoon && (
                          <span
                            className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                              isExpired
                                ? 'bg-[#FCE8E2] text-[#C64536]'
                                : 'bg-[#FFF4E5] text-[#D97706]'
                            }`}
                          >
                            {isExpired ? 'منتهي' : `${daysLeft} يوم`}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 pr-3">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Shortage quick button */}
                        <button
                          onClick={() => {
                            setShortageMedication(med);
                            setDesiredQty(String(Math.max(5, med.reorderLevel * 2)));
                          }}
                          className="p-1.5 text-[#E35B2D] hover:bg-[#FDE5D8] rounded-lg transition"
                          title="تسجيل كنقص وطلب توريد"
                        >
                          <ShoppingBag className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(med)}
                          className="p-1.5 text-[#7A817E] hover:text-[#1FA47A] hover:bg-[#E5F5EF] rounded-lg transition"
                          title="تعديل"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`هل أنت متأكد من حذف ${med.name} من قاعدة البيانات؟`)) {
                              deleteMedication(med.id);
                            }
                          }}
                          className="p-1.5 text-[#7A817E] hover:text-[#C64536] hover:bg-[#FCE8E2] rounded-lg transition"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredMedications.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#7A817E]">
                    <Package className="w-10 h-10 mx-auto text-[#ECECE8] mb-2" />
                    <p className="text-sm font-bold">لا توجد أدوية مطابقة للشروط</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Medication Modal */}
      {(isAddModalOpen || editingMedication) && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative border border-[#ECECE8] animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#ECECE8]">
              <h2 className="text-lg font-black text-[#0D2420]">
                {editingMedication ? 'تعديل بيانات الدواء' : 'إضافة دواء جديد للمخزون'}
              </h2>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingMedication(null);
                }}
                className="text-[#7A817E] hover:text-[#0D2420] p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMedication} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#0D2420] block mb-1">اسم الدواء والشكل الصيدلي *</label>
                <input
                  required
                  type="text"
                  value={formState.name}
                  onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                  placeholder="مثال: بنادول إكسترا 24 قرص"
                  className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0D2420] focus:outline-none focus:border-[#1FA47A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#0D2420] block mb-1">الفئة / التصنيف</label>
                  <input
                    type="text"
                    value={formState.category}
                    onChange={(e) => setFormState({ ...formState, category: e.target.value })}
                    placeholder="مثال: مسكنات، مضاد حيوي"
                    className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0D2420] focus:outline-none focus:border-[#1FA47A]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#0D2420] block mb-1">سعر البيع للجمهور (ج.م) *</label>
                  <input
                    required
                    type="number"
                    step="0.25"
                    value={formState.price}
                    onChange={(e) => setFormState({ ...formState, price: e.target.value })}
                    placeholder="مثال: 72"
                    className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0D2420] focus:outline-none focus:border-[#1FA47A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#0D2420] block mb-1">الكمية الحالية بالصيدلية</label>
                  <input
                    type="number"
                    value={formState.quantity}
                    onChange={(e) => setFormState({ ...formState, quantity: e.target.value })}
                    placeholder="مثال: 20"
                    className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0D2420] focus:outline-none focus:border-[#1FA47A]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#0D2420] block mb-1">حد إعادة الطلب (تنبيه النواقص)</label>
                  <input
                    type="number"
                    value={formState.reorderLevel}
                    onChange={(e) => setFormState({ ...formState, reorderLevel: e.target.value })}
                    placeholder="مثال: 10"
                    className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0D2420] focus:outline-none focus:border-[#1FA47A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#0D2420] block mb-1">تاريخ الصلاحية</label>
                  <input
                    type="date"
                    value={formState.expiryDate}
                    onChange={(e) => setFormState({ ...formState, expiryDate: e.target.value })}
                    className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0D2420] focus:outline-none focus:border-[#1FA47A]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#0D2420] block mb-1">الباركود (اختياري)</label>
                  <input
                    type="text"
                    value={formState.barcode}
                    onChange={(e) => setFormState({ ...formState, barcode: e.target.value })}
                    placeholder="الرقم التعريفي للباركود"
                    className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0D2420] focus:outline-none focus:border-[#1FA47A]"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-[#1FA47A] hover:bg-[#15906B] text-white py-2.5 rounded-xl text-xs font-black shadow-md transition"
                >
                  {editingMedication ? 'حفظ التعديلات' : 'إضافة إلى المخزون'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingMedication(null);
                  }}
                  className="bg-[#FAF9F6] hover:bg-[#ECECE8] text-[#0D2420] px-4 py-2.5 rounded-xl text-xs font-bold transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Shortage Modal */}
      {shortageMedication && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative border border-[#ECECE8]">
            <h3 className="font-black text-base text-[#0D2420]">
              تسجيل في قائمة النواقص
            </h3>
            <p className="text-xs text-[#7A817E]">
              إضافة <strong className="text-[#0D2420]">{shortageMedication.name}</strong> إلى طلبية النواقص
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[#0D2420] block mb-1">الكمية المطلوبة</label>
                <input
                  type="number"
                  value={desiredQty}
                  onChange={(e) => setDesiredQty(e.target.value)}
                  className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl px-3 py-2 text-xs font-bold text-[#0D2420]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#0D2420] block mb-1">ملاحظة / اسم الزبون الطالب</label>
                <input
                  type="text"
                  value={shortageNote}
                  onChange={(e) => setShortageNote(e.target.value)}
                  placeholder="طلب عاجل من الزبون..."
                  className="w-full bg-[#FAF9F6] border border-[#ECECE8] rounded-xl px-3 py-2 text-xs font-bold text-[#0D2420]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleConfirmShortage}
                className="flex-1 bg-[#E35B2D] hover:bg-[#D66A42] text-white py-2.5 rounded-xl text-xs font-black transition"
              >
                تأكيد النقص
              </button>
              <button
                onClick={() => setShortageMedication(null)}
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
