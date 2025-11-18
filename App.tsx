import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import POS from './pages/POS';
import Purchases from './pages/Purchases';
import Accounting from './pages/Accounting';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Reports from './pages/Reports';
import { AppProvider, useAppContext } from './AppContext';
import type { Permission } from './types';
import { MenuIcon } from './components/icons';

const Header: React.FC<{ onMenuClick: () => void, activeViewLabel: string }> = ({ onMenuClick, activeViewLabel }) => (
    <div className="md:hidden flex items-center justify-between p-4 bg-white/60 backdrop-blur-lg border-b border-gray-200/60 sticky top-0 z-30">
        <h1 className="text-xl font-bold text-slate-800 capitalize">{activeViewLabel}</h1>
        <button onClick={onMenuClick} className="p-2">
            <MenuIcon className="w-6 h-6" />
        </button>
    </div>
);


const AppContent: React.FC = () => {
  const [activeView, setActiveView] = useState('dashboard');
  const { storeSettings, currentUser, hasPermission } = useAppContext();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  if (!currentUser) {
      return null; // Should not happen if App component logic is correct
  }
  
  const accessiblePages = {
      dashboard: hasPermission('page:dashboard'),
      inventory: hasPermission('page:inventory'),
      pos: hasPermission('page:pos'),
      purchases: hasPermission('page:purchases'),
      accounting: hasPermission('page:accounting'),
      reports: hasPermission('page:reports'),
      settings: hasPermission('page:settings'),
  };
  
    const navLabels: { [key: string]: string } = {
      dashboard: 'داشبورد',
      inventory: 'انبارداری',
      pos: 'فروش',
      purchases: 'خرید',
      accounting: 'حسابداری',
      reports: 'گزارشات',
      settings: 'تنظیمات',
  };

  // If the current active view is not accessible, switch to the first accessible one
  if (!accessiblePages[activeView as keyof typeof accessiblePages]) {
      const firstAccessible = Object.keys(accessiblePages).find(page => accessiblePages[page as keyof typeof accessiblePages]);
      if (firstAccessible) {
          setActiveView(firstAccessible);
      } else {
        // Handle case where user has no accessible pages
        return <div className="flex-1 flex items-center justify-center"><p>شما به هیچ صفحه‌ای دسترسی ندارید.</p></div>
      }
  }

  const renderActiveView = () => {
    switch (activeView) {
      case 'dashboard': return accessiblePages.dashboard && <Dashboard />;
      case 'inventory': return accessiblePages.inventory && <Inventory />;
      case 'pos': return accessiblePages.pos && <POS />;
      case 'purchases': return accessiblePages.purchases && <Purchases />;
      case 'accounting': return accessiblePages.accounting && <Accounting />;
      case 'reports': return accessiblePages.reports && <Reports />;
      case 'settings': return accessiblePages.settings && <Settings />;
      default: return accessiblePages.dashboard && <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-transparent">
      <Sidebar 
        activeView={activeView} 
        setActiveView={setActiveView} 
        storeName={storeSettings.storeName}
        accessiblePages={accessiblePages} 
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
      />
      <main className="flex-1 flex flex-col overflow-y-auto">
        <Header onMenuClick={() => setIsMobileSidebarOpen(true)} activeViewLabel={navLabels[activeView] || 'داشبورد'} />
        <div className="flex-1 overflow-y-auto">
          {renderActiveView()}
        </div>
      </main>
    </div>
  );
};


const AuthGate: React.FC = () => {
    const { isAuthenticated, isLoading } = useAppContext();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <svg className="animate-spin h-10 w-10 text-blue-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="mt-4 text-lg font-semibold text-slate-700">در حال بارگذاری اطلاعات...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Login />;
    }
    return <AppContent />;
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <AuthGate />
    </AppProvider>
  );
};

export default App;