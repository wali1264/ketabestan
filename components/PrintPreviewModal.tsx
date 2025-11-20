import React from 'react';
import type { SaleInvoice, StoreSettings, CartItem } from '../types';
import { XIcon } from './icons';
import { useAppContext } from '../AppContext';
import { formatCurrency } from '../utils/formatters';


interface PrintPreviewModalProps {
    invoice: SaleInvoice;
    onClose: () => void;
}

const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({ invoice, onClose }) => {
    const { storeSettings } = useAppContext();

    const handlePrint = () => {
        window.print();
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

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
                <div id="print-modal-content" className="text-gray-900 flex-grow flex flex-col min-h-0">
                    <div className="text-center mb-8 border-b pb-6">
                        <h1 className="text-3xl font-extrabold text-blue-600">{storeSettings.storeName}</h1>
                        <p className="text-sm text-slate-500">{storeSettings.address}</p>
                        <p className="text-sm text-slate-500">تلفن: {storeSettings.phone}</p>
                        <p className="text-md text-slate-600 mt-2 font-bold">فاکتور فروش</p>
                    </div>
                    <div className="flex justify-between text-md mb-6">
                        <div>
                            <p><strong>شماره فاکتور:</strong> <span className="font-mono">{invoice.id}</span></p>
                            <p><strong>فروشنده:</strong> {invoice.cashier}</p>
                        </div>
                        <div className="text-left">
                            <p><strong>تاریخ:</strong> {new Date(invoice.timestamp).toLocaleDateString('fa-IR')}</p>
                            <p><strong>ساعت:</strong> {new Date(invoice.timestamp).toLocaleTimeString('fa-IR')}</p>
                        </div>
                    </div>
                    <div className="flex-grow overflow-y-auto border-t border-b min-h-0">
                        <table className="min-w-full text-md">
                            <thead className="bg-slate-50 sticky top-0">
                                <tr>
                                    <th className="p-3 text-right font-bold">کالا / خدمت</th>
                                    <th className="p-3 font-bold">تعداد</th>
                                    <th className="p-3 font-bold">قیمت نهایی</th>
                                    <th className="p-3 text-left font-bold">قیمت کل</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoice.items.map(item => {
                                    const prices = getPrice(item);
                                    return (
                                     <tr key={`${item.id}-${item.type}`} className="border-b">
                                        <td className="p-3 text-right">
                                            <p className="font-semibold">{item.name}</p>
                                            {prices.discount > 0 && (
                                                <div className="text-xs text-green-600">
                                                    (تخفیف: {Math.round(prices.discount).toLocaleString('fa-IR')} از <s>{Math.round(prices.original * item.quantity).toLocaleString('fa-IR')}</s>)
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-3 text-center">{item.quantity}</td>
                                        <td className="p-3 text-center">{Math.round(prices.final).toLocaleString('fa-IR')}</td>
                                        <td className="p-3 text-left font-semibold">{Math.round(item.quantity * prices.final).toLocaleString('fa-IR')}</td>
                                    </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-6 pt-4 border-t text-left space-y-2 text-md">
                        <div className="flex justify-between">
                            <span className="font-semibold text-slate-600">جمع کل:</span>
                            <span>{formatCurrency(invoice.subtotal, storeSettings)}</span>
                        </div>
                         <div className="flex justify-between text-green-600">
                            <span className="font-semibold">مجموع تخفیف:</span>
                            <span>{formatCurrency(invoice.totalDiscount, storeSettings)}</span>
                        </div>
                        <div className="flex justify-between text-xl font-bold border-t pt-2 mt-2">
                            <span>مبلغ نهایی قابل پرداخت:</span>
                            <span className="text-blue-600">{formatCurrency(invoice.totalAmount, storeSettings)}</span>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end space-x-3 space-x-reverse mt-8 pt-6 border-t no-print">
                    <button onClick={onClose} className="px-6 py-3 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors font-semibold">بستن</button>
                    <button onClick={handlePrint} className="px-6 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-lg btn-primary font-semibold">چاپ نهایی</button>
                </div>
            </div>
        </div>
    );
};

export default PrintPreviewModal;