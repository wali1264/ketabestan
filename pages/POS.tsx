import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { InvoiceItem, Product, SaleInvoice, SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent, Customer, SalesMemoImage, Service, CartItem } from '../types';
import { useAppContext } from '../AppContext';
import { MicIcon, EditIcon, PrintIcon, TrashIcon, CameraIcon, GalleryIcon, XIcon, CheckIcon, BarcodeIcon, PlusIcon } from '../components/icons';
import Toast from '../components/Toast';
import PrintPreviewModal from '../components/PrintPreviewModal';
import FloatingGallery from '../components/FloatingGallery';
import * as db from '../utils/db';
import { formatCurrency } from '../utils/formatters';
import DateRangeFilter from '../components/DateRangeFilter';
import POSCartItem from '../components/POSCartItem';
import PackageUnitInput from '../components/PackageUnitInput';


// Extracted ProductSide Component
const ProductSide: React.FC<{
    searchContainerRef: React.RefObject<HTMLDivElement>, 
    memoFileInputRef: React.RefObject<HTMLInputElement>, 
    searchInputRef: React.RefObject<HTMLInputElement>, 
    searchTerm: string, 
    setSearchTerm: (term: string) => void,
    setIsSearchFocused: (isFocused: boolean) => void, 
    handleTakePhotoClick: () => void, 
    handlePhotoTaken: (event: React.ChangeEvent<HTMLInputElement>) => void, 
    isBarcodeModeActive: boolean,
    setIsBarcodeModeActive: (isActive: boolean) => void, 
    isListening: boolean, 
    toggleListening: () => void, 
    recognitionLang: string, 
    toggleLanguage: () => void,
    isSearchFocused: boolean, 
    dropdownProducts: Product[], 
    handleDropdownItemClick: (product: Product) => void, 
    addToCart: (item: Product | Service, type: 'product' | 'service') => void, 
    storeSettings: any,
    // Props for MiniCart
    cart: CartItem[],
    editingPriceItemId: string | null,
    setEditingPriceItemId: (id: string | null) => void,
    updateCartItemQuantity: (itemId: string, itemType: 'product' | 'service', newQuantity: number) => { success: boolean, message: string },
    removeFromCart: (itemId: string, itemType: 'product' | 'service') => void,
    updateCartItemFinalPrice: (itemId: string, itemType: 'product' | 'service', finalPrice: number) => void,
    hasPermission: (permission: string) => boolean,
}> = ({
    searchContainerRef, memoFileInputRef, searchInputRef, searchTerm, setSearchTerm,
    setIsSearchFocused, handleTakePhotoClick, handlePhotoTaken, isBarcodeModeActive,
    setIsBarcodeModeActive, isListening, toggleListening, recognitionLang, toggleLanguage,
    isSearchFocused, dropdownProducts, handleDropdownItemClick,
    addToCart, storeSettings, cart, editingPriceItemId, setEditingPriceItemId,
    updateCartItemQuantity, removeFromCart, updateCartItemFinalPrice, hasPermission
}) => (
    <>
        <div ref={searchContainerRef} className="relative mb-4 flex-shrink-0">
             <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={memoFileInputRef}
                onChange={handlePhotoTaken}
                className="hidden"
            />
            <input
                ref={searchInputRef}
                type="text"
                placeholder="جستجوی محصول یا اسکن بارکد..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                className="w-full p-4 pl-48 rounded-xl bg-white/80 border-2 border-transparent shadow-sm form-input"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center h-full">
                <div className="flex items-center gap-1">
                    <button 
                        onClick={() => setIsBarcodeModeActive(!isBarcodeModeActive)} 
                        className={`p-2 rounded-lg transition-all duration-200 ${isBarcodeModeActive ? 'bg-green-100 text-green-700' : 'text-slate-500 hover:bg-slate-200/60'}`}
                        title="حالت فروش با اسکنر"
                    >
                        <BarcodeIcon className="w-6 h-6"/>
                    </button>
                    <button onClick={toggleListening} className={`p-2 rounded-lg transition-all duration-200 ${isListening ? 'bg-red-100 text-red-700 animate-pulse' : 'text-slate-500 hover:bg-slate-200/60'}`}>
                        <MicIcon className="w-6 h-6"/>
                    </button>
                    <button onClick={handleTakePhotoClick} className="p-2 rounded-lg text-slate-500 hover:bg-slate-200/60 transition-all duration-200" title="ثبت عکس سریع">
                        <CameraIcon className="w-6 h-6"/>
                    </button>
                </div>
                <div className="w-px h-6 bg-slate-300 mx-2"></div>
                <button type="button" onClick={toggleLanguage} className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors">
                    {recognitionLang === 'fa-IR' ? 'FA' : 'EN'}
                </button>
            </div>
            {isSearchFocused && dropdownProducts.length > 0 && (
                <div className="absolute top-full mt-2 w-full bg-white/95 backdrop-blur-xl rounded-xl shadow-lg border border-gray-200/60 z-20 max-h-80 overflow-y-auto">
                    <ul>
                        {dropdownProducts.map((product: Product) => (
                            <li 
                                key={product.id}
                                onClick={() => handleDropdownItemClick(product)}
                                className="p-4 flex justify-between items-center hover:bg-blue-100/50 cursor-pointer border-b border-gray-200/60 last:border-b-0"
                            >
                                <span className="font-semibold text-slate-800 text-lg">{product.name}</span>
                                <span className="text-blue-600 font-bold">{formatCurrency(product.salePrice, storeSettings)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {isSearchFocused && searchTerm && dropdownProducts.length === 0 && (
                 <div className="absolute top-full mt-2 w-full bg-white/95 backdrop-blur-xl rounded-xl shadow-lg border border-gray-200/60 z-20 p-4">
                    <p className="text-center text-slate-500">محصولی یافت نشد.</p>
                </div>
            )}
        </div>
        
        {/* Mini Cart for Mobile */}
        <div className="md:hidden mt-4 pt-4 border-t border-gray-200/60 flex-grow flex flex-col min-h-0">
            <h3 className="text-lg font-bold text-slate-800 mb-3 px-1 flex-shrink-0">اقلام انتخاب شده ({cart.length})</h3>
            <div className="flex-grow overflow-y-auto -mx-1 px-1">
                {cart.length === 0 ? (
                     <div className="flex items-center justify-center h-full">
                        <p className="text-slate-500">موردی به سبد خرید اضافه نشده.</p>
                    </div>
                ) : (
                    cart.map((item: CartItem) => (
                       <POSCartItem
                           key={`${item.id}-${item.type}`}
                           item={item}
                           isEditingPrice={editingPriceItemId === `${item.id}-${item.type}`}
                           storeSettings={storeSettings}
                           hasPermission={hasPermission}
                           onQuantityChange={(total) => updateCartItemQuantity(item.id, item.type, total)}
                           onRemove={() => removeFromCart(item.id, item.type)}
                           onStartPriceEdit={() => setEditingPriceItemId(`${item.id}-${item.type}`)}
                           onSavePrice={(newPrice) => {
                               updateCartItemFinalPrice(item.id, item.type, newPrice);
                               setEditingPriceItemId(null);
                           }}
                           onCancelPriceEdit={() => setEditingPriceItemId(null)}
                       />
                    ))
                )}
            </div>
        </div>
    </>
);

// Extracted CartSide Component
const CartSide: React.FC<any> = ({
    activeTab, setActiveTab, cart, filteredInvoices, services, setIsGalleryOpen, memoImages,
    editingSaleInvoiceId, handleCancelEdit, updateQuantity, removeFromCart, editingPriceItemId,
    setEditingPriceItemId, updateCartItemFinalPrice, hasPermission, selectedCustomerId,
    setSelectedCustomerId, customers, totalAmount, completeSale, setInvoiceDateRange,
    handlePrintInvoice, handleEditInvoice, storeSettings, setMobileView, addToCart, handleOpenReturnModal
}) => (
     <>
        <div className="flex justify-between items-center mb-4">
            <div className="flex border-b-2 border-gray-200/60">
                <button onClick={() => setActiveTab('cart')} className={`py-3 px-6 font-bold text-lg transition-colors relative ${activeTab === 'cart' ? 'text-blue-600' : 'text-slate-500 hover:text-blue-600'}`}>
                    سبد خرید ({cart.length})
                    {activeTab === 'cart' && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-t-full"></div>}
                </button>
                 <button onClick={() => setActiveTab('invoices')} className={`py-3 px-6 font-bold text-lg transition-colors relative ${activeTab === 'invoices' ? 'text-blue-600' : 'text-slate-500 hover:text-blue-600'}`}>
                    فاکتورها ({filteredInvoices.length})
                    {activeTab === 'invoices' && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-t-full"></div>}
                </button>
                 <button onClick={() => setActiveTab('services')} className={`py-3 px-6 font-bold text-lg transition-colors relative ${activeTab === 'services' ? 'text-blue-600' : 'text-slate-500 hover:text-blue-600'}`}>
                    خدمات
                    {activeTab === 'services' && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-t-full"></div>}
                </button>
            </div>
             <button onClick={() => setIsGalleryOpen(true)} className="relative p-2 rounded-full text-gray-500 hover:text-blue-600 hover:bg-gray-100 transition-colors" title="گالری یادداشت‌ها">
                <GalleryIcon className="w-7 h-7" />
                {memoImages.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                        {memoImages.length}
                    </span>
                )}
            </button>
        </div>
        
        {activeTab === 'cart' && (
        <>
            {editingSaleInvoiceId && (
                <div className="p-3 mb-4 bg-amber-100/80 border-r-4 border-amber-500 text-amber-900 rounded-l-md flex justify-between items-center">
                   <p className="font-bold">در حال ویرایش فاکتور: <span className="font-mono">{editingSaleInvoiceId}</span></p>
                   <button onClick={handleCancelEdit} className="flex items-center text-sm font-semibold text-amber-800 hover:text-red-700">
                        <XIcon className="w-4 h-4 ml-1" />
                        لغو ویرایش
                   </button>
                </div>
            )}
            <div className="flex-grow overflow-y-auto -mx-6 px-6">
                {cart.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-slate-500 text-lg">سبد خرید شما خالی است.</p>
                    </div>
                ) : (
                    cart.map((item: CartItem) => (
                       <POSCartItem
                           key={`${item.id}-${item.type}`}
                           item={item}
                           isEditingPrice={editingPriceItemId === `${item.id}-${item.type}`}
                           storeSettings={storeSettings}
                           hasPermission={hasPermission}
                           onQuantityChange={(total) => updateQuantity(item.id, item.type, total)}
                           onRemove={() => removeFromCart(item.id, item.type)}
                           onStartPriceEdit={() => setEditingPriceItemId(`${item.id}-${item.type}`)}
                           onSavePrice={(newPrice) => {
                               updateCartItemFinalPrice(item.id, item.type, newPrice);
                               setEditingPriceItemId(null);
                           }}
                           onCancelPriceEdit={() => setEditingPriceItemId(null)}
                       />
                    ))
                )}
            </div>
            <div className="border-t-2 border-gray-200/60 pt-4 mt-4">
                <div className="mb-4">
                    <label htmlFor="customer-select" className="text-md font-semibold text-slate-700">مشتری (برای فروش نسیه)</label>
                     <select id="customer-select" value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)} className="w-full p-3 mt-2 bg-white/80 border-2 border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 form-input" disabled={!hasPermission('pos:create_credit_sale')}>
                        <option value="">فروش نقدی</option>
                        {customers.map((c: Customer) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div className="flex justify-between items-center text-2xl font-bold mb-5 text-slate-800">
                    <span>مبلغ کل:</span>
                    <span className="text-blue-600">{formatCurrency(totalAmount, storeSettings)}</span>
                </div>
                <button onClick={completeSale} className="w-full p-4 bg-blue-600 text-white font-bold text-xl rounded-lg shadow-lg hover:shadow-xl hover:bg-blue-700 transition-all duration-300 transform btn-primary disabled:bg-gray-400 disabled:shadow-none disabled:hover:translate-y-0" disabled={cart.length === 0 || !hasPermission('pos:create_invoice')}>
                     {editingSaleInvoiceId ? 'بروزرسانی فاکتور' : 'ثبت فاکتور'}
                </button>
            </div>
        </>
        )}

        {activeTab === 'invoices' && (
            <div className="flex flex-col h-full">
                 <div className="mb-4 p-2 bg-slate-100/50 rounded-lg">
                    <DateRangeFilter onFilterChange={(start: Date, end: Date) => setInvoiceDateRange({ start, end })} />
                </div>
                <div className="flex-grow overflow-y-auto -mx-6 px-6">
                     {filteredInvoices.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-slate-500 text-lg">در این بازه زمانی فاکتوری ثبت نشده است.</p>
                        </div>
                     ) : (
                        filteredInvoices.map((invoice: SaleInvoice) => (
                            <div key={invoice.id} className="flex items-center justify-between mb-4 p-4 bg-white/80 rounded-xl shadow-sm border border-gray-200/50">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-mono font-bold text-slate-800 text-lg">{invoice.id}</p>
                                        {invoice.type === 'return' && <span className="text-xs font-bold bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full">مرجوعی</span>}
                                    </div>
                                    <div className="text-md text-blue-600 font-bold">
                                        {formatCurrency(invoice.totalAmount, storeSettings)}
                                        {Number(invoice.totalDiscount) > 0 && (
                                            <span className="text-xs text-green-600 font-semibold mr-2">(تخفیف: {formatCurrency(invoice.totalDiscount, storeSettings)})</span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-500">{new Date(invoice.timestamp).toLocaleString('fa-IR')}</p>
                                </div>
                                <div className="flex items-center space-x-2 space-x-reverse">
                                    <button onClick={() => handlePrintInvoice(invoice.id)} className="p-2 rounded-full text-gray-500 hover:text-green-600 hover:bg-green-100/50 transition-colors"><PrintIcon className="w-6 h-6"/></button>
                                    {hasPermission('pos:edit_invoice') && invoice.type === 'sale' && <button onClick={() => handleEditInvoice(invoice.id)} className="p-2 rounded-full text-gray-500 hover:text-blue-600 hover:bg-blue-100/50 transition-colors"><EditIcon className="w-6 h-6"/></button>}
                                    {invoice.type === 'sale' && <button onClick={() => handleOpenReturnModal(invoice)} className="p-2 rounded-full text-gray-500 hover:text-orange-600 hover:bg-orange-100/50 transition-colors" title="مرجوعی"><PlusIcon className="w-6 h-6 transform rotate-45" /></button>}
                                </div>
                            </div>
                        ))
                     )}
                </div>
            </div>
        )}
        {activeTab === 'services' && (
             <div className="flex-grow overflow-y-auto -mx-6 px-6">
                 {services.length === 0 ? (
                    <div className="flex items-center justify-center h-full flex-col">
                        <p className="text-slate-500 text-lg">هیچ خدمتی تعریف نشده است.</p>
                        <p className="text-slate-500 text-sm">به بخش تنظیمات بروید تا خدمات جدید اضافه کنید.</p>
                    </div>
                 ) : (
                    services.map((service: Service) => (
                        <div key={service.id} onClick={() => {addToCart(service, 'service'); setActiveTab('cart'); setMobileView('cart');}} className="flex items-center justify-between mb-4 p-4 bg-white/80 rounded-xl shadow-sm border border-gray-200/50 cursor-pointer hover:bg-blue-50 transition-colors">
                            <div>
                                <p className="font-bold text-slate-800 text-lg">{service.name}</p>
                            </div>
                            <div className="text-lg font-bold text-green-600">
                                {formatCurrency(service.price, storeSettings)}
                            </div>
                        </div>
                    ))
                 )}
            </div>
        )}
    </>
);

const ReturnModal: React.FC<{ invoice: SaleInvoice, onClose: () => void, onSubmit: (returnItems: { id: string, type: 'product' | 'service', quantity: number }[]) => void }> = ({ invoice, onClose, onSubmit }) => {
    const [returnQuantities, setReturnQuantities] = useState<{[key: string]: number}>({});

    const handleQuantityChange = (item: CartItem, quantity: number) => {
        const key = `${item.id}-${item.type}`;
        const newQuantity = Math.max(0, Math.min(quantity, item.quantity));
        setReturnQuantities(prev => ({...prev, [key]: newQuantity}));
    };
    
    const handleSubmit = () => {
        const returnItems = Object.entries(returnQuantities)
            .filter(([, qty]) => Number(qty) > 0)
            .map(([key, qty]) => {
                // FIX: Use lastIndexOf to handle IDs that might contain hyphens.
                const lastDashIndex = key.lastIndexOf('-');
                const id = key.substring(0, lastDashIndex);
                const type = key.substring(lastDashIndex + 1);
                return { id, type: type as 'product' | 'service', quantity: Number(qty) };
            });
        onSubmit(returnItems);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-animate">
            <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-2xl border border-gray-200/80 w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="flex-shrink-0 flex justify-between items-center pb-4 border-b">
                    <h2 className="text-xl font-bold">ثبت مرجوعی برای فاکتور <span className="font-mono">{invoice.id}</span></h2>
                    <button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-200/50"><XIcon /></button>
                </div>
                <div className="flex-grow overflow-y-auto pt-4 -mx-2 px-2">
                    <p className="text-sm text-slate-600 mb-4">تعداد کالاهایی که مشتری مرجوع کرده است را وارد کنید.</p>
                    <div className="space-y-4">
                        {invoice.items.map(item => {
                            const key = `${item.id}-${item.type}`;
                            return (
                                <div key={key} className="flex items-center justify-between p-3 bg-white/70 rounded-lg border">
                                    <div>
                                        <p className="font-semibold">{item.name}</p>
                                        <p className="text-xs text-slate-500">خریداری شده: {item.quantity} عدد</p>
                                    </div>
                                    <PackageUnitInput
                                        totalUnits={returnQuantities[key] || 0}
                                        itemsPerPackage={item.type === 'product' ? (item as InvoiceItem).itemsPerPackage || 1 : 1}
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


const POS: React.FC = () => {
    const context = useAppContext();
    const { 
        products, 
        saleInvoices, 
        customers, 
        services,
        cart,
        addToCart: contextAddToCart,
        updateCartItemQuantity: contextUpdateQuantity,
        removeFromCart: contextRemoveFromCart,
        updateCartItemFinalPrice: contextUpdateCartItemFinalPrice,
        addSaleReturn,
        storeSettings,
        currentUser
    } = context;
    
    const [searchTerm, setSearchTerm] = useState('');
    const [toast, setToast] = useState('');
    const [activeTab, setActiveTab] = useState<'cart' | 'invoices' | 'services'>('cart');
    const [mobileView, setMobileView] = useState<'products' | 'cart'>('products');
    const [invoiceToPrint, setInvoiceToPrint] = useState<SaleInvoice | null>(null);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [memoImages, setMemoImages] = useState<SalesMemoImage[]>([]);
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const memoFileInputRef = useRef<HTMLInputElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const searchContainerRef = useRef<HTMLDivElement>(null);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [recognitionLang, setRecognitionLang] = useState<'fa-IR' | 'en-US'>('fa-IR');
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const [editingPriceItemId, setEditingPriceItemId] = useState<string | null>(null);
    const [invoiceDateRange, setInvoiceDateRange] = useState<{ start: Date, end: Date }>({ start: new Date(), end: new Date() });
    const [isBarcodeModeActive, setIsBarcodeModeActive] = useState(false);
    const barcodeBuffer = useRef('');
    const barcodeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [returnModalInvoice, setReturnModalInvoice] = useState<SaleInvoice | null>(null);
    // FIX: Add a ref to control the recognition loop safely, preventing race conditions.
    const shouldRestartRecognition = useRef(false);


    useEffect(() => { loadMemoImages(); }, []);
    
    const loadMemoImages = async () => {
        const images = await db.getAllMemoImages();
        setMemoImages(images);
    };
    
    const showToast = (message: string) => {
        setToast(message);
        setTimeout(() => setToast(''), 4000);
    };

    const processBarcode = useCallback((scannedCode: string) => {
        const product = products.find(p => p.barcode === scannedCode);
        if (product) {
            const result = contextAddToCart(product, 'product');
            if(result.success) {
                showToast(`"${product.name}" اضافه شد.`);
            } else if (result.message) {
                showToast(result.message);
            }
        } else {
            showToast(`محصولی با بارکد "${scannedCode}" یافت نشد.`);
        }
    }, [products, contextAddToCart]);


    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isBarcodeModeActive) return;

            const isModalOpen = document.querySelector('.modal-animate');
            if (isModalOpen) return;

            if (e.key === 'Enter') {
                if (barcodeBuffer.current.length > 2) {
                    processBarcode(barcodeBuffer.current);
                }
                barcodeBuffer.current = '';
                e.preventDefault();
            } else if (e.key.length === 1) { 
                barcodeBuffer.current += e.key;
                e.preventDefault();
            }

            if (barcodeTimeout.current) clearTimeout(barcodeTimeout.current);
            barcodeTimeout.current = setTimeout(() => {
                if (barcodeBuffer.current.length > 2) {
                    processBarcode(barcodeBuffer.current);
                }
                barcodeBuffer.current = '';
            }, 100);
        };
        
        if (isBarcodeModeActive) {
            document.addEventListener('keydown', handleKeyDown);
            showToast("حالت فروش با اسکنر فعال شد.");
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            if (barcodeTimeout.current) clearTimeout(barcodeTimeout.current);
        };
    }, [isBarcodeModeActive, processBarcode]);


    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('Speech Recognition is not supported by this browser.');
            return;
        }

        if (!recognitionRef.current) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = true;

            recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
                const transcript = Array.from(event.results)
                    .map(result => result[0])
                    .map(result => result.transcript)
                    .join('');
                setSearchTerm(transcript.trim());
            };
            
            // FIX: This handler now restarts recognition if it's supposed to be active,
            // creating a continuous listening experience without manual toggling for each search.
            recognitionRef.current.onend = () => {
                if (shouldRestartRecognition.current) {
                    recognitionRef.current?.start();
                }
            };

            recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
                console.error('Speech recognition error:', event.error);
                if (event.error !== 'no-speech' && event.error !== 'aborted') {
                    showToast(`خطای گفتار: ${event.error}`);
                }
                setIsListening(false);
                shouldRestartRecognition.current = false;
            };
        }
        
        recognitionRef.current.lang = recognitionLang;

    }, [recognitionLang]);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                setIsSearchFocused(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => { document.removeEventListener('mousedown', handleClickOutside); };
    }, []);

    const toggleListening = () => {
        if (!recognitionRef.current) {
            showToast("تشخیص گفتار در این مرورگر پشتیبانی نمی‌شود.");
            return;
        }
        
        // FIX: The logic is now based on the desired state. It tells the `onend` handler
        // whether or not to restart, creating a robust loop that the user controls.
        if (isListening) {
            // User wants to turn it OFF.
            shouldRestartRecognition.current = false;
            recognitionRef.current.stop();
            setIsListening(false);
        } else {
            // User wants to turn it ON.
            setSearchTerm('');
            shouldRestartRecognition.current = true;
            recognitionRef.current.start();
            setIsListening(true);
        }
    };
    
    const toggleLanguage = () => {
        setRecognitionLang(prev => prev === 'fa-IR' ? 'en-US' : 'fa-IR');
    };

    const addToCart = (itemToAdd: Product | Service, type: 'product' | 'service') => {
      const result = contextAddToCart(itemToAdd, type);
      if(result.message) showToast(result.message);
      if(result.success) setSearchTerm('');
    };

    const handleDropdownItemClick = (product: Product) => {
        addToCart(product, 'product');
        setSearchTerm('');
        searchInputRef.current?.focus();
    };
    
    const dropdownProducts = useMemo(() => {
        if (searchTerm.trim() === '') return [];
        return products
            .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .slice(0, 7);
    }, [products, searchTerm]);

    const totalAmount = cart.reduce((total, item) => {
        const price = (item.type === 'product' && item.finalPrice !== undefined) ? item.finalPrice : (item.type === 'product' ? item.salePrice : item.price);
        return total + price * item.quantity;
    }, 0);

    const completeSale = () => {
        if (!currentUser) {
            showToast("خطا: کاربر فعلی مشخص نیست.");
            return;
        }
        const result = context.completeSale(currentUser.username, selectedCustomerId || undefined);
        showToast(result.message);

        if (result.success && result.invoice) {
            if (!context.editingSaleInvoiceId) {
                setInvoiceToPrint(result.invoice);
            }
            setActiveTab('invoices');
            setSelectedCustomerId('');
            setMobileView('cart');
        }
    }

    const handleEditInvoice = (invoiceId: string) => {
        const result = context.beginEditSale(invoiceId);
        showToast(result.message);
        if (result.success) {
            setSelectedCustomerId(result.customerId || '');
            setActiveTab('cart');
            setMobileView('cart');
        }
    };

    const handlePrintInvoice = (invoiceId: string) => {
        const invoice = saleInvoices.find(inv => inv.id === invoiceId);
        if (invoice) {
            setInvoiceToPrint(invoice);
        }
    };

    const handleTakePhotoClick = () => {
        memoFileInputRef.current?.click();
    };

    const handlePhotoTaken = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const imageData = reader.result as string;
                await db.addMemoImage(imageData);
                showToast("یادداشت تصویری با موفقیت ذخیره شد.");
                await loadMemoImages();
            };
            reader.readAsDataURL(file);
        }
        event.target.value = '';
    };
    
    const handleDeleteMemoImage = async (id: number) => {
        await db.deleteMemoImage(id);
        showToast("یادداشت تصویری حذف شد.");
        await loadMemoImages();
    };

    const filteredInvoices = useMemo(() => {
        if (!invoiceDateRange.start || !invoiceDateRange.end) return [];
        const startTime = invoiceDateRange.start.getTime();
        const endTime = invoiceDateRange.end.getTime();

        return saleInvoices
            .filter(inv => {
                const invTime = new Date(inv.timestamp).getTime();
                return invTime >= startTime && invTime <= endTime;
            })
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [saleInvoices, invoiceDateRange]);
    
    const handleOpenReturnModal = (invoice: SaleInvoice) => {
        setReturnModalInvoice(invoice);
    };

    const handleReturnSubmit = (returnItems: { id: string; type: 'product' | 'service'; quantity: number }[]) => {
        if (returnModalInvoice && currentUser) {
            const result = addSaleReturn(returnModalInvoice.id, returnItems, currentUser.username);
            showToast(result.message);
            if (result.success) {
                setReturnModalInvoice(null);
            }
        }
    };

    return (
        <div className="h-full">
            {toast && <Toast message={toast} onClose={() => setToast('')} />}
            {invoiceToPrint && <PrintPreviewModal invoice={invoiceToPrint} onClose={() => setInvoiceToPrint(null)} />}
            {isGalleryOpen && (
                <FloatingGallery 
                    images={memoImages}
                    onClose={() => setIsGalleryOpen(false)}
                    onDelete={handleDeleteMemoImage}
                />
            )}
            {returnModalInvoice && (
                <ReturnModal invoice={returnModalInvoice} onClose={() => setReturnModalInvoice(null)} onSubmit={handleReturnSubmit} />
            )}
            
            <div className="md:flex h-full bg-transparent">
                {/* Product View */}
                <div className={`w-full md:w-1/2 p-4 md:p-6 flex-col ${mobileView === 'products' ? 'flex' : 'hidden'} md:flex h-full`}>
                    <ProductSide 
                      {...{
                        searchContainerRef, memoFileInputRef, searchInputRef, searchTerm, setSearchTerm,
                        setIsSearchFocused, handleTakePhotoClick, handlePhotoTaken, isBarcodeModeActive,
                        setIsBarcodeModeActive, isListening, toggleListening, recognitionLang, toggleLanguage,
                        isSearchFocused, dropdownProducts, handleDropdownItemClick,
                        addToCart, storeSettings,
                        // MiniCart props
                        cart, editingPriceItemId, setEditingPriceItemId, 
                        updateCartItemQuantity: contextUpdateQuantity, removeFromCart: contextRemoveFromCart, 
                        updateCartItemFinalPrice: contextUpdateCartItemFinalPrice, hasPermission: context.hasPermission
                      }}
                    />
                </div>

                {/* Cart View */}
                <div className={`w-full md:w-1/2 bg-white/60 backdrop-blur-xl p-4 md:p-6 flex-col h-full border-r border-gray-200/60 md:shadow-2xl ${mobileView === 'cart' ? 'flex' : 'hidden'} md:flex`}>
                    <CartSide 
                       {...{
                         activeTab, setActiveTab, cart, filteredInvoices, services, setIsGalleryOpen, memoImages,
                         editingSaleInvoiceId: context.editingSaleInvoiceId, handleCancelEdit: context.cancelEditSale, updateQuantity: contextUpdateQuantity, 
                         removeFromCart: contextRemoveFromCart, editingPriceItemId,
                         setEditingPriceItemId, updateCartItemFinalPrice: contextUpdateCartItemFinalPrice, hasPermission: context.hasPermission, 
                         selectedCustomerId, setSelectedCustomerId, customers, totalAmount, completeSale, setInvoiceDateRange,
                         handlePrintInvoice, handleEditInvoice, storeSettings, setMobileView, addToCart, handleOpenReturnModal
                       }}
                    />
                </div>
            </div>
            
             {/* Mobile Tab Navigator */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-gray-200/60 flex justify-around p-2 z-30">
                 <button onClick={() => setMobileView('products')} className={`py-2 px-6 font-bold text-lg rounded-lg transition-colors ${mobileView === 'products' ? 'text-blue-600 bg-blue-100/70' : 'text-slate-500'}`}>
                    فروشگاه
                </button>
                 <button onClick={() => setMobileView('cart')} className={`py-2 px-6 font-bold text-lg rounded-lg relative transition-colors ${mobileView === 'cart' ? 'text-blue-600 bg-blue-100/70' : 'text-slate-500'}`}>
                    سبد خرید
                    {cart.length > 0 && <span className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">{cart.length}</span>}
                </button>
            </div>

        </div>
    );
};

export default POS;