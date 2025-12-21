
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../AppContext';
import DateRangeFilter from '../components/DateRangeFilter';
import { formatCurrency } from '../utils/formatters';
import type { Product, SaleInvoice, User, Customer, Supplier, CustomerTransaction, SupplierTransaction } from '../types';
import TransactionHistoryModal from '../components/TransactionHistoryModal';
import { PrintIcon, WarningIcon, UserGroupIcon, InventoryIcon, AccountingIcon } from '../components/icons';
import ReportPrintPreviewModal from '../components/ReportPrintPreviewModal';

const Reports: React.FC = () => {
    const { 
        saleInvoices, products, expenses, users, activities, 
        customers, suppliers, customerTransactions, supplierTransactions, storeSettings
    } = useAppContext();

    const [activeTab, setActiveTab] = useState('sales');
    const [dateRange, setDateRange] = useState<{ start: Date, end: Date }>({ start: new Date(), end: new Date() });
    const [printModalContent, setPrintModalContent] = useState<{ title: string; content: React.ReactNode } | null>(null);

    // --- Sales & Profitability Calculations ---
    const salesData = useMemo(() => {
        const filteredInvoices = saleInvoices.filter(inv => {
            const invTime = new Date(inv.timestamp).getTime();
            return invTime >= dateRange.start.getTime() && invTime <= dateRange.end.getTime();
        });

        let grossRevenue = 0; // Total money in from sales (Total Amount)
        let returnsAmount = 0; // Total money back from returns
        let totalDiscountsGiven = 0; // Only positive discounts
        let totalCOGS = 0; // Cost of Goods Sold

        filteredInvoices.forEach(inv => {
            if (inv.type === 'sale') {
                grossRevenue += inv.totalAmount;
                if (inv.totalDiscount > 0) {
                    totalDiscountsGiven += inv.totalDiscount;
                }
                inv.items.forEach(item => {
                    if (item.type === 'product') {
                        totalCOGS += (item.purchasePrice || 0) * item.quantity;
                    }
                });
            } else if (inv.type === 'return') {
                returnsAmount += inv.totalAmount;
                inv.items.forEach(item => {
                    if (item.type === 'product') {
                        totalCOGS -= (item.purchasePrice || 0) * item.quantity;
                    }
                });
            }
        });

        const netSales = grossRevenue - returnsAmount;
        const totalExpenses = expenses.filter(exp => {
            const expTime = new Date(exp.date).getTime();
            return expTime >= dateRange.start.getTime() && expTime <= dateRange.end.getTime();
        }).reduce((sum, exp) => sum + exp.amount, 0);

        const grossProfit = netSales - totalCOGS;
        const netIncome = grossProfit - totalExpenses;

        const topProducts = filteredInvoices
            .flatMap(inv => inv.items)
            .filter(item => item.type === 'product')
            .reduce((acc, item) => {
                const existing = acc.find(p => p.id === item.id);
                const price = (item as any).finalPrice ?? (item as any).salePrice;
                const qty = item.quantity; 
                if (existing) {
                    existing.quantity += qty;
                    existing.totalValue += qty * price;
                } else {
                    acc.push({ id: item.id, name: item.name, quantity: qty, totalValue: qty * price });
                }
                return acc;
            }, [] as { id: string, name: string, quantity: number, totalValue: number }[])
            .sort((a, b) => b.totalValue - a.totalValue)
            .slice(0, 10);

        const salesByEmployee = filteredInvoices
            .filter(inv => inv.type === 'sale')
            .reduce((acc, inv) => {
                const existing = acc.find(e => e.cashier === inv.cashier);
                if (existing) {
                    existing.totalSales += inv.totalAmount;
                    existing.invoiceCount += 1;
                } else {
                    acc.push({ cashier: inv.cashier, totalSales: inv.totalAmount, invoiceCount: 1 });
                }
                return acc;
            }, [] as { cashier: string, totalSales: number, invoiceCount: number }[]);

        return { 
            netSales, 
            totalDiscountsGiven, 
            totalExpenses, 
            netIncome, 
            topProducts, 
            salesByEmployee,
            returnsAmount,
            totalCOGS 
        };
    }, [saleInvoices, expenses, dateRange]);
    
    // --- Inventory Calculations ---
    const inventoryData = useMemo(() => {
        const totalValue = products.reduce((sum, p) => sum + p.batches.reduce((batchSum, b) => batchSum + (b.stock * b.purchasePrice), 0), 0);
        const totalItems = products.reduce((sum, p) => sum + p.batches.reduce((batchSum, b) => batchSum + b.stock, 0), 0);
        const soldProductIds = new Set(saleInvoices.filter(inv => {
            const invTime = new Date(inv.timestamp).getTime();
            return invTime >= dateRange.start.getTime() && invTime <= dateRange.end.getTime();
        }).flatMap(inv => inv.items.map(item => item.id)));
        
        const stagnantProducts = products.filter(p => !soldProductIds.has(p.id));

        return { totalValue, totalItems, stagnantProducts };
    }, [products, saleInvoices, dateRange]);
    
    // --- Financial Position (Balance Sheet) Logic ---
    const financialPositionData = useMemo(() => {
        const inventoryValue = products.reduce((sum, p) => 
            sum + p.batches.reduce((batchSum, b) => batchSum + (b.stock * b.purchasePrice), 0), 0
        );

        const customerReceivables = customers.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0);
        const supplierPayables = suppliers.reduce((sum, s) => sum + (s.balance > 0 ? s.balance : 0), 0);
        
        const totalAssets = inventoryValue + customerReceivables;
        const netCapital = totalAssets - supplierPayables;

        const topDebtors = [...customers]
            .filter(c => c.balance > 0)
            .sort((a, b) => b.balance - a.balance)
            .slice(0, 5);

        return {
            inventoryValue,
            customerReceivables,
            supplierPayables,
            totalAssets,
            netCapital,
            topDebtors
        };
    }, [products, customers, suppliers]);

    // --- Employee Activity Calculations ---
    const [selectedEmployee, setSelectedEmployee] = useState('all');
    const [selectedActivityTypes, setSelectedActivityTypes] = useState<string[]>([]);
    
    const activityTypes = useMemo(() => [...new Set(activities.map(a => a.type))], [activities]);

    const employeeActivityData = useMemo(() => {
        return activities.filter(act => {
             const actTime = new Date(act.timestamp).getTime();
             const inRange = actTime >= dateRange.start.getTime() && actTime <= dateRange.end.getTime();
             const employeeMatch = selectedEmployee === 'all' || act.user === selectedEmployee;
             const typeMatch = selectedActivityTypes.length === 0 || selectedActivityTypes.includes(act.type);
             return inRange && employeeMatch && typeMatch;
        });
    }, [activities, dateRange, selectedEmployee, selectedActivityTypes]);

    const handleActivityTypeChange = (type: string) => {
        setSelectedActivityTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
    };

    // --- Accounts Report ---
    const [selectedAccount, setSelectedAccount] = useState<{type: 'customer' | 'supplier', id: string} | null>(null);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);

    const accountReportData = useMemo(() => {
        if (!selectedAccount) return null;
        let person, transactions;
        if(selectedAccount.type === 'customer') {
            person = customers.find(c => c.id === selectedAccount.id);
            transactions = customerTransactions.filter(t => t.customerId === selectedAccount.id);
        } else {
            person = suppliers.find(s => s.id === selectedAccount.id);
            transactions = supplierTransactions.filter(t => t.supplierId === selectedAccount.id);
        }
        return { person, transactions };
    }, [selectedAccount, customers, suppliers, customerTransactions, supplierTransactions]);

    const collectionsData = useMemo(() => {
        const filteredPayments = customerTransactions.filter(t => {
            const tTime = new Date(t.date).getTime();
            const inRange = tTime >= dateRange.start.getTime() && tTime <= dateRange.end.getTime();
            return t.type === 'payment' && inRange;
        });
        const totalCollected = filteredPayments.reduce((sum, t) => sum + t.amount, 0);
        const count = filteredPayments.length;
        const details = filteredPayments.map(t => {
            const customer = customers.find(c => c.id === t.customerId);
            return {
                id: t.id,
                customerName: customer ? customer.name : 'مشتری حذف شده',
                amount: t.amount,
                date: t.date,
                description: t.description
            };
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return { totalCollected, count, details };
    }, [customerTransactions, dateRange, customers]);

    const openHistoryModal = () => { if(accountReportData?.person) setHistoryModalOpen(true); };

    const SmartStatCard: React.FC<{ title: string, value: string, color: string, icon?: React.ReactNode }> = ({ title, value, color, icon }) => {
        let fontSizeClass = 'text-3xl';
        if (value.length > 25) fontSizeClass = 'text-lg';
        else if (value.length > 20) fontSizeClass = 'text-xl';
        else if (value.length > 15) fontSizeClass = 'text-2xl';

        return (
            <div className="bg-white/70 p-5 rounded-xl shadow-md border flex flex-col justify-center h-32 transition-transform duration-200 hover:-translate-y-1 relative overflow-hidden group">
                {icon && <div className="absolute -left-2 -bottom-2 opacity-10 scale-150 transform group-hover:scale-[1.7] transition-transform duration-500">{icon}</div>}
                <h4 className="text-md font-semibold text-slate-600 mb-2 truncate relative z-10" title={title}>{title}</h4>
                <p className={`${fontSizeClass} font-extrabold ${color} whitespace-nowrap overflow-hidden text-ellipsis relative z-10`} title={value}>{value}</p>
            </div>
        );
    };
    
    const handlePrintReport = (title: string, content: React.ReactNode) => {
        setPrintModalContent({ title, content });
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'sales': 
                const salesReportContent = (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <SmartStatCard title="فروش خالص (پس از مرجوعی)" value={formatCurrency(salesData.netSales, storeSettings)} color="text-blue-600" />
                            <SmartStatCard title="تخفیف‌های داده شده" value={formatCurrency(salesData.totalDiscountsGiven, storeSettings)} color="text-amber-600" />
                            <SmartStatCard title="هزینه‌های ثبت شده" value={formatCurrency(salesData.totalExpenses, storeSettings)} color="text-red-500" />
                            <SmartStatCard title="سود خالص نهایی" value={formatCurrency(salesData.netIncome, storeSettings)} color="text-green-600" />
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="p-4 bg-white/70 rounded-xl shadow-md border">
                                <h3 className="font-bold text-lg mb-2">جزئیات مالی</h3>
                                <ul className="space-y-2 text-sm">
                                    <li className="flex justify-between p-2 border-b"><span>قیمت خرید کالاها (COGS):</span> <span className="font-mono">{formatCurrency(salesData.totalCOGS, storeSettings)}</span></li>
                                    <li className="flex justify-between p-2 border-b"><span>مبلغ مرجوعی‌ها:</span> <span className="font-mono text-red-500">{formatCurrency(salesData.returnsAmount, storeSettings)}</span></li>
                                </ul>
                            </div>
                            <div className="p-4 bg-white/70 rounded-xl shadow-md border">
                                <h3 className="font-bold text-lg mb-2">عملکرد فروش کارمندان</h3>
                                <ul>{salesData.salesByEmployee.map(e => <li key={e.cashier} className="flex justify-between p-2 border-b last:border-0"><span>{e.cashier}</span> <span className="font-semibold">{formatCurrency(e.totalSales, storeSettings)} ({e.invoiceCount} فاکتور)</span></li>)}</ul>
                            </div>
                        </div>
                         <div className="p-4 bg-white/70 rounded-xl shadow-md border">
                            <h3 className="font-bold text-lg mb-2">پرفروش‌ترین محصولات</h3>
                            <ul>{salesData.topProducts.map(p => <li key={p.id} className="flex justify-between p-2 border-b last:border-0"><span>{p.name}</span> <span className="font-semibold">{formatCurrency(p.totalValue, storeSettings)} ({p.quantity} عدد)</span></li>)}</ul>
                        </div>
                    </div>
                );
                return (
                    <div>
                        <button onClick={() => handlePrintReport('گزارش فروش و سودآوری', salesReportContent)} className="flex items-center gap-2 mb-4 px-4 py-2 bg-slate-200 rounded-md text-slate-700 hover:bg-slate-300 transition-colors"><PrintIcon /> چاپ گزارش</button>
                        {salesReportContent}
                    </div>
                );
            case 'inventory': 
                const inventoryReportContent = (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <SmartStatCard title="ارزش کل انبار" value={formatCurrency(inventoryData.totalValue, storeSettings)} color="text-blue-600" />
                            <SmartStatCard title="تعداد کل اقلام" value={inventoryData.totalItems.toLocaleString('fa-IR')} color="text-green-600" />
                        </div>
                        <div className="p-4 bg-white/70 rounded-xl shadow-md border">
                            <h3 className="font-bold text-lg mb-2">گزارش کامل موجودی</h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm text-center">
                                    <thead className="bg-slate-100">
                                        <tr>
                                            <th className="p-2">نام محصول</th>
                                            <th className="p-2">موجودی کل</th>
                                            <th className="p-2">ارزش موجودی</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {products.map(p => {
                                            const totalStock = p.batches.reduce((sum, b) => sum + b.stock, 0);
                                            const stockValue = p.batches.reduce((sum, b) => sum + (b.stock * b.purchasePrice), 0);
                                            return (
                                                <tr key={p.id} className="border-b last:border-0">
                                                    <td className="p-2 text-right font-semibold">{p.name}</td>
                                                    <td className="p-2">{totalStock.toLocaleString('fa-IR')}</td>
                                                    <td className="p-2">{formatCurrency(stockValue, storeSettings)}</td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
                 return (
                    <div>
                        <button onClick={() => handlePrintReport('گزارش انبار و موجودی', inventoryReportContent)} className="flex items-center gap-2 mb-4 px-4 py-2 bg-slate-200 rounded-md text-slate-700 hover:bg-slate-300 transition-colors"><PrintIcon /> چاپ گزارش</button>
                        {inventoryReportContent}
                    </div>
                );
            case 'financial_position':
                const financialReportContent = (
                    <div className="space-y-8">
                        {/* 3 Column Structure for Assets, Liabilities, and Net */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Assets Column */}
                            <div className="space-y-4">
                                <h3 className="font-bold text-slate-700 flex items-center gap-2 border-b-2 border-green-500 pb-2">
                                    <span className="w-3 h-3 rounded-full bg-green-500"></span>
                                    دارایی‌های جاری
                                </h3>
                                <SmartStatCard title="ارزش موجودی انبار" value={formatCurrency(financialPositionData.inventoryValue, storeSettings)} color="text-green-600" icon={<InventoryIcon />} />
                                <SmartStatCard title="مجموع طلب از مشتریان" value={formatCurrency(financialPositionData.customerReceivables, storeSettings)} color="text-green-600" icon={<UserGroupIcon />} />
                                <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex justify-between items-center">
                                    <span className="font-bold text-green-800">کل دارایی‌ها:</span>
                                    <span className="font-extrabold text-green-700 text-lg">{formatCurrency(financialPositionData.totalAssets, storeSettings)}</span>
                                </div>
                            </div>

                            {/* Liabilities Column */}
                            <div className="space-y-4">
                                <h3 className="font-bold text-slate-700 flex items-center gap-2 border-b-2 border-red-500 pb-2">
                                    <span className="w-3 h-3 rounded-full bg-red-500"></span>
                                    تعهدات و بدهی‌ها
                                </h3>
                                <SmartStatCard title="بدهی به تأمین‌کنندگان" value={formatCurrency(financialPositionData.supplierPayables, storeSettings)} color="text-red-600" icon={<AccountingIcon />} />
                                <div className="p-4 bg-slate-50 rounded-xl text-slate-400 text-sm border border-slate-200 h-32 flex items-center justify-center text-center">
                                    <p>سایر بدهی‌ها (مساعده کارمندان و ...) در این بخش محاسبه نشده‌اند.</p>
                                </div>
                                <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex justify-between items-center">
                                    <span className="font-bold text-red-800">کل بدهی‌ها:</span>
                                    <span className="font-extrabold text-red-700 text-lg">{formatCurrency(financialPositionData.supplierPayables, storeSettings)}</span>
                                </div>
                            </div>

                            {/* Net Worth Column */}
                            <div className="space-y-4">
                                <h3 className="font-bold text-slate-700 flex items-center gap-2 border-b-2 border-blue-500 pb-2">
                                    <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                                    سرمایه خالص (ثروت واقعی)
                                </h3>
                                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-2xl shadow-xl text-white h-[280px] flex flex-col justify-center items-center text-center">
                                    <h4 className="text-blue-100 mb-4 font-semibold">ارزش کل نهایی فروشگاه</h4>
                                    <p className="text-4xl lg:text-5xl font-black mb-2 drop-shadow-md" dir="ltr">{formatCurrency(financialPositionData.netCapital, storeSettings)}</p>
                                    <div className="mt-6 py-2 px-4 bg-white/20 rounded-full text-xs backdrop-blur-md">
                                        محاسبه شده بر اساس قیمت خرید کالاها
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Analysis Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
                            <div className="p-5 bg-white/70 rounded-2xl shadow-lg border border-orange-100">
                                <div className="flex items-center gap-2 mb-4">
                                    <WarningIcon className="w-6 h-6 text-orange-600" />
                                    <h3 className="font-bold text-lg text-slate-800">تحلیل ریسک سرمایه</h3>
                                </div>
                                <p className="text-sm text-slate-600 mb-4">لیست مشتریانی که بیشترین بدهی را دارند و سرمایه شما را بلوکه کرده‌اند:</p>
                                <div className="space-y-3">
                                    {financialPositionData.topDebtors.map(c => (
                                        <div key={c.id} className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-100">
                                            <span className="font-semibold text-slate-700">{c.name}</span>
                                            <span className="font-bold text-red-600" dir="ltr">{formatCurrency(c.balance, storeSettings)}</span>
                                        </div>
                                    ))}
                                    {financialPositionData.topDebtors.length === 0 && <p className="text-center py-4 text-slate-400">مشتری بدهکاری یافت نشد.</p>}
                                </div>
                            </div>
                            <div className="p-5 bg-white/70 rounded-2xl shadow-lg border border-blue-100 flex flex-col justify-center">
                                <h3 className="font-bold text-lg text-slate-800 mb-4 text-center">ترکیب دارایی‌ها</h3>
                                <div className="flex items-center h-12 w-full rounded-full overflow-hidden bg-slate-100 shadow-inner">
                                    <div 
                                        className="h-full bg-blue-500 flex items-center justify-center text-[10px] text-white font-bold transition-all duration-1000"
                                        style={{ width: `${(financialPositionData.inventoryValue / financialPositionData.totalAssets) * 100}%` }}
                                    >
                                        کالا {Math.round((financialPositionData.inventoryValue / financialPositionData.totalAssets) * 100)}%
                                    </div>
                                    <div 
                                        className="h-full bg-orange-400 flex items-center justify-center text-[10px] text-white font-bold transition-all duration-1000"
                                        style={{ width: `${(financialPositionData.customerReceivables / financialPositionData.totalAssets) * 100}%` }}
                                    >
                                        مطالبات {Math.round((financialPositionData.customerReceivables / financialPositionData.totalAssets) * 100)}%
                                    </div>
                                </div>
                                <div className="mt-6 space-y-2">
                                    <div className="flex items-center gap-2 text-xs text-slate-600">
                                        <div className="w-3 h-3 rounded bg-blue-500"></div>
                                        <span>سرمایه در گردش (کالای موجود در قفسه‌ها)</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-600">
                                        <div className="w-3 h-3 rounded bg-orange-400"></div>
                                        <span>سرمایه در بازار (طلب از مشتریان)</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
                return (
                    <div>
                        <button onClick={() => handlePrintReport('ترازنامه مالی و سرمایه', financialReportContent)} className="flex items-center gap-2 mb-4 px-4 py-2 bg-slate-200 rounded-md text-slate-700 hover:bg-slate-300 transition-colors"><PrintIcon /> چاپ ترازنامه</button>
                        {financialReportContent}
                    </div>
                );
            case 'employees': 
                const employeeReportContent = (
                     <div className="p-4 bg-white/70 rounded-xl shadow-md border">
                        <h3 className="font-bold text-lg mb-2">لیست فعالیت‌ها</h3>
                        <ul className="space-y-2">
                             {employeeActivityData.map(act => (
                                <li key={act.id} className="p-2 border-b">
                                    <span className="font-bold text-blue-700">{act.user}</span> {act.description}
                                    <span className="text-xs text-slate-500 block text-left">{new Date(act.timestamp).toLocaleString('fa-IR')}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                );
                return (
                 <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div className="flex gap-4 p-4 bg-white/70 rounded-xl shadow-md border items-center flex-wrap">
                            <select value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)} className="p-2 border rounded-md bg-white">
                                <option value="all">همه کارمندان</option>
                                {users.map(u => <option key={u.id} value={u.username}>{u.username}</option>)}
                            </select>
                            <div className="flex gap-2 flex-wrap">
                                {activityTypes.map(type => (
                                    <label key={type} className="flex items-center gap-1 cursor-pointer">
                                        <input type="checkbox" checked={selectedActivityTypes.includes(type)} onChange={() => handleActivityTypeChange(type)} />
                                        <span>{type}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <button onClick={() => handlePrintReport('گزارش فعالیت کارمندان', employeeReportContent)} className="flex items-center gap-2 px-4 py-2 bg-slate-200 rounded-md text-slate-700 hover:bg-slate-300 transition-colors"><PrintIcon /> چاپ گزارش</button>
                    </div>
                    {employeeReportContent}
                 </div>
                );
            case 'accounts': 
                const collectionsReportContent = (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <SmartStatCard title="مجموع وصولی" value={formatCurrency(collectionsData.totalCollected, storeSettings)} color="text-green-600" />
                            <SmartStatCard title="تعداد پرداخت‌ها" value={`${collectionsData.count} فقره`} color="text-blue-600" />
                        </div>
                        <div className="bg-white/70 rounded-xl shadow-md border overflow-hidden">
                            <table className="min-w-full text-sm text-center">
                                <thead className="bg-slate-100">
                                    <tr>
                                        <th className="p-3">نام مشتری</th>
                                        <th className="p-3">مبلغ</th>
                                        <th className="p-3">تاریخ و ساعت</th>
                                        <th className="p-3">شرح</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {collectionsData.details.map(d => (
                                        <tr key={d.id} className="border-b last:border-0 hover:bg-slate-50">
                                            <td className="p-3 font-semibold">{d.customerName}</td>
                                            <td className="p-3 text-green-700 font-bold" dir="ltr">{formatCurrency(d.amount, storeSettings)}</td>
                                            <td className="p-3">{new Date(d.date).toLocaleString('fa-IR')}</td>
                                            <td className="p-3 text-slate-500">{d.description}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {collectionsData.count === 0 && <p className="text-center p-6 text-slate-500">موردی یافت نشد.</p>}
                        </div>
                    </div>
                );

                return (
                <div className="space-y-8">
                    <div>
                        <div className="flex justify-between items-end mb-4">
                           <div>
                               <h3 className="text-xl font-bold text-slate-800">گزارش وصول مطالبات (از مشتریان)</h3>
                               <p className="text-sm text-slate-500 mt-1">لیست مبالغ دریافت شده از مشتریان بابت بدهی‌های قبلی</p>
                           </div>
                           <button onClick={() => handlePrintReport('گزارش وصول مطالبات', collectionsReportContent)} className="flex items-center gap-2 px-4 py-2 bg-slate-200 rounded-md text-slate-700 hover:bg-slate-300 transition-colors"><PrintIcon /> چاپ گزارش</button>
                        </div>
                        {collectionsReportContent}
                    </div>

                    <div className="border-t border-dashed border-gray-300 my-6"></div>

                    <div>
                        <h3 className="text-xl font-bold text-slate-800 mb-4">بررسی حساب اشخاص (معین)</h3>
                        <div className="flex flex-col md:flex-row gap-4 p-4 bg-white/70 rounded-xl shadow-md border items-center">
                            <select onChange={e => setSelectedAccount(e.target.value ? JSON.parse(e.target.value) : null)} className="p-3 border rounded-md bg-white w-full md:w-1/2">
                                <option value="">-- انتخاب حساب --</option>
                                <optgroup label="مشتریان">
                                    {customers.map(c => <option key={c.id} value={JSON.stringify({type: 'customer', id: c.id})}>{c.name}</option>)}
                                </optgroup>
                                <optgroup label="تأمین‌کنندگان">
                                    {suppliers.map(s => <option key={s.id} value={JSON.stringify({type: 'supplier', id: s.id})}>{s.name}</option>)}
                                </optgroup>
                            </select>
                            <button onClick={openHistoryModal} disabled={!selectedAccount} className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-md disabled:bg-gray-400 font-semibold shadow-lg btn-primary transition-all">مشاهده صورت حساب</button>
                        </div>
                        {historyModalOpen && accountReportData?.person && (
                            <TransactionHistoryModal 
                                person={accountReportData.person}
                                transactions={accountReportData.transactions as any}
                                type={selectedAccount!.type}
                                onClose={() => setHistoryModalOpen(false)}
                                onReprint={() => {}}
                            />
                        )}
                    </div>
                </div>
            );
            default: return null;
        }
    }


    return (
        <div className="p-8">
            {printModalContent && (
                <ReportPrintPreviewModal 
                    title={printModalContent.title}
                    dateRange={dateRange}
                    onClose={() => setPrintModalContent(null)}
                >
                    {printModalContent.content}
                </ReportPrintPreviewModal>
            )}

            <h1 className="mb-4">مرکز گزارشات</h1>
            <div className="mb-8 p-4 bg-white/60 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/60">
                <DateRangeFilter onFilterChange={(start, end) => setDateRange({ start, end })} />
            </div>

            <div className="bg-white/60 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/60">
                <div className="flex border-b border-gray-200/60 p-2 bg-white/40 rounded-t-2xl flex-wrap">
                    <button onClick={() => setActiveTab('sales')} className={`py-3 px-6 font-bold text-lg rounded-lg ${activeTab === 'sales' ? 'bg-white shadow-md text-blue-600' : 'text-slate-600'}`}>فروش و سودآوری</button>
                    <button onClick={() => setActiveTab('inventory')} className={`py-3 px-6 font-bold text-lg rounded-lg ${activeTab === 'inventory' ? 'bg-white shadow-md text-blue-600' : 'text-slate-600'}`}>انبار و موجودی</button>
                    <button onClick={() => setActiveTab('financial_position')} className={`py-3 px-6 font-bold text-lg rounded-lg ${activeTab === 'financial_position' ? 'bg-white shadow-md text-blue-600' : 'text-slate-600'}`}>ترازنامه مالی (سرمایه)</button>
                    <button onClick={() => setActiveTab('accounts')} className={`py-3 px-6 font-bold text-lg rounded-lg ${activeTab === 'accounts' ? 'bg-white shadow-md text-blue-600' : 'text-slate-600'}`}>حساب‌ها و وصولی</button>
                    <button onClick={() => setActiveTab('employees')} className={`py-3 px-6 font-bold text-lg rounded-lg ${activeTab === 'employees' ? 'bg-white shadow-md text-blue-600' : 'text-slate-600'}`}>فعالیت کارمندان</button>
                </div>
                <div className="p-6">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default Reports;
