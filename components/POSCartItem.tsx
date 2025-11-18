import React, { useState } from 'react';
import type { InvoiceItem, CartItem, StoreSettings } from '../types';
import { EditIcon, TrashIcon, CheckIcon, XIcon } from './icons';
import PackageUnitInput from './PackageUnitInput';
import { formatCurrency } from '../utils/formatters';

const CartItemPriceEditor: React.FC<{ item: InvoiceItem, onSave: (price: number) => void, onCancel: () => void }> = ({ item, onSave, onCancel }) => {
    const [price, setPrice] = useState(String(Math.round(item.finalPrice !== undefined ? item.finalPrice : item.salePrice)));
    
    const discountPercent = item.salePrice > 0 
        ? (((item.salePrice - Number(price)) / item.salePrice) * 100)
        : 0;

    const handleSave = () => {
        onSave(Number(price));
    };
    
    return (
        <div className="bg-blue-50/70 p-3 rounded-lg mt-2 border border-blue-200">
            <div className="flex items-center gap-4">
                <div className="flex-grow">
                    <label className="text-xs font-semibold text-slate-600">قیمت نهایی</label>
                    <input 
                        type="text" 
                        inputMode="numeric"
                        value={price}
                        onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ''))}
                        className="w-full p-2 text-lg font-bold border-2 border-blue-300 rounded-md form-input"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                    />
                </div>
                <div className="text-center">
                    <span className="text-xs font-semibold text-slate-600">تخفیف</span>
                    <p className={`font-bold text-lg ${discountPercent > 0 ? 'text-green-600' : discountPercent < 0 ? 'text-red-600' : 'text-slate-700'}`}>
                       {Math.abs(discountPercent).toFixed(1)}%
                    </p>
                </div>
                 <div className="flex self-end gap-1">
                    <button onClick={handleSave} className="p-2 bg-green-500 text-white rounded-full hover:bg-green-600"><CheckIcon className="w-5 h-5"/></button>
                    <button onClick={onCancel} className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600"><XIcon className="w-5 h-5"/></button>
                </div>
            </div>
            <p className="text-xs text-slate-500 mt-1 text-right">قیمت اصلی: <s className="font-mono">{Math.round(item.salePrice).toLocaleString('fa-IR')}</s></p>
        </div>
    );
};


interface POSCartItemProps {
    item: CartItem;
    isEditingPrice: boolean;
    storeSettings: StoreSettings;
    hasPermission: (permission: string) => boolean;
    onQuantityChange: (newQuantity: number) => void;
    onRemove: () => void;
    onStartPriceEdit: () => void;
    onSavePrice: (newPrice: number) => void;
    onCancelPriceEdit: () => void;
}

const POSCartItem: React.FC<POSCartItemProps> = ({
    item, isEditingPrice, storeSettings, hasPermission, onQuantityChange, onRemove, onStartPriceEdit, onSavePrice, onCancelPriceEdit
}) => {
    
    const price = (item.type === 'product' && item.finalPrice !== undefined) ? item.finalPrice : (item.type === 'product' ? item.salePrice : item.price);

    return (
        <div className={`mb-4 p-4 bg-white/80 rounded-xl shadow-sm border border-gray-200/50 transition-all duration-300 ${isEditingPrice ? 'ring-2 ring-blue-500' : ''}`}>
            <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 text-lg truncate" title={item.name}>{item.name}</p>
                    <div className="text-md text-slate-500 flex items-center gap-2">
                        {item.type === 'product' && item.finalPrice !== undefined && item.finalPrice !== item.salePrice ? (
                            <>
                                <s className="text-red-500">{formatCurrency(item.salePrice, storeSettings)}</s>
                                <span className="font-bold text-green-600">{formatCurrency(item.finalPrice, storeSettings)}</span>
                            </>
                        ) : (
                            <span>{formatCurrency(price, storeSettings)}</span>
                        )}
                         {item.type === 'product' && !isEditingPrice && hasPermission('pos:apply_discount') && <button onClick={onStartPriceEdit} className="p-1 rounded-full hover:bg-slate-200/50"><EditIcon className="w-4 h-4 text-slate-500"/></button>}
                    </div>
                </div>
                <div className="flex items-start space-x-3 space-x-reverse">
                   {item.type === 'product' ? (
                        <PackageUnitInput 
                            totalUnits={item.quantity}
                            itemsPerPackage={(item as InvoiceItem).itemsPerPackage || 1}
                            onChange={onQuantityChange}
                        />
                   ) : (
                        <PackageUnitInput 
                            totalUnits={item.quantity}
                            itemsPerPackage={1} // Services are always individual units
                            onChange={onQuantityChange}
                        />
                   )}
                    <button onClick={onRemove} className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-100 transition-colors">
                       <TrashIcon className="w-6 h-6" />
                    </button>
                </div>
            </div>
            {isEditingPrice && item.type === 'product' && (
                <CartItemPriceEditor
                    item={item as InvoiceItem}
                    onSave={onSavePrice}
                    onCancel={onCancelPriceEdit}
                />
            )}
        </div>
    );
};

export default POSCartItem;
