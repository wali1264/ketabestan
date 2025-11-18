import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { PurchaseInvoice, PurchaseInvoiceItem, SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent, Product } from '../types';
import { useAppContext } from '../AppContext';
import { PlusIcon, SearchIcon, TrashIcon, XIcon, EditIcon, MicIcon, WarningIcon, PrintIcon } from '../components/icons';
import Toast from '../components/Toast';
import PurchasePrintPreviewModal from '../components/PurchasePrintPreviewModal';
import PackageUnitInput from '../components/PackageUnitInput';
import { formatCurrency } from '../utils/formatters';
import DateRangeFilter from '../components/DateRangeFilter';

type PurchaseItemDraft = Omit<PurchaseInvoiceItem, 'productName'> & {
    showExpiry?: boolean;
};


const persianDigitsMap: { [key: string]: string } = { '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' };
const wordToNumberMap: { [key: string]: number } = {
  'صفر': 0, 'یک': 1, 'دو': 2, 'سه': 3, 'چهار': 4, 'پنج': 5, 'شش': 6, 'هفت': 7, 'هشت': 8, 'نه': 9, 'ده': 10
};

const parseSpokenNumber = (transcript: string): string => {
    let processedTranscript = transcript.replace(/[۰-۹]/g, d => persianDigitsMap[d]);
    const words = processedTranscript.toLowerCase().split(/\s+/);
    const numbers = words.map(word => wordToNumberMap[word] ?? parseInt(word.replace(/[^0-9]/g, ''), 10)).filter(num => !isNaN(num));
    if (numbers.length > 0) {
        return numbers.join('');
    }
    return transcript;
};

const ReturnModal: React.FC<{ invoice: PurchaseInvoice, onClose: () => void, onSubmit: (returnItems: { productId: string; quantity: number }[]) => void }> = ({ invoice, onClose, onSubmit }) => {
    const [returnQuantities, setReturnQuantities] = useState<{ [key: string]: number }>({});
    const { products } = useAppContext();

    const handleQuantityChange = (item: PurchaseInvoiceItem, quantity: number) => {
        const newQuantity = Math.max(0, Math.min(quantity, item.quantity));
        setReturnQuantities(prev => ({ ...prev, [item.productId]: newQuantity }));
    };

    const handleSubmit = () => {
        const returnItems = Object.entries(returnQuantities)
            // FIX: Coerce qty to a number to satisfy TypeScript's strict type checking.
            .filter(([, qty]) => Number(qty) > 0)
            .map(([productId, quantity]) => ({ productId, quantity }));
        onSubmit(returnItems);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-animate">
            <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-2xl border border-gray-200/80 w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="flex-shrink-0 flex justify-between items-center pb-4 border-b">
                    <h2 className="text-xl font-bold">ثبت مرجوعی برای فاکتور <span className="font-mono">{invoice.invoiceNumber || invoice.id}</span></h2>
                    <button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-200/50"><XIcon /></button>
                </div>
                <div className="flex-grow overflow-y-auto pt-4 -mx-2 px-2">
                    <p className="text-sm text-slate-600 mb-4">تعداد کالاهایی که قصد مرجوع کردن دارید را وارد کنید.</p>
                    <div className="space-y-4">
                        {invoice.items.map(item => {
                            const product = products.find(p => p.id === item.productId);
                            return (
                                <div key={item.productId} className="flex items-center justify-between p-3 bg-white/70 rounded-lg border">
                                    <div>
                                        <p className="font-semibold">{item.productName}</p>
                                        <p className="text-xs text-slate-500">خریداری شده: {item.quantity} عدد</p>
                                    </div>
                                    <PackageUnitInput
                                        totalUnits={returnQuantities[item.productId] || 0}
                                        itemsPerPackage={product?.itemsPerPackage || 1}
                                        onChange={(total) => handleQuantityChange(item, total)}
                                    />
                                </div>
                            )
                        })}
                    </div>
                </div>
                <div className="flex-shrink-0 flex justify-end gap-3 mt-6 pt-4 border-t">
                    <button onClick={onClose} className="px-6 py-3 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors font-semibold">لغو</button>
                    <button onClick={handleSubmit} className="px-8 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-lg btn-primary font-semibold">ثبت مرجوعی</button>
                </div>
            </div>
        </div>
    );
};


