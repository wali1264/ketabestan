
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
    const { storeSettings, customers, setInvoiceTransientCustomer } = useAppContext();
    const [customCustomerName, setCustomCustomerName] = useState('');
    const [isEditingName, setIsEditingName] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Initialize name from registered customer if exists, OR from stored originalInvoiceId if type is 'sale'
    useEffect(() => {
        if (invoice.customerId) {
            const customer = customers.find(c => c.id === invoice.customerId);
            if (customer) {
                setCustomCustomerName(customer.name);
            } else {
                // Fallback if customer was deleted but ID remains on invoice
                setCustomCustomerName('مشتری حذف شده');
            }
        } else if (invoice.type === 'sale') {
            setCustomCustomerName(invoice.originalInvoiceId || '');
        }
    }, [invoice, customers]);

    // Focus input when editing starts
    useEffect(() => {
        if (isEditingName && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditingName]);

    const saveCustomerName = async () => {
        // Only save for transient customers (no customerId) on sale invoices
        if (!invoice.customerId && invoice.type === 'sale') {
            const nameToSave = customCustomerName.trim();
            const currentSavedName = invoice.originalInvoiceId || '';
            
            // Save only if the name has changed
            if (nameToSave !== currentSavedName) {
                await setInvoiceTransientCustomer(invoice.id, nameToSave);
            }
        }
    };

    const handlePrint = async () => {
        // Ensure we exit edit mode
        setIsEditingName(false);
        
        // Save name before printing
        await saveCustomerName();

        // Small timeout to allow React to re-render the text view before browser print dialog opens
        setTimeout(() => {
            window.print();
        }, 100);
    };

    const handleClose = async () => {
        setIsEditingName(false);
        // Save name before closing
        await saveCustomerName();
        onClose();
    };
    
    const getItemDetails = (item: CartItem) => {
        const isService = item.type === 'service';
        // Ensure itemsPerPack is at least 1
        let itemsPerPack = !isService && (item as InvoiceItem).itemsPerPackage ? (item as InvoiceItem).itemsPerPackage! : 1;
        if (itemsPerPack < 1) itemsPerPack = 1;
        
        const totalQty = item.quantity;
        let pkgCount = 0;
        let unitCount = 0;

        // Logic Fix: If itemsPerPack is 1, strictly treat it as Units, not Packages.
        // This ensures standard items don't show up in the Package column.
        if (itemsPerPack === 1 || isService) {
            pkgCount = 0;
            unitCount = totalQty;
        } else {
            pkgCount = Math.floor(totalQty / itemsPerPack);
            unitCount = totalQty % itemsPerPack;
        }
        
        // Price calculation
        let unitPrice = 0;
        if (item.type === 'product') {
            unitPrice = item.finalPrice !== undefined ? item.finalPrice : item.salePrice;
        } else {
            unitPrice = item.price;
        }
        
        const pkgPrice = unitPrice * itemsPerPack;
        const totalPrice = unitPrice * totalQty;
        
        return {
            isService,
            itemsPerPack,
            pkgCount,
            unitCount,
            unitPrice,
            pkgPrice,
            totalPrice
        };
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
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
                        <table className="min-w-full text-sm border-collapse">
                            <thead className="bg-slate-100 sticky top-0">
                                <tr>
                                    <th rowSpan={2} className="p-2 text-center font-bold border border-slate-400 w-10">#</th>
                                    <th rowSpan={2} className="p-2 text-right font-bold border border-slate-400">شرح کالا</th>
                                    <th colSpan={2} className="p-2 text-center font-bold border border-slate-400 bg-blue-50 text-blue-900">تعداد (مقدار)</th>
                                    <th colSpan={2} className="p-2 text-center font-bold border border-slate-400">قیمت (فی)</th>
                                    <th rowSpan={2} className="p-2 text-center font-bold border border-slate-400 w-24">قیمت کل</th>
                                </tr>
                                <tr>
                                    <th className="p-1 text-center font-bold border border-slate-400 bg-blue-50 text-xs w-16">بسته</th>
                                    <th className="p-1 text-center font-bold border border-slate-400 bg-blue-50 text-xs w-16">عدد</th>
                                    <th className="p-1 text-center font-bold border border-slate-400 text-xs w-20">فی بسته</th>
                                    <th className="p-1 text-center font-bold border border-slate-400 text-xs w-20">فی عدد</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoice.items.map((item, index) => {
                                    const details = getItemDetails(item);
                                    
                                    return (
                                        <tr key={`${item.id}-${item.type}`} className="border-b border-slate-300 hover:bg-slate-50">
                                            <td className="p-2 text-center border border-slate-300 font-mono text-slate-500">{index + 1}</td>
                                            <td className="p-2 text-right border border-slate-300">
                                                <p className="font-semibold text-slate-800">{item.name}</p>
                                                {item.type === 'product' && (item as any).finalPrice !== undefined && (item as any).finalPrice !== (item as any).salePrice && (
                                                    <span className="text-[10px] text-green-600 block">
                                                        (با تخفیف)
                                                    </span>
                                                )}
                                                {/* Optional: Show items per pack hint if it's a package item */}
                                                {details.itemsPerPack > 1 && (
                                                    <span className="text-[9px] text-slate-400 block">
                                                        (تعداد در بسته: {details.itemsPerPack})
                                                    </span>
                                                )}
                                            </td>
                                            
                                            {/* Packages Count */}
                                            <td className="p-2 text-center border border-slate-300 font-bold bg-blue-50/30">
                                                {details.pkgCount > 0 ? details.pkgCount.toLocaleString('fa-IR') : '-'}
                                            </td>
                                            
                                            {/* Units Count */}
                                            <td className="p-2 text-center border border-slate-300 font-bold bg-blue-50/30">
                                                {details.unitCount > 0 ? details.unitCount.toLocaleString('fa-IR') : '-'}
                                            </td>

                                            {/* Package Price (Fee Baste) */}
                                            <td className="p-2 text-center border border-slate-300 text-xs md:text-sm">
                                                {/* Show Package Price only if we actually sold packages */}
                                                {details.pkgCount > 0 ? details.pkgPrice.toLocaleString('fa-IR', { maximumFractionDigits: 3 }) : '-'}
                                            </td>

                                            {/* Unit Price (Fee Adad) */}
                                            <td className="p-2 text-center border border-slate-300 text-xs md:text-sm">
                                                {/* Show Unit Price only if we actually sold separate units */}
                                                {details.unitCount > 0 ? details.unitPrice.toLocaleString('fa-IR', { maximumFractionDigits: 3 }) : '-'}
                                            </td>

                                            {/* Total Price */}
                                            <td className="p-2 text-center border border-slate-300 font-bold text-slate-800">
                                                {details.totalPrice.toLocaleString('fa-IR', { maximumFractionDigits: 3 })}
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
                        <button onClick={handleClose} className="px-6 py-3 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors font-semibold">بستن</button>
                        <button onClick={handlePrint} className="px-6 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-lg btn-primary font-semibold">چاپ نهایی</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrintPreviewModal;
