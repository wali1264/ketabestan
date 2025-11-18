import React from 'react';
import { XIcon, PrintIcon } from './icons';

interface ReportPrintPreviewModalProps {
    title: string;
    dateRange: { start: Date, end: Date };
    onClose: () => void;
    children: React.ReactNode;
}

const ReportPrintPreviewModal: React.FC<ReportPrintPreviewModalProps> = ({ title, dateRange, onClose, children }) => {

    const handlePrint = () => {
        window.print();
    };
    
    const formattedDateRange = `${new Date(dateRange.start).toLocaleDateString('fa-IR')} - ${new Date(dateRange.end).toLocaleDateString('fa-IR')}`;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div id="print-modal-content" className="flex-grow flex flex-col min-h-0">
                    <div className="text-center mb-6 border-b pb-4">
                        <h1 className="text-2xl font-extrabold text-blue-700">{title}</h1>
                        <p className="text-md text-slate-600">بازه زمانی: {formattedDateRange}</p>
                    </div>
                    <div className="flex-grow overflow-y-auto -mx-6 px-6">
                        {children}
                    </div>
                </div>
                <div className="flex justify-end space-x-3 space-x-reverse mt-6 pt-4 border-t no-print">
                    <button onClick={onClose} className="px-6 py-3 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors font-semibold">بستن</button>
                    <button onClick={handlePrint} className="flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-lg btn-primary font-semibold">
                        <PrintIcon />
                        چاپ نهایی
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReportPrintPreviewModal;
