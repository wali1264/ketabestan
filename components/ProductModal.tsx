
import React, { useState, useEffect, useRef } from 'react';
import type { Product, ProductBatch, SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent } from '../types';
import { XIcon, ChevronDownIcon, MicIcon, WarningIcon } from './icons';
import { parseToPackageAndUnits, parseToTotalUnits } from '../utils/formatters';


type ProductFormData = Omit<Product, 'id' | 'batches'>;
type FirstBatchData = Omit<ProductBatch, 'id'>;

type FormState = {
    id?: string;
    name: string;
    salePrice: string;
    itemsPerPackage: string;
    barcode: string;
    manufacturer: string;
    // Batch fields
    purchasePrice: string;
    lotNumber: string;
    expiryDate: string;
    stock: number;
};


interface ProductModalProps {
    product: Product | null;
    onClose: () => void;
    onSave: (productData: ProductFormData, firstBatchData: FirstBatchData) => void;
}

const persianDigitsMap: { [key: string]: string } = { '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' };
const wordToNumberMap: { [key: string]: number } = {
  'صفر': 0, 'یک': 1, 'دو': 2, 'سه': 3, 'چهار': 4, 'پنج': 5, 'شش': 6, 'هفت': 7, 'هشت': 8, 'نه': 9, 'ده': 10,
  'یازده': 11, 'دوازده': 12, 'سیزده': 13, 'چهارده': 14, 'پانزده': 15, 'شانزده': 16, 'هفده': 17, 'هجده': 18, 'نوزده': 19,
  'بیست': 20, 'سی': 30, 'چهل': 40, 'پنجاه': 50, 'شصت': 60, 'هفتاد': 70, 'هشتاد': 80, 'نود': 90,
  'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
  'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
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

const parseSmartDate = (transcript: string): string => {
    const normalized = transcript.replace(/[۰-۹]/g, d => persianDigitsMap[d]);
    const numbers = normalized.split(/\s+/).map(word => {
        const num = parseInt(word, 10);
        if (!isNaN(num)) return num;
        return wordToNumberMap[word.toLowerCase()];
    }).filter(n => n !== undefined) as number[];

    if (numbers.length < 2) return ''; 

    let month, year;
    const n1 = numbers[0];
    const n2 = numbers[1];

    if (n1 > 12 && n2 >= 1 && n2 <= 12) { [year, month] = [n1, n2]; } 
    else if (n2 > 12 && n1 >= 1 && n1 <= 12) { [month, year] = [n1, n2]; } 
    else if (n1 <= 12 && n2 < 100) { month = n1; year = 2000 + n2; } 
    else if (n2 <= 12 && n1 < 100) { month = n2; year = 2000 + n1; } 
    else { return ''; }

    if (month >= 1 && month <= 12 && year > 2000) {
        const lastDay = new Date(year, month, 0).getDate();
        const monthStr = String(month).padStart(2, '0');
        const dayStr = String(lastDay).padStart(2, '0');
        return `${year}-${monthStr}-${dayStr}`;
    }
    return '';
};

const FormInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string; id: string; error?: string, inputRef?: React.Ref<HTMLInputElement> }> = ({ label, id, error, inputRef, ...props }) => (
    <div>
        <label htmlFor={id} className="block text-md font-semibold text-slate-700 mb-2">{label}</label>
        <input 
            id={id} 
            ref={inputRef}
            {...props} 
            className={`w-full p-3 bg-white/80 border ${error ? 'border-red-500' : 'border-slate-300/80'} rounded-lg shadow-sm focus:ring-0 transition-all placeholder:text-slate-400 form-input`}
        />
         {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
);

const ProductModal: React.FC<ProductModalProps> = ({ product, onClose, onSave }) => {
    const productToFormState = (p: Product | null): FormState => {
        const firstBatch = p?.batches[0];
        return {
            id: p?.id || undefined,
            name: p?.name || '',
            salePrice: p?.salePrice?.toString() || '',
            itemsPerPackage: p?.itemsPerPackage?.toString() || '1',
            barcode: p?.barcode || '',
            manufacturer: p?.manufacturer || '',
            purchasePrice: firstBatch?.purchasePrice?.toString() || '',
            lotNumber: firstBatch?.lotNumber || '',
            expiryDate: firstBatch?.expiryDate || '',
            stock: firstBatch?.stock || 0,
        };
    };

    const [formData, setFormData] = useState<FormState>(productToFormState(product));
    const [stockPackages, setStockPackages] = useState('');
    const [stockUnits, setStockUnits] = useState('');
    const [isDetailsOpen, setIsDetailsOpen] = useState(!!(product?.barcode || product?.manufacturer || product?.batches[0]?.expiryDate));
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    
    const [isListening, setIsListening] = useState(false);
    const [micError, setMicError] = useState('');
    const [recognitionLang, setRecognitionLang] = useState<'fa-IR' | 'en-US'>('fa-IR');
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const activeFieldRef = useRef<HTMLInputElement | null>(null);

    const numericFields = ['purchasePrice', 'salePrice', 'itemsPerPackage', 'lotNumber', 'stockPackages', 'stockUnits'];
    
    useEffect(() => {
        const itemsPerPack = Number(formData.itemsPerPackage) || 1;
        const { packages, units } = parseToPackageAndUnits(formData.stock, itemsPerPack);
        setStockPackages(packages > 0 ? String(packages) : '');
        setStockUnits(units > 0 ? String(units) : '');
    }, [formData.stock, formData.itemsPerPackage]);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
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
                    const field = activeFieldRef.current;
                    const fieldName = field.name;
                    let processedTranscript: string;

                    if (fieldName === 'expiryDate') {
                        processedTranscript = parseSmartDate(finalTranscript);
                    } else if (numericFields.includes(fieldName)) {
                        processedTranscript = parseSpokenNumber(finalTranscript);
                    } else {
                        processedTranscript = finalTranscript.trim();
                    }
                    
                    field.value = processedTranscript;
                    field.dispatchEvent(new Event('input', { bubbles: true }));
                }
            };

            recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
                console.error("Speech recognition error", event.error);
                if (event.error === 'not-allowed') {
                    setMicError('دسترسی میکروفون مسدود است. لطفاً از تنظیمات مرورگر دسترسی را مجاز کنید.');
                } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
                     setMicError('خطایی در تشخیص گفتار رخ داد.');
                }
            };
            
            recognition.onend = () => {
                if(isListening) setIsListening(false);
            }
            
            recognitionRef.current = recognition;
        }
    }, []);

    useEffect(() => {
        if (recognitionRef.current) {
            recognitionRef.current.lang = recognitionLang;
        }
    }, [recognitionLang]);

    const toggleListening = async () => {
        if (!recognitionRef.current) {
            setMicError("مرورگر شما از قابلیت تشخیص گفتار پشتیبانی نمی‌کند.");
            return;
        }

        setMicError(''); 

        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
            return;
        }

        try {
            const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
            if (permissionStatus.state === 'granted' || permissionStatus.state === 'prompt') {
                recognitionRef.current.start();
                setIsListening(true);
            } else if (permissionStatus.state === 'denied') {
                setMicError('دسترسی میکروفون مسدود است. لطفاً روی آیکون قفل/دوربین در نوار آدرس کلیک کرده و دسترسی را مجاز کنید.');
            }
        } catch (e) {
            console.error("Error checking microphone permissions:", e);
            setMicError("خطایی در بررسی دسترسی میکروفون رخ داد.");
        }
    };


    const toggleLanguage = () => {
        setRecognitionLang(prev => {
            const newLang = prev === 'fa-IR' ? 'en-US' : 'fa-IR';
            if (recognitionRef.current) {
                recognitionRef.current.lang = newLang;
            }
            return newLang;
        });
    };
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        
        let processedValue = value;
        
        // STRICT INTEGERS: itemsPerPackage, lotNumber
        if (['itemsPerPackage', 'lotNumber'].includes(name)) {
            processedValue = value.replace(/[^0-9]/g, '');
        }
        // DECIMALS ALLOWED: purchasePrice, salePrice
        else if (['purchasePrice', 'salePrice'].includes(name)) {
            // Allow digits and dot, remove others
            processedValue = value.replace(/[^0-9.]/g, '');
            
            // Prevent more than one dot
            if ((processedValue.match(/\./g) || []).length > 1) {
                return; // Ignore input if it attempts to add a second dot
            }
        }

        setFormData(prev => ({ ...prev, [name]: processedValue }));

        if (errors[name]) {
            setErrors(prev => { const newErrors = { ...prev }; delete newErrors[name]; return newErrors; });
        }
    };

    const handleStockChange = (packagesStr: string, unitsStr: string) => {
        const packages = Number(packagesStr) || 0;
        const units = Number(unitsStr) || 0;
        const itemsPerPack = Number(formData.itemsPerPackage) || 1;
        const total = parseToTotalUnits(packages, units, itemsPerPack);
        setFormData(prev => ({ ...prev, stock: total }));
    };

    
    const validate = () => {
        const newErrors: { [key: string]: string } = {};
        if (!formData.name.trim()) newErrors.name = "نام محصول اجباری است";
        if (!formData.purchasePrice || Number(formData.purchasePrice) <= 0) newErrors.purchasePrice = "قیمت خرید باید بزرگتر از صفر باشد";
        if (!formData.salePrice || Number(formData.salePrice) <= 0) newErrors.salePrice = "قیمت فروش باید بزرگتر از صفر باشد";
        if (formData.stock < 0) newErrors.stock = "موجودی نمی‌تواند منفی باشد";
        if (!formData.lotNumber.trim()) newErrors.lotNumber = "شماره لات اجباری است";
        
        if (formData.expiryDate) {
            const todayStr = new Date().toISOString().split('T')[0];
            if (formData.expiryDate < todayStr) {
                newErrors.expiryDate = "تاریخ انقضا نمی‌تواند در گذشته باشد";
            }
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isListening && recognitionRef.current) {
            recognitionRef.current.stop();
        }
        if (validate()) {
            const productData: ProductFormData = {
                name: formData.name.trim(),
                // Changed: Removed Math.round to allow decimals
                salePrice: Number(formData.salePrice), 
                itemsPerPackage: formData.itemsPerPackage ? Number(formData.itemsPerPackage) : 1,
                barcode: formData.barcode?.trim() || undefined,
                manufacturer: formData.manufacturer?.trim() || undefined,
            };
            const firstBatchData: FirstBatchData = {
                // Changed: Removed Math.round to allow decimals
                purchasePrice: Number(formData.purchasePrice),
                stock: Number(formData.stock),
                lotNumber: formData.lotNumber.trim(),
                purchaseDate: new Date().toISOString(),
                expiryDate: formData.expiryDate || undefined,
            }
            // onSave expects different signatures for new vs edit
            if (product) {
                // For editing, we pass a full product object. The logic is in AppContext
                const updatedProduct = {
                    ...product,
                    ...productData,
                    // Note: This modal doesn't edit batches, only general info.
                    // The AppContext update function should handle this gracefully.
                }
                onSave(updatedProduct, firstBatchData); // A bit of a hack, needs to be handled in parent
            } else {
                 onSave(productData, firstBatchData);
            }
        }
    };

    const formRef = useRef<HTMLFormElement>(null);
    const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const form = formRef.current;
            if (!form) return;
    
            const focusable = Array.from(
                form.querySelectorAll('input:not([disabled]), button[type="submit"]')
            ).filter(el => (el as HTMLElement).offsetParent !== null);
    
            const currentIndex = focusable.indexOf(e.target as HTMLElement);
    
            const nextIndex = currentIndex + 1;
            if (nextIndex < focusable.length) {
                (focusable[nextIndex] as HTMLElement).focus();
            } else {
                 // FIX: The `handleSubmit` function expects a FormEvent, but was being called with a
                 // KeyboardEvent. This satisfies the type system by casting through `unknown`.
                 handleSubmit(e as unknown as React.FormEvent); 
            }
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-animate">
             <style>{`
                @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
                .listening-pulse { animation: pulse 1.5s infinite ease-in-out; }
            `}</style>
            <div className="bg-white/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-gray-200/80 w-full max-w-2xl">
                <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                    <div className="flex items-center space-x-3 space-x-reverse">
                        <h2 className="text-2xl font-bold text-slate-800">{product ? 'ویرایش محصول' : 'افزودن محصول جدید'}</h2>
                        <button type="button" onClick={toggleListening} className={`p-2 rounded-full transition-colors ${isListening ? 'bg-red-500 text-white listening-pulse' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>
                            <MicIcon className="w-5 h-5" />
                        </button>
                        <button type="button" onClick={toggleLanguage} className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors">
                            {recognitionLang === 'fa-IR' ? 'FA' : 'EN'}
                        </button>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-200/50 transition-colors"><XIcon /></button>
                </div>

                {micError && (
                    <div className="flex items-center justify-center text-red-700 bg-red-100/80 text-md p-3 rounded-md mt-4 text-center">
                        <WarningIcon className="w-5 h-5 ml-2 text-red-600" />
                        <span>{micError}</span>
                    </div>
                )}

                <form ref={formRef} onSubmit={handleSubmit} onFocusCapture={(e) => { activeFieldRef.current = e.target as unknown as HTMLInputElement; }} className="space-y-5 mt-6 max-h-[70vh] overflow-y-auto pr-2">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <FormInput label="نام محصول" id="name" name="name" type="text" value={formData.name} onChange={handleInputChange} onInput={handleInputChange} placeholder="مثال: خودکار آبی بیک" required error={errors.name} onKeyDown={handleKeyDown} />
                        <FormInput label="شماره لات اولیه" id="lotNumber" name="lotNumber" type="text" value={formData.lotNumber} onChange={handleInputChange} onInput={handleInputChange} placeholder="مثال: L-12345" required error={errors.lotNumber} onKeyDown={handleKeyDown} disabled={!!product} />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                       <FormInput label="قیمت خرید اولیه" id="purchasePrice" name="purchasePrice" type="text" inputMode="decimal" value={formData.purchasePrice} onChange={handleInputChange} onInput={handleInputChange} required error={errors.purchasePrice} onKeyDown={handleKeyDown} disabled={!!product} />
                       <FormInput label="قیمت فروش" id="salePrice" name="salePrice" type="text" inputMode="decimal" value={formData.salePrice} onChange={handleInputChange} onInput={handleInputChange} required error={errors.salePrice} onKeyDown={handleKeyDown} />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <FormInput label="تعداد در بسته" id="itemsPerPackage" name="itemsPerPackage" type="text" inputMode="numeric" value={formData.itemsPerPackage} onChange={handleInputChange} onInput={handleInputChange} placeholder="مثال: 12" onKeyDown={handleKeyDown} />
                        <FormInput
                            label="موجودی اولیه (بسته)"
                            id="stockPackages"
                            name="stockPackages"
                            type="text"
                            inputMode="numeric"
                            value={stockPackages}
                            onInput={(e) => {
                                const val = (e.target as HTMLInputElement).value.replace(/[^0-9]/g, '');
                                setStockPackages(val);
                                handleStockChange(val, stockUnits);
                            }}
                            onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                setStockPackages(val);
                                handleStockChange(val, stockUnits);
                            }}
                            disabled={Number(formData.itemsPerPackage) <= 1 || !!product}
                            onKeyDown={handleKeyDown}
                             error={errors.stock}
                        />
                        <FormInput
                            label="موجودی اولیه (عدد)"
                            id="stockUnits"
                            name="stockUnits"
                            type="text"
                            inputMode="numeric"
                            value={stockUnits}
                             onInput={(e) => {
                                const val = (e.target as HTMLInputElement).value.replace(/[^0-9]/g, '');
                                setStockUnits(val);
                                handleStockChange(stockPackages, val);
                            }}
                            onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                setStockUnits(val);
                                handleStockChange(stockPackages, val);
                            }}
                            disabled={!!product}
                            onKeyDown={handleKeyDown}
                        />
                    </div>

                    <div className="border-t border-slate-200 pt-4">
                        <button type="button" onClick={() => setIsDetailsOpen(!isDetailsOpen)} className="w-full flex justify-between items-center text-slate-700 font-semibold rounded-md p-2 hover:bg-slate-100/50 transition-colors">
                            <span>افزودن جزئیات بیشتر</span>
                            <ChevronDownIcon className={`w-5 h-5 transition-transform duration-300 ${isDetailsOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isDetailsOpen && (
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-5">
                                <FormInput label="کد محصول (بارکد)" id="barcode" name="barcode" type="text" value={formData.barcode} onChange={handleInputChange} onInput={handleInputChange} placeholder="اسکن یا وارد کنید" onKeyDown={handleKeyDown} />
                                <FormInput label="شرکت سازنده" id="manufacturer" name="manufacturer" type="text" value={formData.manufacturer} onChange={handleInputChange} onInput={handleInputChange} onKeyDown={handleKeyDown} />
                                <FormInput label="تاریخ انقضا (اولیه)" id="expiryDate" name="expiryDate" type="date" value={formData.expiryDate} onChange={handleInputChange} onInput={handleInputChange} onKeyDown={handleKeyDown} error={errors.expiryDate} disabled={!!product}/>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end space-x-3 space-x-reverse pt-5 border-t border-slate-200">
                        <button type="button" onClick={onClose} className="px-6 py-3 rounded-lg text-slate-700 bg-slate-200/70 hover:bg-slate-300/70 transition-colors font-semibold">انصراف</button>
                        <button type="submit" className="px-8 py-3 rounded-lg bg-blue-600 text-white btn-primary font-semibold">ذخیره</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProductModal;
