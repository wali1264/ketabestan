import React, { createContext, useContext, ReactNode, useState } from 'react';
import { supabase } from './utils/supabaseClient';
import type {
    Product, ProductBatch, SaleInvoice, PurchaseInvoice, PurchaseInvoiceItem, InvoiceItem,
    Customer, Supplier, Employee, Expense, Service, StoreSettings, CartItem,
    CustomerTransaction, SupplierTransaction, PayrollTransaction, ActivityLog,
    User, Role, Permission, AppState
} from './types';
import { formatCurrency } from './utils/formatters';

interface AppContextType extends AppState {
    isLoading: boolean;
    showToast: (message: string) => void;
    
    // Auth
    login: (username: string, password: string) => Promise<{ success: boolean; message: string }>;
    logout: () => Promise<void>;
    hasPermission: (permission: Permission) => boolean;
    
    // Users & Roles (stubs for phase 2)
    addUser: (user: Omit<User, 'id'>) => { success: boolean; message: string };
    updateUser: (user: Partial<User> & { id: string }) => { success: boolean; message: string };
    deleteUser: (userId: string) => void;
    addRole: (role: Omit<Role, 'id'>) => { success: boolean; message: string };
    updateRole: (role: Role) => { success: boolean; message: string };
    deleteRole: (roleId: string) => void;

    // Backup & Restore (stubs for phase 2)
    exportData: () => void;
    importData: (file: File) => void;

    // Inventory Actions (stubs for phase 2)
    addProduct: (product: Omit<Product, 'id' | 'batches'>, firstBatch: Omit<ProductBatch, 'id'>) => { success: boolean; message: string };
    updateProduct: (product: Product) => { success: boolean; message: string };
    deleteProduct: (productId: string) => void;
    
    // POS Actions (stubs for phase 2)
    addToCart: (itemToAdd: Product | Service, type: 'product' | 'service') => { success: boolean; message: string };
    updateCartItemQuantity: (itemId: string, itemType: 'product' | 'service', newQuantity: number) => { success: boolean; message: string };
    updateCartItemFinalPrice: (itemId: string, itemType: 'product' | 'service', finalPrice: number) => void;
    removeFromCart: (itemId: string, itemType: 'product' | 'service') => void;
    completeSale: (cashier: string, customerId?: string) => { success: boolean; invoice?: SaleInvoice; message: string };
    beginEditSale: (invoiceId: string) => { success: boolean; message: string; customerId?: string; };
    cancelEditSale: () => void;
    addSaleReturn: (originalInvoiceId: string, returnItems: { id: string; type: 'product' | 'service'; quantity: number }[], cashier: string) => { success: boolean, message: string };
    
    // Purchase Actions (stubs for phase 2)
    addPurchaseInvoice: (invoiceData: Omit<PurchaseInvoice, 'id' | 'totalAmount' | 'items' | 'type' | 'originalInvoiceId'> & { items: Omit<PurchaseInvoiceItem, 'productName'>[] }) => { success: boolean, message: string };
    beginEditPurchase: (invoiceId: string) => { success: boolean, message: string };
    cancelEditPurchase: () => void;
    updatePurchaseInvoice: (invoiceData: Omit<PurchaseInvoice, 'id' | 'totalAmount' | 'items' | 'type' | 'originalInvoiceId'> & { items: Omit<PurchaseInvoiceItem, 'productName'>[] }) => { success: boolean, message: string };
    addPurchaseReturn: (originalInvoiceId: string, returnItems: { productId: string; quantity: number }[]) => { success: boolean; message: string };

    // Settings (stubs for phase 2)
    updateSettings: (newSettings: StoreSettings) => void;
    
    // Services (stubs for phase 2)
    addService: (service: Omit<Service, 'id'>) => void;
    deleteService: (serviceId: string) => void;
    
