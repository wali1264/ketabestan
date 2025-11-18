import React from 'react';
import type { StoreSettings, Supplier, Customer, AnyTransaction } from '../types';
import { XIcon } from './icons';
import { useAppContext } from '../AppContext';
import { formatCurrency, numberToPersianWords } from '../utils/formatters';


interface ReceiptPreviewModalProps {
    person: Supplier | Customer;
    transaction: AnyTransaction;
    type: 'supplier' | 'customer';
    onClose: () => void;
}

const ReceiptPreviewModal: React.FC<ReceiptPreviewModalProps> = ({ person, transaction, type, onClose }) => {
    const { storeSettings } = useAppContext();

    const handlePrint = () => {
        window.print();
    };
    
    const title = type === 'supplier' ? 'رسید پرداخت وجه' : 'رسید دریافت وجه';
    const partyLabel = type === 'supplier' ? 'پرداخت شده به' : 'دریافت شده از';

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col">
                <div id="print-modal-content" className="text-gray-900 font-sans">
                    <div className="text-center mb-6 border-b pb-4">
                        <h1 className="text-2xl font-extrabold">{storeSettings.storeName}</h1>
                        <p className="text-xs text-slate-500">{storeSettings.address}</p>
                        <p className="text-xs text-slate-500">تلفن: {storeSettings.phone}</p>
                    </div>
                     <h2 className="text-xl text-center font-bold mb-6">{title}</h2>
                    <div className="flex justify-between text-sm mb-6">
                        <p><strong>شماره رسید:</strong> <span className="font-mono">{transaction.id.slice(0, 8)}</span></p>
                        <p><strong>تاریخ:</strong> {new Date(transaction.date).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                    <div className="space-y-4 text-md border-y py-6">
                        <p><strong>{partyLabel}:</strong> محترم <span className="font-bold">{person.name}</span></p>
                        <p><strong>مبلغ به عدد:</strong> <span className="font-bold font-mono text-lg">{formatCurrency(transaction.amount, storeSettings)}</span></p>
                        <p><strong>مبلغ به حروف:</strong> <span className="font-bold">{numberToPersianWords(transaction.amount)} {storeSettings.currencyName}</span></p>
                         <p><strong>بابت:</strong> {transaction.description}</p>
                    </div>

                    <div className="mt-20 flex justify-around text-center text-sm">
                        <div className="w-48">
                            <p className="font-bold">تحویل دهنده وجه</p>
                            <p className="border-t border-dashed border-gray-400 mt-12 pt-2">امضا</p>
                        </div>
                        <div className="w-48">
                            <p className="font-bold">دریافت کننده وجه</p>
                             <div className="flex items-end justify-between mt-12">
                                <span className="border-t border-dashed border-gray-400 pt-2 flex-grow mr-4">امضا</span>
                                <span className="border border-dashed border-gray-400 text-gray-500 w-12 h-14 flex items-center justify-center text-xs">اثر انگشت</span>
                            </div>
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

export default ReceiptPreviewModal;
