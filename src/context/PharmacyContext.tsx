import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import {
  PharmacyState,
  Medication,
  Sale,
  CartItem,
  NewSalePaymentMethod,
  Supplier,
  ReorderRecord,
  ReorderNeed,
  Shift,
  Expense,
  CustomerDebt,
  PharmacyAlert,
  PharmacySettings,
} from '../types/pharmacy';
import { createInitialState } from '../data/initialData';
import { makeId, daysUntil } from '../utils/format';

const STORAGE_KEY = 'pharmacy_manager_state_v1';

interface PharmacyContextType extends PharmacyState {
  isReady: boolean;
  alerts: PharmacyAlert[];
  reorderNeeds: ReorderNeed[];
  activeShift?: Shift;

  // Inventory
  addMedication: (med: Omit<Medication, 'id'>) => void;
  updateMedication: (id: string, med: Partial<Medication>) => void;
  deleteMedication: (id: string) => void;

  // Sales / POS
  completeSale: (
    items: CartItem[],
    paymentMethod: NewSalePaymentMethod,
    cashReceived?: number,
    change?: number
  ) => boolean;

  // Shortages / Reorders
  logShortage: (entry: {
    medicationId: string;
    desiredQuantity: number;
    urgency?: 'critical' | 'high' | 'normal';
    notes?: string;
    supplierName?: string;
    customerName?: string;
    customerPhone?: string;
    unit?: 'علبة' | 'شريط' | 'قطعة';
  }) => void;
  markReorderOrdered: (medicationId: string, supplierName?: string) => void;
  markReorderReceived: (medicationId: string, receivedQty?: number, addToStock?: boolean) => void;
  deleteReorderRecord: (medicationId: string) => void;

  // Shifts
  startShift: (pharmacistName: string, openingCash: number) => boolean;
  closeShift: (shiftId: string, actualCash: number, note?: string) => void;

  // Expenses
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'shiftId'>) => void;

  // Debts
  addDebt: (debt: Omit<CustomerDebt, 'id' | 'createdAt' | 'paid' | 'payments'>) => void;
  settleDebt: (debtId: string, amount: number) => void;

  // Suppliers
  addSupplier: (supplier: Omit<Supplier, 'id' | 'lastOrder'>) => void;
  deleteSupplier: (id: string) => void;

  // Settings & Backup
  updateSettings: (settings: Partial<PharmacySettings>) => void;
  exportBackupJSON: () => string;
  importBackupJSON: (jsonStr: string) => boolean;
  resetToDemo: () => void;
}

const PharmacyContext = createContext<PharmacyContextType | undefined>(undefined);

