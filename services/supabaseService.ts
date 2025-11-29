
import { supabase } from '../utils/supabaseClient';
import type { 
    Product, ProductBatch, SaleInvoice, PurchaseInvoice, Supplier, Customer, 
    Employee, Expense, Service, Role, User, StoreSettings, ActivityLog, 
    CustomerTransaction, SupplierTransaction, PayrollTransaction, InvoiceItem,
    PurchaseInvoiceItem, SaleInvoice as SaleInvoiceType, AppState
} from '../types';

// --- Helper Helpers for Data Mapping (Database Snake_case to App CamelCase) ---

const mapSettings = (data: any): StoreSettings => ({
    storeName: data.store_name,
    address: data.address || '',
    phone: data.phone || '',
    lowStockThreshold: data.low_stock_threshold,
    expiryThresholdMonths: data.expiry_threshold_months,
    currencyName: data.currency_name,
    currencySymbol: data.currency_symbol
});

const mapRole = (data: any): Role => ({
    id: data.id,
    name: data.name,
    permissions: data.permissions || []
});

const mapUser = (data: any): User => ({
    id: data.id,
    username: data.username,
    password: data.password,
    roleId: data.role_id
});

const mapProduct = (data: any): Product => ({
    id: data.id,
    name: data.name,
    salePrice: Number(data.sale_price),
    barcode: data.barcode,
    manufacturer: data.manufacturer,
    itemsPerPackage: Number(data.items_per_package) || 1, // Ensure Number type
    batches: data.product_batches?.map((b: any) => ({
        id: b.id,
        lotNumber: b.lot_number,
        stock: b.stock,
        purchasePrice: Number(b.purchase_price),
        purchaseDate: b.purchase_date,
        expiryDate: b.expiry_date
    })) || []
});

const mapSaleInvoice = (data: any): SaleInvoice => ({
    id: data.id,
    type: data.type,
    originalInvoiceId: data.original_invoice_id,
    subtotal: Number(data.subtotal),
    totalDiscount: Number(data.total_discount),
    totalAmount: Number(data.total_amount),
    timestamp: data.timestamp,
    cashier: data.cashier,
    customerId: data.customer_id,
    items: data.sale_invoice_items?.map((item: any) => ({
        id: item.item_id, // This ID refers to Product or Service ID
        type: item.type,
        name: item.name,
        quantity: item.quantity,
        price: Number(item.price), // For services
        salePrice: Number(item.price), // For products (mapped to same for simplicity in types)
        finalPrice: Number(item.final_price),
        purchasePrice: Number(item.purchase_price), // Mapped for COGS calculation
        itemsPerPackage: 1 // Default, populated properly in UI if product exists
    })) || []
});

const mapPurchaseInvoice = (data: any): PurchaseInvoice => ({
    id: data.id,
    type: data.type,
    originalInvoiceId: data.original_invoice_id,
    supplierId: data.supplier_id,
    invoiceNumber: data.invoice_number || '',
    totalAmount: Number(data.total_amount),
    timestamp: data.timestamp,
    currency: data.currency || 'AFN',
    exchangeRate: Number(data.exchange_rate || 1),
    items: data.purchase_invoice_items?.map((item: any) => ({
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
        purchasePrice: Number(item.purchase_price),
        lotNumber: item.lot_number,
        expiryDate: item.expiry_date
    })) || []
});

// --- API Methods ---

