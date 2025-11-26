
import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Product, ActivityLog } from '../types';
import { useAppContext } from '../AppContext';
import { POSIcon, InventoryIcon, PurchaseIcon, WarningIcon, BellIcon, UserGroupIcon, EyeIcon, XIcon } from '../components/icons';
import { formatCurrency } from '../utils/formatters';
import DateRangeFilter from '../components/DateRangeFilter';
import ActivityDetailModal from '../components/ActivityDetailModal';

// Extracted StatCard to prevent re-renders and fix positioning context
const StatCard: React.FC<{ title: string; value: string; description: string; color: string, icon: React.ReactNode, onDetailClick?: () => void }> = ({ title, value, description, color, icon, onDetailClick }) => (
    <div className="bg-white/60 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-gray-200/60 flex flex-col justify-between transform transition-transform duration-300 hover:-translate-y-2 h-full relative group">
        <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold text-slate-700">{title}</h3>
            <div className={`p-2 rounded-full bg-opacity-20 ${color.replace('text-', 'bg-')}`}>{icon}</div>
        </div>
        <div className="mb-4">
            <p className={`text-4xl lg:text-5xl font-extrabold my-2 ${color}`}>{value}</p>
            <p className="text-md text-slate-500">{description}</p>
        </div>
        
        {/* Button relocated to bottom-left with high z-index to ensure clickability */}
        {onDetailClick && (
            <button 
                onClick={(e) => { 
                    e.stopPropagation(); 
                    onDetailClick(); 
                }} 
                className="absolute bottom-4 left-4 z-20 p-2 bg-white hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded-lg shadow-sm border border-slate-200 transition-all duration-200 flex items-center justify-center" 
                title="مشاهده جزئیات"
            >
                <EyeIcon className="w-5 h-5" />
            </button>
        )}
    </div>
);

const AlertCard: React.FC<{ title: string, items: { id: string, name: string, stock: number, expiryDate?: string }[], color: string, type: 'stock' | 'expiry' }> = ({ title, items, color, type }) => (
    <div className={`p-4 rounded-xl bg-${color}-100/70 border-r-4 border-${color}-500`}>
        <div className="flex items-center">
            <WarningIcon className={`w-6 h-6 text-${color}-600 mr-3`} />
            <h3 className={`text-lg font-bold text-${color}-800`}>{title} ({items.length})</h3>
        </div>
        {items.length > 0 && (
            <ul className="mt-2 list-disc list-inside text-sm text-${color}-700 pr-4 max-h-24 overflow-y-auto">
                {items.slice(0, 5).map(p => (
                    <li key={p.id + (p as any).lotNumber}>
                        {p.name} 
                        {type === 'stock' ? ` (موجودی: ${p.stock})` : ` (انقضا: ${new Date(p.expiryDate!).toLocaleDateString('fa-IR')})`}
                    </li>
                ))}
                {items.length > 5 && <li>و {items.length - 5} مورد دیگر...</li>}
            </ul>
        )}
    </div>
);