const Purchases: React.FC = () => {
    const { 
        purchaseInvoices, 
        suppliers, 
        products, 
        addPurchaseInvoice, 
        storeSettings,
        beginEditPurchase,
        cancelEditPurchase,
        updatePurchaseInvoice,
        addPurchaseReturn,
        editingPurchaseInvoiceId,
        hasPermission
    } = useAppContext();
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [toast, setToast] = useState('');
    const [invoiceToPrint, setInvoiceToPrint] = useState<PurchaseInvoice | null>(null);
    const [dateRange, setDateRange] = useState<{ start: Date, end: Date }>({ start: new Date(), end: new Date() });
    const [returnModalInvoice, setReturnModalInvoice] = useState<PurchaseInvoice | null>(null);

    // Modal State
    const [supplierId, setSupplierId] = useState('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
    const [items, setItems] = useState<PurchaseItemDraft[]>([]);
    const [productSearch, setProductSearch] = useState('');

    const [isListening, setIsListening] = useState(false);
    const [micError, setMicError] = useState('');
    const [recognitionLang, setRecognitionLang] = useState<'fa-IR' | 'en-US'>('fa-IR');
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const activeFieldRef = useRef<{name: string, index?: number} | null>(null);
    const numericFields = ['purchasePrice', 'lotNumber'];

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        
        recognition.onresult = (event: SpeechRecognitionEvent) => {
             let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }
            if (finalTranscript && activeFieldRef.current) {
                const { name, index } = activeFieldRef.current;
                 if(name === 'productSearch') {
                    setProductSearch(finalTranscript.trim());
                 } else if (index !== undefined) {
                    const processedTranscript = numericFields.includes(name)
                        ? parseSpokenNumber(finalTranscript)
                        : finalTranscript.trim();
                    handleItemChange(index, name as keyof PurchaseItemDraft, processedTranscript);
                 }
            }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            if (event.error === 'not-allowed') setMicError('دسترسی میکروفون مسدود است.');
            setIsListening(false);
        };
        recognition.onend = () => setIsListening(false);
        recognitionRef.current = recognition;

    }, []);

    useEffect(() => {
        if(recognitionRef.current) recognitionRef.current.lang = recognitionLang;
    }, [recognitionLang]);

    const toggleListening = async () => {
        if (!recognitionRef.current) return;
        setMicError('');
        if (isListening) {
            recognitionRef.current.stop();
        } else {
             try {
                const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
                if (permissionStatus.state === 'denied') {
                    setMicError('دسترسی میکروفون مسدود است. لطفاً از تنظیمات مرورگر دسترسی را مجاز کنید.');
                    return;
                }
                recognitionRef.current.start();
                setIsListening(true);
            } catch (e) {
                console.error("Mic permission error:", e);
                setMicError("خطا در دسترسی به میکروفون.");
            }
        }
    };
    const toggleLanguage = () => setRecognitionLang(p => p === 'fa-IR' ? 'en-US' : 'fa-IR');

    const showToast = (message: string) => {
        setToast(message);
        setTimeout(() => setToast(''), 3000);
    };

    const resetModalState = () => {
        setSupplierId('');
        setInvoiceNumber('');
        setInvoiceDate(new Date().toISOString().split('T')[0]);
        setItems([]);
        setProductSearch('');
        setMicError('');
        if (editingPurchaseInvoiceId) {
            cancelEditPurchase();
        }
    }
    
    const handleOpenModal = () => {
        resetModalState();
        setIsModalOpen(true);
    }
    
    const handleCloseModal = () => {
        resetModalState();
        setIsModalOpen(false);
    }


    const handleEditClick = (invoice: PurchaseInvoice) => {
        const result = beginEditPurchase(invoice.id);
        if (!result.success) {
            showToast(result.message);
            return;
        }
        setSupplierId(invoice.supplierId);
        setInvoiceNumber(invoice.invoiceNumber);
        setInvoiceDate(new Date(invoice.timestamp).toISOString().split('T')[0]);
        setItems(invoice.items.map(i => ({...i, showExpiry: !!i.expiryDate})));
        setIsModalOpen(true);
    };

    const handleReturnClick = (invoice: PurchaseInvoice) => {
        setReturnModalInvoice(invoice);
    };

    const handleReturnSubmit = (returnItems: { productId: string; quantity: number }[]) => {
        if (returnModalInvoice) {
            const result = addPurchaseReturn(returnModalInvoice.id, returnItems);
            showToast(result.message);
            if (result.success) {
                setReturnModalInvoice(null);
            }
        }
    };

    const handlePrintClick = (invoice: PurchaseInvoice) => {
        setInvoiceToPrint(invoice);
    };

    const handleAddItem = (product: Product) => {
        if (items.some(item => item.productId === product.id)) {
            showToast("این محصول قبلاً به فاکتور اضافه شده است.");
            return;
        }
        const newItem: PurchaseItemDraft = {
            productId: product.id,
            quantity: 0,
            purchasePrice: 0,
            lotNumber: '',
            expiryDate: '',
            showExpiry: false,
        };
        setItems(prev => [...prev, newItem]);
        setProductSearch('');
    };

    const handleItemChange = (index: number, field: keyof PurchaseItemDraft, value: string | number | boolean) => {
        const updatedItems = [...items];
        let processedValue = value;
        if (field === 'purchasePrice') {
             processedValue = String(value).replace(/[^0-9]/g, '');
        }
        (updatedItems[index] as any)[field] = processedValue;
        setItems(updatedItems);
    }
    
    const handleRemoveItem = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const totalAmount = useMemo(() => {
        return items.reduce((total, item) => total + (Number(item.purchasePrice) * Number(item.quantity)), 0);
    }, [items]);

    const filteredProducts = useMemo(() => {
        if (!productSearch) return [];
        return products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));
    }, [productSearch, products]);

    const filteredInvoices = useMemo(() => {
        if (!dateRange.start || !dateRange.end) return [];
        const startTime = dateRange.start.getTime();
        const endTime = dateRange.end.getTime();

        return purchaseInvoices.filter(inv => {
            const invTime = new Date(inv.timestamp).getTime();
            return invTime >= startTime && invTime <= endTime;
        });
    }, [purchaseInvoices, dateRange]);


    const handleSaveInvoice = () => {
        const finalItems = items.map(draft => ({
            productId: draft.productId,
            quantity: Number(draft.quantity),
            purchasePrice: Number(draft.purchasePrice),
            lotNumber: draft.lotNumber,
            expiryDate: draft.expiryDate || undefined,
        }));
        
        const invoiceData = {
            supplierId,
            invoiceNumber,
            items: finalItems,
            timestamp: invoiceDate,
        };

        const result = editingPurchaseInvoiceId
            ? updatePurchaseInvoice(invoiceData)
            : addPurchaseInvoice(invoiceData);

        showToast(result.message);
        if (result.success) {
            handleCloseModal();
        }
    };

    return (
        <div className="p-4 md:p-8">
            {toast && <Toast message={toast} onClose={() => setToast('')} />}
            {invoiceToPrint && (
                 <PurchasePrintPreviewModal 
                    invoice={invoiceToPrint} 
                    supplier={suppliers.find(s => s.id === invoiceToPrint.supplierId)}
                    onClose={() => setInvoiceToPrint(null)} 
                />
            )}
            {returnModalInvoice && (
                <ReturnModal invoice={returnModalInvoice} onClose={() => setReturnModalInvoice(null)} onSubmit={handleReturnSubmit} />
            )}
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                <h1 className="text-2xl md:text-4xl text-slate-800">مدیریت خرید</h1>
                {hasPermission('purchase:create_invoice') && (
                    <button onClick={handleOpenModal} className="w-full md:w-auto flex items-center justify-center bg-blue-600 text-white px-5 py-3 rounded-lg shadow-lg hover:bg-blue-700 btn-primary">
                        <PlusIcon className="w-6 h-6 ml-2"/>
                        <span className="font-semibold">ثبت فاکتور خرید</span>
                    </button>
                )}
            </div>
            
            <div className="mb-6 p-4 bg-white/60 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/60">
                <DateRangeFilter onFilterChange={(start, end) => setDateRange({ start, end })} />
            </div>

            <div className="bg-white/60 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/60 overflow-hidden hidden md:block">
                <table className="min-w-full text-center table-zebra">
                    <thead className="bg-white/50">
                        <tr>
                            <th className="p-5 text-md font-bold text-slate-700 tracking-wider">شماره فاکتور</th>
                            <th className="p-5 text-md font-bold text-slate-700 tracking-wider">تأمین کننده</th>
                            <th className="p-5 text-md font-bold text-slate-700 tracking-wider">مبلغ کل</th>
                            <th className="p-5 text-md font-bold text-slate-700 tracking-wider">تاریخ</th>
                            <th className="p-5 text-md font-bold text-slate-700 tracking-wider">عملیات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredInvoices.map((invoice) => (
                            <tr key={invoice.id} className="border-t border-gray-200/60">
                                <td className="p-4 font-semibold text-slate-800 font-mono text-lg">
                                    <div className="flex items-center justify-center gap-2">
                                        <span>{invoice.invoiceNumber || invoice.id}</span>
                                        {invoice.type === 'return' && <span className="text-xs font-bold bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full">مرجوعی</span>}
                                    </div>
                                </td>
                                <td className="p-4 text-slate-700 text-lg">{suppliers.find(s => s.id === invoice.supplierId)?.name || 'ناشناس'}</td>
                                <td className="p-4 text-slate-700 text-lg">{formatCurrency(invoice.totalAmount, storeSettings)}</td>
                                <td className="p-4 text-slate-500 text-lg">{new Date(invoice.timestamp).toLocaleDateString('fa-IR')}</td>
                                <td className="p-4">
                                    <div className="flex justify-center items-center space-x-1 space-x-reverse">
                                        <button onClick={() => handlePrintClick(invoice)} className="p-2 rounded-full text-green-600 hover:text-green-800 hover:bg-green-100/50 transition-colors"><PrintIcon className="w-6 h-6"/></button>
                                        {hasPermission('purchase:edit_invoice') && invoice.type === 'purchase' && <button onClick={() => handleEditClick(invoice)} className="p-2 rounded-full text-blue-600 hover:text-blue-800 hover:bg-blue-100/50 transition-colors"><EditIcon className="w-6 h-6"/></button>}
                                        {invoice.type === 'purchase' && <button onClick={() => handleReturnClick(invoice)} className="p-2 rounded-full text-orange-600 hover:text-orange-800 hover:bg-orange-100/50 transition-colors" title="مرجوعی"><PlusIcon className="w-6 h-6 transform rotate-45" /></button>}
                                    </div>
                                </td>
                            </tr>
                        ))}
                         {filteredInvoices.length === 0 && (
                            <tr>
                                <td colSpan={5} className="text-center p-16">
                                    <p className="text-slate-500 text-lg">در این بازه زمانی فاکتوری ثبت نشده است.</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

             {/* Mobile View */}
            <div className="md:hidden space-y-4">
                {filteredInvoices.map((invoice) => (
                     <div key={invoice.id} className="bg-white/70 p-4 rounded-xl shadow-md border">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-mono font-bold text-lg text-slate-800 mb-2">{invoice.invoiceNumber || invoice.id}</h3>
                                {invoice.type === 'return' && <span className="text-xs font-bold bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full">مرجوعی</span>}
                           </div>
                           <div className="flex items-center">
                             <button onClick={() => handlePrintClick(invoice)} className="p-2 text-green-600"><PrintIcon className="w-5 h-5"/></button>
                             {hasPermission('purchase:edit_invoice') && invoice.type === 'purchase' && <button onClick={() => handleEditClick(invoice)} className="p-2 text-blue-600"><EditIcon className="w-5 h-5"/></button>}
                             {invoice.type === 'purchase' && <button onClick={() => handleReturnClick(invoice)} className="p-2 text-orange-600" title="مرجوعی"><PlusIcon className="w-5 h-5 transform rotate-45" /></button>}
                           </div>
                        </div>
                         <div className="space-y-2 text-md">
                            <div className="flex justify-between"><span className="text-slate-500">تأمین کننده:</span> <span className="font-semibold">{suppliers.find(s => s.id === invoice.supplierId)?.name || 'ناشناس'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">تاریخ:</span> <span className="font-semibold">{new Date(invoice.timestamp).toLocaleDateString('fa-IR')}</span></div>
                         </div>
                        <div className="mt-3 pt-3 border-t">
                             <div className="flex justify-between text-lg"><span className="text-slate-500">مبلغ کل:</span> <span className="font-bold text-blue-600">{formatCurrency(invoice.totalAmount, storeSettings)}</span></div>
                        </div>
                    </div>
                ))}
                {filteredInvoices.length === 0 && (
                    <div className="text-center py-16">
                         <p className="text-slate-500 text-lg">در این بازه زمانی فاکتوری ثبت نشده است.</p>
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-0 md:p-4 modal-animate">
                    <div className="bg-white/80 backdrop-blur-xl p-4 md:p-6 rounded-none md:rounded-2xl shadow-2xl border border-gray-200/80 w-full h-full md:max-w-5xl md:h-[95vh] flex flex-col" onFocusCapture={(e) => {
                        const target = e.target as HTMLElement;
                        const name = target.getAttribute('name');
                        const index = target.getAttribute('data-index');
                        if (name) {
                            activeFieldRef.current = index ? { name, index: parseInt(index, 10) } : { name };
                        }
                    }}>
                        <div className="flex-shrink-0 flex justify-between items-center pb-4 border-b border-slate-200">
                            <h2 className="text-xl md:text-2xl font-bold text-slate-800">{editingPurchaseInvoiceId ? 'ویرایش فاکتور خرید' : 'ثبت فاکتور خرید جدید'}</h2>
                            <button onClick={handleCloseModal} className="p-1 rounded-full text-slate-500 hover:bg-slate-200/50 transition-colors"><XIcon /></button>
                        </div>
                        
                        <div className="flex-grow overflow-y-auto pt-4 -mx-2 px-2">
                           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="w-full p-3 bg-white/80 border border-gray-300 rounded-lg form-input" required>
                                    <option value="">-- انتخاب تأمین کننده --</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                                <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} type="text" className="w-full p-3 bg-white/80 border border-gray-300 rounded-lg form-input" placeholder="شماره فاکتور (اختیاری)" />
                                <input value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} type="date" className="w-full p-3 bg-white/80 border border-gray-300 rounded-lg form-input" required />
                           </div>
                           
                           <div className="relative mb-2">
                                <input 
                                    type="text"
                                    value={productSearch}
                                    name="productSearch"
                                    onChange={e => setProductSearch(e.target.value)}
                                    placeholder="جستجوی کالا برای افزودن به فاکتور..."
                                    className="w-full p-3.5 pr-32 bg-white/80 border border-gray-300 rounded-lg form-input"
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                    <button type="button" onClick={toggleLanguage} className="px-3 py-1.5 text-xs font-semibold rounded-md bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors">{recognitionLang === 'fa-IR' ? 'FA' : 'EN'}</button>
                                    <button onClick={toggleListening} className={`p-2 rounded-full transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-gray-500 hover:text-blue-600 hover:bg-gray-100'}`}><MicIcon className="w-5 h-5"/></button>
                                    <SearchIcon className="text-slate-400 w-5 h-5" />
                                </div>
                                {filteredProducts.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg max-h-52 overflow-y-auto border">
                                        {filteredProducts.map(p => (
                                            <div key={p.id} onClick={() => handleAddItem(p)} className="p-3 hover:bg-blue-100/50 cursor-pointer">{p.name}</div>
                                        ))}
                                    </div>
                                )}
                           </div>
                            {micError && <p className="text-xs text-red-600 text-center mt-1 flex items-center justify-center gap-1"><WarningIcon className="w-4 h-4" /> {micError}</p>}

                           <div className="space-y-3 mt-4">
                                {items.map((item, index) => {
                                    const product = products.find(p => p.id === item.productId)!;
                                    return (
                                        <div key={item.productId} className="bg-white/50 p-3 rounded-lg border">
                                            <div className="flex justify-between items-center mb-2">
                                                <h4 className="font-semibold text-slate-800 truncate text-md">{product.name}</h4>
                                                <button onClick={() => handleRemoveItem(index)} className="text-red-500"><TrashIcon className="w-5 h-5"/></button>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                 <div>
                                                    <label className="text-xs font-semibold text-slate-500">تعداد</label>
                                                    <PackageUnitInput
                                                        totalUnits={item.quantity}
                                                        itemsPerPackage={product.itemsPerPackage || 1}
                                                        onChange={(total) => handleItemChange(index, 'quantity', total)}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-semibold text-slate-500">قیمت خرید</label>
                                                    <input type="text" name="purchasePrice" data-index={index} value={item.purchasePrice} onChange={e => handleItemChange(index, 'purchasePrice', e.target.value)} placeholder="0" className="w-full p-2 bg-white/80 border border-gray-300 rounded-md form-input" />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-semibold text-slate-500">شماره لات</label>
                                                    <input type="text" name="lotNumber" data-index={index} value={item.lotNumber} onChange={e => handleItemChange(index, 'lotNumber', e.target.value)} placeholder="-" className="w-full p-2 bg-white/80 border border-gray-300 rounded-md form-input" />
                                                </div>
                                                <div>
                                                   <label className="text-xs font-semibold text-slate-500">انقضا</label>
                                                   {item.showExpiry ? (
                                                    <input type="date" value={item.expiryDate} onChange={e => handleItemChange(index, 'expiryDate', e.target.value)} className="w-full p-2 bg-white/80 border border-gray-300 rounded-md text-sm form-input"/>
                                                   ) : (
                                                    <button onClick={() => handleItemChange(index, 'showExpiry', true)} className="w-full h-full text-sm text-blue-600 hover:underline">افزودن</button>
                                                   )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                           </div>
                        </div>

                        <div className="flex-shrink-0 flex flex-col md:flex-row justify-between items-center mt-6 pt-4 border-t border-slate-200">
                           <div className="text-xl md:text-2xl font-bold text-slate-700 w-full md:w-auto text-center md:text-right mb-4 md:mb-0">
                                <span>مجموع کل: </span>
                                <span className="text-blue-600">{formatCurrency(totalAmount, storeSettings)}</span>
                           </div>
                           <div className="flex w-full md:w-auto space-x-3 space-x-reverse">
                               <button type="button" onClick={handleCloseModal} className="flex-1 px-6 py-3 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors font-semibold">لغو</button>
                               <button type="button" onClick={handleSaveInvoice} className="flex-1 px-8 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-lg transition-all btn-primary font-semibold">{editingPurchaseInvoiceId ? 'بروزرسانی' : 'ذخیره'}</button>
                           </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Purchases;