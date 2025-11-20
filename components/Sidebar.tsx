import React, { useState } from 'react';
import { DashboardIcon, InventoryIcon, POSIcon, PurchaseIcon, AccountingIcon, SettingsIcon, LogoutIcon, ReportsIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon } from './icons';
import { useAppContext } from '../AppContext';


interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  storeName: string;
  accessiblePages: Record<string, boolean>;
  isMobileOpen: boolean;
  setIsMobileOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, storeName, accessiblePages, isMobileOpen, setIsMobileOpen }) => {
  const { logout, currentUser } = useAppContext();
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const navItems = [
    { id: 'dashboard', label: 'داشبورد', icon: <DashboardIcon />, visible: accessiblePages.dashboard },
    { id: 'inventory', label: 'انبارداری', icon: <InventoryIcon />, visible: accessiblePages.inventory },
    { id: 'pos', label: 'فروش', icon: <POSIcon />, visible: accessiblePages.pos },
    { id: 'purchases', label: 'خرید', icon: <PurchaseIcon />, visible: accessiblePages.purchases },
    { id: 'accounting', label: 'حسابداری', icon: <AccountingIcon />, visible: accessiblePages.accounting },
    { id: 'reports', label: 'گزارشات', icon: <ReportsIcon />, visible: accessiblePages.reports },
    { id: 'settings', label: 'تنظیمات', icon: <SettingsIcon />, visible: accessiblePages.settings },
  ];
  
  const [mainName, subName] = storeName.includes(' ') ? storeName.split(' ') : [storeName, ''];
  
  const handleItemClick = (view: string) => {
    setActiveView(view);
    if(isMobileOpen) {
      setIsMobileOpen(false);
    }
  };


  return (
    <>
      {isMobileOpen && <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setIsMobileOpen(false)}></div>}
      <div className={`
        flex flex-col h-screen p-4 bg-white/60 backdrop-blur-lg border-l border-gray-200/60 
        transition-all duration-300 ease-in-out z-50
        md:relative md:translate-x-0 md:shadow-lg
        fixed inset-y-0 right-0
        ${isCollapsed ? 'w-24' : 'w-72 md:w-64'} 
        ${isMobileOpen ? 'translate-x-0 shadow-2xl' : 'translate-x-full'}
      `}>
        <div className={`flex items-center mb-12 p-2 transition-all duration-300 ${isCollapsed ? 'justify-center' : ''}`}>
          {!isCollapsed && (
              <>
                  <span className="text-3xl font-extrabold text-blue-600 truncate">{mainName}</span>
                  {subName && <span className="text-3xl font-light text-blue-500 mr-1 truncate">{subName}</span>}
              </>
          )}
          {isCollapsed && (
              <span className="text-3xl font-extrabold text-blue-600">{mainName.charAt(0)}{subName.charAt(0)}</span>
          )}
        </div>

        <nav className="flex flex-col space-y-3 flex-grow">
          {navItems.filter(item => item.visible).map(item => (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.id)}
              className={`flex items-center rounded-xl p-3 text-lg transition-all duration-300 ease-in-out transform hover:-translate-y-1 ${isCollapsed ? 'justify-center' : 'space-x-3 space-x-reverse'} ${
                activeView === item.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                  : 'text-slate-700 hover:bg-white/80 hover:text-blue-600'
              }`}
              title={isCollapsed ? item.label : ''}
            >
              {item.icon}
              {!isCollapsed && <span className="font-semibold whitespace-nowrap">{item.label}</span>}
            </button>
          ))}
        </nav>
        
        <div className="mt-auto pt-4 border-t border-gray-200/60">
          {!isCollapsed && (
              <div className="p-2 mb-2 text-center bg-slate-100/70 rounded-lg">
                  <p className="font-bold text-slate-800 truncate">{currentUser?.username}</p>
              </div>
          )}
          <button
              onClick={logout}
              className={`w-full flex items-center rounded-xl p-3 text-lg text-slate-700 hover:bg-red-100/70 hover:text-red-600 transition-colors ${isCollapsed ? 'justify-center' : 'space-x-2 space-x-reverse'}`}
              title={isCollapsed ? 'خروج' : ''}
            >
              <LogoutIcon />
              {!isCollapsed && <span className="font-semibold whitespace-nowrap">خروج</span>}
          </button>
          <button
              onClick={() => setIsCollapsed(prev => !prev)}
              className="w-full hidden md:flex items-center justify-center rounded-xl p-3 mt-2 text-sm text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 transition-colors"
            >
              {isCollapsed ? <ChevronDoubleLeftIcon /> : <ChevronDoubleRightIcon />}
              {!isCollapsed && <span className="font-semibold whitespace-nowrap">{isCollapsed ? 'باز کردن' : 'جمع کردن'}</span>}
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;