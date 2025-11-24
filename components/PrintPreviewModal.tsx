
import React, { useState, useEffect, useRef } from 'react';
import type { SaleInvoice, StoreSettings, CartItem, InvoiceItem } from '../types';
import { XIcon, EditIcon, CheckIcon } from './icons';
import { useAppContext } from '../AppContext';
import { formatCurrency } from '../utils/formatters';


interface PrintPreviewModalProps {
    invoice: SaleInvoice;
    onClose: () => void;
}

const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({ invoice, onClose }) => {
    const { storeSettings, customers } = useAppContext();
    const [customCustomerName, setCustomCustomerName] = useState('');
    const [isEditingName, setIsEditingName] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Initialize name from registered customer if exists
    useEffect(() => {
        const customer = invoice.customerId ? customers.find(c => c.id === invoice.customerId) : null;
        if (customer) {
            setCustomCustomerName(customer.name);
        }
    }, [invoice.customerId, customers]);

    // Focus input when editing starts
    useEffect(() => {
        if (isEditingName && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditingName]);

    const handlePrint = () => {
        // Ensure we exit edit mode before printing to show clean text
        setIsEditingName(false);
        // Small timeout to allow React to re-render the text view before browser print dialog opens
        setTimeout(() => {
            window.print();
        }, 100);
    };
    
    const getPrice = (item: CartItem): { original: number; final: number; discount: number } => {
        if (item.type === 'product') {
            const original = item.salePrice;
            const final = item.finalPrice !== undefined ? item.finalPrice : original;
            const discount = (original - final) * item.quantity;
            return { original, final, discount };
        }
        // Services don't have discounts in this implementation
        return { original: item.price, final: item.price, discount: 0 };
    };

    const getPackageInfo = (item: CartItem) => {
        if (item.type === 'service') {
            return { packages: 0, units: item.quantity };
        }
        const pItem = item as InvoiceItem;
        const itemsPerPack = pItem.itemsPerPackage || 1;
        const packages = Math.floor(item.quantity / itemsPerPack);
        const units = item.quantity % itemsPerPack;
        return { packages, units };
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div id="print-modal-content" className="text-gray-900 flex-grow flex flex-col min-h-0">
                    <div className="text-center mb-6 border-b pb-4">
                        <h1 className="text-3xl font-extrabold text-blue-600">{storeSettings.storeName}</h1>
                        <p className="text-sm text-slate-500">{storeSettings.address}</p>
                        <p className="text-sm text-slate-500">تلفن: {storeSettings.phone}</p>
                        <p className="text-lg text-slate-800 mt-2 font-bold bg-slate-100 inline-block px-4 py-1 rounded-full border">فاکتور فروش</p>
                    </div>
                    
                    <div className="flex justify-between text-sm mb-4 bg-slate-50 p-3 rounded-lg border">
                        <div className="space-y-1 w-1/2">
                            <div className="text-md border-b border-slate-300 pb-1 mb-1 flex items-center flex-wrap gap-2 min-h-[30px]">
                                <strong>نام مشتری:</strong> 
                                {isEditingName ? (
                                    <div className="flex items-center gap-1 no-print">
                                        <input 
                                            ref={inputRef}
                                            value={customCustomerName}
                                            onChange={(e) => setCustomCustomerName(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                                            placeholder="نام مشتری را بنویسید..."
                                            className="border border-blue-400 rounded px-2 py-0.5 text-sm w-40 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                        <button onClick={() => setIsEditingName(false)} className="text-green-600 hover:bg-green-100 p-1 rounded">
                                            <CheckIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 group">
                                        <span className="font-bold text-lg text-blue-800">
                                            {customCustomerName || 'مشتری گذری'}
                                        </span>
                                        <button 
                                            onClick={() => setIsEditingName(true)} 
                                            className="text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity no-print"
                                            title="ویرایش نام برای چاپ"
                                        >
                                            <EditIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <p><strong>شماره فاکتور:</strong> <span className="font-mono font-bold">{invoice.id}</span></p>
                            <p><strong>فروشنده:</strong> {invoice.cashier}</p>
                        </div>
                        <div className="text-left space-y-1">
                            <p><strong>تاریخ:</strong> {new Date(invoice.timestamp).toLocaleDateString('fa-IR')}</p>
                            <p><strong>ساعت:</strong> {new Date(invoice.timestamp).toLocaleTimeString('fa-IR')}</p>
                        </div>
                    </div>

                    <div className="flex-grow overflow-y-auto border-t border-b min-h-0">
                        <table className="min-w-full text-sm">
                            <thead className="bg-slate-100 sticky top-0">
                                <tr>
                                    <th className="p-2 text-center font-bold border-l w-10">#</th>
                                    <th className="p-2 text-right font-bold border-l">کالا / خدمت</th>
                                    <th className="p-2 text-center font-bold border-l w-16 bg-blue-50 text-blue-800">بسته</th>
                                    <th className="p-2 text-center font-bold border-l w-16 bg-blue-50 text-blue-800">عدد</th>
                                    <th className="p-2 text-center font-bold border-l">فی نهایی</th>
                                    <th className="p-2 text-left font-bold">قیمت کل</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoice.items.map((item, index) => {
                                    const prices = getPrice(item);
                                    const { packages, units } = getPackageInfo(item);
                                    
                                    return (
                                     <tr key={`${item.id}-${item.type}`} className="border-b hover:bg-slate-50">
                                        <td className="p-2 text-center border-l font-mono text-slate-500">{index + 1}</td>
                                        <td className="p-2 text-right border-l">
                                            <p className="font-semibold text-slate-800">{item.name}</p>
                                            {prices.discount > 0 && (
                                                <div className="text-[10px] text-green-600">
                                                    (تخفیف: {Math.round(prices.discount).toLocaleString('fa-IR')})
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-2 text-center border-l font-bold bg-blue-50/30">
                                            {packages > 0 ? packages.toLocaleString('fa-IR') : '-'}
                                        </td>
                                        <td className="p-2 text-center border-l font-bold bg-blue-50/30">
                                            {units > 0 ? units.toLocaleString('fa-IR') : (packages > 0 ? '0' : '-')}
                                        </td>
                                        <td className="p-2 text-center border-l">
                                            {Math.round(prices.final).toLocaleString('fa-IR')}
                                        </td>
                                        <td className="p-2 text-left font-bold text-slate-800">
                                            {Math.round(item.quantity * prices.final).toLocaleString('fa-IR')}
                                        </td>
                                    </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-4 pt-2 text-left space-y-1 text-sm">
                        <div className="flex justify-between px-2">
                            <span className="font-semibold text-slate-600">جمع کل:</span>
                            <span>{formatCurrency(invoice.subtotal, storeSettings)}</span>
                        </div>
                         <div className="flex justify-between px-2 text-green-600">
                            <span className="font-semibold">مجموع تخفیف:</span>
                            <span>{formatCurrency(invoice.totalDiscount, storeSettings)}</span>
                        </div>
                        <div className="flex justify-between text-xl font-bold border-t border-black pt-2 mt-2 px-2 bg-slate-100 rounded">
                            <span>مبلغ نهایی:</span>
                            <span className="text-blue-700">{formatCurrency(invoice.totalAmount, storeSettings)}</span>
                        </div>
                    </div>
                </div>
                <div className="flex justify-between items-center mt-6 pt-4 border-t no-print">
                    <button 
                        onClick={() => setIsEditingName(true)} 
                        className="flex items-center gap-2 px-4 py-3 rounded-lg bg-yellow-100 text-yellow-800 hover:bg-yellow-200 transition-colors font-semibold"
                        title="افزودن نام مشتری به صورت دستی برای چاپ"
                    >
                        <EditIcon className="w-5 h-5" />
                        <span className="hidden md:inline">نام مشتری</span>
                    </button>

                    <div className="flex space-x-3 space-x-reverse">
                        <button onClick={onClose} className="px-6 py-3 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors font-semibold">بستن</button>
                        <button onClick={handlePrint} className="px-6 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-lg btn-primary font-semibold">چاپ نهایی</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrintPreviewModal;
