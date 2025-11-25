
import React, { useState, useEffect, useRef } from 'react';
import type { SaleInvoice, StoreSettings, CartItem, InvoiceItem } from '../types';
import { XIcon, EditIcon, CheckIcon } from './icons';
import { useAppContext } from '../AppContext';
import { formatCurrency } from '../utils/formatters';

interface PrintPreviewModalProps {
    invoice: SaleInvoice;
    onClose: () => void;
}

// Custom Logo Icon for the Header
const BookLogoIcon = ({ className = "w-6 h-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
);

const PenIcon = ({ className = "w-6 h-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
);

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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-0 md:p-4 overflow-y-auto">
            {/* Print Specific Styles */}
            <style>{`
                @media print {
                    @page { margin: 0; size: auto; }
                    body { background: white; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    .no-print { display: none !important; }
                    /* Ensure background graphics print */
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                }
            `}</style>

            <div className="bg-white w-full md:max-w-3xl min-h-screen md:min-h-0 md:h-auto md:max-h-[95vh] shadow-2xl md:rounded-xl flex flex-col overflow-hidden relative">
                
                {/* --- PRINT CONTENT START --- */}
                <div id="print-modal-content" className="relative flex flex-col flex-grow bg-white text-slate-900">
                    
                    {/* Watermark Background */}
                    <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none opacity-[0.03] overflow-hidden">
                        <BookLogoIcon className="w-[500px] h-[500px] text-slate-900 transform -rotate-12" />
                    </div>

                    {/* 1. Header Section */}
                    <div className="relative bg-gradient-to-br from-blue-800 via-blue-700 to-blue-600 text-white pt-8 pb-12 px-8 z-10 overflow-hidden">
                        {/* Decorative Circles */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
                        
                        <div className="flex justify-between items-center relative z-10">
                            {/* Left: Logo Graphic */}
                            <div className="flex flex-col items-center justify-center w-24 h-24 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/20 shadow-inner">
                                <BookLogoIcon className="w-12 h-12 text-white mb-1" />
                                <div className="w-8 h-1 bg-white/50 rounded-full"></div>
                            </div>

                            {/* Right: Store Info */}
                            <div className="text-right">
                                <h1 className="text-4xl font-extrabold tracking-tight mb-1 text-white drop-shadow-sm">{storeSettings.storeName}</h1>
                                <p className="text-blue-100 text-sm font-medium opacity-90 mb-1">عرضه کننده انواع کتاب و لوازم تحریر</p>
                                <div className="flex items-center justify-end gap-2 text-xs text-blue-200 mt-2">
                                    <span>{storeSettings.phone}</span>
                                    <span className="w-1 h-1 bg-blue-300 rounded-full"></span>
                                    <span>{storeSettings.address}</span>
                                </div>
                            </div>
                        </div>

                        {/* Bottom Curve (SVG) */}
                        <div className="absolute bottom-0 left-0 w-full leading-[0]">
                            <svg className="block w-full h-8 md:h-12 text-white" viewBox="0 0 1440 320" preserveAspectRatio="none">
                                <path fill="currentColor" fillOpacity="1" d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,224C672,245,768,267,864,261.3C960,256,1056,224,1152,197.3C1248,171,1344,149,1392,138.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
                            </svg>
                        </div>
                    </div>

                    {/* 2. Invoice Meta Info */}
                    <div className="px-8 py-4 relative z-10">
                        <div className="flex justify-between items-start bg-white rounded-xl border-2 border-blue-100 shadow-sm p-4">
                            <div className="space-y-2 w-2/3">
                                <div className="flex items-center gap-2 border-b border-dashed border-slate-200 pb-2">
                                    <span className="text-slate-500 text-sm font-bold">خریدار محترم:</span>
                                    {isEditingName ? (
                                        <div className="flex items-center gap-1 no-print">
                                            <input 
                                                ref={inputRef}
                                                value={customCustomerName}
                                                onChange={(e) => setCustomCustomerName(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                                                placeholder="نام مشتری..."
                                                className="border border-blue-400 rounded px-2 py-1 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            <button onClick={() => setIsEditingName(false)} className="text-white bg-green-500 hover:bg-green-600 p-1 rounded shadow">
                                                <CheckIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditingName(true)}>
                                            <span className="font-extrabold text-lg text-slate-800 border-b border-transparent hover:border-blue-300 transition-colors">
                                                {customCustomerName || 'مشتری گذری'}
                                            </span>
                                            <EditIcon className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity no-print" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-6 text-sm text-slate-700">
                                    <p><strong>شماره فاکتور:</strong> <span className="font-mono font-bold text-blue-700 text-base">{invoice.id}</span></p>
                                    <p><strong>فروشنده:</strong> {invoice.cashier}</p>
                                </div>
                            </div>
                            <div className="text-left space-y-1 border-l-2 border-blue-100 pl-4">
                                <div className="bg-blue-50 text-blue-800 px-3 py-1 rounded-lg text-xs font-bold inline-block mb-1">فاکتور فروش</div>
                                <p className="text-sm text-slate-600"><strong>تاریخ:</strong> <span className="font-mono">{new Date(invoice.timestamp).toLocaleDateString('fa-IR')}</span></p>
                                <p className="text-sm text-slate-600"><strong>ساعت:</strong> <span className="font-mono">{new Date(invoice.timestamp).toLocaleTimeString('fa-IR')}</span></p>
                            </div>
                        </div>
                    </div>

                    {/* 3. Table */}
                    <div className="px-8 flex-grow z-10 min-h-[300px]">
                        <table className="w-full border-collapse border-spacing-0">
                            <thead>
                                <tr className="bg-slate-800 text-white text-sm overflow-hidden rounded-t-lg">
                                    <th rowSpan={2} className="py-3 px-2 border-r border-slate-600 first:rounded-tr-lg w-12">ردیف</th>
                                    <th rowSpan={2} className="py-3 px-2 border-r border-slate-600 text-right">شرح کالا</th>
                                    <th colSpan={2} className="py-2 px-2 border-r border-b border-slate-600 text-center bg-slate-700">تعداد (مقدار)</th>
                                    <th colSpan={2} className="py-2 px-2 border-r border-b border-slate-600 text-center bg-slate-700">قیمت (فی)</th>
                                    <th rowSpan={2} className="py-3 px-2 last:rounded-tl-lg w-28">قیمت کل</th>
                                </tr>
                                <tr className="bg-slate-800 text-white text-xs">
                                    <th className="py-1 px-1 border-r border-slate-600 w-16">بسته</th>
                                    <th className="py-1 px-1 border-r border-slate-600 w-16">عدد</th>
                                    <th className="py-1 px-1 border-r border-slate-600 w-20">فی بسته</th>
                                    <th className="py-1 px-1 border-r border-slate-600 w-20">فی عدد</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm text-slate-800">
                                {invoice.items.map((item, index) => {
                                    const details = getItemDetails(item);
                                    const isEven = index % 2 === 0;
                                    
                                    return (
                                        <tr key={`${item.id}-${item.type}`} className={`${isEven ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50 transition-colors`}>
                                            <td className="py-3 px-2 text-center border-r border-b border-slate-200 font-mono text-slate-500">{index + 1}</td>
                                            <td className="py-3 px-2 text-right border-r border-b border-slate-200">
                                                <div className="font-bold text-slate-800">{item.name}</div>
                                                {details.itemsPerPack > 1 && (
                                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                                        (بسته {details.itemsPerPack} تایی)
                                                    </div>
                                                )}
                                            </td>
                                            
                                            {/* Packages Count */}
                                            <td className="py-3 px-2 text-center border-r border-b border-slate-200 font-bold font-mono text-blue-700 bg-blue-50/30">
                                                {details.pkgCount > 0 ? details.pkgCount.toLocaleString('fa-IR') : '-'}
                                            </td>
                                            
                                            {/* Units Count */}
                                            <td className="py-3 px-2 text-center border-r border-b border-slate-200 font-bold font-mono text-blue-700 bg-blue-50/30">
                                                {details.unitCount > 0 ? details.unitCount.toLocaleString('fa-IR') : '-'}
                                            </td>

                                            {/* Package Price */}
                                            <td className="py-3 px-2 text-center border-r border-b border-slate-200 font-mono text-slate-600 text-xs">
                                                {details.pkgCount > 0 ? Math.round(details.pkgPrice).toLocaleString('fa-IR') : '-'}
                                            </td>

                                            {/* Unit Price */}
                                            <td className="py-3 px-2 text-center border-r border-b border-slate-200 font-mono text-slate-600 text-xs">
                                                {details.unitCount > 0 ? Math.round(details.unitPrice).toLocaleString('fa-IR') : '-'}
                                            </td>

                                            {/* Total Price */}
                                            <td className="py-3 px-2 text-center border-l border-b border-slate-200 font-bold font-mono text-slate-900">
                                                {Math.round(details.totalPrice).toLocaleString('fa-IR')}
                                            </td>
                                        </tr>
                                    )
                                })}
                                {/* Empty rows filler if needed, or just border bottom */}
                                <tr className="border-t-2 border-slate-800"></tr>
                            </tbody>
                        </table>
                    </div>

                    {/* 4. Totals Section */}
                    <div className="px-8 py-2 z-10">
                        <div className="flex justify-end">
                            <div className="w-64 bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                                <div className="flex justify-between text-sm text-slate-600">
                                    <span>جمع کل:</span>
                                    <span className="font-mono">{formatCurrency(invoice.subtotal, storeSettings)}</span>
                                </div>
                                <div className="flex justify-between text-sm text-green-600 font-medium">
                                    <span>تخفیف:</span>
                                    <span className="font-mono">{formatCurrency(invoice.totalDiscount, storeSettings)}</span>
                                </div>
                                <div className="border-t border-slate-300 my-2"></div>
                                <div className="flex justify-between text-lg font-extrabold text-blue-800">
                                    <span>مبلغ نهایی:</span>
                                    <span className="font-mono">{formatCurrency(invoice.totalAmount, storeSettings)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 5. Footer Signatures */}
                    <div className="px-8 pb-12 pt-8 z-10 mt-auto">
                        <div className="flex justify-between items-end">
                            <div className="text-center space-y-8">
                                <p className="text-sm font-bold text-slate-500">مهر و امضای فروشگاه</p>
                                <div className="w-40 h-24 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center bg-slate-50/50">
                                    <span className="text-xs text-slate-400 opacity-50">محل مهر</span>
                                </div>
                            </div>
                            
                            <div className="text-center">
                                <p className="text-xs text-slate-400 mb-1">با تشکر از خرید شما</p>
                                <p className="text-[10px] text-slate-300 font-mono">نرم‌افزار مدیریت کتابستان</p>
                            </div>

                            <div className="text-center space-y-8">
                                <p className="text-sm font-bold text-slate-500">امضای خریدار</p>
                                <div className="w-40 h-24 border-b-2 border-slate-300"></div>
                            </div>
                        </div>
                    </div>
                </div>
                {/* --- PRINT CONTENT END --- */}

                {/* Action Bar (No Print) */}
                <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center no-print z-50">
                    <div className="flex items-center text-sm text-slate-500">
                        <div className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></div>
                        آماده چاپ
                    </div>
                    <div className="flex space-x-3 space-x-reverse">
                        <button 
                            onClick={handleClose} 
                            className="px-5 py-2 rounded-lg text-slate-600 hover:bg-slate-200 font-semibold transition-colors"
                        >
                            بستن
                        </button>
                        <button 
                            onClick={handlePrint} 
                            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all hover:-translate-y-0.5 font-bold"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            چاپ نهایی
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default PrintPreviewModal;
