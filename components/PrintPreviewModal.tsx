
import React, { useState, useEffect, useRef, useMemo } from 'react';
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
    
    // --- Psychological Pricing Logic ---
    // Instead of using invoice.subtotal directly (which is mathematically pure),
    // we calculate a "Perceived Subtotal" and "Perceived Discount".
    // Rule 1: If Item Price Increased (Surcharge), the "Unit Price" shown is the Higher Price. No Discount shown.
    // Rule 2: If Item Price Decreased (Discount), the "Unit Price" shown is the Original Price. Discount is calculated.
    const { perceivedSubtotal, perceivedTotalDiscount } = useMemo(() => {
        let sub = 0;
        let disc = 0;

        invoice.items.forEach(item => {
            const quantity = item.quantity;
            
            if (item.type === 'product') {
                const originalPrice = (item as any).salePrice;
                const finalPrice = (item as any).finalPrice !== undefined ? (item as any).finalPrice : originalPrice;

                if (finalPrice > originalPrice) {
                    // Surcharge Case: Hide the original price. Pretend the higher price is the standard.
                    // Contribution to Subtotal: Higher Price * Qty
                    // Contribution to Discount: 0
                    sub += finalPrice * quantity;
                } else {
                    // Discount Case (or Equal): Show original price.
                    // Contribution to Subtotal: Original Price * Qty
                    // Contribution to Discount: (Original - Final) * Qty
                    sub += originalPrice * quantity;
                    disc += (originalPrice - finalPrice) * quantity;
                }
            } else {
                // Services always added as is
                sub += item.price * quantity;
            }
        });

        return { perceivedSubtotal: sub, perceivedTotalDiscount: disc };
    }, [invoice.items]);


    const getItemDetails = (item: CartItem) => {
        const isService = item.type === 'service';
        // Ensure itemsPerPack is at least 1
        let itemsPerPack = !isService && (item as InvoiceItem).itemsPerPackage ? (item as InvoiceItem).itemsPerPackage! : 1;
        if (itemsPerPack < 1) itemsPerPack = 1;
        
        const totalQty = item.quantity;
        let pkgCount = 0;
        let unitCount = 0;

        if (itemsPerPack === 1 || isService) {
            pkgCount = 0;
            unitCount = totalQty;
        } else {
            pkgCount = Math.floor(totalQty / itemsPerPack);
            unitCount = totalQty % itemsPerPack;
        }
        
        // Price display logic must match the "Perceived" logic above
        let unitPrice = 0;
        
        if (item.type === 'product') {
            const originalPrice = item.salePrice;
            const final = item.finalPrice !== undefined ? item.finalPrice : originalPrice;
            
            if (final > originalPrice) {
                unitPrice = final; // Show higher price as standard
            } else {
                unitPrice = originalPrice; // Show standard price
            }
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
            <div className="bg-white p-4 md:p-6 print:p-8 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                <div id="print-modal-content" className="text-gray-900 flex-grow flex flex-col min-h-0">
                    <div className="text-center mb-2 pb-2 print:mb-6 print:pb-4 border-b">
                        <h1 className="text-xl print:text-3xl font-extrabold text-blue-600">{storeSettings.storeName}</h1>
                        <p className="text-xs print:text-sm text-slate-500">{storeSettings.address}</p>
                        <p className="text-xs print:text-sm text-slate-500">تلفن: {storeSettings.phone}</p>
                        <p className="text-sm print:text-lg text-slate-800 mt-1 print:mt-2 font-bold bg-slate-100 inline-block px-4 py-1 rounded-full border">فاکتور فروش</p>
                    </div>
                    
                    <div className="flex justify-between text-xs print:text-sm mb-2 print:mb-4 bg-slate-50 p-2 print:p-3 rounded-lg border">
                        <div className="space-y-0.5 print:space-y-1 w-1/2">
                            <div className="text-sm print:text-md border-b border-slate-300 pb-1 mb-1 flex items-center flex-wrap gap-2 min-h-[24px] print:min-h-[30px]">
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
                                        <span className="font-bold text-base print:text-lg text-blue-800">
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
                        <div className="text-left space-y-0.5 print:space-y-1">
                            <p><strong>تاریخ:</strong> {new Date(invoice.timestamp).toLocaleDateString('fa-IR')}</p>
                            <p><strong>ساعت:</strong> {new Date(invoice.timestamp).toLocaleTimeString('fa-IR')}</p>
                        </div>
                    </div>

                    <div className="flex-grow overflow-y-auto border-t border-b min-h-0">
                        <table className="min-w-full text-xs print:text-sm border-collapse">
                            <thead className="bg-slate-100 sticky top-0">
                                <tr>
                                    <th rowSpan={2} className="p-1 print:p-2 text-center font-bold border border-slate-400 w-8 print:w-10">#</th>
                                    <th rowSpan={2} className="p-1 print:p-2 text-right font-bold border border-slate-400">شرح کالا</th>
                                    <th colSpan={2} className="p-1 print:p-2 text-center font-bold border border-slate-400 bg-blue-50 text-blue-900">تعداد (مقدار)</th>
                                    <th colSpan={2} className="p-1 print:p-2 text-center font-bold border border-slate-400">قیمت (فی)</th>
                                    <th rowSpan={2} className="p-1 print:p-2 text-center font-bold border border-slate-400 w-20 print:w-24">قیمت کل</th>
                                </tr>
                                <tr>
                                    <th className="p-1 text-center font-bold border border-slate-400 bg-blue-50 w-12 print:w-16">بسته</th>
                                    <th className="p-1 text-center font-bold border border-slate-400 bg-blue-50 w-12 print:w-16">عدد</th>
                                    <th className="p-1 text-center font-bold border border-slate-400 w-16 print:w-20">فی بسته</th>
                                    <th className="p-1 text-center font-bold border border-slate-400 w-16 print:w-20">فی عدد</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoice.items.map((item, index) => {
                                    const details = getItemDetails(item);
                                    
                                    return (
                                        <tr key={`${item.id}-${item.type}`} className="border-b border-slate-300 hover:bg-slate-50">
                                            <td className="p-1 print:p-2 text-center border border-slate-300 font-mono text-slate-500">{index + 1}</td>
                                            <td className="p-1 print:p-2 text-right border border-slate-300">
                                                <p className="font-semibold text-slate-800">{item.name}</p>
                                                {/* Only show discount tag if it's a real discount, NOT surcharge */}
                                                {item.type === 'product' && (item as any).finalPrice !== undefined && (item as any).finalPrice < (item as any).salePrice && (
                                                    <span className="text-[10px] text-green-600 block">
                                                        (با تخفیف)
                                                    </span>
                                                )}
                                                {details.itemsPerPack > 1 && (
                                                    <span className="text-[9px] text-slate-400 block">
                                                        (تعداد در بسته: {details.itemsPerPack})
                                                    </span>
                                                )}
                                            </td>
                                            
                                            {/* Packages Count */}
                                            <td className="p-1 print:p-2 text-center border border-slate-300 font-bold bg-blue-50/30">
                                                {details.pkgCount > 0 ? details.pkgCount.toLocaleString('fa-IR') : '-'}
                                            </td>
                                            
                                            {/* Units Count */}
                                            <td className="p-1 print:p-2 text-center border border-slate-300 font-bold bg-blue-50/30">
                                                {details.unitCount > 0 ? details.unitCount.toLocaleString('fa-IR') : '-'}
                                            </td>

                                            {/* Package Price (Fee Baste) */}
                                            <td className="p-1 print:p-2 text-center border border-slate-300">
                                                {details.pkgCount > 0 ? details.pkgPrice.toLocaleString('fa-IR', { maximumFractionDigits: 3 }) : '-'}
                                            </td>

                                            {/* Unit Price (Fee Adad) */}
                                            <td className="p-1 print:p-2 text-center border border-slate-300">
                                                {details.unitCount > 0 ? details.unitPrice.toLocaleString('fa-IR', { maximumFractionDigits: 3 }) : '-'}
                                            </td>

                                            {/* Total Price */}
                                            <td className="p-1 print:p-2 text-center border border-slate-300 font-bold text-slate-800">
                                                {details.totalPrice.toLocaleString('fa-IR', { maximumFractionDigits: 3 })}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-2 pt-2 print:mt-4 text-left space-y-1 text-sm">
                        {/* 
                            Logic Updated:
                            Use 'perceivedTotalDiscount' instead of 'invoice.totalDiscount'.
                            This ensures that even if totalDiscount is 0 (due to surcharges cancelling out),
                            we still show the positive discounts if they exist.
                        */}
                        {perceivedTotalDiscount > 0 ? (
                            <>
                                <div className="flex justify-between px-2">
                                    <span className="font-semibold text-slate-600">جمع کل:</span>
                                    <span>{formatCurrency(perceivedSubtotal, storeSettings)}</span>
                                </div>
                                <div className="flex justify-between px-2 text-green-600">
                                    <span className="font-semibold">مجموع تخفیف:</span>
                                    <span>{formatCurrency(perceivedTotalDiscount, storeSettings)}</span>
                                </div>
                            </>
                        ) : null}
                        
                        <div className="flex justify-between text-xl font-bold border-t border-black pt-2 mt-2 px-2 bg-slate-100 rounded">
                            <span>مبلغ نهایی:</span>
                            <span className="text-blue-700">{formatCurrency(invoice.totalAmount, storeSettings)}</span>
                        </div>
                    </div>
                </div>
                <div className="flex justify-between items-center mt-4 print:mt-6 pt-2 print:pt-4 border-t no-print">
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
