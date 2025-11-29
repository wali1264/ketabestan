
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../AppContext';
import DateRangeFilter from '../components/DateRangeFilter';
import { formatCurrency } from '../utils/formatters';
import type { Product, SaleInvoice, User, Customer, Supplier, CustomerTransaction, SupplierTransaction } from '../types';
import TransactionHistoryModal from '../components/TransactionHistoryModal';
import { PrintIcon } from '../components/icons';
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
                // Accumulate only positive discounts (real discounts)
                // Surcharges (totalDiscount < 0) are effectively part of revenue, so we ignore them for the 'Discount' metric
                if (inv.totalDiscount > 0) {
                    totalDiscountsGiven += inv.totalDiscount;
                }

                // Calculate COGS for this invoice
                inv.items.forEach(item => {
                    if (item.type === 'product') {
                        // purchasePrice is snapshot at time of sale
                        totalCOGS += (item.purchasePrice || 0) * item.quantity;
                    }
                });

            } else if (inv.type === 'return') {
                returnsAmount += inv.totalAmount;
                // Reverse COGS for returns
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

        // Gross Profit = Net Sales - COGS
        const grossProfit = netSales - totalCOGS;
        
        // Net Income = Gross Profit - Expenses
        const netIncome = grossProfit - totalExpenses;

        const topProducts = filteredInvoices
            .flatMap(inv => inv.items)
            .filter(item => item.type === 'product')
            .reduce((acc, item) => {
                const existing = acc.find(p => p.id === item.id);
                const price = (item as any).finalPrice ?? (item as any).salePrice;
                const qty = item.quantity; 
                // Note: Not subtracting returns from top products list to keep it simple "Top Moved Items"
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

    const openHistoryModal = () => { if(accountReportData?.person) setHistoryModalOpen(true); };

    // Smart Stat Card with Adaptive Typography
    const SmartStatCard: React.FC<{ title: string, value: string, color: string }> = ({ title, value, color }) => {
        // Determine font size based on length
        let fontSizeClass = 'text-3xl';
        if (value.length > 25) fontSizeClass = 'text-lg';
        else if (value.length > 20) fontSizeClass = 'text-xl';
        else if (value.length > 15) fontSizeClass = 'text-2xl';

        return (
            <div className="bg-white/70 p-5 rounded-xl shadow-md border flex flex-col justify-center h-32 transition-transform duration-200 hover:-translate-y-1">
                <h4 className="text-md font-semibold text-slate-600 mb-2 truncate" title={title}>{title}</h4>
                <p 
                    className={`${fontSizeClass} font-extrabold ${color} whitespace-nowrap overflow-hidden text-ellipsis`} 
                    title={value} // Native tooltip for truncated text
                >
                    {value}
                </p>
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
                        <div className="p-4 bg-white/70 rounded-xl shadow-md border">
                            <h3 className="font-bold text-lg mb-2">گزارش کالاهای راکد</h3>
                            <p className="text-sm text-slate-500 mb-2">کالاهایی که در بازه زمانی انتخاب شده فروشی نداشته‌اند.</p>
                            <ul className="list-disc list-inside columns-2 md:columns-4">
                                {inventoryData.stagnantProducts.map(p => <li key={p.id}>{p.name}</li>)}
                            </ul>
                        </div>
                    </div>
                );
                 return (
                    <div>
                        <button onClick={() => handlePrintReport('گزارش انبار و موجودی', inventoryReportContent)} className="flex items-center gap-2 mb-4 px-4 py-2 bg-slate-200 rounded-md text-slate-700 hover:bg-slate-300 transition-colors"><PrintIcon /> چاپ گزارش</button>
                        {inventoryReportContent}
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
            case 'accounts': return (
                <div className="space-y-6">
                    <div className="flex gap-4 p-4 bg-white/70 rounded-xl shadow-md border items-center">
                        <select onChange={e => setSelectedAccount(e.target.value ? JSON.parse(e.target.value) : null)} className="p-2 border rounded-md bg-white">
                            <option value="">-- انتخاب حساب --</option>
                            <optgroup label="مشتریان">
                                {customers.map(c => <option key={c.id} value={JSON.stringify({type: 'customer', id: c.id})}>{c.name}</option>)}
                            </optgroup>
                            <optgroup label="تأمین‌کنندگان">
                                {suppliers.map(s => <option key={s.id} value={JSON.stringify({type: 'supplier', id: s.id})}>{s.name}</option>)}
                            </optgroup>
                        </select>
                        <button onClick={openHistoryModal} disabled={!selectedAccount} className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:bg-gray-400">مشاهده صورت حساب</button>
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
                    <button onClick={() => setActiveTab('employees')} className={`py-3 px-6 font-bold text-lg rounded-lg ${activeTab === 'employees' ? 'bg-white shadow-md text-blue-600' : 'text-slate-600'}`}>فعالیت کارمندان</button>
                    <button onClick={() => setActiveTab('accounts')} className={`py-3 px-6 font-bold text-lg rounded-lg ${activeTab === 'accounts' ? 'bg-white shadow-md text-blue-600' : 'text-slate-600'}`}>حساب‌ها</button>
                </div>
                <div className="p-6">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default Reports;