const Dashboard: React.FC = () => {
    const { saleInvoices, purchaseInvoices, activities, products, storeSettings, currentUser, customers } = useAppContext();
    const [dateRange, setDateRange] = useState<{ start: Date, end: Date }>({ start: new Date(), end: new Date() });
    const [isAlertsOpen, setIsAlertsOpen] = useState(false);
    const alertsRef = useRef<HTMLDivElement>(null);
    const [viewingActivity, setViewingActivity] = useState<ActivityLog | null>(null);
    const [isCreditDetailsOpen, setIsCreditDetailsOpen] = useState(false);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (alertsRef.current && !alertsRef.current.contains(event.target as Node)) {
                setIsAlertsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Robust "Today" calculation using timestamps to ensure mobile compatibility
    const { totalSalesToday, totalCreditSalesToday, todayCreditInvoices } = useMemo(() => {
        const now = new Date();
        // Set start of today (00:00:00) local time
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
        // Set end of today (23:59:59) local time
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

        const todayInvoices = saleInvoices.filter(inv => {
            const invTime = new Date(inv.timestamp).getTime();
            return invTime >= startOfDay && invTime <= endOfDay;
        });

        const sales = todayInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
        
        const creditInvoices = todayInvoices.filter(inv => inv.customerId);
        const credit = creditInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
            
        return { 
            totalSalesToday: sales, 
            totalCreditSalesToday: credit,
            todayCreditInvoices: creditInvoices.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        };
    }, [saleInvoices]);

    const productsWithTotalStock = products.map(p => ({
        ...p,
        totalStock: p.batches.reduce((sum, b) => sum + b.stock, 0)
    }));

    // Alert calculations
    const lowStockProducts = productsWithTotalStock.filter(p => p.totalStock > 0 && p.totalStock <= storeSettings.lowStockThreshold);
    
    const expiringSoonProducts = products.flatMap(p => 
        p.batches
         .filter(b => {
            if (!b.expiryDate) return false;
            const expiry = new Date(b.expiryDate);
            const thresholdDate = new Date();
            thresholdDate.setMonth(thresholdDate.getMonth() + storeSettings.expiryThresholdMonths);
            return expiry <= thresholdDate && expiry > new Date();
         })
         .map(b => ({ ...p, lotNumber: b.lotNumber, stock: b.stock, expiryDate: b.expiryDate })) // Create a displayable entity
    );

    const totalAlerts = lowStockProducts.length + expiringSoonProducts.length;

    const filteredActivities = useMemo(() => {
        if (!dateRange.start || !dateRange.end) return [];
        const startTime = dateRange.start.getTime();
        const endTime = dateRange.end.getTime();

        return activities.filter(activity => {
            const activityTime = new Date(activity.timestamp).getTime();
            return activityTime >= startTime && activityTime <= endTime;
        });
    }, [activities, dateRange]);


  return (
    <div className="p-4 md:p-8">
      {viewingActivity && <ActivityDetailModal activity={viewingActivity} onClose={() => setViewingActivity(null)} />}
      
      {/* Credit Sales Details Modal */}
      {isCreditDetailsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 modal-animate">
            <div className="bg-white/95 backdrop-blur-xl p-0 rounded-2xl shadow-2xl border border-gray-200/80 w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b bg-slate-50">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <UserGroupIcon className="w-5 h-5 text-orange-600" />
                        جزئیات فروش نسیه امروز
                    </h3>
                    <button onClick={() => setIsCreditDetailsOpen(false)} className="p-1.5 rounded-full bg-white text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors border"><XIcon className="w-5 h-5" /></button>
                </div>
                {/* List */}
                <div className="flex-grow overflow-y-auto p-4 space-y-3">
                    {todayCreditInvoices.length > 0 ? todayCreditInvoices.map(inv => {
                        const customer = customers.find(c => c.id === inv.customerId);
                        return (
                            <div key={inv.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2 hover:border-blue-300 transition-colors">
                                <div className="flex justify-between items-start">
                                    <p className="font-bold text-slate-800 text-lg">{customer?.name || 'مشتری نامشخص'}</p>
                                    <span className="font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-100">{formatCurrency(inv.totalAmount, storeSettings)}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs text-slate-500 border-t border-dashed border-slate-200 pt-2 mt-1">
                                    <span>ثبت کننده: <span className="font-semibold text-slate-700">{inv.cashier}</span></span>
                                    <span>{new Date(inv.timestamp).toLocaleTimeString('fa-IR', {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                            </div>
                        )
                    }) : (
                        <div className="text-center py-10 flex flex-col items-center text-slate-400">
                            <UserGroupIcon className="w-12 h-12 mb-2 opacity-50" />
                            <p>هیچ فروش نسیه‌ای برای امروز ثبت نشده است.</p>
                        </div>
                    )}
                </div>
                <div className="p-4 bg-slate-50 border-t flex justify-between items-center">
                    <span className="font-semibold text-slate-600">مجموع کل:</span>
                    <span className="font-bold text-xl text-slate-800">{formatCurrency(totalCreditSalesToday, storeSettings)}</span>
                </div>
            </div>
        </div>
      )}

      <div className="flex justify-between items-start mb-10">
        <div>
            <h1 className="text-2xl md:text-4xl mb-2">داشبورد مدیریتی</h1>
            <p className="text-md md:text-lg text-slate-600">خوش آمدید، {currentUser?.username}!</p>
        </div>
        <div className="relative" ref={alertsRef}>
            <button onClick={() => setIsAlertsOpen(prev => !prev)} className="p-3 rounded-full hover:bg-slate-200/50 transition-colors relative">
                <BellIcon className="w-8 h-8 text-slate-600"/>
                {totalAlerts > 0 && (
                    <span className="absolute top-1 right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                        {totalAlerts}
                    </span>
                )}
            </button>
            {isAlertsOpen && (
                <div className="absolute left-0 mt-2 w-80 bg-white/80 backdrop-blur-xl rounded-xl shadow-2xl border border-gray-200/60 z-20 p-4 max-h-96 overflow-y-auto">
                    <h3 className="font-bold text-slate-800 text-lg mb-3 pb-2 border-b">مرکز هشدارها</h3>
                    {totalAlerts === 0 ? (
                        <p className="text-center text-slate-500 py-4">هیچ هشدار فعالی وجود ندارد.</p>
                    ) : (
                        <div className="space-y-4">
                            {lowStockProducts.length > 0 && (
                                <div>
                                    <h4 className="font-semibold text-amber-700 mb-2">کالاهای رو به اتمام</h4>
                                    <ul className="space-y-1 text-sm">
                                        {lowStockProducts.map(p => (
                                            <li key={p.id} className="flex justify-between p-1.5 bg-amber-50/70 rounded">
                                                <span>{p.name}</span>
                                                <span className="font-bold">{p.totalStock} عدد</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {expiringSoonProducts.length > 0 && (
                                <div>
                                    <h4 className="font-semibold text-red-700 mb-2">کالاهای با انقضای نزدیک</h4>
                                     <ul className="space-y-1 text-sm">
                                        {expiringSoonProducts.map(p => (
                                            <li key={p.id + p.lotNumber} className="flex justify-between p-1.5 bg-red-50/70 rounded">
                                                <span>{p.name}</span>
                                                <span className="font-bold">{new Date(p.expiryDate!).toLocaleDateString('fa-IR')}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
      </div>


       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          {lowStockProducts.length > 0 && <AlertCard title="کالاهای رو به اتمام" items={lowStockProducts.map(p => ({...p, stock: p.totalStock}))} color="amber" type="stock" />}
          {expiringSoonProducts.length > 0 && <AlertCard title="کالاهای با انقضای نزدیک" items={expiringSoonProducts} color="red" type="expiry" />}
       </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <StatCard 
            title="مجموع فروش امروز" 
            value={Math.round(totalSalesToday).toLocaleString('fa-IR')} 
            description={storeSettings.currencyName} 
            color="text-blue-600" 
            icon={<POSIcon className="w-6 h-6 text-blue-600" />} 
        />
        <StatCard 
            title="فروش نسیه امروز" 
            value={Math.round(totalCreditSalesToday).toLocaleString('fa-IR')} 
            description={storeSettings.currencyName} 
            color="text-orange-600" 
            icon={<UserGroupIcon className="w-6 h-6 text-orange-600" />}
            onDetailClick={() => setIsCreditDetailsOpen(true)}
        />
      </div>

      <div className="bg-white/60 backdrop-blur-xl p-4 md:p-6 rounded-2xl shadow-lg border border-gray-200/60">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
            <h2 className="text-xl font-bold">فعالیت‌های اخیر</h2>
             <DateRangeFilter onFilterChange={(start, end) => setDateRange({ start, end })} />
        </div>
        <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredActivities.length > 0 ? filteredActivities.map(activity => {
                // Check if this activity is related to a credit sale
                const relatedInvoice = activity.type === 'sale' ? saleInvoices.find(i => i.id === activity.refId) : null;
                const isCreditSale = relatedInvoice && relatedInvoice.customerId;

                return (
                    <div 
                        key={activity.id} 
                        onClick={() => activity.refId && setViewingActivity(activity)}
                        className={`flex items-center justify-between p-4 rounded-xl hover:bg-white/80 transition-colors duration-200 ${activity.refId ? 'cursor-pointer' : ''}`}
                    >
                        <div className="flex items-center space-x-4 space-x-reverse">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${activity.type === 'sale' ? 'bg-green-100' : activity.type === 'purchase' ? 'bg-blue-100' : 'bg-amber-100'}`}>
                            {activity.type === 'sale' && <POSIcon className="w-5 h-5 text-green-600"/>}
                            {activity.type === 'purchase' && <PurchaseIcon className="w-5 h-5 text-blue-600"/>}
                            {activity.type === 'inventory' && <InventoryIcon className="w-5 h-5 text-amber-600"/>}
                            </div>
                            <div>
                                <p className="font-semibold text-slate-800 text-md flex items-center flex-wrap gap-2">
                                    <span><span className="font-bold text-blue-700">{activity.user}</span> {activity.description}</span>
                                    {isCreditSale && (
                                        <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-700 rounded-full border border-indigo-200 flex items-center gap-1">
                                            <UserGroupIcon className="w-3 h-3" />
                                            نسیه
                                        </span>
                                    )}
                                </p>
                                <p className="text-sm text-slate-500">{new Date(activity.timestamp).toLocaleString('fa-IR')}</p>
                            </div>
                        </div>
                    </div>
                );
            }) : (
                 <div className="text-center p-8">
                    <p className="text-slate-500 text-lg">در بازه زمانی انتخاب شده، فعالیتی ثبت نشده است.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
