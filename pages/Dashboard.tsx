import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Product, ActivityLog } from '../types';
import { useAppContext } from '../AppContext';
import { POSIcon, InventoryIcon, PurchaseIcon, WarningIcon, BellIcon } from '../components/icons';
import { formatCurrency } from '../utils/formatters';
import DateRangeFilter from '../components/DateRangeFilter';
import ActivityDetailModal from '../components/ActivityDetailModal';


const Dashboard: React.FC = () => {
    const { saleInvoices, purchaseInvoices, activities, products, storeSettings, currentUser } = useAppContext();
    const [dateRange, setDateRange] = useState<{ start: Date, end: Date }>({ start: new Date(), end: new Date() });
    const [isAlertsOpen, setIsAlertsOpen] = useState(false);
    const alertsRef = useRef<HTMLDivElement>(null);
    const [viewingActivity, setViewingActivity] = useState<ActivityLog | null>(null);

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


    const isToday = (date: Date) => {
        const today = new Date();
        return date.getFullYear() === today.getFullYear() &&
               date.getMonth() === today.getMonth() &&
               date.getDate() === today.getDate();
    };

    const todaysSales = saleInvoices.filter(inv => isToday(new Date(inv.timestamp)));
    const totalSalesToday = todaysSales.reduce((sum, inv) => sum + inv.totalAmount, 0);
    
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


    const StatCard: React.FC<{ title: string; value: string; description: string; color: string, icon: React.ReactNode }> = ({ title, value, description, color, icon }) => (
        <div className="bg-white/60 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-gray-200/60 flex flex-col justify-between transform transition-transform duration-300 hover:-translate-y-2">
            <div className="flex justify-between items-start">
                <h3 className="text-lg font-semibold text-slate-700">{title}</h3>
                <div className={`p-2 rounded-full bg-opacity-20 ${color.replace('text-', 'bg-')}`}>{icon}</div>
            </div>
            <div>
                <p className={`text-5xl font-extrabold my-2 ${color}`}>{value}</p>
                <p className="text-md text-slate-500">{description}</p>
            </div>
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
    )

  return (
    <div className="p-4 md:p-8">
      {viewingActivity && <ActivityDetailModal activity={viewingActivity} onClose={() => setViewingActivity(null)} />}
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
      
      <div className="grid grid-cols-1 gap-8 mb-10 sm:max-w-sm">
        <StatCard title="مجموع فروش امروز" value={Math.round(totalSalesToday).toLocaleString('fa-IR')} description={storeSettings.currencyName} color="text-blue-600" icon={<POSIcon className="w-6 h-6 text-blue-600" />} />
      </div>

      <div className="bg-white/60 backdrop-blur-xl p-4 md:p-6 rounded-2xl shadow-lg border border-gray-200/60">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
            <h2 className="text-xl font-bold">فعالیت‌های اخیر</h2>
             <DateRangeFilter onFilterChange={(start, end) => setDateRange({ start, end })} />
        </div>
        <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredActivities.length > 0 ? filteredActivities.map(activity => (
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
                            <p className="font-semibold text-slate-800 text-md"><span className="font-bold text-blue-700">{activity.user}</span> {activity.description}</p>
                            <p className="text-sm text-slate-500">{new Date(activity.timestamp).toLocaleString('fa-IR')}</p>
                        </div>
                    </div>
                </div>
            )) : (
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