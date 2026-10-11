import React, { useState, useMemo } from 'react';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Printer,
  X,
  Banknote,
  Smartphone,
  Pill,
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { CartItem, NewSalePaymentMethod, Medication, Sale } from '../types/pharmacy';
import { formatCurrency, formatNumber, formatDateTime } from '../utils/format';

export const SalesScreen: React.FC = () => {
  const { medications, completeSale, activeShift, settings } = usePharmacy();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<NewSalePaymentMethod>('نقدي');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [lastCompletedSale, setLastCompletedSale] = useState<Sale | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Extract distinct categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    medications.forEach((m) => {
      if (m.category) cats.add(m.category);
    });
    return ['الكل', ...Array.from(cats)];
  }, [medications]);

  // Filter medications
  const filteredMedications = useMemo(() => {
    return medications.filter((med) => {
      const matchesCategory = selectedCategory === 'الكل' || med.category === selectedCategory;
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        med.name.toLowerCase().includes(query) ||
        med.sku.toLowerCase().includes(query) ||
        (med.barcode && med.barcode.toLowerCase().includes(query));
      return matchesCategory && matchesSearch;
    });
  }, [medications, selectedCategory, searchQuery]);

  // Cart operations
  const addToCart = (med: Medication) => {
    if (med.quantity <= 0) {
      triggerToast(`عذرًا، ${med.name} نافد من المخزون!`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.medicationId === med.id);
      if (existing) {
        if (existing.quantity >= med.quantity) {
          triggerToast(`وصلت للحد الأقصى للكمية المتاحة (${med.quantity})`);
          return prev;
        }
        return prev.map((item) =>
          item.medicationId === med.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        return [
          ...prev,
          {
            medicationId: med.id,
            name: med.name,
            unitPrice: med.price,
            quantity: 1,
            unitLabel: 'علبة',
          },
        ];
      }
    });
  };

  const updateQuantity = (medicationId: string, delta: number) => {
    const med = medications.find((m) => m.id === medicationId);
    if (!med) return;

    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.medicationId === medicationId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > med.quantity) {
              triggerToast(`الكمية المتاحة في المخزون هي ${med.quantity} فقط`);
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null);
    });
  };

  const removeFromCart = (medicationId: string) => {
    setCart((prev) => prev.filter((item) => item.medicationId !== medicationId));
  };

  const clearCart = () => {
    setCart([]);
    setCashReceived('');
  };

  // Calculations
  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }, [cart]);

  const parsedCashReceived = parseFloat(cashReceived) || 0;
  const changeAmount = paymentMethod === 'نقدي' && parsedCashReceived > 0 ? parsedCashReceived - cartTotal : 0;

  const handleCheckout = () => {
    if (cart.length === 0) return;

    if (paymentMethod === 'نقدي' && parsedCashReceived > 0 && parsedCashReceived < cartTotal) {
      triggerToast('المبلغ المستلم أقل من إجمالي الفاتورة!');
      return;
    }

    const saleRecord: Sale = {
      id: `INV-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString(),
      items: [...cart],
      total: cartTotal,
      paymentMethod,
      cashReceived: paymentMethod === 'نقدي' && parsedCashReceived > 0 ? parsedCashReceived : cartTotal,
      change: changeAmount > 0 ? changeAmount : 0,
      shiftId: activeShift?.id,
    };

    const success = completeSale(
      cart,
      paymentMethod,
      saleRecord.cashReceived,
      saleRecord.change
    );

    if (success) {
      setLastCompletedSale(saleRecord);
      setShowReceiptModal(true);
      clearCart();
      triggerToast('تم تسجيل الفاتورة بنجاح وتحديث المخزون');
    }
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-50 bg-[#0D2420] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-[#1FA47A]">
          <CheckCircle className="w-5 h-5 text-[#1FA47A]" />
          <span className="text-sm font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0D2420]">شاشة الكاشير والمبيعات</h1>
          <p className="text-xs text-[#7A817E] font-medium">
            بحث وتمرير سريع للأدوية وإصدار الفواتير النقدية والإلكترونية
          </p>
        </div>

        {activeShift ? (
          <div className="flex items-center gap-2 bg-[#E9F8F1] border border-[#1FA47A]/30 text-[#1FA47A] px-3.5 py-1.5 rounded-2xl text-xs font-bold w-fit">
            <span className="w-2 h-2 rounded-full bg-[#1FA47A] animate-pulse"></span>
            <span>الوردية الحالية: {activeShift.pharmacistName}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-[#FDE5D8] text-[#E35B2D] px-3.5 py-1.5 rounded-2xl text-xs font-bold w-fit">
            <AlertCircle className="w-4 h-4" />
            <span>تنبيه: لا توجد وردية مفتوحة حاليًا</span>
          </div>
        )}
      </div>

      {/* Main Layout: Catalog on Left (Right in RTL), Cart on Right (Left in RTL) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Products Search & List (8 columns) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم، الباركود، أو الرمز (SKU)..."
              className="w-full bg-white border border-[#ECECE8] rounded-2xl pr-12 pl-4 py-3.5 text-sm font-bold text-[#0D2420] placeholder:text-[#7A817E] focus:outline-none focus:border-[#1FA47A] shadow-sm transition"
            />
            <Search className="w-5 h-5 text-[#7A817E] absolute right-4 top-1/2 -translate-y-1/2" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#7A817E] hover:text-[#0D2420]"
              >
                مسح
              </button>
            )}
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-[#1FA47A] text-white shadow-sm'
                    : 'bg-white text-[#0D2420] border border-[#ECECE8] hover:bg-[#FAF9F6]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Medication Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5 max-h-[620px] overflow-y-auto pr-1">
            {filteredMedications.map((med) => {
              const inCartItem = cart.find((c) => c.medicationId === med.id);
              const isOutOfStock = med.quantity <= 0;
              const isLowStock = !isOutOfStock && med.quantity <= med.reorderLevel;

              return (
                <div
                  key={med.id}
                  onClick={() => !isOutOfStock && addToCart(med)}
                  className={`bg-white border rounded-2xl p-4 flex flex-col justify-between transition-all select-none ${
                    isOutOfStock
                      ? 'opacity-60 border-gray-200 cursor-not-allowed bg-gray-50'
                      : 'hover:border-[#1FA47A] hover:shadow-md cursor-pointer border-[#ECECE8] active:scale-[0.98]'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#FAF9F6] text-[#7A817E]">
                        {med.category}
                      </span>
                      {isOutOfStock ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#FCE8E2] text-[#C64536]">
                          نفد المخزون
                        </span>
                      ) : isLowStock ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#FDE5D8] text-[#E35B2D]">
                          المتاح: {formatNumber(med.quantity)}
                        </span>
                      ) : (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#E5F5EF] text-[#1FA47A]">
                          المتاح: {formatNumber(med.quantity)}
                        </span>
                      )}
                    </div>

                    <h3 className="font-black text-sm text-[#0D2420] leading-tight mb-1">
                      {med.name}
                    </h3>
                    <p className="text-[11px] font-mono text-[#7A817E]">SKU: {med.sku}</p>
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#ECECE8]">
                    <span className="font-black text-[#1FA47A] text-base">
                      {formatCurrency(med.price)}
                    </span>
                    <button
                      disabled={isOutOfStock}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isOutOfStock) addToCart(med);
                      }}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center transition ${
                        isOutOfStock
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : inCartItem
                          ? 'bg-[#1FA47A] text-white shadow-sm'
                          : 'bg-[#E5F5EF] text-[#1FA47A] hover:bg-[#1FA47A] hover:text-white'
                      }`}
                    >
                      {inCartItem ? (
                        <span className="text-xs font-black">{inCartItem.quantity}</span>
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredMedications.length === 0 && (
              <div className="col-span-full bg-white rounded-2xl p-8 text-center text-[#7A817E] border border-[#ECECE8]">
                <Pill className="w-10 h-10 mx-auto text-[#ECECE8] mb-2" />
                <p className="text-sm font-bold">لا توجد أدوية مطابقة لبحثك</p>
                <p className="text-xs">جرب البحث بكلمات أخرى أو اختر فئة مختلفة</p>
              </div>
            )}
          </div>
        </div>

        {/* Cart Drawer / Side Order Panel (4 or 5 columns) */}
        <div className="lg:col-span-5 xl:col-span-4">
          <div className="bg-white rounded-3xl border border-[#ECECE8] p-5 shadow-sm space-y-4 sticky top-28">
            <div className="flex items-center justify-between pb-3 border-b border-[#ECECE8]">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-[#1FA47A]" />
                <h2 className="font-black text-base text-[#0D2420]">فاتورة العميل</h2>
                <span className="bg-[#E5F5EF] text-[#1FA47A] text-xs font-black px-2 py-0.5 rounded-full">
                  {formatNumber(cart.length)}
                </span>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-xs font-bold text-[#C64536] hover:underline flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>إفراغ</span>
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="text-center py-10 text-[#7A817E]">
                  <ShoppingCart className="w-10 h-10 mx-auto text-[#ECECE8] mb-2" />
                  <p className="text-xs font-bold">سلة الفاتورة فارغة</p>
                  <p className="text-[11px]">اضغط على أي صنف من القائمة لإضافته</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.medicationId}
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-[#FAF9F6] border border-[#ECECE8]"
                  >
                    <div className="flex-1 pr-1 min-w-0">
                      <p className="text-xs font-bold text-[#0D2420] truncate">{item.name}</p>
                      <p className="text-[11px] text-[#1FA47A] font-extrabold">
                        {formatCurrency(item.unitPrice * item.quantity)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-xl border border-[#ECECE8]">
                      <button
                        onClick={() => updateQuantity(item.medicationId, -1)}
                        className="w-6 h-6 rounded-lg bg-[#FAF9F6] hover:bg-[#ECECE8] text-[#0D2420] flex items-center justify-center transition"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-black px-1 min-w-[16px] text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.medicationId, 1)}
                        className="w-6 h-6 rounded-lg bg-[#FAF9F6] hover:bg-[#ECECE8] text-[#0D2420] flex items-center justify-center transition"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.medicationId)}
                      className="text-[#7A817E] hover:text-[#C64536] p-1.5 transition mr-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Payment Options */}
            {cart.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-[#ECECE8]">
                {/* Method selector */}
                <div>
                  <label className="text-xs font-bold text-[#7A817E] block mb-1.5">طريقة الدفع:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setPaymentMethod('نقدي')}
                      className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-black transition border ${
                        paymentMethod === 'نقدي'
                          ? 'bg-[#E5F5EF] text-[#1FA47A] border-[#1FA47A]'
                          : 'bg-white text-[#7A817E] border-[#ECECE8]'
                      }`}
                    >
                      <Banknote className="w-4 h-4" />
                      <span>نقدي (كاش)</span>
                    </button>
                    <button
                      onClick={() => setPaymentMethod('فودافون كاش')}
                      className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-black transition border ${
                        paymentMethod === 'فودافون كاش'
                          ? 'bg-[#FDE5D8] text-[#E35B2D] border-[#E35B2D]'
                          : 'bg-white text-[#7A817E] border-[#ECECE8]'
                      }`}
                    >
                      <Smartphone className="w-4 h-4" />
                      <span>فودافون كاش</span>
                    </button>
                  </div>
                </div>

                {/* Cash payment calculator */}
                {paymentMethod === 'نقدي' && (
                  <div className="space-y-2 bg-[#FAF9F6] p-3 rounded-2xl border border-[#ECECE8]">
                    <div className="flex items-center justify-between text-xs font-bold text-[#7A817E]">
                      <span>المبلغ المستلم من العميل:</span>
                      <div className="flex gap-1">
                        {[50, 100, 200].map((amt) => (
                          <button
                            key={amt}
                            onClick={() => setCashReceived(String(amt))}
                            className="bg-white border border-[#ECECE8] px-2 py-0.5 rounded-lg text-[10px] font-black hover:border-[#1FA47A]"
                          >
                            {amt}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="number"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      placeholder="أدخل المبلغ المستلم (مثال: 200)"
                      className="w-full bg-white border border-[#ECECE8] rounded-xl px-3 py-2 text-sm font-bold text-[#0D2420] focus:outline-none focus:border-[#1FA47A]"
                    />
                    {parsedCashReceived > 0 && (
                      <div className="flex items-center justify-between pt-1 text-xs font-black">
                        <span className="text-[#7A817E]">الباقي للعميل:</span>
                        <span
                          className={`text-sm ${
                            changeAmount < 0 ? 'text-[#C64536]' : 'text-[#1FA47A]'
                          }`}
                        >
                          {formatCurrency(changeAmount)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Financial Summary */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-sm font-black text-[#0D2420]">
                    <span>إجمالي الفاتورة:</span>
                    <span className="text-xl text-[#1FA47A]">{formatCurrency(cartTotal)}</span>
                  </div>
                </div>

                {/* Checkout Button */}
                <button
                  onClick={handleCheckout}
                  className="w-full bg-[#1FA47A] hover:bg-[#15906B] text-white py-3.5 rounded-2xl font-black text-sm shadow-md shadow-[#1FA47A]/20 transition flex items-center justify-center gap-2 active:scale-95"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>تأكيد البيع وإصدار الفاتورة</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Printable Receipt Modal */}
      {showReceiptModal && lastCompletedSale && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative border border-[#ECECE8] animate-in fade-in zoom-in-95">
            <button
              onClick={() => setShowReceiptModal(false)}
              className="absolute left-4 top-4 text-[#7A817E] hover:text-[#0D2420] p-1"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Thermal Receipt Visual */}
            <div className="text-center pb-3 border-b border-dashed border-[#ECECE8]">
              <div className="w-10 h-10 rounded-full bg-[#E5F5EF] text-[#1FA47A] flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h3 className="font-black text-lg text-[#0D2420]">
                {settings.pharmacyName || 'صيدليتي'}
              </h3>
              <p className="text-[11px] text-[#7A817E]">{settings.address || 'القاهرة، مصر'}</p>
              <p className="text-[11px] font-mono text-[#7A817E]">
                فاتورة رقم: {lastCompletedSale.id}
              </p>
              <p className="text-[11px] text-[#7A817E]">
                {formatDateTime(lastCompletedSale.createdAt)}
              </p>
            </div>

            {/* Items list */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between font-bold text-[#7A817E] border-b pb-1">
                <span>الصنف والكمية</span>
                <span>المبلغ</span>
              </div>
              {lastCompletedSale.items.map((it, idx) => (
                <div key={idx} className="flex justify-between font-medium">
                  <span>
                    {it.name} <span className="text-[#7A817E]">×{it.quantity}</span>
                  </span>
                  <span className="font-bold">{formatCurrency(it.unitPrice * it.quantity)}</span>
                </div>
              ))}
            </div>

            {/* Financial breakdown */}
            <div className="border-t border-dashed border-[#ECECE8] pt-3 space-y-1.5 text-xs font-bold">
              <div className="flex justify-between text-base font-black text-[#0D2420]">
                <span>الإجمالي:</span>
                <span className="text-[#1FA47A]">{formatCurrency(lastCompletedSale.total)}</span>
              </div>
              <div className="flex justify-between text-[#7A817E]">
                <span>طريقة الدفع:</span>
                <span>{lastCompletedSale.paymentMethod}</span>
              </div>
              {lastCompletedSale.cashReceived && (
                <>
                  <div className="flex justify-between text-[#7A817E]">
                    <span>المدفوع:</span>
                    <span>{formatCurrency(lastCompletedSale.cashReceived)}</span>
                  </div>
                  <div className="flex justify-between text-[#7A817E]">
                    <span>الباقي:</span>
                    <span className="text-[#1FA47A]">{formatCurrency(lastCompletedSale.change || 0)}</span>
                  </div>
                </>
              )}
            </div>

            <p className="text-center text-[10px] text-[#7A817E] pt-2">
              نتمنى لكم دوام الصحة والعافية · للاسترجاع يرجى إحضار الفاتورة
            </p>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 bg-[#0D2420] hover:bg-[#1FA47A] text-white py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة الإيصال</span>
              </button>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="bg-[#FAF9F6] hover:bg-[#ECECE8] text-[#0D2420] px-4 py-2.5 rounded-xl text-xs font-bold transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
