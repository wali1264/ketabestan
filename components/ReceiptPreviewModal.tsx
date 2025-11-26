
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
    
    // Safe access for deleted persons
    const personName = person ? person.name : 'حساب حذف شده';

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden">
                <div id="print-modal-content" className="text-gray-900 font-sans flex-grow overflow-y-auto">
                    <div className="text-center mb-6 border-b pb-4">
                        <h1 className="text-2xl font-extrabold">{storeSettings.storeName}</h1>
                        <p className="text-xs text-slate-500">{storeSettings.address}</p>
                        <p className="text-xs text-slate-500">تلفن: {storeSettings.phone}</p>
                    </div>
                     <h2 className="text-xl text-center font-bold mb-6 bg-slate-100 p-2 rounded-lg border">{title}</h2>
                    <div className="flex justify-between text-sm mb-6 px-2">
                        <p><strong>شماره رسید:</strong> <span className="font-mono text-lg">{transaction.id.slice(0, 8)}</span></p>
                        <p><strong>تاریخ:</strong> {new Date(transaction.date).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                    <div className="space-y-4 text-md border-y border-slate-200 py-6 px-4 bg-slate-50 rounded-lg">
                        <p><strong>{partyLabel}:</strong> محترم <span className="font-bold text-lg">{personName}</span></p>
                        <p><strong>مبلغ به عدد:</strong> <span className="font-bold font-mono text-xl mx-2">{formatCurrency(transaction.amount, storeSettings)}</span></p>
                        <p><strong>مبلغ به حروف:</strong> <span className="font-bold text-lg text-blue-800">{numberToPersianWords(transaction.amount)} {storeSettings.currencyName}</span></p>
                         <p><strong>بابت:</strong> {transaction.description}</p>
                    </div>

                    <div className="mt-16 flex justify-around text-center text-sm">
                        <div className="w-48">
                            <p className="font-bold mb-12">تحویل دهنده وجه</p>
                            <div className="border-t border-dashed border-gray-400 pt-2">امضا</div>
                        </div>
                        <div className="w-48">
                            <p className="font-bold mb-12">دریافت کننده وجه</p>
                             <div className="flex items-end justify-between">
                                <span className="border-t border-dashed border-gray-400 pt-2 flex-grow mr-4">امضا</span>
                                <span className="border border-dashed border-gray-400 text-gray-400 w-12 h-14 flex items-center justify-center text-xs rounded">اثر انگشت</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end space-x-3 space-x-reverse mt-6 pt-4 border-t no-print bg-white">
                    <button onClick={onClose} className="px-6 py-3 rounded-lg bg-gray-100 text-slate-700 hover:bg-gray-200 transition-colors font-semibold">بستن</button>
                    <button onClick={handlePrint} className="px-6 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-lg btn-primary font-semibold">چاپ رسید</button>
                </div>
            </div>
        </div>
    );
};

export default ReceiptPreviewModal;
