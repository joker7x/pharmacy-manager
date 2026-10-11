import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  AlertTriangle,
  Clock,
  Users,
  Receipt,
  Truck,
  BarChart3,
  Settings,
  Pill,
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { formatCurrency } from '../utils/format';

export type TabType =
  | 'dashboard'
  | 'sales'
  | 'inventory'
  | 'alerts'
  | 'shifts'
  | 'debts'
  | 'expenses'
  | 'suppliers'
  | 'reports'
  | 'settings';

interface HeaderProps {
  currentTab: TabType;
  setCurrentTab: (tab: TabType) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, setCurrentTab }) => {
  const { activeShift, alerts, reorderNeeds, settings } = usePharmacy();

  const urgentAlertsCount = alerts.filter((a) => a.severity === 'high').length;
  const neededReordersCount = reorderNeeds.filter((r) => r.status === 'needed').length;
  const totalBadges = urgentAlertsCount + neededReordersCount;

  const navItems: { id: TabType; label: string; icon: React.FC<{ className?: string }>; badge?: number }[] = [
    { id: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard },
    { id: 'sales', label: 'الكاشير', icon: ShoppingCart },
    { id: 'inventory', label: 'المخزون', icon: Package },
    { id: 'alerts', label: 'النواقص', icon: AlertTriangle, badge: totalBadges > 0 ? totalBadges : undefined },
    { id: 'shifts', label: 'الورديات والخزينة', icon: Clock },
    { id: 'debts', label: 'الآجل والعملاء', icon: Users },
    { id: 'expenses', label: 'المصروفات', icon: Receipt },
    { id: 'suppliers', label: 'الموردين', icon: Truck },
    { id: 'reports', label: 'التقارير', icon: BarChart3 },
    { id: 'settings', label: 'الإعدادات', icon: Settings },
  ];

  return (
    <header className="bg-white border-b border-[#ECECE8] sticky top-0 z-40 shadow-sm">
      {/* Top Brand Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Pharmacy Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1FA47A] flex items-center justify-center text-white shadow-md shadow-[#1FA47A]/20">
              <Pill className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl text-[#0D2420] tracking-tight">صيدليتي</span>
                <span className="bg-[#E5F5EF] text-[#1FA47A] text-[11px] font-bold px-2 py-0.5 rounded-full">
                  أوفلاين
                </span>
              </div>
              <p className="text-xs text-[#7A817E] font-medium hidden sm:block">
                {settings.pharmacyName || 'إدارة الصيدلية الشاملة'}
              </p>
            </div>
          </div>

          {/* Active Shift & Actions */}
          <div className="flex items-center gap-3">
            {activeShift ? (
              <button
                onClick={() => setCurrentTab('shifts')}
                className="flex items-center gap-2 bg-[#E9F8F1] border border-[#1FA47A]/30 text-[#1FA47A] px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-[#D5F6E8] transition"
              >
                <span className="w-2 h-2 rounded-full bg-[#1FA47A] animate-pulse"></span>
                <span>وردية جارية: {activeShift.pharmacistName}</span>
                <span className="hidden md:inline text-xs text-[#15906B] font-semibold">
                  (خزينة: {formatCurrency(activeShift.openingCash)})
                </span>
              </button>
            ) : (
              <button
                onClick={() => setCurrentTab('shifts')}
                className="flex items-center gap-2 bg-[#FDE5D8] text-[#E35B2D] px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-[#FCD2BF] transition"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>لا توجد وردية مفتوحة</span>
              </button>
            )}

            {/* Quick POS Button */}
            <button
              onClick={() => setCurrentTab('sales')}
              className="bg-[#1FA47A] hover:bg-[#15906B] text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm transition active:scale-95"
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="hidden sm:inline">فاتورة جديدة</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="bg-[#FAF9F6] border-t border-[#ECECE8] overflow-x-auto scrollbar-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-1 space-x-reverse min-w-max py-1.5" aria-label="Tabs">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all relative ${
                    isActive
                      ? 'bg-[#1FA47A] text-white shadow-sm'
                      : 'text-[#0D2420] hover:bg-[#ECECE8] hover:text-[#0D2420]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#7A817E]'}`} />
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                        isActive ? 'bg-white text-[#1FA47A]' : 'bg-[#E35B2D] text-white'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
};
