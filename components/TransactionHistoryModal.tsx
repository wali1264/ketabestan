import React, { useState, useMemo } from 'react';
import type { Supplier, Customer, Employee, AnyTransaction, PayrollTransaction } from '../types';
import { XIcon, PrintIcon } from './icons';
import { useAppContext } from '../AppContext';
import { formatCurrency } from '../utils/formatters';
import DateRangeFilter from './DateRangeFilter';
import ReportPrintPreviewModal from './ReportPrintPreviewModal';

interface TransactionHistoryModalProps {
    person: Supplier | Customer | Employee;
    transactions: AnyTransaction[];
    type: 'supplier' | 'customer' | 'employee';
    onClose: () => void;
    onReprint: (transactionId: string) => void;
}

const TransactionHistoryModal: React.FC<TransactionHistoryModalProps> = ({ person, transactions, type, onClose, onReprint }) => {
    const { storeSettings } = useAppContext();
    const [dateRange, setDateRange] = useState<{ start: Date, end: Date }>({ start: new Date(), end: new Date() });
    const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);


    const filteredTransactions = useMemo(() => {
        if (!dateRange.start || !dateRange.end) return [];
        const startTime = dateRange.start.getTime();
        const endTime = dateRange.end.getTime();

        return transactions
            .filter(t => {
                const tTime = new Date(t.date).getTime();
                return tTime >= startTime && tTime <= endTime;
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [transactions, dateRange]);


    const transactionTable = (
        <table className="min-w-full text-center responsive-table">
            <thead>
                <tr>
                    <th className="p-3 font-bold text-slate-700">تاریخ</th>
                    <th className="p-3 font-bold text-slate-700">شرح</th>
                    <th className="p-3 font-bold text-slate-700">بدهکار</th>
                    <th className="p-3 font-bold text-slate-700">بستانکار</th>
                    <th className="p-3 font-bold text-slate-700"></th>
                </tr>
            </thead>
            <tbody className="bg-white/50">
                {filteredTransactions.map(t => {
                    let debit = 0;
                    let credit = 0;
                    
                    if (type === 'supplier') {
                        if (t.type === 'purchase') debit = t.amount;
                        else if (t.type === 'payment') credit = t.amount;
                        else if (t.type === 'purchase_return') credit = t.amount;
                    } else if (type === 'customer') {
                        if (t.type === 'credit_sale') debit = t.amount;
                        else if (t.type === 'payment') credit = t.amount;
                        else if (t.type === 'sale_return') credit = t.amount;
                    } else if (type === 'employee') {
                        const payrollTx = t as PayrollTransaction;
                        if (payrollTx.type === 'advance' || payrollTx.type === 'salary_payment') {
                            debit = payrollTx.amount;
                        }
                    }

                    return (
                        <tr key={t.id}>
                            <td data-label="تاریخ" className="p-3 text-slate-600">{new Date(t.date).toLocaleDateString('fa-IR')}</td>
                            <td data-label="شرح" className="p-3 text-slate-800 font-semibold">{t.description}</td>
                            <td data-label="بدهکار" className="p-3 text-red-600">{debit > 0 ? Math.round(debit).toLocaleString('fa-IR') : '-'}</td>
                            <td data-label="بستانکار" className="p-3 text-green-600">{credit > 0 ? Math.round(credit).toLocaleString('fa-IR') : '-'}</td>
                            <td className="p-3 actions-cell">
                                {t.type === 'payment' && (
                                    <button onClick={() => onReprint(t.id)} className="p-2 rounded-full text-gray-500 hover:text-green-600 hover:bg-green-100/50 transition-colors" title="چاپ مجدد رسید">
                                        <PrintIcon className="w-5 h-5" />
                                    </button>
                                )}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );


    return (
        <>
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-0 md:p-4 modal-animate">
                <div className="bg-white/80 backdrop-blur-xl p-6 rounded-none md:rounded-2xl shadow-2xl border border-gray-200/80 w-full h-full md:max-w-4xl md:h-[90vh] flex flex-col">
                    <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                        <div>
                            <h2 className="text-xl md:text-2xl font-bold text-slate-800">صورت حساب: {person.name}</h2>
                            <p className="text-md text-slate-600">
                                موجودی نهایی: <span className="font-bold">{formatCurrency(person.balance, storeSettings)}</span>
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setIsPrintPreviewOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-200 rounded-md text-slate-700 hover:bg-slate-300 transition-colors"><PrintIcon /> چاپ</button>
                            <button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-200/50 transition-colors"><XIcon /></button>
                        </div>
                    </div>
                    
                    <div className="my-4 p-2 bg-slate-100/50 rounded-lg">
                        <DateRangeFilter onFilterChange={(start, end) => setDateRange({ start, end })} />
                    </div>

                    <div className="flex-grow overflow-y-auto -mx-2 px-2">
                        {transactionTable}
                        {filteredTransactions.length === 0 && (
                            <div className="text-center p-16">
                                <p className="text-slate-500 text-lg">در بازه زمانی انتخاب شده، تراکنشی یافت نشد.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {isPrintPreviewOpen && (
                <ReportPrintPreviewModal
                    title={`صورت حساب ${person.name}`}
                    dateRange={dateRange}
                    onClose={() => setIsPrintPreviewOpen(false)}
                >
                    {transactionTable}
                     <div className="mt-6 pt-4 border-t text-left font-bold text-xl">
                        موجودی نهایی: {formatCurrency(person.balance, storeSettings)}
                    </div>
                </ReportPrintPreviewModal>
            )}
        </>
    );
};

export default TransactionHistoryModal;