    // Accounting (stubs for phase 2)
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

const getInitialState = (): AppState => ({
    products: [], saleInvoices: [], purchaseInvoices: [], customers: [],
    suppliers: [], employees: [], expenses: [], services: [],
    storeSettings: { storeName: '', address: '', phone: '', lowStockThreshold: 10, expiryThresholdMonths: 3, currencyName: '', currencySymbol: '' },
    cart: [], customerTransactions: [], supplierTransactions: [], payrollTransactions: [],
    activities: [], saleInvoiceCounter: 0, editingSaleInvoiceId: null, editingPurchaseInvoiceId: null,
    isAuthenticated: false, currentUser: null, users: [], roles: [],
});

const toCamel = (s: string) => {
  return s.replace(/([-_][a-z])/ig, ($1) => {
    return $1.toUpperCase()
      .replace('-', '')
      .replace('_', '');
  });
};

const convertKeysToCamelCase = (o: any): any => {
  if (Array.isArray(o)) {
    return o.map(v => convertKeysToCamelCase(v));
  } else if (o !== null && typeof o === 'object') {
    return Object.keys(o).reduce((acc, key) => {
      acc[toCamel(key)] = convertKeysToCamelCase(o[key]);
      return acc;
    }, {} as {[key: string]: any});
  }
  return o;
};


export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, setState] = useState<AppState>(getInitialState());
    const [isLoading, setIsLoading] = useState(false);
    const [toastMessage, setToastMessage] = useState('');

    const showToast = (message: string) => setToastMessage(message);

    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            console.log("Fetching initial data sequentially...");
    
            const handleFetch = async (tableName: string) => {
                const { data, error } = await supabase.from(tableName).select('*');
                if (error) {
                    console.error(`Error fetching ${tableName}:`, error);
                    throw new Error(`Failed to fetch ${tableName}: ${error.message}`);
                }
                console.log(`Successfully fetched ${tableName}`);
                return data || [];
            };
    
            const productsData = await handleFetch('products');
            const productBatchesData = await handleFetch('product_batches');
            const rolesData = await handleFetch('roles');
            const usersData = await handleFetch('users');
            
            const settingsRes = await supabase.from('store_settings').select('*').limit(1).single();
            if (settingsRes.error) {
                console.error(`Error fetching store_settings:`, settingsRes.error);
                throw new Error(`Failed to fetch store_settings: ${settingsRes.error.message}`);
            }
            console.log(`Successfully fetched store_settings`);
            const settingsData = settingsRes.data;
    
            const customersData = await handleFetch('customers');
            const suppliersData = await handleFetch('suppliers');
            const saleInvoicesData = await handleFetch('sale_invoices');
            const saleInvoiceItemsData = await handleFetch('sale_invoice_items');
            const purchaseInvoicesData = await handleFetch('purchase_invoices');
            const purchaseInvoiceItemsData = await handleFetch('purchase_invoice_items');
            const employeesData = await handleFetch('employees');
            const expensesData = await handleFetch('expenses');
            const servicesData = await handleFetch('services');
            const customerTransactionsData = await handleFetch('customer_transactions');
            const supplierTransactionsData = await handleFetch('supplier_transactions');
            const payrollTransactionsData = await handleFetch('payroll_transactions');
            const activitiesData = await handleFetch('activity_logs');
    
            console.log("All data fetched. Processing...");
    
            // Convert all flat data to camelCase
            const products: Product[] = convertKeysToCamelCase(productsData);
            const productBatches: (ProductBatch & { productId: string })[] = convertKeysToCamelCase(productBatchesData);
            const saleInvoices: SaleInvoice[] = convertKeysToCamelCase(saleInvoicesData);
            const saleInvoiceItems: any[] = convertKeysToCamelCase(saleInvoiceItemsData);
            const purchaseInvoices: PurchaseInvoice[] = convertKeysToCamelCase(purchaseInvoicesData);
            const purchaseInvoiceItems: any[] = convertKeysToCamelCase(purchaseInvoiceItemsData);
    
            // Reconstruct nested data structures
            const productMap = new Map<string, Product>(products.map(p => [p.id, { ...p, batches: [] }]));
            productBatches.forEach(batch => {
                if (productMap.has(batch.productId)) {
                    productMap.get(batch.productId)!.batches.push(batch);
                }
            });
    
            const saleInvoiceMap = new Map<string, SaleInvoice>(saleInvoices.map(inv => [inv.id, { ...inv, items: [] }]));
            saleInvoiceItems.forEach(item => {
                if (saleInvoiceMap.has(item.invoiceId)) {
                    saleInvoiceMap.get(item.invoiceId)!.items.push(item);
                }
            });
            
            const purchaseInvoiceMap = new Map<string, PurchaseInvoice>(purchaseInvoices.map(inv => [inv.id, { ...inv, items: [] }]));
            purchaseInvoiceItems.forEach(item => {
                if (purchaseInvoiceMap.has(item.invoiceId)) {
                    purchaseInvoiceMap.get(item.invoiceId)!.items.push(item);
                }
            });
    
            const finalProducts = Array.from(productMap.values());
            const finalSaleInvoices = Array.from(saleInvoiceMap.values());
            const finalPurchaseInvoices = Array.from(purchaseInvoiceMap.values());
            
            const saleInvoiceCounter = finalSaleInvoices.length > 0
                ? Math.max(0, ...finalSaleInvoices.map(inv => parseInt(inv.id.replace('F', ''), 10) || 0)) + 1
                : 1;
    
            setState(prev => ({
                ...prev,
                products: finalProducts,
                roles: convertKeysToCamelCase(rolesData),
                users: convertKeysToCamelCase(usersData),
                storeSettings: convertKeysToCamelCase(settingsData || prev.storeSettings),
                customers: convertKeysToCamelCase(customersData),
                suppliers: convertKeysToCamelCase(suppliersData),
                employees: convertKeysToCamelCase(employeesData),
                expenses: convertKeysToCamelCase(expensesData),
                services: convertKeysToCamelCase(servicesData),
                saleInvoices: finalSaleInvoices,
                purchaseInvoices: finalPurchaseInvoices,
                customerTransactions: convertKeysToCamelCase(customerTransactionsData),
                supplierTransactions: convertKeysToCamelCase(supplierTransactionsData),
                payrollTransactions: convertKeysToCamelCase(payrollTransactionsData),
                activities: convertKeysToCamelCase(activitiesData),
                saleInvoiceCounter,
            }));
            
            console.log("State updated successfully.");
    
        } catch (error) {
            console.error("Error during sequential data fetch:", error);
            showToast("خطا در بارگذاری اطلاعات اولیه. لطفاً کنسول را بررسی کنید.");
            await logout();
        } finally {
            setIsLoading(false);
        }
    };
    
    // AUTH & RBAC LOGIC
    const login = async (username: string, password: string): Promise<{ success: boolean; message: string }> => {
        setIsLoading(true);
        try {
            // Step 1: Call our secure Edge Function to get a JWT and the user object
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
    
            const result = await response.json();
    
            if (!response.ok) {
                return { success: false, message: result.message || 'خطا در احراز هویت.' };
            }
    
            const { accessToken, user } = result;
    
            // Step 2: Set the session in the Supabase client.
            const { data: { session }, error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: accessToken,
            });
            
            if (sessionError || !session) {
                 console.error("Set session error:", sessionError);
                 return { success: false, message: 'خطا در برقراری نشست کاربری.' };
            }
    
            // The user object is now available from the API, no need to fetch it again.
            setState(prev => ({ ...prev, isAuthenticated: true, currentUser: convertKeysToCamelCase(user) }));
            
            await fetchInitialData();
    
            return { success: true, message: 'ورود موفق' };
    
        } catch (error) {
            console.error("Login error:", error);
            setIsLoading(false); // FIX: Reset loading state on failure
            return { success: false, message: 'یک خطای ناشناخته در شبکه رخ داد.' };
        }
    };

    const logout = async () => {
        await supabase.auth.signOut();
        setState(getInitialState());
    };

    const hasPermission = (permission: Permission): boolean => {
        if (!state.currentUser) return false;
        const userRole = state.roles.find(r => r.id === state.currentUser!.roleId);
        if (!userRole) return false;
        // Check for wildcard '*' permission
        if (userRole.permissions.includes('*')) {
            return true;
        }
        return userRole.permissions.includes(permission);
    };
    
    // --- STUBBED FUNCTIONS FOR PHASE 2 ---
    const notImplemented = () => ({ success: false, message: 'این قابلیت هنوز پیاده‌سازی نشده است.' });

    return <AppContext.Provider value={{
        ...state, 
        isLoading,
        showToast, 
        login, 
        logout, 
        hasPermission, 
        addUser: notImplemented as any, 
        updateUser: notImplemented as any, 
        deleteUser: () => {}, 
        addRole: notImplemented as any, 
        updateRole: notImplemented as any, 
        deleteRole: () => {}, 
        exportData: () => {}, 
        importData: () => {},
        addProduct: notImplemented as any, 
        updateProduct: notImplemented as any, 
        deleteProduct: () => {}, 
        addToCart: notImplemented as any, 
        updateCartItemQuantity: notImplemented as any, 
        updateCartItemFinalPrice: () => {}, 
        removeFromCart: () => {}, 
        completeSale: notImplemented as any,
        beginEditSale: notImplemented as any, 
        cancelEditSale: () => {}, 
        addSaleReturn: notImplemented as any, 
        addPurchaseInvoice: notImplemented as any, 
        beginEditPurchase: notImplemented as any, 
        cancelEditPurchase: () => {}, 
        updatePurchaseInvoice: notImplemented as any, 
        addPurchaseReturn: notImplemented as any,
        updateSettings: () => {}, 
        addService: () => {}, 
        deleteService: () => {}, 
        addSupplier: () => {}, 
        addSupplierPayment: notImplemented as any, 
        addCustomer: () => {}, 
        addCustomerPayment: notImplemented as any,
        addEmployee: () => {}, 
        addEmployeeAdvance: () => {}, 
        processAndPaySalaries: notImplemented as any, 
        addExpense: () => {},
    }}>{children}</AppContext.Provider>;
};

export const useAppContext = (): AppContextType => {
    const context = useContext(AppContext);
    if (context === undefined) throw new Error('useAppContext must be used within an AppProvider');
    return context;
};