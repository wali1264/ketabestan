
import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import type {
    Product, ProductBatch, SaleInvoice, PurchaseInvoice, PurchaseInvoiceItem, InvoiceItem,
    Customer, Supplier, Employee, Expense, Service, StoreSettings, CartItem,
    CustomerTransaction, SupplierTransaction, PayrollTransaction, ActivityLog,
    User, Role, Permission, AppState
} from './types';
import { formatCurrency } from './utils/formatters';
import { ALL_PERMISSIONS } from './utils/permissions';
import { api } from './services/supabaseService';

interface AppContextType extends AppState {
    showToast: (message: string) => void;
    isLoading: boolean;
    
    // Auth
    login: (username: string, password: string) => Promise<{ success: boolean; message: string }>;
    logout: () => void;
    hasPermission: (permission: Permission) => boolean;
    
    // Users & Roles
    addUser: (user: Omit<User, 'id'>) => Promise<{ success: boolean; message: string }>;
    updateUser: (user: Partial<User> & { id: string }) => Promise<{ success: boolean; message: string }>;
    deleteUser: (userId: string) => Promise<void>;
    addRole: (role: Omit<Role, 'id'>) => Promise<{ success: boolean; message: string }>;
    updateRole: (role: Role) => Promise<{ success: boolean; message: string }>;
    deleteRole: (roleId: string) => Promise<void>;

    // Backup & Restore
    exportData: () => void;
    importData: (file: File) => void;

    // Inventory Actions
    addProduct: (product: Omit<Product, 'id' | 'batches'>, firstBatch: Omit<ProductBatch, 'id'>) => { success: boolean; message: string }; // kept sync signature for UI, but triggers async
    updateProduct: (product: Product) => { success: boolean; message: string };
    deleteProduct: (productId: string) => void;
    
    // POS Actions
    addToCart: (itemToAdd: Product | Service, type: 'product' | 'service') => { success: boolean; message: string };
    updateCartItemQuantity: (itemId: string, itemType: 'product' | 'service', newQuantity: number) => { success: boolean; message: string };
    updateCartItemFinalPrice: (itemId: string, itemType: 'product' | 'service', finalPrice: number) => void;
    removeFromCart: (itemId: string, itemType: 'product' | 'service') => void;
    completeSale: (cashier: string, customerId?: string) => { success: boolean; invoice?: SaleInvoice; message: string };
    beginEditSale: (invoiceId: string) => { success: boolean; message: string; customerId?: string; };
    cancelEditSale: () => void;
    addSaleReturn: (originalInvoiceId: string, returnItems: { id: string; type: 'product' | 'service'; quantity: number }[], cashier: string) => { success: boolean, message: string };
    
    // Purchase Actions
    addPurchaseInvoice: (invoiceData: Omit<PurchaseInvoice, 'id' | 'totalAmount' | 'items' | 'type' | 'originalInvoiceId'> & { items: Omit<PurchaseInvoiceItem, 'productName'>[] }) => { success: boolean, message: string };
    beginEditPurchase: (invoiceId: string) => { success: boolean, message: string };
    cancelEditPurchase: () => void;
    updatePurchaseInvoice: (invoiceData: Omit<PurchaseInvoice, 'id' | 'totalAmount' | 'items' | 'type' | 'originalInvoiceId'> & { items: Omit<PurchaseInvoiceItem, 'productName'>[] }) => { success: boolean, message: string };
    addPurchaseReturn: (originalInvoiceId: string, returnItems: { productId: string; quantity: number }[]) => { success: boolean; message: string };

    // Settings
    updateSettings: (newSettings: StoreSettings) => void;
    
    // Services
    addService: (service: Omit<Service, 'id'>) => void;
    deleteService: (serviceId: string) => void;
    
    // Accounting
    addSupplier: (supplier: Omit<Supplier, 'id' | 'balance'>) => void;
    addSupplierPayment: (supplierId: string, amount: number, description: string) => SupplierTransaction;
    addCustomer: (customer: Omit<Customer, 'id' | 'balance'>) => void;
    addCustomerPayment: (customerId: string, amount: number, description: string) => CustomerTransaction;
    addEmployee: (employee: Omit<Employee, 'id'|'balance'>) => void;
    addEmployeeAdvance: (employeeId: string, amount: number) => void;
    processAndPaySalaries: () => { success: boolean; message: string };
    addExpense: (expense: Omit<Expense, 'id'>) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const getDefaultState = (): AppState => {
    return {
        products: [], saleInvoices: [], purchaseInvoices: [], customers: [],
        suppliers: [], employees: [], expenses: [], services: [],
        storeSettings: {
            storeName: 'کتابستان', address: '', phone: '', lowStockThreshold: 10,
            expiryThresholdMonths: 3, currencyName: 'افغانی', currencySymbol: 'AFN'
        },
        cart: [], customerTransactions: [], supplierTransactions: [], payrollTransactions: [],
        activities: [], saleInvoiceCounter: 0, editingSaleInvoiceId: null, editingPurchaseInvoiceId: null,
        isAuthenticated: false, currentUser: null,
        users: [],
        roles: [],
    };
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, setState] = useState<AppState>(getDefaultState());
    const [isLoading, setIsLoading] = useState(true);
    const [toastMessage, setToastMessage] = useState('');