export const PharmacyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<PharmacyState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load pharmacy state from localStorage:', e);
    }
    return createInitialState();
  });

  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(true);
  }, []);

  // Save changes to localStorage
  useEffect(() => {
    if (isReady) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        console.error('Failed to save pharmacy state:', e);
      }
    }
  }, [state, isReady]);

  // Compute active shift
  const activeShift = useMemo(() => {
    return state.shifts.find((s) => !s.closedAt);
  }, [state.shifts]);

  // Compute stock and expiry alerts
  const alerts = useMemo<PharmacyAlert[]>(() => {
    const list: PharmacyAlert[] = [];
    state.medications.forEach((med) => {
      // Stock alert
      if (med.quantity <= med.reorderLevel) {
        const isCritical = med.quantity <= Math.max(2, Math.floor(med.reorderLevel / 2));
        list.push({
          id: `stock-${med.id}`,
          medicationId: med.id,
          title: med.quantity === 0 ? 'نفد من المخزون' : isCritical ? 'مخزون حرج جدًا' : 'مخزون منخفض',
          detail: `${med.name} — المتبقي ${med.quantity} وحدة فقط (حد الطلب: ${med.reorderLevel})`,
          severity: med.quantity === 0 || isCritical ? 'high' : 'medium',
          kind: 'stock',
        });
      }

      // Expiry alert
      const days = daysUntil(med.expiryDate);
      if (days <= 60) {
        list.push({
          id: `exp-${med.id}`,
          medicationId: med.id,
          title: days < 0 ? 'منتهي الصلاحية!' : 'اقتربت الصلاحية',
          detail: days < 0 ? `${med.name} — منتهي الصلاحية ويجب سحبه فورا` : `${med.name} — ينتهي خلال ${days} يومًا`,
          severity: days <= 15 ? 'high' : 'medium',
          kind: 'expiry',
        });
      }
    });

    return list.sort((a, b) => (a.severity === 'high' ? -1 : 1));
  }, [state.medications]);

  // Compute reorder needs joined with medication
  const reorderNeeds = useMemo<ReorderNeed[]>(() => {
    const medMap = new Map(state.medications.map((m) => [m.id, m]));
    return state.reorderRecords
      .map((record) => {
        const med = medMap.get(record.medicationId);
        if (!med) return null;
        return {
          ...record,
          medication: med,
        };
      })
      .filter((n): n is ReorderNeed => n !== null);
  }, [state.reorderRecords, state.medications]);

  // Inventory actions
  const addMedication = (med: Omit<Medication, 'id'>) => {
    const newMed: Medication = {
      ...med,
      id: makeId('med'),
      sku: med.sku || `SKU-${Date.now().toString().slice(-4)}`,
    };
    setState((prev) => ({
      ...prev,
      medications: [newMed, ...prev.medications],
    }));
  };

  const updateMedication = (id: string, updates: Partial<Medication>) => {
    setState((prev) => ({
      ...prev,
      medications: prev.medications.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    }));
  };

  const deleteMedication = (id: string) => {
    setState((prev) => ({
      ...prev,
      medications: prev.medications.filter((m) => m.id !== id),
      reorderRecords: prev.reorderRecords.filter((r) => r.medicationId !== id),
    }));
  };

  // Sales
  const completeSale = (
    items: CartItem[],
    paymentMethod: NewSalePaymentMethod,
    cashReceived?: number,
    change?: number
  ) => {
    if (!items.length) return false;

    const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const saleId = makeId('sale');

    const newSale: Sale = {
      id: saleId,
      createdAt: new Date().toISOString(),
      items,
      total,
      paymentMethod,
      cashReceived,
      change,
      shiftId: activeShift?.id,
    };

    // Deduct stock for each medication
    setState((prev) => {
      const updatedMedications = prev.medications.map((med) => {
        const soldItem = items.find((i) => i.medicationId === med.id);
        if (soldItem) {
          const newQty = Math.max(0, med.quantity - soldItem.quantity);
          return { ...med, quantity: newQty };
        }
        return med;
      });

      // Automatically create reorder records if medication hits reorderLevel
      const newReorders = [...prev.reorderRecords];
      items.forEach((item) => {
        const targetMed = updatedMedications.find((m) => m.id === item.medicationId);
        if (targetMed && targetMed.quantity <= targetMed.reorderLevel) {
          const existing = newReorders.find((r) => r.medicationId === targetMed.id);
          if (!existing) {
            newReorders.push({
              medicationId: targetMed.id,
              markedAt: new Date().toISOString(),
              quantityAtMark: targetMed.quantity,
              status: 'needed',
              desiredQuantity: Math.max(5, targetMed.reorderLevel * 2),
              urgency: targetMed.quantity === 0 ? 'critical' : 'high',
              demandCount: 1,
              urgent: targetMed.quantity === 0,
            });
          }
        }
      });

      return {
        ...prev,
        sales: [newSale, ...prev.sales],
        medications: updatedMedications,
        reorderRecords: newReorders,
      };
    });

    return true;
  };

  // Shortages
  const logShortage = (entry: {
    medicationId: string;
    desiredQuantity: number;
    urgency?: 'critical' | 'high' | 'normal';
    notes?: string;
    supplierName?: string;
    customerName?: string;
    customerPhone?: string;
    unit?: 'علبة' | 'شريط' | 'قطعة';
  }) => {
    setState((prev) => {
      const med = prev.medications.find((m) => m.id === entry.medicationId);
      const currentQty = med ? med.quantity : 0;
      const existingIdx = prev.reorderRecords.findIndex((r) => r.medicationId === entry.medicationId);

      if (existingIdx >= 0) {
        const existing = prev.reorderRecords[existingIdx];
        const updated = [...prev.reorderRecords];
        updated[existingIdx] = {
          ...existing,
          desiredQuantity: entry.desiredQuantity,
          urgency: entry.urgency || existing.urgency,
          notes: entry.notes || existing.notes,
          supplierName: entry.supplierName || existing.supplierName,
          customerName: entry.customerName || existing.customerName,
          customerPhone: entry.customerPhone || existing.customerPhone,
          unit: entry.unit || existing.unit,
          status: 'needed',
          demandCount: existing.demandCount + 1,
          urgent: entry.urgency === 'critical' || entry.urgency === 'high' || existing.urgent,
        };
        return { ...prev, reorderRecords: updated };
      } else {
        const record: ReorderRecord = {
          medicationId: entry.medicationId,
          markedAt: new Date().toISOString(),
          quantityAtMark: currentQty,
          status: 'needed',
          desiredQuantity: entry.desiredQuantity,
          urgency: entry.urgency || (currentQty === 0 ? 'critical' : 'normal'),
          notes: entry.notes,
          supplierName: entry.supplierName,
          customerName: entry.customerName,
          customerPhone: entry.customerPhone,
          unit: entry.unit || 'علبة',
          demandCount: 1,
          urgent: entry.urgency === 'critical' || currentQty === 0,
        };
        return { ...prev, reorderRecords: [record, ...prev.reorderRecords] };
      }
    });
  };

  const markReorderOrdered = (medicationId: string, supplierName?: string) => {
    setState((prev) => ({
      ...prev,
      reorderRecords: prev.reorderRecords.map((r) =>
        r.medicationId === medicationId
          ? {
              ...r,
              status: 'ordered',
              orderedAt: new Date().toISOString(),
              supplierName: supplierName || r.supplierName,
            }
          : r
      ),
    }));
  };

  const markReorderReceived = (medicationId: string, receivedQty?: number, addToStock = true) => {
    setState((prev) => {
      const record = prev.reorderRecords.find((r) => r.medicationId === medicationId);
      const qtyToAdd = receivedQty || record?.desiredQuantity || 10;

      let updatedMedications = prev.medications;
      if (addToStock) {
        updatedMedications = prev.medications.map((m) =>
          m.id === medicationId ? { ...m, quantity: m.quantity + qtyToAdd } : m
        );
      }

      return {
        ...prev,
        medications: updatedMedications,
        reorderRecords: prev.reorderRecords.map((r) =>
          r.medicationId === medicationId
            ? {
                ...r,
                status: 'received',
                receivedQty: qtyToAdd,
                receivedAt: new Date().toISOString(),
              }
            : r
        ),
      };
    });
  };

  const deleteReorderRecord = (medicationId: string) => {
    setState((prev) => ({
      ...prev,
      reorderRecords: prev.reorderRecords.filter((r) => r.medicationId !== medicationId),
    }));
  };

  // Shifts
  const startShift = (pharmacistName: string, openingCash: number) => {
    if (activeShift) return false;
    const newShift: Shift = {
      id: makeId('shift'),
      pharmacistName,
      openingCash,
      startedAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      shifts: [newShift, ...prev.shifts],
    }));
    return true;
  };

  const closeShift = (shiftId: string, actualCash: number, note?: string) => {
    setState((prev) => {
      const target = prev.shifts.find((s) => s.id === shiftId);
      if (!target) return prev;

      // Calculate shift cash sales
      const shiftSales = prev.sales.filter((s) => s.shiftId === shiftId && s.paymentMethod === 'نقدي');
      const totalCashSales = shiftSales.reduce((sum, s) => sum + s.total, 0);

      // Calculate shift expenses
      const shiftExp = prev.expenses.filter((e) => e.shiftId === shiftId);
      const totalExpenses = shiftExp.reduce((sum, e) => sum + e.amount, 0);

      const expectedCash = target.openingCash + totalCashSales - totalExpenses;
      const difference = actualCash - expectedCash;

      return {
        ...prev,
        shifts: prev.shifts.map((s) =>
          s.id === shiftId
            ? {
                ...s,
                closedAt: new Date().toISOString(),
                actualCash,
                difference,
                note,
              }
            : s
        ),
      };
    });
  };

  // Expenses
  const addExpense = (expense: Omit<Expense, 'id' | 'createdAt' | 'shiftId'>) => {
    const newExp: Expense = {
      ...expense,
      id: makeId('exp'),
      createdAt: new Date().toISOString(),
      shiftId: activeShift?.id,
    };
    setState((prev) => ({
      ...prev,
      expenses: [newExp, ...prev.expenses],
    }));
  };

  // Debts
  const addDebt = (debt: Omit<CustomerDebt, 'id' | 'createdAt' | 'paid' | 'payments'>) => {
    const newDebt: CustomerDebt = {
      ...debt,
      id: makeId('debt'),
      createdAt: new Date().toISOString(),
      paid: 0,
      payments: [],
    };
    setState((prev) => ({
      ...prev,
      debts: [newDebt, ...prev.debts],
    }));
  };

  const settleDebt = (debtId: string, amount: number) => {
    setState((prev) => ({
      ...prev,
      debts: prev.debts.map((d) => {
        if (d.id === debtId) {
          const newPaid = Math.min(d.total, d.paid + amount);
          const payments = [...(d.payments || []), { amount, date: new Date().toISOString() }];
          return { ...d, paid: newPaid, payments };
        }
        return d;
      }),
    }));
  };

  // Suppliers
  const addSupplier = (supplier: Omit<Supplier, 'id' | 'lastOrder'>) => {
    const newSup: Supplier = {
      ...supplier,
      id: makeId('sup'),
      lastOrder: 'حديث الإضافة',
    };
    setState((prev) => ({
      ...prev,
      suppliers: [newSup, ...prev.suppliers],
    }));
  };

  const deleteSupplier = (id: string) => {
    setState((prev) => ({
      ...prev,
      suppliers: prev.suppliers.filter((s) => s.id !== id),
    }));
  };

  // Settings & Backups
  const updateSettings = (settings: Partial<PharmacySettings>) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...settings },
    }));
  };

  const exportBackupJSON = () => {
    return JSON.stringify(state, null, 2);
  };

  const importBackupJSON = (jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed.medications) && Array.isArray(parsed.sales)) {
        setState(parsed);
        return true;
      }
    } catch (e) {
      console.error('Invalid backup JSON:', e);
    }
    return false;
  };

  const resetToDemo = () => {
    const demo = createInitialState();
    setState(demo);
  };

  return (
    <PharmacyContext.Provider
      value={{
        ...state,
        isReady,
        alerts,
        reorderNeeds,
        activeShift,
        addMedication,
        updateMedication,
        deleteMedication,
        completeSale,
        logShortage,
        markReorderOrdered,
        markReorderReceived,
        deleteReorderRecord,
        startShift,
        closeShift,
        addExpense,
        addDebt,
        settleDebt,
        addSupplier,
        deleteSupplier,
        updateSettings,
        exportBackupJSON,
        importBackupJSON,
        resetToDemo,
      }}
    >
      {children}
    </PharmacyContext.Provider>
  );
};

export const usePharmacy = () => {
  const context = useContext(PharmacyContext);
  if (!context) {
    throw new Error('usePharmacy must be used within PharmacyProvider');
  }
  return context;
};