export const api = {
    // --- Settings ---
    getSettings: async () => {
        const { data, error } = await supabase.from('store_settings').select('*').single();
        if (error) throw error;
        return mapSettings(data);
    },
    updateSettings: async (settings: StoreSettings) => {
        const { error } = await supabase.from('store_settings').update({
            store_name: settings.storeName,
            address: settings.address,
            phone: settings.phone,
            low_stock_threshold: settings.lowStockThreshold,
            expiry_threshold_months: settings.expiryThresholdMonths,
            currency_name: settings.currencyName,
            currency_symbol: settings.currencySymbol
        }).eq('id', 1);
        if (error) throw error;
    },

    // --- Auth & Users ---
    getUsers: async () => {
        const { data, error } = await supabase.from('users').select('*');
        if (error) throw error;
        return data.map(mapUser);
    },
    getRoles: async () => {
        const { data, error } = await supabase.from('roles').select('*');
        if (error) throw error;
        return data.map(mapRole);
    },
    addUser: async (user: Omit<User, 'id'>) => {
        const newId = crypto.randomUUID();
        const { error } = await supabase.from('users').insert({
            id: newId,
            username: user.username,
            password: user.password,
            role_id: user.roleId
        });
        if (error) throw error;
        return { ...user, id: newId };
    },
    updateUser: async (user: Partial<User> & { id: string }) => {
        const updates: any = {};
        if (user.username) updates.username = user.username;
        if (user.password) updates.password = user.password;
        if (user.roleId) updates.role_id = user.roleId;
        const { error } = await supabase.from('users').update(updates).eq('id', user.id);
        if (error) throw error;
    },
    deleteUser: async (id: string) => {
        const { error } = await supabase.from('users').delete().eq('id', id);
        if (error) throw error;
    },
    addRole: async (role: Omit<Role, 'id'>) => {
        const newId = crypto.randomUUID();
        const { error } = await supabase.from('roles').insert({
            id: newId,
            name: role.name,
            permissions: role.permissions
        });
        if (error) throw error;
        return { ...role, id: newId };
    },
    updateRole: async (role: Role) => {
        const { error } = await supabase.from('roles').update({
            name: role.name,
            permissions: role.permissions
        }).eq('id', role.id);
        if (error) throw error;
    },
    deleteRole: async (id: string) => {
        const { error } = await supabase.from('roles').delete().eq('id', id);
        if (error) throw error;
    },

    // --- Inventory ---
    getProducts: async () => {
        const { data, error } = await supabase
            .from('products')
            .select('*, product_batches(*)');
        if (error) throw error;
        return data.map(mapProduct);
    },
    addProduct: async (product: Omit<Product, 'id'|'batches'>, firstBatch: Omit<ProductBatch, 'id'>) => {
        const productId = crypto.randomUUID();
        const batchId = crypto.randomUUID();
        
        // 1. Insert Product
        const { error: pError } = await supabase.from('products').insert({
            id: productId,
            name: product.name,
            sale_price: product.salePrice,
            barcode: product.barcode,
            manufacturer: product.manufacturer,
            items_per_package: product.itemsPerPackage
        });
        if (pError) throw pError;

        // 2. Insert First Batch
        const { error: bError } = await supabase.from('product_batches').insert({
            id: batchId,
            product_id: productId,
            lot_number: firstBatch.lotNumber,
            stock: firstBatch.stock,
            purchase_price: firstBatch.purchasePrice,
            purchase_date: firstBatch.purchaseDate,
            expiry_date: firstBatch.expiryDate
        });
        if (bError) throw bError;

        return { ...product, id: productId, batches: [{...firstBatch, id: batchId}] };
    },
    updateProduct: async (product: Product) => {
        const { error } = await supabase.from('products').update({
            name: product.name,
            sale_price: product.salePrice,
            barcode: product.barcode,
            manufacturer: product.manufacturer,
            items_per_package: product.itemsPerPackage
        }).eq('id', product.id);
        if (error) throw error;
    },
    deleteProduct: async (id: string) => {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) throw error;
    },

    // --- Services ---
    getServices: async () => {
        const { data, error } = await supabase.from('services').select('*');
        if (error) throw error;
        return data;
    },
    addService: async (service: Omit<Service, 'id'>) => {
        const id = crypto.randomUUID();
        const { error } = await supabase.from('services').insert({ id, ...service });
        if (error) throw error;
        return { ...service, id };
    },
    deleteService: async (id: string) => {
        const { error } = await supabase.from('services').delete().eq('id', id);
        if (error) throw error;
    },

    // --- Customers, Suppliers, Employees, Expenses ---
    getEntities: async () => {
        const [cust, supp, emp, exp] = await Promise.all([
            supabase.from('customers').select('*'),
            supabase.from('suppliers').select('*'),
            supabase.from('employees').select('*'),
            supabase.from('expenses').select('*'),
        ]);
        
        if (cust.error) throw cust.error;
        if (supp.error) throw supp.error;
        if (emp.error) throw emp.error;
        if (exp.error) throw exp.error;

        return {
            customers: cust.data.map(c => ({...c, balance: Number(c.balance)})),
            suppliers: supp.data.map(s => ({...s, balance: Number(s.balance)})),
            employees: emp.data.map(e => ({...e, monthlySalary: Number(e.monthly_salary), balance: Number(e.balance)})),
            expenses: exp.data.map(e => ({...e, amount: Number(e.amount)})),
        };
    },
    addCustomer: async (c: any) => { const id = crypto.randomUUID(); await supabase.from('customers').insert({id, ...c}); return {...c, id, balance: 0}; },
    deleteCustomer: async (id: string) => { const { error } = await supabase.from('customers').delete().eq('id', id); if (error) throw error; },
    
    addSupplier: async (s: any) => { const id = crypto.randomUUID(); await supabase.from('suppliers').insert({id, name: s.name, contact_person: s.contactPerson, phone: s.phone}); return {...s, id, balance: 0}; },
    deleteSupplier: async (id: string) => { const { error } = await supabase.from('suppliers').delete().eq('id', id); if (error) throw error; },

    addEmployee: async (e: any) => { const id = crypto.randomUUID(); await supabase.from('employees').insert({id, name: e.name, position: e.position, monthly_salary: e.monthlySalary}); return {...e, id, balance: 0}; },
    addExpense: async (e: any) => { const id = crypto.randomUUID(); await supabase.from('expenses').insert({id, ...e}); return {...e, id}; },

    // --- Transactions ---
    getTransactions: async () => {
        const [cust, supp, pay] = await Promise.all([
            supabase.from('customer_transactions').select('*'),
            supabase.from('supplier_transactions').select('*'),
            supabase.from('payroll_transactions').select('*')
        ]);
        return {
            customerTransactions: cust.data?.map((t:any) => ({...t, customerId: t.customer_id, invoiceId: t.invoice_id, amount: Number(t.amount)})) || [],
            supplierTransactions: supp.data?.map((t:any) => ({...t, supplierId: t.supplier_id, invoiceId: t.invoice_id, amount: Number(t.amount), currency: t.currency || 'AFN'})) || [],
            payrollTransactions: pay.data?.map((t:any) => ({...t, employeeId: t.employee_id, amount: Number(t.amount)})) || []
        };
    },

    // --- Invoices (POS & Purchase) ---
    getInvoices: async () => {
        const [sales, purchases] = await Promise.all([
            supabase.from('sale_invoices').select('*, sale_invoice_items(*)').order('timestamp', { ascending: false }),
            supabase.from('purchase_invoices').select('*, purchase_invoice_items(*)').order('timestamp', { ascending: false })
        ]);
        
        if (sales.error) throw sales.error;
        if (purchases.error) throw purchases.error;

        return {
            saleInvoices: sales.data.map(mapSaleInvoice),
            purchaseInvoices: purchases.data.map(mapPurchaseInvoice)
        };
    },
    getActivities: async () => {
        const { data } = await supabase.from('activity_logs').select('*').order('timestamp', { ascending: false }).limit(100);
        return data?.map((a: any) => ({...a, refId: a.ref_id, refType: a.ref_type})) || [];
    },
    addActivity: async (log: ActivityLog) => {
        await supabase.from('activity_logs').insert({
            id: log.id,
            type: log.type,
            description: log.description,
            timestamp: log.timestamp,
            user: log.user,
            ref_id: log.refId,
            ref_type: log.refType
        });
    },

    // --- Complex Operations (Sales & Purchases) ---
    createSale: async (invoice: SaleInvoice, stockUpdates: {batchId: string, newStock: number}[], customerUpdate?: {id: string, newBalance: number, transaction: CustomerTransaction}) => {
        // 1. Invoice Header
        const { error: iError } = await supabase.from('sale_invoices').insert({
            id: invoice.id,
            type: invoice.type,
            original_invoice_id: invoice.originalInvoiceId,
            subtotal: invoice.subtotal,
            total_discount: invoice.totalDiscount,
            total_amount: invoice.totalAmount,
            timestamp: invoice.timestamp,
            cashier: invoice.cashier,
            customer_id: invoice.customerId
        });
        if (iError) throw iError;

        // 2. Invoice Items
        const itemsData = invoice.items.map(item => ({
            invoice_id: invoice.id,
            item_id: item.id,
            type: item.type,
            name: item.name,
            quantity: item.quantity,
            price: (item.type === 'product' ? (item as any).salePrice : (item as any).price),
            final_price: (item.type === 'product' && (item as any).finalPrice !== undefined) ? (item as any).finalPrice : (item as any).salePrice,
            purchase_price: (item.type === 'product' ? (item as any).purchasePrice : 0) // Track COGS
        }));
        const { error: itemError } = await supabase.from('sale_invoice_items').insert(itemsData);
        if (itemError) throw itemError;

        // 3. Update Stock
        for (const update of stockUpdates) {
            await supabase.from('product_batches').update({ stock: update.newStock }).eq('id', update.batchId);
        }

        // 4. Update Customer
        if (customerUpdate) {
            await supabase.from('customers').update({ balance: customerUpdate.newBalance }).eq('id', customerUpdate.id);
            await supabase.from('customer_transactions').insert({
                id: customerUpdate.transaction.id,
                customer_id: customerUpdate.transaction.customerId,
                type: customerUpdate.transaction.type,
                amount: customerUpdate.transaction.amount,
                date: customerUpdate.transaction.date,
                description: customerUpdate.transaction.description,
                invoice_id: customerUpdate.transaction.invoiceId
            });
        }
    },

    // --- UPDATE SALE (EDIT) ---
    updateSale: async (
        invoiceId: string, 
        newInvoiceData: SaleInvoice, 
        stockRestores: {productId: string, quantity: number}[], 
        stockDeductions: {batchId: string, quantity: number}[], 
        customerUpdate?: {id: string, oldAmount: number, newAmount: number, transactionDescription: string}
    ) => {
        // 1. Restore Stock (Revert)
        for (const restore of stockRestores) {
            const { data: batches } = await supabase.from('product_batches').select('*').eq('product_id', restore.productId).limit(1);
            if (batches && batches.length > 0) {
                const batch = batches[0];
                await supabase.from('product_batches').update({ stock: batch.stock + restore.quantity }).eq('id', batch.id);
            }
        }

        // 2. Deduct Stock (Apply new)
        for (const deduct of stockDeductions) {
             // Fetch latest to ensure no race condition on negative stock
            const { data: batch } = await supabase.from('product_batches').select('stock').eq('id', deduct.batchId).single();
            if (batch) {
                await supabase.from('product_batches').update({ stock: batch.stock - deduct.quantity }).eq('id', deduct.batchId);
            }
        }

        // 3. Update Invoice Header
        const { error: headerError } = await supabase.from('sale_invoices').update({
            subtotal: newInvoiceData.subtotal,
            total_discount: newInvoiceData.totalDiscount,
            total_amount: newInvoiceData.totalAmount,
            customer_id: newInvoiceData.customerId
        }).eq('id', invoiceId);
        if (headerError) throw headerError;

        // 4. Update Items (Delete old, insert new)
        await supabase.from('sale_invoice_items').delete().eq('invoice_id', invoiceId);
        const itemsData = newInvoiceData.items.map(item => ({
            invoice_id: invoiceId,
            item_id: item.id,
            type: item.type,
            name: item.name,
            quantity: item.quantity,
            price: (item.type === 'product' ? (item as any).salePrice : (item as any).price),
            final_price: (item.type === 'product' && (item as any).finalPrice !== undefined) ? (item as any).finalPrice : (item as any).salePrice,
            purchase_price: (item.type === 'product' ? (item as any).purchasePrice : 0) // Track COGS
        }));
        await supabase.from('sale_invoice_items').insert(itemsData);

        // 5. Update Customer
        if (customerUpdate) {
            const { data: customer } = await supabase.from('customers').select('balance').eq('id', customerUpdate.id).single();
            if (customer) {
                const newBalance = customer.balance - customerUpdate.oldAmount + customerUpdate.newAmount;
                await supabase.from('customers').update({ balance: newBalance }).eq('id', customerUpdate.id);
                
                // Update existing transaction
                await supabase.from('customer_transactions')
                    .update({ amount: customerUpdate.newAmount, description: customerUpdate.transactionDescription })
                    .eq('invoice_id', invoiceId)
                    .eq('type', 'credit_sale');
            }
        }
    },

    updateSaleInvoiceMetadata: async (invoiceId: string, updates: { original_invoice_id?: string | null }) => {
        const { error } = await supabase.from('sale_invoices').update(updates).eq('id', invoiceId);
        if (error) throw error;
    },

    createSaleReturn: async (returnInvoice: SaleInvoice, stockRestores: {productId: string, quantity: number}[], customerRefund?: {id: string, amount: number}) => {
         const { error: iError } = await supabase.from('sale_invoices').insert({
            id: returnInvoice.id,
            type: 'return',
            original_invoice_id: returnInvoice.originalInvoiceId,
            subtotal: returnInvoice.subtotal,
            total_discount: returnInvoice.totalDiscount,
            total_amount: returnInvoice.totalAmount,
            timestamp: returnInvoice.timestamp,
            cashier: returnInvoice.cashier,
            customer_id: returnInvoice.customerId
        });
        if (iError) throw iError;

        const itemsData = returnInvoice.items.map(item => ({
            invoice_id: returnInvoice.id,
            item_id: item.id,
            type: item.type,
            name: item.name,
            quantity: item.quantity,
            price: (item.type === 'product' ? (item as any).salePrice : (item as any).price),
            final_price: 0,
            purchase_price: (item.type === 'product' ? (item as any).purchasePrice : 0) // Track COGS for reversal
        }));
        await supabase.from('sale_invoice_items').insert(itemsData);

        for (const restore of stockRestores) {
             const { data: batches } = await supabase.from('product_batches').select('*').eq('product_id', restore.productId).limit(1);
             if (batches && batches.length > 0) {
                 const batch = batches[0];
                 await supabase.from('product_batches').update({ stock: batch.stock + restore.quantity }).eq('id', batch.id);
             }
        }

        if (customerRefund) {
             const { data: customer } = await supabase.from('customers').select('balance').eq('id', customerRefund.id).single();
             if (customer) {
                 const newBalance = customer.balance - customerRefund.amount;
                 await supabase.from('customers').update({ balance: newBalance }).eq('id', customerRefund.id);

                 await supabase.from('customer_transactions').insert({
                     id: crypto.randomUUID(),
                     customer_id: customerRefund.id,
                     type: 'sale_return',
                     amount: customerRefund.amount,
                     date: new Date().toISOString(),
                     description: `مرجوعی فاکتور #${returnInvoice.originalInvoiceId}`,
                     invoice_id: returnInvoice.id
                 });
             }
        }
    },

    createPurchase: async (invoice: PurchaseInvoice, supplierUpdate: {id: string, newBalance: number, transaction: SupplierTransaction}, newBatches: any[]) => {
        const { error: iError } = await supabase.from('purchase_invoices').insert({
            id: invoice.id,
            type: invoice.type,
            original_invoice_id: invoice.originalInvoiceId,
            supplier_id: invoice.supplierId,
            invoice_number: invoice.invoiceNumber,
            total_amount: invoice.totalAmount,
            timestamp: invoice.timestamp,
            currency: invoice.currency,
            exchange_rate: invoice.exchangeRate
        });
        if (iError) throw iError;

        // We store items in Base Currency (calculated in AppContext before calling this)
        const itemsData = invoice.items.map(item => ({
            invoice_id: invoice.id,
            product_id: item.productId,
            product_name: item.productName,
            quantity: item.quantity,
            purchase_price: item.purchasePrice,
            lot_number: item.lotNumber,
            expiry_date: item.expiryDate 
        }));
        const { error: itemError } = await supabase.from('purchase_invoice_items').insert(itemsData);
        if (itemError) throw itemError;

        if (newBatches.length > 0) {
             const batchesData = newBatches.map(b => ({
                id: b.id,
                product_id: b.productId, // CamelCase input
                lot_number: b.lotNumber,
                stock: b.stock,
                purchase_price: b.purchasePrice, // Already converted to base currency
                purchase_date: b.purchaseDate,
                expiry_date: b.expiryDate
             }));
             await supabase.from('product_batches').insert(batchesData);
        }

        await supabase.from('suppliers').update({ balance: supplierUpdate.newBalance }).eq('id', supplierUpdate.id);
        
        const txData: any = {
            id: supplierUpdate.transaction.id,
            supplier_id: supplierUpdate.transaction.supplierId,
            type: supplierUpdate.transaction.type,
            amount: supplierUpdate.transaction.amount,
            date: supplierUpdate.transaction.date,
            description: supplierUpdate.transaction.description,
            invoice_id: supplierUpdate.transaction.invoiceId,
            currency: supplierUpdate.transaction.currency // Store currency
        };
        await supabase.from('supplier_transactions').insert(txData);
    },

    updatePurchase: async (
        invoiceId: string, 
        newInvoiceData: PurchaseInvoice, 
        newBatches: any[], 
        supplierUpdate?: {id: string, oldAmount: number, newAmount: number}
    ) => {
        // 1. Update Header
        await supabase.from('purchase_invoices').update({
             supplier_id: newInvoiceData.supplierId,
             invoice_number: newInvoiceData.invoiceNumber,
             total_amount: newInvoiceData.totalAmount,
             timestamp: newInvoiceData.timestamp,
             currency: newInvoiceData.currency,
             exchange_rate: newInvoiceData.exchangeRate
        }).eq('id', invoiceId);

        // 2. Re-create items
        await supabase.from('purchase_invoice_items').delete().eq('invoice_id', invoiceId);
        const itemsData = newInvoiceData.items.map(item => ({
            invoice_id: invoiceId,
            product_id: item.productId,
            product_name: item.productName,
            quantity: item.quantity,
            purchase_price: item.purchasePrice,
            lot_number: item.lotNumber, 
            expiry_date: item.expiryDate 
        }));
        await supabase.from('purchase_invoice_items').insert(itemsData);

        // 3. Add NEW batches (For edit, we assume we add new ones if not exist, existing ones are manual)
        if (newBatches.length > 0) {
             const batchesData = newBatches.map(b => ({
                id: b.id,
                product_id: b.productId, // CamelCase
                lot_number: b.lotNumber,
                stock: b.stock,
                purchase_price: b.purchasePrice,
                purchase_date: b.purchaseDate,
                expiry_date: b.expiryDate
             }));
             await supabase.from('product_batches').insert(batchesData);
        }

        // 4. Update Supplier Financials
        if (supplierUpdate) {
            const { data: supplier } = await supabase.from('suppliers').select('balance').eq('id', supplierUpdate.id).single();
            if (supplier) {
                const newBalance = supplier.balance - supplierUpdate.oldAmount + supplierUpdate.newAmount;
                await supabase.from('suppliers').update({ balance: newBalance }).eq('id', supplierUpdate.id);
                
                // Update tx
                await supabase.from('supplier_transactions')
                    .update({ amount: supplierUpdate.newAmount })
                    .eq('invoice_id', invoiceId)
                    .eq('type', 'purchase');
            }
        }
    },

    createPurchaseReturn: async (returnInvoice: PurchaseInvoice, stockDeductions: {productId: string, quantity: number, lotNumber: string}[], supplierRefund?: {id: string, amount: number}) => {
        // 1. Create Invoice
         await supabase.from('purchase_invoices').insert({
            id: returnInvoice.id,
            type: 'return',
            original_invoice_id: returnInvoice.originalInvoiceId,
            supplier_id: returnInvoice.supplierId,
            invoice_number: returnInvoice.invoiceNumber,
            total_amount: returnInvoice.totalAmount,
            timestamp: returnInvoice.timestamp
        });

        const itemsData = returnInvoice.items.map(item => ({
            invoice_id: returnInvoice.id,
            product_id: item.productId,
            product_name: item.productName,
            quantity: item.quantity,
            purchase_price: item.purchasePrice,
            lot_number: item.lotNumber, 
            expiry_date: item.expiryDate 
        }));
        await supabase.from('purchase_invoice_items').insert(itemsData);

        // 2. Reduce Stock
        for(const deduct of stockDeductions) {
             // Try to find matching batch by lot number and product
             const { data: batches } = await supabase.from('product_batches')
                .select('*')
                .eq('product_id', deduct.productId)
                .eq('lot_number', deduct.lotNumber)
                .limit(1);
             
             if (batches && batches.length > 0) {
                 const batch = batches[0];
                 const newStock = Math.max(0, batch.stock - deduct.quantity);
                 await supabase.from('product_batches').update({ stock: newStock }).eq('id', batch.id);
             }
        }

        // 3. Debit Supplier
        if (supplierRefund) {
            const { data: supplier } = await supabase.from('suppliers').select('balance').eq('id', supplierRefund.id).single();
            if(supplier) {
                const newBalance = supplier.balance - supplierRefund.amount;
                await supabase.from('suppliers').update({ balance: newBalance }).eq('id', supplierRefund.id);

                await supabase.from('supplier_transactions').insert({
                     id: crypto.randomUUID(),
                     supplier_id: supplierRefund.id,
                     type: 'purchase_return',
                     amount: supplierRefund.amount,
                     date: new Date().toISOString(),
                     description: `مرجوعی خرید #${returnInvoice.originalInvoiceId}`,
                     invoice_id: returnInvoice.id
                });
            }
        }
    },
    
    // --- Financial Payments ---
    processPayment: async (
        entityType: 'customer' | 'supplier' | 'employee', 
        entityId: string, 
        newBalance: number, 
        transaction: any
    ) => {
        const table = entityType === 'customer' ? 'customers' : (entityType === 'supplier' ? 'suppliers' : 'employees');
        const txTable = entityType === 'customer' ? 'customer_transactions' : (entityType === 'supplier' ? 'supplier_transactions' : 'payroll_transactions');
        
        await supabase.from(table).update({ balance: newBalance }).eq('id', entityId);
        
        const txData: any = { ...transaction };
        if (entityType === 'customer') txData.customer_id = transaction.customerId;
        if (entityType === 'supplier') txData.supplier_id = transaction.supplierId;
        if (entityType === 'employee') txData.employee_id = transaction.employeeId;
        
        delete txData.customerId;
        delete txData.supplierId;
        delete txData.employeeId;
        delete txData.invoiceId; // Optional handling if present
        if(transaction.invoiceId) txData.invoice_id = transaction.invoiceId;

        await supabase.from(txTable).insert(txData);
    },
    
    processPayroll: async (updates: {id: string, balance: 0}[], transactions: PayrollTransaction[], expense: Expense) => {
        // 1. Reset balances
        for(const u of updates) {
            await supabase.from('employees').update({ balance: 0 }).eq('id', u.id);
        }
        // 2. Add transactions
        const txs = transactions.map(t => ({
            id: t.id,
            employee_id: t.employeeId,
            type: t.type,
            amount: t.amount,
            date: t.date,
            description: t.description
        }));
        await supabase.from('payroll_transactions').insert(txs);
        
        // 3. Add Expense
        await supabase.from('expenses').insert({
            id: expense.id,
            category: expense.category,
            description: expense.description,
            amount: expense.amount,
            date: expense.date
        });
    },

    // --- DANGEROUS: Wipe and Restore Database ---
    clearAndRestoreData: async (data: AppState) => {
        // 1. Delete everything in reverse dependency order
        const tablesToDelete = [
            'sale_invoice_items', 'purchase_invoice_items', 'product_batches',
            'customer_transactions', 'supplier_transactions', 'payroll_transactions', 'activity_logs',
            'sale_invoices', 'purchase_invoices',
            'products', 'customers', 'suppliers', 'employees', 'services', 'expenses',
            'store_settings'
        ];

        for (const table of tablesToDelete) {
            const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (neq dummy)
            if (error) console.error(`Error clearing table ${table}:`, error);
        }

        // 2. Restore Data in correct order
        
        // Settings
        if (data.storeSettings) {
            // We update ID 1 rather than insert, as settings is a singleton
            await api.updateSettings(data.storeSettings); 
        }

        // Base Entities
        if (data.services.length > 0) {
            await supabase.from('services').insert(data.services.map(s => ({ id: s.id, name: s.name, price: s.price })));
        }
        if (data.customers.length > 0) {
            await supabase.from('customers').insert(data.customers.map(c => ({ id: c.id, name: c.name, phone: c.phone, credit_limit: c.creditLimit, balance: c.balance })));
        }
        if (data.suppliers.length > 0) {
            await supabase.from('suppliers').insert(data.suppliers.map(s => ({ id: s.id, name: s.name, contact_person: s.contactPerson, phone: s.phone, address: s.address, balance: s.balance })));
        }
        if (data.employees.length > 0) {
            await supabase.from('employees').insert(data.employees.map(e => ({ id: e.id, name: e.name, position: e.position, monthly_salary: e.monthlySalary, balance: e.balance })));
        }
        if (data.expenses.length > 0) {
            await supabase.from('expenses').insert(data.expenses.map(e => ({ id: e.id, category: e.category, description: e.description, amount: e.amount, date: e.date })));
        }

        // Products & Batches
        if (data.products.length > 0) {
            const productsData = data.products.map(p => ({
                id: p.id, name: p.name, sale_price: p.salePrice, barcode: p.barcode, manufacturer: p.manufacturer, items_per_package: p.itemsPerPackage
            }));
            await supabase.from('products').insert(productsData);

            const batchesData = data.products.flatMap(p => p.batches.map(b => ({
                id: b.id, product_id: p.id, lot_number: b.lotNumber, stock: b.stock, purchase_price: b.purchasePrice, purchase_date: b.purchaseDate, expiry_date: b.expiryDate
            })));
            if (batchesData.length > 0) await supabase.from('product_batches').insert(batchesData);
        }

        // Invoices
        if (data.saleInvoices.length > 0) {
            const salesData = data.saleInvoices.map(i => ({
                id: i.id, type: i.type, original_invoice_id: i.originalInvoiceId, subtotal: i.subtotal, total_discount: i.totalDiscount, total_amount: i.totalAmount, timestamp: i.timestamp, cashier: i.cashier, customer_id: i.customerId
            }));
            await supabase.from('sale_invoices').insert(salesData);

            const saleItemsData = data.saleInvoices.flatMap(inv => inv.items.map(item => ({
                invoice_id: inv.id, item_id: item.id, type: item.type, name: item.name, quantity: item.quantity, 
                price: (item.type === 'product' ? (item as any).salePrice : (item as any).price),
                final_price: (item.type === 'product' && (item as any).finalPrice !== undefined) ? (item as any).finalPrice : (item as any).salePrice,
                purchase_price: (item.type === 'product' ? (item as any).purchasePrice : 0) // Include during restore
            })));
            if (saleItemsData.length > 0) await supabase.from('sale_invoice_items').insert(saleItemsData);
        }

        if (data.purchaseInvoices.length > 0) {
            const purchasesData = data.purchaseInvoices.map(i => ({
                id: i.id, type: i.type, original_invoice_id: i.originalInvoiceId, supplier_id: i.supplierId, invoice_number: i.invoiceNumber, total_amount: i.totalAmount, timestamp: i.timestamp, currency: i.currency, exchange_rate: i.exchangeRate
            }));
            await supabase.from('purchase_invoices').insert(purchasesData);

            const purchaseItemsData = data.purchaseInvoices.flatMap(inv => inv.items.map(item => ({
                invoice_id: inv.id, product_id: item.productId, product_name: item.productName, quantity: item.quantity, purchase_price: item.purchasePrice, lot_number: item.lotNumber, expiry_date: item.expiryDate 
            })));
            if (purchaseItemsData.length > 0) await supabase.from('purchase_invoice_items').insert(purchaseItemsData);
        }

        // Transactions & Activity
        if (data.customerTransactions.length > 0) {
            await supabase.from('customer_transactions').insert(data.customerTransactions.map(t => ({
                id: t.id, customer_id: t.customerId, type: t.type, amount: t.amount, date: t.date, description: t.description, invoice_id: t.invoiceId
            })));
        }
        if (data.supplierTransactions.length > 0) {
            await supabase.from('supplier_transactions').insert(data.supplierTransactions.map(t => ({
                id: t.id, supplier_id: t.supplierId, type: t.type, amount: t.amount, date: t.date, description: t.description, invoice_id: t.invoiceId, currency: t.currency
            })));
        }
        if (data.payrollTransactions.length > 0) {
            await supabase.from('payroll_transactions').insert(data.payrollTransactions.map(t => ({
                id: t.id, employee_id: t.employeeId, type: t.type, amount: t.amount, date: t.date, description: t.description
            })));
        }
        if (data.activities && data.activities.length > 0) {
            await supabase.from('activity_logs').insert(data.activities.map(a => ({
                id: a.id, type: a.type, description: a.description, timestamp: a.timestamp, user: a.user, ref_id: a.refId, ref_type: a.refType
            })));
        }
    }

};