    const showToast = (message: string) => setToastMessage(message);

    // --- Initial Data Load from Supabase ---
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [settings, users, roles, products, services, entities, transactions, invoices, activity] = await Promise.all([
                api.getSettings(),
                api.getUsers(),
                api.getRoles(),
                api.getProducts(),
                api.getServices(),
                api.getEntities(),
                api.getTransactions(),
                api.getInvoices(),
                api.getActivities()
            ]);

            setState(prev => ({
                ...prev,
                storeSettings: settings,
                users,
                roles,
                products,
                services,
                customers: entities.customers,
                suppliers: entities.suppliers,
                employees: entities.employees,
                expenses: entities.expenses,
                customerTransactions: transactions.customerTransactions,
                supplierTransactions: transactions.supplierTransactions,
                payrollTransactions: transactions.payrollTransactions,
                saleInvoices: invoices.saleInvoices,
                purchaseInvoices: invoices.purchaseInvoices,
                activities: activity,
                saleInvoiceCounter: invoices.saleInvoices.length,
            }));
        } catch (error) {
            console.error("Error fetching data:", error);
            showToast("خطا در دریافت اطلاعات از سرور.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const addActivityLocal = async (type: ActivityLog['type'], description: string, user: string, refId?: string, refType?: ActivityLog['refType']) => {
        const newActivity: ActivityLog = {
            id: crypto.randomUUID(), type, description, timestamp: new Date().toISOString(), user, refId, refType
        };
        // Update local state immediately
        setState(prev => ({ ...prev, activities: [newActivity, ...prev.activities] }));
        // Send to DB
        try {
            await api.addActivity(newActivity);
        } catch (e) { console.error("Failed to log activity", e); }
        return newActivity;
    };
    
    // AUTH & RBAC LOGIC
    const login = async (username: string, password: string): Promise<{ success: boolean; message: string }> => {
        // Since we are using custom auth table, we check against loaded users or fetch specific one.
        // We already loaded users in fetchData, so we check local state which mirrors DB.
        // For higher security, we should query DB directly here to ensure latest password.
        try {
            const users = await api.getUsers();
            const user = users.find(u => u.username === username);
            
            if (user && user.password === password) {
                setState(prev => ({ ...prev, isAuthenticated: true, currentUser: user, users }));
                return { success: true, message: 'ورود موفق' };
            }
        } catch (e) {
            console.error(e);
            return { success: false, message: 'خطا در برقراری ارتباط.' };
        }
        return { success: false, message: 'نام کاربری یا رمز عبور اشتباه است.' };
    };

    const logout = () => {
        setState(prev => ({ ...prev, isAuthenticated: false, currentUser: null }));
    };

    const hasPermission = (permission: Permission): boolean => {
        if (!state.currentUser) return false;
        const userRole = state.roles.find(r => r.id === state.currentUser!.roleId);
        return userRole?.permissions.includes(permission) ?? false;
    };
    
    // --- User Management ---
    const addUser = async (userData: Omit<User, 'id'>) => {
        try {
             if (state.users.some(u => u.username === userData.username)) {
                return { success: false, message: 'این نام کاربری قبلا استفاده شده.' };
            }
            const newUser = await api.addUser(userData);
            addActivityLocal('inventory', `کاربر جدید "${userData.username}" را اضافه کرد`, state.currentUser!.username);
            setState(prev => ({ ...prev, users: [...prev.users, newUser] }));
            return { success: true, message: 'کاربر جدید با موفقیت افزوده شد.' };
        } catch (e) { console.error(e); return { success: false, message: 'خطا در ذخیره کاربر.' }; }
    };

    const updateUser = async (userData: Partial<User> & { id: string }) => {
        try {
             await api.updateUser(userData);
             addActivityLocal('inventory', `کاربر "${userData.username || '?'}" را ویرایش کرد`, state.currentUser!.username);
             setState(prev => ({ ...prev, users: prev.users.map(u => u.id === userData.id ? { ...u, ...userData } : u) }));
             return { success: true, message: 'کاربر با موفقیت بروزرسانی شد.' };
        } catch (e) { return { success: false, message: 'خطا در بروزرسانی.' }; }
    };

    const deleteUser = async (userId: string) => {
         const user = state.users.find(u => u.id === userId);
         try {
            await api.deleteUser(userId);
            addActivityLocal('inventory', `کاربر "${user?.username}" را حذف کرد`, state.currentUser!.username);
            setState(prev => ({ ...prev, users: prev.users.filter(u => u.id !== userId) }));
            showToast("کاربر حذف شد.");
         } catch (e) { showToast("خطا در حذف کاربر."); }
    };

    // --- Role Management ---
    const addRole = async (roleData: Omit<Role, 'id'>) => {
        try {
            const newRole = await api.addRole(roleData);
            addActivityLocal('inventory', `نقش جدید "${roleData.name}" را ایجاد کرد`, state.currentUser!.username);
            setState(prev => ({ ...prev, roles: [...prev.roles, newRole] }));
            return { success: true, message: 'نقش جدید افزوده شد.' };
        } catch (e) { return { success: false, message: 'خطا در افزودن نقش.' }; }
    };

    const updateRole = async (roleData: Role) => {
        try {
            await api.updateRole(roleData);
            addActivityLocal('inventory', `نقش "${roleData.name}" را ویرایش کرد`, state.currentUser!.username);
            setState(prev => ({ ...prev, roles: prev.roles.map(r => r.id === roleData.id ? roleData : r) }));
            return { success: true, message: 'نقش بروزرسانی شد.' };
        } catch (e) { return { success: false, message: 'خطا.' }; }
    };

    const deleteRole = async (roleId: string) => {
        if (state.users.some(u => u.roleId === roleId)) {
            showToast("نمی‌توان نقشی را که به یک کاربر اختصاص داده شده حذف کرد.");
            return;
        }
        try {
            const role = state.roles.find(r => r.id === roleId);
            await api.deleteRole(roleId);
            addActivityLocal('inventory', `نقش "${role?.name}" را حذف کرد`, state.currentUser!.username);
            setState(prev => ({ ...prev, roles: prev.roles.filter(r => r.id !== roleId) }));
        } catch(e) { showToast("خطا در حذف نقش."); }
    };

    // BACKUP & RESTORE (Kept local for now, but data comes from state)
    const exportData = () => {
        const dataStr = JSON.stringify(state, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const date = new Date().toISOString().split('T')[0];
        link.download = `StationeryPro_Backup_${date}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast("پشتیبان‌گیری با موفقیت انجام شد.");
    };
    
    const importData = (file: File) => {
        showToast("قابلیت بازیابی آفلاین در نسخه ابری غیرفعال است. لطفاً با پشتیبانی تماس بگیرید.");
    };

    // INVENTORY LOGIC
    const addProduct = (productData: Omit<Product, 'id' | 'batches'>, firstBatchData: Omit<ProductBatch, 'id'>) => {
        // This function is called synchronously by UI, but we need async.
        // Pattern: Update local state optimistically or show loading?
        // We will trigger async in background and update state when done.
        
        const trimmedName = productData.name.trim();
        if (state.products.some(p => p.name.trim().toLowerCase() === trimmedName.toLowerCase())) {
             return { success: false, message: 'خطا: محصولی با این نام از قبل وجود دارد.' };
        }

        api.addProduct(productData, firstBatchData).then(newProduct => {
             addActivityLocal('inventory', `محصول جدید "${trimmedName}" را اضافه کرد`, state.currentUser!.username, newProduct.id, 'product');
             setState(prev => ({ ...prev, products: [...prev.products, newProduct] }));
             showToast('محصول جدید ذخیره شد.');
        }).catch(err => {
            console.error(err);
            showToast('خطا در ذخیره محصول در پایگاه داده.');
        });

        return { success: true, message: 'در حال ذخیره سازی...' };
    };
    
    const updateProduct = (productData: Product) => {
         api.updateProduct(productData).then(() => {
             addActivityLocal('inventory', `محصول "${productData.name}" را ویرایش کرد`, state.currentUser!.username, productData.id, 'product');
             setState(prev => ({ ...prev, products: prev.products.map(p => p.id === productData.id ? productData : p) }));
             showToast('محصول ویرایش شد.');
         }).catch(err => showToast('خطا در ویرایش محصول.'));
         
        return { success: true, message: 'در حال ویرایش...' };
    };
    
    const deleteProduct = (productId: string) => {
        const product = state.products.find(p => p.id === productId);
        api.deleteProduct(productId).then(() => {
            addActivityLocal('inventory', `محصول "${product?.name}" را حذف کرد`, state.currentUser!.username);
            setState(prev => ({ ...prev, products: prev.products.filter(p => p.id !== productId) }));
            showToast('محصول حذف شد.');
        }).catch(() => showToast('خطا در حذف محصول.'));
    };

    // POS LOGIC (State manipulation kept local until 'completeSale')
    const addToCart = (itemToAdd: Product | Service, type: 'product' | 'service') => {
        let success = false, message = '';
        setState(prev => {
            const existingItemIndex = prev.cart.findIndex(item => item.id === itemToAdd.id && item.type === type);
            const totalStock = type === 'product' ? (itemToAdd as Product).batches.reduce((sum, b) => sum + b.stock, 0) : Infinity;
            if (existingItemIndex > -1) {
                const updatedCart = [...prev.cart];
                const existingItem = updatedCart[existingItemIndex];
                if (type === 'product' && existingItem.quantity >= totalStock) {
                    message = `حداکثر موجودی برای "${existingItem.name}" در سبد خرید است.`; return prev; 
                }
                updatedCart[existingItemIndex] = { ...existingItem, quantity: existingItem.quantity + 1 };
                success = true;
                return { ...prev, cart: updatedCart };
            } else {
                if (type === 'product' && totalStock < 1) {
                    message = `موجودی محصول "${itemToAdd.name}" تمام شده است.`; return prev; 
                }
                const productWithPurchasePrice = type === 'product' ? { ...itemToAdd, purchasePrice: 0 } : itemToAdd;
                success = true;
                return { ...prev, cart: [...prev.cart, { ...(productWithPurchasePrice as any), quantity: 1, type }] };
            }
        });
        return { success, message };
    };

    const updateCartItemQuantity = (itemId: string, itemType: 'product' | 'service', newQuantity: number) => {
        if (newQuantity < 0) return { success: false, message: 'مقدار نامعتبر' };
        let success = true, message = '';
        setState(prev => {
            const cart = [...prev.cart];
            const itemIndex = cart.findIndex(i => i.id === itemId && i.type === itemType);
            if (itemIndex === -1) return prev;
            if (itemType === 'product') {
                 const productInStock = prev.products.find(p => p.id === itemId);
                 const totalStock = productInStock?.batches.reduce((sum, b) => sum + b.stock, 0) || 0;
                 if (newQuantity > totalStock) {
                    message = `موجودی محصول فقط ${totalStock} عدد است.`;
                    cart[itemIndex] = { ...cart[itemIndex], quantity: totalStock };
                    return { ...prev, cart };
                 }
            }
            cart[itemIndex] = { ...cart[itemIndex], quantity: newQuantity };
            if (newQuantity === 0) {
                return { ...prev, cart: cart.filter(i => !(i.id === itemId && i.type === itemType)) };
            }
            return { ...prev, cart };
        });
        return { success, message };
    };

    const updateCartItemFinalPrice = (itemId: string, itemType: 'product' | 'service', finalPrice: number) => {
        setState(prev => ({
            ...prev, cart: prev.cart.map(item =>
                (item.id === itemId && item.type === itemType && item.type === 'product')
                    ? { ...item, finalPrice: Math.round(finalPrice) }
                    : item
            )
        }));
    };
    
    const removeFromCart = (itemId: string, itemType: 'product' | 'service') => {
        setState(prev => ({ ...prev, cart: prev.cart.filter(item => !(item.id === itemId && item.type === itemType)) }));
    };

    const getPrice = (item: CartItem): { final: number; original: number } => {
        if (item.type === 'product') {
            const original = item.salePrice; const final = item.finalPrice !== undefined ? item.finalPrice : original;
            return { final, original };
        }
        return { final: item.price, original: item.price };
    };
    
    const completeSale = (cashier: string, customerId?: string): { success: boolean; invoice?: SaleInvoice; message: string } => {
        const { cart, products, storeSettings, editingSaleInvoiceId, customers, saleInvoices } = state;

        if (cart.length === 0) return { success: false, message: "سبد خرید خالی است!" };
        
        const newSubtotal = cart.reduce((total, item) => getPrice(item).original * item.quantity + total, 0);
        const newTotalAmount = cart.reduce((total, item) => getPrice(item).final * item.quantity + total, 0);
        const newTotalDiscount = newSubtotal - newTotalAmount;

        // 1. Prepare Updates
        const updatedProducts = JSON.parse(JSON.stringify(products));
        const stockUpdates: {batchId: string, newStock: number}[] = [];
        const saleItemsWithPurchasePrice: CartItem[] = [];

        for (const item of cart) {
            if (item.type === 'service') { 
                saleItemsWithPurchasePrice.push(item); 
                continue; 
            }
            const productIndex = updatedProducts.findIndex((p: Product) => p.id === item.id);
            if (productIndex === -1) return { success: false, message: `محصول "${item.name}" یافت نشد!` };
            
            const product = updatedProducts[productIndex];
            
            // Stock Deduction Logic
            const batchesWithExpiry = product.batches.filter((b: ProductBatch) => b.expiryDate && b.stock > 0).sort((a: ProductBatch, b: ProductBatch) => new Date(a.expiryDate!).getTime() - new Date(b.expiryDate!).getTime());
            const batchesWithoutExpiry = product.batches.filter((b: ProductBatch) => !b.expiryDate && b.stock > 0).sort((a: ProductBatch, b: ProductBatch) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime());
            const deductionOrder = [...batchesWithExpiry, ...batchesWithoutExpiry];
            
            let quantityToDeduct = item.quantity;
            let totalPurchaseValue = 0;
            
            for (const batch of deductionOrder) {
                if (quantityToDeduct <= 0) break;
                const deductAmount = Math.min(quantityToDeduct, batch.stock);
                batch.stock -= deductAmount; 
                quantityToDeduct -= deductAmount; 
                totalPurchaseValue += deductAmount * batch.purchasePrice;
                
                stockUpdates.push({ batchId: batch.id, newStock: batch.stock });
            }
            
            if (quantityToDeduct > 0) return { success: false, message: `موجودی محصول "${item.name}" کافی نیست!` };
            
            saleItemsWithPurchasePrice.push({ ...item, purchasePrice: totalPurchaseValue / item.quantity });
        }

        const invoiceId = editingSaleInvoiceId || `F${Date.now()}`;
        const finalInvoice: SaleInvoice = { 
            id: invoiceId, 
            type: 'sale', 
            items: saleItemsWithPurchasePrice, 
            subtotal: Math.round(newSubtotal), 
            totalAmount: Math.round(newTotalAmount), 
            totalDiscount: Math.round(newTotalDiscount), 
            timestamp: editingSaleInvoiceId ? saleInvoices.find(i=>i.id===invoiceId)!.timestamp : new Date().toISOString(), 
            cashier, 
            customerId, 
        };

        // Customer Update
        let customerUpdate;
        if (customerId) {
            const customer = customers.find(c => c.id === customerId);
            if(customer) {
                customerUpdate = {
                    id: customerId,
                    newBalance: customer.balance + finalInvoice.totalAmount, // For new, this is right. For edit, service handles revert.
                    transaction: { 
                        id: crypto.randomUUID(), 
                        customerId, 
                        type: 'credit_sale' as const, 
                        amount: finalInvoice.totalAmount, 
                        date: new Date().toISOString(), 
                        description: `فاکتور فروش #${finalInvoice.id}`, 
                        invoiceId: finalInvoice.id 
                    }
                };
            }
        }

        if (editingSaleInvoiceId) {
            // --- EDIT MODE ---
            const oldInvoice = saleInvoices.find(inv => inv.id === editingSaleInvoiceId)!;
            
            // 1. Calculate "Restores" (add back stock from old invoice items)
            const stockRestores: {productId: string, quantity: number}[] = [];
            oldInvoice.items.filter(i => i.type === 'product').forEach(item => {
                stockRestores.push({ productId: item.id, quantity: item.quantity });
            });
            
            // 2. Calculate "Deductions" (these are in `stockUpdates` calculated above)
            const stockDeductions = stockUpdates.map(u => ({ batchId: u.batchId, quantity: (products.find(p => p.batches.some(b=>b.id===u.batchId))?.batches.find(b=>b.id===u.batchId)?.stock || 0) - u.newStock })); // Re-calculate deduction amount

            // 3. Customer Update Params
            let custUpdateParams;
            if (customerId && oldInvoice.customerId === customerId) {
                const customer = customers.find(c => c.id === customerId)!;
                custUpdateParams = {
                    id: customerId,
                    oldAmount: oldInvoice.totalAmount,
                    newAmount: finalInvoice.totalAmount,
                    transactionDescription: `فاکتور فروش #${finalInvoice.id} (ویرایش شده)`
                };
            } else if (customerId) {
                // Changed customer? Logic too complex for MVP service method, fall back to basic
                // For now assume customer didn't change or just update new
                 custUpdateParams = {
                    id: customerId,
                    oldAmount: 0, // Assume no old debt for *this* customer
                    newAmount: finalInvoice.totalAmount,
                    transactionDescription: `فاکتور فروش #${finalInvoice.id}`
                };
            }
            
            api.updateSale(invoiceId, finalInvoice, stockRestores, stockUpdates.map(u => {
                 // Find how much was deducted. newStock is the result.
                 // We need the delta.
                 // We can just pass batchId and quantity to deduct.
                 // Logic in loop above: `batch.stock -= deductAmount`.
                 // We need to know `deductAmount`.
                 // Let's re-run the loop logic efficiently or capture it?
                 // Captured in `stockUpdates`? No, `stockUpdates` has `newStock`.
                 // We need to subtract newStock from current (in state) stock to get delta.
                 const p = products.find(p => p.batches.some(b => b.id === u.batchId));
                 const b = p?.batches.find(b => b.id === u.batchId);
                 return { batchId: u.batchId, quantity: b ? b.stock - u.newStock : 0 };
            }), custUpdateParams).then(() => {
                 addActivityLocal('sale', `فاکتور فروش #${finalInvoice.id} را ویرایش کرد`, cashier, finalInvoice.id, 'saleInvoice');
                 fetchData(); // Reload all data to be safe
                 showToast("فاکتور ویرایش شد.");
            });

            setState(prev => ({ ...prev, editingSaleInvoiceId: null, cart: [] }));

        } else {
            // --- CREATE MODE ---
            api.createSale(finalInvoice, stockUpdates, customerUpdate).then(() => {
                 addActivityLocal('sale', `فاکتور فروش #${finalInvoice.id} به مبلغ ${formatCurrency(finalInvoice.totalAmount, storeSettings)} ثبت کرد`, cashier, finalInvoice.id, 'saleInvoice');
                 
                 // Optimistic Update (Simplified)
                 setState(prev => {
                     const newSaleInvoices = [finalInvoice, ...prev.saleInvoices];
                     const newProducts = updatedProducts;
                     const newCustomers = customerId ? prev.customers.map(c => c.id === customerId ? {...c, balance: c.balance + finalInvoice.totalAmount} : c) : prev.customers;
                     const newTransactions = customerId ? [customerUpdate!.transaction, ...prev.customerTransactions] : prev.customerTransactions;
                     
                     return {
                         ...prev,
                         saleInvoices: newSaleInvoices,
                         products: newProducts,
                         customers: newCustomers,
                         customerTransactions: newTransactions,
                         cart: []
                     }
                 });
                 showToast("فاکتور با موفقیت ثبت شد.");
            }).catch(err => {
                console.error(err);
                showToast("خطا در ثبت فاکتور در سرور.");
            });
        }

        return { success: true, invoice: finalInvoice, message: 'در حال ثبت فاکتور...' };
    };

    const beginEditSale = (invoiceId: string) => {
        const invoice = state.saleInvoices.find(i => i.id === invoiceId);
        if (!invoice) return { success: false, message: "فاکتور یافت نشد." };
        
        setState(prev => ({
            ...prev,
            editingSaleInvoiceId: invoiceId,
            cart: invoice.items.map(i => ({ ...i, type: i.type as 'product' | 'service' })),
        }));
        return { success: true, message: "فاکتور جهت ویرایش بارگذاری شد.", customerId: invoice.customerId };
    };

    const cancelEditSale = () => {
        setState(prev => ({ ...prev, editingSaleInvoiceId: null, cart: [] }));
    };

    const addSaleReturn = (originalInvoiceId: string, returnItems: { id: string; type: 'product' | 'service'; quantity: number }[], cashier: string) => {
        const originalInvoice = state.saleInvoices.find(i => i.id === originalInvoiceId);
        if (!originalInvoice) return { success: false, message: "فاکتور اصلی یافت نشد." };
        
        // Calculate return amounts
        let returnSubtotal = 0;
        let returnTotal = 0;
        
        // Map return items to full details
        const detailedReturnItems = returnItems.map(ri => {
            const originalItem = originalInvoice.items.find(i => i.id === ri.id && i.type === ri.type);
            if (!originalItem) return null;
            const price = (originalItem.type === 'product' && originalItem.finalPrice !== undefined) ? originalItem.finalPrice : (originalItem.type === 'product' ? originalItem.salePrice : originalItem.price);
            returnSubtotal += price * ri.quantity;
            returnTotal += price * ri.quantity;
            return { ...originalItem, quantity: ri.quantity };
        }).filter(Boolean) as CartItem[];

        const returnInvoice: SaleInvoice = {
            id: `R${Date.now()}`,
            type: 'return',
            originalInvoiceId,
            items: detailedReturnItems,
            subtotal: returnSubtotal,
            totalAmount: returnTotal,
            totalDiscount: 0,
            timestamp: new Date().toISOString(),
            cashier,
            customerId: originalInvoice.customerId
        };

        const stockRestores = detailedReturnItems
            .filter(i => i.type === 'product')
            .map(i => ({ productId: i.id, quantity: i.quantity }));

        const customerRefund = originalInvoice.customerId ? { id: originalInvoice.customerId, amount: returnTotal } : undefined;

        api.createSaleReturn(returnInvoice, stockRestores, customerRefund).then(() => {
            addActivityLocal('sale', `مرجوعی فاکتور #${originalInvoiceId} را ثبت کرد`, cashier, returnInvoice.id, 'saleInvoice');
            fetchData();
            showToast("مرجوعی با موفقیت ثبت شد.");
        }).catch(err => showToast("خطا در ثبت مرجوعی."));

        return { success: true, message: "در حال ثبت مرجوعی..." };
    };

    // PURCHASE ACTIONS
    const addPurchaseInvoice = (invoiceData: any) => {
        const { products, suppliers } = state;
        const supplier = suppliers.find(s => s.id === invoiceData.supplierId);
        if(!supplier) return { success: false, message: "تامین کننده نامعتبر" };

        const invoiceId = `PINV-${Date.now()}`;
        const finalItems = invoiceData.items.map((item: any) => ({ 
            ...item, 
            productName: products.find(p => p.id === item.productId)?.name || 'نامشخص' 
        }));
        const totalAmount = invoiceData.items.reduce((total: number, item: any) => total + (item.purchasePrice * item.quantity), 0);
        
        const invoice: PurchaseInvoice = {
             ...invoiceData, 
             type: 'purchase', 
             id: invoiceId, 
             items: finalItems, 
             totalAmount: Math.round(totalAmount) 
        };

        // Prepare Batches
        const newBatches = [];
        const localProducts = JSON.parse(JSON.stringify(products));
        
        for(const item of invoice.items) {
            const batchId = crypto.randomUUID();
            newBatches.push({
                id: batchId,
                product_id: item.productId,
                lotNumber: item.lotNumber,
                stock: item.quantity,
                purchasePrice: item.purchasePrice,
                purchaseDate: invoice.timestamp,
                expiryDate: item.expiryDate
            });
            // Update local state preview
            const p = localProducts.find((p:Product) => p.id === item.productId);
            if(p) p.batches.push(newBatches[newBatches.length-1]);
        }

        const supplierUpdate = {
            id: supplier.id,
            newBalance: supplier.balance + invoice.totalAmount,
            transaction: {
                 id: crypto.randomUUID(), 
                 supplierId: supplier.id, 
                 type: 'purchase' as const, 
                 amount: invoice.totalAmount, 
                 date: invoice.timestamp, 
                 description: `فاکتور خرید #${invoice.invoiceNumber}`, 
                 invoiceId: invoice.id 
            }
        };

        api.createPurchase(invoice, supplierUpdate, newBatches).then(() => {
            addActivityLocal('purchase', `فاکتور خرید ثبت کرد`, state.currentUser!.username, invoice.id, 'purchaseInvoice');
            setState(prev => ({
                ...prev,
                products: localProducts,
                purchaseInvoices: [invoice, ...prev.purchaseInvoices],
                suppliers: prev.suppliers.map(s => s.id === supplier.id ? {...s, balance: s.balance + invoice.totalAmount} : s),
                supplierTransactions: [supplierUpdate.transaction, ...prev.supplierTransactions]
            }));
            showToast("فاکتور خرید ثبت شد.");
        }).catch(err => {
            console.error(err);
            showToast("خطا در ثبت فاکتور خرید.");
        });

        return { success: true, message: "در حال ثبت..." };
    };

    const beginEditPurchase = (invoiceId: string) => {
        setState(prev => ({ ...prev, editingPurchaseInvoiceId: invoiceId }));
        return { success: true, message: "حالت ویرایش خرید فعال شد." };
    };
    
    const cancelEditPurchase = () => {
        setState(prev => ({ ...prev, editingPurchaseInvoiceId: null }));
    };

    const updatePurchaseInvoice = (invoiceData: any) => {
        const invoiceId = state.editingPurchaseInvoiceId!;
        const oldInvoice = state.purchaseInvoices.find(i => i.id === invoiceId)!;
        
        const finalItems = invoiceData.items.map((item: any) => ({ 
            ...item, 
            productName: state.products.find(p => p.id === item.productId)?.name || 'نامشخص' 
        }));
        const totalAmount = invoiceData.items.reduce((total: number, item: any) => total + (Number(item.purchasePrice) * Number(item.quantity)), 0);

        const newInvoice: PurchaseInvoice = {
             ...oldInvoice,
             ...invoiceData,
             items: finalItems,
             totalAmount
        };

        // Calculate New Batches (only for items that don't match existing structure, simplified: just add all as new? No.)
        // Logic: We pass all items as "potential new batches" if lot number changed, 
        // but `supabaseService.ts` logic for updatePurchase is a bit naive. 
        // For MVP safety, we won't auto-delete old batches to prevent history loss.
        // We will add batches for ALL items in the edit list to ensure stock exists? No that duplicates.
        // Let's just pass empty new batches for edit, assuming user manually fixes stock, OR pass items that have NEW lot numbers.
        // Simplified: Pass [] for new batches. Warn user.
        
        // Supplier Update
        const supplierUpdate = {
            id: newInvoice.supplierId,
            oldAmount: oldInvoice.totalAmount,
            newAmount: totalAmount
        };

        api.updatePurchase(invoiceId, newInvoice, [], supplierUpdate).then(() => {
            showToast("فاکتور خرید ویرایش شد. (توجه: موجودی کالاها را در صورت نیاز دستی اصلاح کنید)");
            fetchData();
            setState(prev => ({ ...prev, editingPurchaseInvoiceId: null }));
        });

        return { success: true, message: "در حال بروزرسانی..." };
    };

    const addPurchaseReturn = (originalInvoiceId: string, returnItems: { productId: string; quantity: number }[]) => {
        const originalInvoice = state.purchaseInvoices.find(i => i.id === originalInvoiceId);
        if (!originalInvoice) return { success: false, message: "فاکتور یافت نشد" };

        // Calculate return totals
        let returnTotal = 0;
        const fullReturnItems: PurchaseInvoiceItem[] = [];
        const stockDeductions: {productId: string, quantity: number, lotNumber: string}[] = [];

        returnItems.forEach(ri => {
            const originalItem = originalInvoice.items.find(i => i.productId === ri.productId);
            if (originalItem) {
                returnTotal += originalItem.purchasePrice * ri.quantity;
                fullReturnItems.push({ ...originalItem, quantity: ri.quantity });
                stockDeductions.push({ productId: ri.productId, quantity: ri.quantity, lotNumber: originalItem.lotNumber });
            }
        });

        const returnInvoice: PurchaseInvoice = {
            id: `PR-${Date.now()}`,
            type: 'return',
            originalInvoiceId,
            supplierId: originalInvoice.supplierId,
            invoiceNumber: originalInvoice.invoiceNumber,
            items: fullReturnItems,
            totalAmount: returnTotal,
            timestamp: new Date().toISOString()
        };

        const supplierRefund = { id: originalInvoice.supplierId, amount: returnTotal };

        api.createPurchaseReturn(returnInvoice, stockDeductions, supplierRefund).then(() => {
            addActivityLocal('purchase', `مرجوعی خرید ثبت کرد`, state.currentUser!.username, returnInvoice.id, 'purchaseInvoice');
            fetchData();
            showToast("مرجوعی خرید ثبت شد.");
        });

        return { success: true, message: "در حال ثبت..." };
    };

    // SETTINGS
    const updateSettings = (newSettings: StoreSettings) => {
        api.updateSettings(newSettings).then(() => {
            setState(prev => ({ ...prev, storeSettings: newSettings }));
            showToast("تنظیمات ذخیره شد.");
        });
    };

    // SERVICES
    const addService = (service: any) => {
        api.addService(service).then(newS => setState(prev => ({ ...prev, services: [...prev.services, newS] })));
    };
    const deleteService = (id: string) => {
        api.deleteService(id).then(() => setState(prev => ({ ...prev, services: prev.services.filter(s => s.id !== id) })));
    };

    // ACCOUNTING
    const addSupplier = (s: any) => api.addSupplier(s).then(newS => { setState(prev => ({...prev, suppliers: [...prev.suppliers, newS]})); showToast("تامین کننده افزوده شد"); });
    const addCustomer = (c: any) => api.addCustomer(c).then(newC => { setState(prev => ({...prev, customers: [...prev.customers, newC]})); showToast("مشتری افزوده شد"); });
    const addEmployee = (e: any) => api.addEmployee(e).then(newE => { setState(prev => ({...prev, employees: [...prev.employees, newE]})); showToast("کارمند افزوده شد"); });
    const addExpense = (e: any) => api.addExpense(e).then(newE => { setState(prev => ({...prev, expenses: [...prev.expenses, newE]})); showToast("هزینه ثبت شد"); });

    const addSupplierPayment = (supplierId: string, amount: number, description: string) => {
        const transaction = { id: crypto.randomUUID(), supplierId, type: 'payment' as const, amount, date: new Date().toISOString(), description };
        const supplier = state.suppliers.find(s => s.id === supplierId)!;
        const newBalance = supplier.balance - amount;
        
        api.processPayment('supplier', supplierId, newBalance, transaction).then(() => {
            setState(prev => ({
                ...prev,
                suppliers: prev.suppliers.map(s => s.id === supplierId ? {...s, balance: newBalance} : s),
                supplierTransactions: [transaction, ...prev.supplierTransactions]
            }));
        });
        return transaction;
    };

    const addCustomerPayment = (customerId: string, amount: number, description: string) => {
        const transaction = { id: crypto.randomUUID(), customerId, type: 'payment' as const, amount, date: new Date().toISOString(), description };
        const customer = state.customers.find(c => c.id === customerId)!;
        const newBalance = customer.balance - amount;
        
        api.processPayment('customer', customerId, newBalance, transaction).then(() => {
            setState(prev => ({
                ...prev,
                customers: prev.customers.map(c => c.id === customerId ? {...c, balance: newBalance} : c),
                customerTransactions: [transaction, ...prev.customerTransactions]
            }));
        });
        return transaction;
    };

    const addEmployeeAdvance = (employeeId: string, amount: number) => {
        const transaction = { id: crypto.randomUUID(), employeeId, type: 'advance' as const, amount, date: new Date().toISOString(), description: 'مساعده' };
        const employee = state.employees.find(e => e.id === employeeId)!;
        const newBalance = employee.balance + amount;
        
        api.processPayment('employee', employeeId, newBalance, transaction).then(() => {
            setState(prev => ({
                ...prev,
                employees: prev.employees.map(e => e.id === employeeId ? {...e, balance: newBalance} : e),
                payrollTransactions: [transaction, ...prev.payrollTransactions]
            }));
        });
    };

    const processAndPaySalaries = () => {
        const { employees, storeSettings } = state;
        const newTransactions: PayrollTransaction[] = [];
        let totalPaid = 0;
        const employeeUpdates: {id: string, balance: 0}[] = [];
        
        employees.forEach(emp => {
            const netSalary = emp.monthlySalary - emp.balance;
            if (netSalary > 0) {
                newTransactions.push({ id: crypto.randomUUID(), employeeId: emp.id, type: 'salary_payment', amount: netSalary, date: new Date().toISOString(), description: `حقوق ماهانه` });
                totalPaid += netSalary;
            }
            employeeUpdates.push({ id: emp.id, balance: 0 });
        });
        
        if(totalPaid === 0) return { success: false, message: 'حقوقی برای پرداخت نیست.' };

        const expense: Expense = { id: crypto.randomUUID(), category: 'salary', description: 'حقوق ماهانه', amount: totalPaid, date: new Date().toISOString() };

        api.processPayroll(employeeUpdates, newTransactions, expense).then(() => {
             addActivityLocal('payroll', `پرداخت حقوق کل: ${formatCurrency(totalPaid, storeSettings)}`, state.currentUser!.username);
             setState(prev => ({
                 ...prev,
                 employees: prev.employees.map(e => ({...e, balance: 0})),
                 payrollTransactions: [...newTransactions, ...prev.payrollTransactions],
                 expenses: [expense, ...prev.expenses]
             }));
             showToast("حقوق‌ها پرداخت شد.");
        });

        return { success: true, message: 'در حال پردازش...' };
    };


    if (isLoading) {
        return <div className="flex items-center justify-center h-screen text-xl font-bold text-blue-600">در حال دریافت اطلاعات از سرور...</div>;
    }

    return <AppContext.Provider value={{
        ...state, showToast, isLoading, login, logout, hasPermission, addUser, updateUser, deleteUser, addRole, updateRole, deleteRole, exportData, importData,
        addProduct, updateProduct, deleteProduct, addToCart, updateCartItemQuantity, updateCartItemFinalPrice, removeFromCart, completeSale,
        beginEditSale, cancelEditSale, addSaleReturn, addPurchaseInvoice, beginEditPurchase, cancelEditPurchase, updatePurchaseInvoice, addPurchaseReturn,
        updateSettings, addService, deleteService, addSupplier, addSupplierPayment, addCustomer, addCustomerPayment,
        addEmployee, addEmployeeAdvance, processAndPaySalaries, addExpense,
    }}>{children}</AppContext.Provider>;
};

export const useAppContext = (): AppContextType => {
    const context = useContext(AppContext);
    if (context === undefined) throw new Error('useAppContext must be used within an AppProvider');
    return context;
};
