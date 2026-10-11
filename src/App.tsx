import React, { useState } from 'react';
import { PharmacyProvider } from './context/PharmacyContext';
import { Header, TabType } from './components/Header';
import { DashboardScreen } from './screens/DashboardScreen';
import { SalesScreen } from './screens/SalesScreen';
import { InventoryScreen } from './screens/InventoryScreen';
import { AlertsScreen } from './screens/AlertsScreen';
import { ShiftsScreen } from './screens/ShiftsScreen';
import { DebtsScreen } from './screens/DebtsScreen';
import { ExpensesScreen } from './screens/ExpensesScreen';
import { SuppliersScreen } from './screens/SuppliersScreen';
import { ReportsScreen } from './screens/ReportsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  AlertTriangle,
  Clock,
} from 'lucide-react';

export const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');

  return (
    <div className="min-h-screen bg-[#F7F7F5] flex flex-col font-sans pb-16 md:pb-6">
      {/* Top Header */}
      <Header currentTab={currentTab} setCurrentTab={setCurrentTab} />

      {/* Main Screen Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === 'dashboard' && <DashboardScreen onNavigate={setCurrentTab} />}
        {currentTab === 'sales' && <SalesScreen />}
        {currentTab === 'inventory' && <InventoryScreen />}
        {currentTab === 'alerts' && <AlertsScreen />}
        {currentTab === 'shifts' && <ShiftsScreen />}
        {currentTab === 'debts' && <DebtsScreen />}
        {currentTab === 'expenses' && <ExpensesScreen />}
        {currentTab === 'suppliers' && <SuppliersScreen />}
        {currentTab === 'reports' && <ReportsScreen />}
        {currentTab === 'settings' && <SettingsScreen />}
      </main>

      {/* Mobile Bottom Tab Bar (matching original app's mobile navigation) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#ECECE8] px-3 py-2 z-40 flex items-center justify-around shadow-lg">
        <button
          onClick={() => setCurrentTab('dashboard')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
            currentTab === 'dashboard' ? 'text-[#1FA47A] font-black' : 'text-[#7A817E] font-medium'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px]">الرئيسية</span>
        </button>

        <button
          onClick={() => setCurrentTab('sales')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
            currentTab === 'sales' ? 'text-[#1FA47A] font-black' : 'text-[#7A817E] font-medium'
          }`}
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="text-[10px]">الكاشير</span>
        </button>

        <button
          onClick={() => setCurrentTab('inventory')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
            currentTab === 'inventory' ? 'text-[#1FA47A] font-black' : 'text-[#7A817E] font-medium'
          }`}
        >
          <Package className="w-5 h-5" />
          <span className="text-[10px]">المخزون</span>
        </button>

        <button
          onClick={() => setCurrentTab('alerts')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
            currentTab === 'alerts' ? 'text-[#1FA47A] font-black' : 'text-[#7A817E] font-medium'
          }`}
        >
          <AlertTriangle className="w-5 h-5" />
          <span className="text-[10px]">النواقص</span>
        </button>

        <button
          onClick={() => setCurrentTab('shifts')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
            currentTab === 'shifts' ? 'text-[#1FA47A] font-black' : 'text-[#7A817E] font-medium'
          }`}
        >
          <Clock className="w-5 h-5" />
          <span className="text-[10px]">الشيفتات</span>
        </button>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <PharmacyProvider>
      <AppContent />
    </PharmacyProvider>
  );
};

export default App;
