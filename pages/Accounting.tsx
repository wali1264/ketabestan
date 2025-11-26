

import React, { useState } from 'react';
import { useAppContext } from '../AppContext';
import type { Supplier, Employee, Customer, Expense, AnyTransaction, CustomerTransaction, SupplierTransaction, PayrollTransaction } from '../types';
import { PlusIcon, XIcon, EyeIcon, TrashIcon } from '../components/icons';
import Toast from '../components/Toast';
import { formatCurrency } from '../utils/formatters';
import TransactionHistoryModal from '../components/TransactionHistoryModal';
import ReceiptPreviewModal from '../components/ReceiptPreviewModal';

const Modal: React.FC<{ title: string, onClose: () => void, children: React.ReactNode }> = ({ title, onClose, children }) => (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 modal-animate">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
                <h2 className="text-xl font-bold text-slate-800">{title}</h2>
                <button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-red-100 hover:text-red-600 transition-colors"><XIcon className="w-6 h-6" /></button>
            </div>
            <div className="p-6 bg-white">{children}</div>
        </div>
    </div>
);


const SuppliersTab = () => {
    const { suppliers, addSupplier, deleteSupplier, addSupplierPayment, supplierTransactions, storeSettings } = useAppContext();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [toast, setToast] = useState('');
    const [historyModalData, setHistoryModalData] = useState<{ person: Supplier, transactions: SupplierTransaction[] } | null>(null);
    const [receiptModalData, setReceiptModalData] = useState<{ person: Supplier, transaction: SupplierTransaction } | null>(null);
    
    // Add Supplier State
    const [addSupplierCurrency, setAddSupplierCurrency] = useState<'AFN' | 'USD'>('AFN');
    const [addSupplierRate, setAddSupplierRate] = useState('');

    // Payment State
    const [paymentCurrency, setPaymentCurrency] = useState<'AFN' | 'USD'>('AFN');
    const [exchangeRate, setExchangeRate] = useState('');

    const showToast = (message: string) => { setToast(message); setTimeout(() => setToast(''), 3000); };

    const handleAddSupplierForm = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const initialAmount = Number(formData.get('initialBalance'));
        const initialType = formData.get('balanceType') as 'creditor' | 'debtor';
        
        if (addSupplierCurrency === 'USD' && initialAmount > 0 && (!addSupplierRate || Number(addSupplierRate) <= 0)) {
            showToast("لطفا نرخ ارز را وارد کنید.");
            return;
        }

        addSupplier({
            name: formData.get('name') as string,
            contactPerson: formData.get('contactPerson') as string,
            phone: formData.get('phone') as string,
        }, initialAmount > 0 ? { 
            amount: initialAmount, 
            type: initialType, 
            currency: addSupplierCurrency,
            exchangeRate: addSupplierCurrency === 'USD' ? Number(addSupplierRate) : 1 
        } : undefined);
        
        setAddSupplierCurrency('AFN');
        setAddSupplierRate('');
        setIsAddModalOpen(false);
    };
    
    const handleDelete = (supplier: Supplier) => {
        if (Math.abs(supplier.balance) > 0) {
            showToast("حذف فقط برای حساب‌های با موجودی صفر امکان‌پذیر است.");
            return;
        }
        if (window.confirm(`آیا از حذف تأمین‌کننده "${supplier.name}" اطمینان دارید؟`)) {
            deleteSupplier(supplier.id);
        }
    };

    const handleOpenPayModal = (supplier: Supplier) => {
        setSelectedSupplier(supplier);
        setPaymentCurrency('AFN');
        setExchangeRate('');
        setIsPayModalOpen(true);
    };

    const handleAddPaymentForm = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!selectedSupplier) return;
        
        const formData = new FormData(e.currentTarget);
        const amount = Number(formData.get('amount'));
        const description = formData.get('description') as string || 'پرداخت وجه';

        if (!amount || amount <= 0) {
            showToast("مبلغ باید بزرگتر از صفر باشد.");
            return;
        }
        
        if (paymentCurrency === 'USD' && (!exchangeRate || Number(exchangeRate) <= 0)) {
            showToast("لطفاً نرخ ارز را وارد کنید.");
            return;
        }

        const newTransaction = addSupplierPayment(
            selectedSupplier.id, 
            amount, 
            description, 
            paymentCurrency, 
            paymentCurrency === 'USD' ? Number(exchangeRate) : 1
        );
        
        if (newTransaction) {
            setIsPayModalOpen(false);
            setReceiptModalData({ person: selectedSupplier, transaction: newTransaction });
            setSelectedSupplier(null);
        }
    };
    
    const handleViewHistory = (supplier: Supplier) => {
        const transactions = supplierTransactions.filter(t => t.supplierId === supplier.id);
        setHistoryModalData({ person: supplier, transactions });
    };

    const handleReprint = (transactionId: string) => {
        const transaction = supplierTransactions.find(t => t.id === transactionId);
        const supplier = suppliers.find(s => s.id === transaction?.supplierId);
        if (transaction && supplier) {
            setHistoryModalData(null); // Close history modal first
            setReceiptModalData({ person: supplier, transaction });
        }
    };


    return (
        <div>
            {toast && <Toast message={toast} onClose={() => setToast('')} />}
            <button onClick={() => setIsAddModalOpen(true)} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md mb-6 btn-primary">
                <PlusIcon className="w-5 h-5 ml-2" /> <span className="font-semibold">افزودن تأمین‌کننده</span>
            </button>
             <div className="overflow-hidden rounded-xl border border-gray-200/60 shadow-md hidden md:block">
                 <table className="min-w-full text-center bg-white/60 table-zebra">
                    <thead className="bg-white/50">
                        <tr>
                            <th className="p-4 font-bold text-slate-700">نام</th>
                            <th className="p-4 font-bold text-slate-700">تلفن</th>
                            <th className="p-4 font-bold text-slate-700">موجودی حساب (بدهی ما)</th>
                            <th className="p-4 font-bold text-slate-700">عملیات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {suppliers.map(s => (
                            <tr key={s.id} className="border-t border-gray-200/60">
                                <td className="p-4 text-lg font-semibold text-slate-800">{s.name}</td>
                                <td className="p-4 text-lg text-slate-600">{s.phone}</td>
                                <td className="p-4 text-lg font-bold text-red-600">{formatCurrency(s.balance, storeSettings)}</td>
                                <td className="p-4">
                                    <div className="flex justify-center items-center gap-2">
                                        <button onClick={() => handleViewHistory(s)} className="p-2 rounded-full text-gray-500 hover:text-blue-600 hover:bg-blue-100/50 transition-colors" title="مشاهده صورت حساب"><EyeIcon /></button>
                                        <button 
                                            onClick={() => handleDelete(s)} 
                                            className={`p-2 rounded-full transition-colors ${Math.abs(s.balance) === 0 ? 'text-red-500 hover:bg-red-100 cursor-pointer' : 'text-gray-300 cursor-not-allowed'}`} 
                                            title={Math.abs(s.balance) === 0 ? "حذف تأمین‌کننده" : "برای حذف باید موجودی صفر باشد"}
                                            disabled={Math.abs(s.balance) > 0}
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                        <button onClick={() => handleOpenPayModal(s)} className="bg-green-500 text-white px-3 py-2 rounded-lg text-sm font-semibold btn-primary hover:!shadow-green-500/30">ثبت پرداخت</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
             {/* Mobile View */}
            <div className="md:hidden space-y-4">
                {suppliers.map(s => (
                    <div key={s.id} className="bg-white/70 p-4 rounded-xl shadow-md border">
                        <div className="flex justify-between items-start">
                           <h3 className="font-bold text-lg text-slate-800 mb-2">{s.name}</h3>
                           <div className="flex gap-1">
                               <button onClick={() => handleViewHistory(s)} className="p-2 rounded-full text-gray-500" title="مشاهده صورت حساب"><EyeIcon /></button>
                               <button 
                                    onClick={() => handleDelete(s)} 
                                    className={`p-2 rounded-full ${Math.abs(s.balance) === 0 ? 'text-red-500' : 'text-gray-300'}`}
                                    disabled={Math.abs(s.balance) > 0}
                                >
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                           </div>
                        </div>
                        <p className="text-sm text-slate-500">{s.phone}</p>
                        <div className="flex justify-between items-center mt-3 pt-3 border-t">
                            <div>
                                <p className="text-sm text-slate-500">بدهی ما:</p>
                                <p className="font-bold text-red-600 text-lg">{formatCurrency(s.balance, storeSettings)}</p>
                            </div>
                            <button onClick={() => handleOpenPayModal(s)} className="bg-green-500 text-white px-3 py-2 rounded-lg text-sm font-semibold">ثبت پرداخت</button>
                        </div>
                    </div>
                ))}
            </div>

            {isAddModalOpen && (
                <Modal title="افزودن تأمین‌کننده جدید" onClose={() => setIsAddModalOpen(false)}>
                    <form onSubmit={handleAddSupplierForm} className="space-y-4">
                        <input name="name" placeholder="نام تأمین‌کننده" className="w-full p-3 border rounded-lg form-input" required/>
                        <input name="contactPerson" placeholder="فرد مسئول" className="w-full p-3 border rounded-lg form-input" />
                        <input name="phone" placeholder="شماره تلفن" className="w-full p-3 border rounded-lg form-input" />
                        
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 space-y-3">
                            <p className="text-sm font-bold text-slate-700">تراز اول دوره (اختیاری)</p>
                            
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" checked={addSupplierCurrency === 'AFN'} onChange={() => setAddSupplierCurrency('AFN')} className="form-radio text-blue-600" />
                                    <span>افغانی</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" checked={addSupplierCurrency === 'USD'} onChange={() => setAddSupplierCurrency('USD')} className="form-radio text-green-600" />
                                    <span>دلار</span>
                                </label>
                            </div>

                            {addSupplierCurrency === 'USD' && (
                                <div className="flex items-center gap-2">
                                    <span className="text-sm whitespace-nowrap font-semibold">نرخ تبدیل:</span>
                                    <input 
                                        type="number" 
                                        value={addSupplierRate} 
                                        onChange={e => setAddSupplierRate(e.target.value)} 
                                        placeholder="68" 
                                        className="w-full p-2 border rounded-lg form-input font-mono" 
                                    />
                                </div>
                            )}

                            <div className="flex gap-2">
                                <input name="initialBalance" type="number" placeholder={`مبلغ اولیه (${addSupplierCurrency})`} className="flex-grow p-2 border rounded-lg" />
                                <select name="balanceType" className="p-2 border rounded-lg bg-white w-1/3 text-sm">
                                    <option value="creditor">ما بدهکاریم</option>
                                    <option value="debtor">او بدهکار است</option>
                                </select>
                            </div>
                        </div>

                        <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-lg btn-primary font-semibold">ذخیره</button>
                    </form>
                </Modal>
            )}
            {isPayModalOpen && selectedSupplier && (
                 <Modal title={`ثبت پرداخت برای ${selectedSupplier.name}`} onClose={() => setIsPayModalOpen(false)}>
                    <form onSubmit={handleAddPaymentForm} className="space-y-4">
                        <div className="flex gap-4 p-2 bg-blue-50 rounded-lg">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" checked={paymentCurrency === 'AFN'} onChange={() => setPaymentCurrency('AFN')} className="form-radio text-blue-600" />
                                <span>افغانی (AFN)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" checked={paymentCurrency === 'USD'} onChange={() => setPaymentCurrency('USD')} className="form-radio text-green-600" />
                                <span>دلار (USD)</span>
                            </label>
                        </div>
                        {paymentCurrency === 'USD' && (
                             <div className="flex items-center gap-2">
                                <span className="text-sm whitespace-nowrap">نرخ تبدیل:</span>
                                <input 
                                    type="number" 
                                    value={exchangeRate} 
                                    onChange={e => setExchangeRate(e.target.value)} 
                                    placeholder="68" 
                                    className="w-full p-2 border rounded-lg form-input font-mono" 
                                />
                            </div>
                        )}
                        <input name="amount" type="number" placeholder={`مبلغ پرداخت (${paymentCurrency === 'USD' ? '$' : storeSettings.currencyName})`} className="w-full p-3 border rounded-lg form-input" required />
                        <input name="description" placeholder="بابت (اختیاری)" className="w-full p-3 border rounded-lg form-input" />
                        <button type="submit" className="w-full bg-green-600 text-white p-3 rounded-lg btn-primary font-semibold">ثبت و چاپ رسید</button>
                    </form>
                </Modal>
            )}
            {historyModalData && (
                <TransactionHistoryModal 
                    person={historyModalData.person}
                    transactions={historyModalData.transactions}
                    type="supplier"
                    onClose={() => setHistoryModalData(null)}
                    onReprint={handleReprint}
                />
            )}
            {receiptModalData && (
                <ReceiptPreviewModal
                    person={receiptModalData.person}
                    transaction={receiptModalData.transaction}
                    type="supplier"
                    onClose={() => setReceiptModalData(null)}
                />
            )}
        </div>
    );
};

const PayrollTab = () => {
    const { employees, addEmployee, addEmployeeAdvance, payrollTransactions, processAndPaySalaries, storeSettings } = useAppContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [toast, setToast] = useState('');
    const [historyModalData, setHistoryModalData] = useState<{ person: Employee, transactions: PayrollTransaction[] } | null>(null);


    const showToast = (message: string) => { setToast(message); setTimeout(() => setToast(''), 3000); };
    
    const handleAddEmployeeForm = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        addEmployee({
            name: formData.get('name') as string,
            position: formData.get('position') as string,
            monthlySalary: Number(formData.get('salary')),
        });
        setIsModalOpen(false);
    };
    
    const handleAddAdvanceForm = (ev: React.FormEvent<HTMLFormElement>, employeeId: string) => {
        ev.preventDefault();
        const amount = Number(new FormData(ev.currentTarget).get('amount'));
        if (!amount || amount <= 0) return;
        addEmployeeAdvance(employeeId, amount);
        (ev.target as HTMLFormElement).reset();
    };

    const handleProcessSalaries = () => {
        if (window.confirm("آیا از پردازش و پرداخت حقوق تمام کارمندان اطمینان دارید؟ این عمل تمام پیش‌پرداخت‌ها را صفر کرده و پرداخت نهایی را ثبت می‌کند.")) {
            const result = processAndPaySalaries();
            showToast(result.message);
        }
    };
    
    const handleViewHistory = (employee: Employee) => {
        const transactions = payrollTransactions.filter(t => t.employeeId === employee.id);
        setHistoryModalData({ person: employee, transactions });
    };

    return (
         <div>
            {toast && <Toast message={toast} onClose={() => setToast('')} />}
            <div className="flex flex-wrap gap-4 mb-6">
                <button onClick={() => setIsModalOpen(true)} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md btn-primary">
                    <PlusIcon className="w-5 h-5 ml-2" /> <span className="font-semibold">افزودن کارمند</span>
                </button>
                 <button onClick={handleProcessSalaries} className="flex items-center bg-green-600 text-white px-4 py-2 rounded-lg shadow-md btn-primary hover:!shadow-green-500/30">
                    <span className="font-semibold">پردازش و پرداخت حقوق ماهانه</span>
                </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-200/60 shadow-md">
                <table className="min-w-full text-center bg-white/60 responsive-table">
                    <thead>
                        <tr>
                            <th className="p-4 font-bold text-slate-700"></th>
                            <th className="p-4 font-bold text-slate-700">نام کارمند</th>
                            <th className="p-4 font-bold text-slate-700">حقوق ماهانه</th>
                            <th className="p-4 font-bold text-slate-700">پیش‌پرداخت‌ها</th>
                             <th className="p-4 font-bold text-slate-700">مانده حقوق</th>
                            <th className="p-4 font-bold text-slate-700">ثبت پیش‌پرداخت</th>
                        </tr>
                    </thead>
                    <tbody>
                        {employees.map(e => (
                            <tr key={e.id}>
                                <td className="p-4">
                                    <button onClick={() => handleViewHistory(e)} className="p-2 rounded-full text-gray-500 hover:text-blue-600 hover:bg-blue-100/50 transition-colors" title="مشاهده صورت حساب"><EyeIcon /></button>
                                </td>
                                <td data-label="نام کارمند" className="p-4 text-lg font-semibold text-slate-800">{e.name}</td>
                                <td data-label="حقوق ماهانه" className="p-4 text-lg text-slate-600">{formatCurrency(e.monthlySalary, storeSettings)}</td>
                                <td data-label="پیش‌پرداخت‌ها" className="p-4 text-lg text-red-500">{formatCurrency(e.balance, storeSettings)}</td>
                                <td data-label="مانده حقوق" className="p-4 text-lg font-bold text-green-600">{formatCurrency(e.monthlySalary - e.balance, storeSettings)}</td>
                                <td data-label="ثبت پیش‌پرداخت" className="p-4 actions-cell">
                                    <form onSubmit={(ev) => handleAddAdvanceForm(ev, e.id)} className="flex justify-center items-center gap-2">
                                        <input type="number" name="amount" className="w-28 p-2 border rounded-lg form-input" placeholder="مبلغ" />
                                        <button type="submit" className="bg-green-500 text-white px-3 py-2 rounded-lg text-sm font-semibold btn-primary hover:!shadow-green-500/30">ثبت</button>
                                    </form>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {isModalOpen && (
                <Modal title="افزودن کارمند جدید" onClose={() => setIsModalOpen(false)}>
                    <form onSubmit={handleAddEmployeeForm} className="space-y-4">
                        <input name="name" placeholder="نام کامل" className="w-full p-3 border rounded-lg form-input" required />
                        <input name="position" placeholder="موقعیت شغلی" className="w-full p-3 border rounded-lg form-input" />
                        <input name="salary" type="number" placeholder={`حقوق ماهانه (${storeSettings.currencyName})`} className="w-full p-3 border rounded-lg form-input" required />
                        <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-lg btn-primary font-semibold">ذخیره</button>
                    </form>
                </Modal>
            )}
            {historyModalData && (
                 <TransactionHistoryModal 
                    person={historyModalData.person}
                    transactions={historyModalData.transactions}
                    type="employee"
                    onClose={() => setHistoryModalData(null)}
                    onReprint={() => {}} // No reprint for payroll yet
                />
            )}
        </div>
    );
};

const CustomersTab = () => {
    const { customers, addCustomer, deleteCustomer, addCustomerPayment, customerTransactions, storeSettings } = useAppContext();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [toast, setToast] = useState('');
    const [historyModalData, setHistoryModalData] = useState<{ person: Customer, transactions: CustomerTransaction[] } | null>(null);
    const [receiptModalData, setReceiptModalData] = useState<{ person: Customer, transaction: CustomerTransaction } | null>(null);

    // Add Customer State
    const [addCustomerCurrency, setAddCustomerCurrency] = useState<'AFN' | 'USD'>('AFN');
    const [addCustomerRate, setAddCustomerRate] = useState('');

    const showToast = (message: string) => { setToast(message); setTimeout(() => setToast(''), 3000); };

    const handleAddCustomerForm = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const initialAmount = Number(formData.get('initialBalance'));
        const initialType = formData.get('balanceType') as 'creditor' | 'debtor';

        if (addCustomerCurrency === 'USD' && initialAmount > 0 && (!addCustomerRate || Number(addCustomerRate) <= 0)) {
            showToast("لطفا نرخ ارز را وارد کنید.");
            return;
        }

        addCustomer({
            name: formData.get('name') as string,
            phone: formData.get('phone') as string,
        }, initialAmount > 0 ? { 
            amount: initialAmount, 
            type: initialType,
            currency: addCustomerCurrency,
            exchangeRate: addCustomerCurrency === 'USD' ? Number(addCustomerRate) : 1
        } : undefined);
        
        setAddCustomerCurrency('AFN');
        setAddCustomerRate('');
        setIsAddModalOpen(false);
    };

    const handleDelete = (customer: Customer) => {
        if (Math.abs(customer.balance) > 0) {
            showToast("حذف فقط برای حساب‌های با موجودی صفر امکان‌پذیر است.");
            return;
        }
        if (window.confirm(`آیا از حذف مشتری "${customer.name}" اطمینان دارید؟`)) {
            deleteCustomer(customer.id);
        }
    };

    const handleOpenPayModal = (customer: Customer) => {
        setSelectedCustomer(customer);
        setIsPayModalOpen(true);
    };

    const handleAddPaymentForm = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!selectedCustomer) return;
        
        const formData = new FormData(e.currentTarget);
        const amount = Number(formData.get('amount'));
        const description = formData.get('description') as string || 'دریافت نقدی';
        
        if (!amount || amount <= 0) {
            showToast("مبلغ باید بزرگتر از صفر باشد.");
            return;
        }
        const newTransaction = addCustomerPayment(selectedCustomer.id, amount, description);
        if (newTransaction) {
            setIsPayModalOpen(false);
            setReceiptModalData({ person: selectedCustomer, transaction: newTransaction });
            setSelectedCustomer(null);
        }
    };

    const handleViewHistory = (customer: Customer) => {
        const transactions = customerTransactions.filter(t => t.customerId === customer.id);
        setHistoryModalData({ person: customer, transactions });
    };

    const handleReprint = (transactionId: string) => {
        const transaction = customerTransactions.find(t => t.id === transactionId);
        const customer = customers.find(c => c.id === transaction?.customerId);
        if (transaction && customer) {
            setHistoryModalData(null);
            setReceiptModalData({ person: customer, transaction });
        }
    };

    return (
        <div>
             {toast && <Toast message={toast} onClose={() => setToast('')} />}
            <button onClick={() => setIsAddModalOpen(true)} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md mb-6 btn-primary">
                <PlusIcon className="w-5 h-5 ml-2" /> <span className="font-semibold">افزودن مشتری</span>
            </button>
            <div className="overflow-hidden rounded-xl border border-gray-200/60 shadow-md hidden md:block">
                <table className="min-w-full text-center bg-white/60 table-zebra">
                    <thead className="bg-white/50">
                        <tr>
                            <th className="p-4 font-bold text-slate-700">نام مشتری</th>
                            <th className="p-4 font-bold text-slate-700">تلفن</th>
                            <th className="p-4 font-bold text-slate-700">موجودی حساب (طلب ما)</th>
                            <th className="p-4 font-bold text-slate-700">عملیات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {customers.map(c => (
                            <tr key={c.id} className="border-t border-gray-200/60">
                                <td className="p-4 text-lg font-semibold text-slate-800">{c.name}</td>
                                <td className="p-4 text-lg text-slate-600">{c.phone}</td>
                                <td className="p-4 text-lg font-bold text-green-600">{formatCurrency(c.balance, storeSettings)}</td>
                                <td className="p-4">
                                     <div className="flex justify-center items-center gap-2">
                                        <button onClick={() => handleViewHistory(c)} className="p-2 rounded-full text-gray-500 hover:text-blue-600 hover:bg-blue-100/50 transition-colors" title="مشاهده صورت حساب"><EyeIcon /></button>
                                        <button 
                                            onClick={() => handleDelete(c)} 
                                            className={`p-2 rounded-full transition-colors ${Math.abs(c.balance) === 0 ? 'text-red-500 hover:bg-red-100 cursor-pointer' : 'text-gray-300 cursor-not-allowed'}`} 
                                            title={Math.abs(c.balance) === 0 ? "حذف مشتری" : "برای حذف باید موجودی صفر باشد"}
                                            disabled={Math.abs(c.balance) > 0}
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                        <button onClick={() => handleOpenPayModal(c)} className="bg-green-500 text-white px-3 py-2 rounded-lg text-sm font-semibold btn-primary hover:!shadow-green-500/30">ثبت دریافت</button>
                                     </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

             {/* Mobile View */}
            <div className="md:hidden space-y-4">
                {customers.map(c => (
                     <div key={c.id} className="bg-white/70 p-4 rounded-xl shadow-md border">
                        <div className="flex justify-between items-start">
                           <h3 className="font-bold text-lg text-slate-800 mb-2">{c.name}</h3>
                           <div className="flex gap-1">
                               <button onClick={() => handleViewHistory(c)} className="p-2 rounded-full text-gray-500" title="مشاهده صورت حساب"><EyeIcon /></button>
                               <button 
                                    onClick={() => handleDelete(c)} 
                                    className={`p-2 rounded-full ${Math.abs(c.balance) === 0 ? 'text-red-500' : 'text-gray-300'}`}
                                    disabled={Math.abs(c.balance) > 0}
                                >
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                           </div>
                        </div>
                        <p className="text-sm text-slate-500">{c.phone}</p>
                        <div className="flex justify-between items-center mt-3 pt-3 border-t">
                            <div>
                                <p className="text-sm text-slate-500">طلب ما:</p>
                                <p className="font-bold text-green-600 text-lg">{formatCurrency(c.balance, storeSettings)}</p>
                            </div>
                            <button onClick={() => handleOpenPayModal(c)} className="bg-green-500 text-white px-3 py-2 rounded-lg text-sm font-semibold">ثبت دریافت</button>
                        </div>
                    </div>
                ))}
            </div>

            {isAddModalOpen && (
                <Modal title="افزودن مشتری جدید" onClose={() => setIsAddModalOpen(false)}>
                    <form onSubmit={handleAddCustomerForm} className="space-y-4">
                        <input name="name" placeholder="نام مشتری" className="w-full p-3 border rounded-lg form-input" required/>
                        <input name="phone" placeholder="شماره تلفن" className="w-full p-3 border rounded-lg form-input" />
                        
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 space-y-3">
                            <p className="text-sm font-bold text-slate-700">تراز اول دوره (اختیاری)</p>
                            
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" checked={addCustomerCurrency === 'AFN'} onChange={() => setAddCustomerCurrency('AFN')} className="form-radio text-blue-600" />
                                    <span>افغانی</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" checked={addCustomerCurrency === 'USD'} onChange={() => setAddCustomerCurrency('USD')} className="form-radio text-green-600" />
                                    <span>دلار</span>
                                </label>
                            </div>

                            {addCustomerCurrency === 'USD' && (
                                <div className="flex items-center gap-2">
                                    <span className="text-sm whitespace-nowrap font-semibold">نرخ تبدیل:</span>
                                    <input 
                                        type="number" 
                                        value={addCustomerRate} 
                                        onChange={e => setAddCustomerRate(e.target.value)} 
                                        placeholder="68" 
                                        className="w-full p-2 border rounded-lg form-input font-mono" 
                                    />
                                </div>
                            )}

                            <div className="flex gap-2">
                                <input name="initialBalance" type="number" placeholder={`مبلغ اولیه (${addCustomerCurrency})`} className="flex-grow p-2 border rounded-lg" />
                                <select name="balanceType" className="p-2 border rounded-lg bg-white w-1/3 text-sm">
                                    <option value="debtor">بدهکار است</option>
                                    <option value="creditor">بستانکار است</option>
                                </select>
                            </div>
                        </div>

                        <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-lg btn-primary font-semibold">ذخیره</button>
                    </form>
                </Modal>
            )}
             {isPayModalOpen && selectedCustomer && (
                 <Modal title={`ثبت دریافت از ${selectedCustomer.name}`} onClose={() => setIsPayModalOpen(false)}>
                    <form onSubmit={handleAddPaymentForm} className="space-y-4">
                        <input name="amount" type="number" placeholder={`مبلغ دریافتی (${storeSettings.currencyName})`} className="w-full p-3 border rounded-lg form-input" required />
                         <input name="description" placeholder="بابت (اختیاری)" className="w-full p-3 border rounded-lg form-input" />
                        <button type="submit" className="w-full bg-green-600 text-white p-3 rounded-lg btn-primary font-semibold">ثبت و چاپ رسید</button>
                    </form>
                </Modal>
            )}
            {historyModalData && (
                <TransactionHistoryModal 
                    person={historyModalData.person}
                    transactions={historyModalData.transactions}
                    type="customer"
                    onClose={() => setHistoryModalData(null)}
                    onReprint={handleReprint}
                />
            )}
            {receiptModalData && (
                <ReceiptPreviewModal
                    person={receiptModalData.person}
                    transaction={receiptModalData.transaction}
                    type="customer"
                    onClose={() => setReceiptModalData(null)}
                />
            )}
        </div>
    );
};

const ExpensesTab = () => {
    const { expenses, addExpense, storeSettings } = useAppContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const handleAddExpenseForm = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        addExpense({
            date: new Date(formData.get('date') as string).toISOString(),
            description: formData.get('description') as string,
            amount: Number(formData.get('amount')),
            category: formData.get('category') as any,
        });
        setIsModalOpen(false);
    };

    return (
        <div>
            <button onClick={() => setIsModalOpen(true)} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md mb-6 btn-primary">
                <PlusIcon className="w-5 h-5 ml-2" /> <span className="font-semibold">ثبت مصرف جدید</span>
            </button>
             <div className="overflow-x-auto rounded-xl border border-gray-200/60 shadow-md">
                <table className="min-w-full text-center bg-white/60 responsive-table">
                    <thead>
                        <tr>
                            <th className="p-4 font-bold text-slate-700">تاریخ</th>
                            <th className="p-4 font-bold text-slate-700">شرح</th>
                            <th className="p-4 font-bold text-slate-700">دسته بندی</th>
                            <th className="p-4 font-bold text-slate-700">مبلغ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {expenses.map(e => (
                            <tr key={e.id}>
                                <td data-label="تاریخ" className="p-4 text-lg text-slate-600">{new Date(e.date).toLocaleDateString('fa-IR')}</td>
                                <td data-label="شرح" className="p-4 text-lg font-semibold text-slate-800">{e.description}</td>
                                <td data-label="دسته بندی" className="p-4 text-lg text-slate-600">{e.category}</td>
                                <td data-label="مبلغ" className="p-4 text-lg font-semibold text-slate-800">{formatCurrency(e.amount, storeSettings)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {isModalOpen && (
                <Modal title="ثبت مصرف جدید" onClose={() => setIsModalOpen(false)}>
                    <form onSubmit={handleAddExpenseForm} className="space-y-4">
                        <input name="date" type="date" className="w-full p-3 border rounded-lg form-input" defaultValue={new Date().toISOString().split('T')[0]} required />
                        <input name="description" placeholder="شرح مصرف" className="w-full p-3 border rounded-lg form-input" required />
                        <input name="amount" type="number" placeholder={`مبلغ (${storeSettings.currencyName})`} className="w-full p-3 border rounded-lg form-input" required />
                        <select name="category" className="w-full p-3 border rounded-lg form-input bg-white">
                            <option value="utilities"> قبوض (برق، آب...)</option>
                            <option value="rent">کرایه</option>
                            <option value="supplies">ملزومات</option>
                            <option value="salary">حقوق</option>
                            <option value="other">سایر</option>
                        </select>
                        <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-lg btn-primary font-semibold">ذخیره</button>
                    </form>
                </Modal>
            )}
        </div>
    );
};


const Accounting: React.FC = () => {
    const { hasPermission } = useAppContext();
    const [activeTab, setActiveTab] = useState('suppliers');

    const tabs = [
        { id: 'suppliers', label: 'تأمین‌کنندگان', permission: 'accounting:manage_suppliers' },
        { id: 'payroll', label: 'حقوق و دستمزد', permission: 'accounting:manage_payroll' },
        { id: 'customers', label: 'مشتریان', permission: 'accounting:manage_customers' },
        { id: 'expenses', label: 'مصارف', permission: 'accounting:manage_expenses' },
    ];
    
    const accessibleTabs = tabs.filter(tab => hasPermission(tab.permission));
    
    // Set active tab to the first accessible one if current is not accessible
    if (!accessibleTabs.find(t => t.id === activeTab)) {
        if(accessibleTabs.length > 0) {
            setActiveTab(accessibleTabs[0].id);
        } else {
            return <div className="p-8"><p>شما به این بخش دسترسی ندارید.</p></div>;
        }
    }


    const renderContent = () => {
        switch (activeTab) {
            case 'suppliers': return <SuppliersTab />;
            case 'payroll': return <PayrollTab />;
            case 'customers': return <CustomersTab />;
            case 'expenses': return <ExpensesTab />;
            default: return null;
        }
    };

    return (
        <div className="p-4 md:p-8">
            <h1 className="text-2xl md:text-4xl mb-10">مرکز مالی</h1>

            <div className="bg-white/60 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/60">
                <div className="flex flex-wrap border-b border-gray-200/60 p-2 bg-white/40 rounded-t-2xl">
                    {accessibleTabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`py-3 px-4 md:px-6 font-bold text-md md:text-lg rounded-lg transition-all duration-300 ${
                                activeTab === tab.id
                                    ? 'bg-white shadow-md text-blue-600'
                                    : 'text-slate-600 hover:bg-white/70 hover:text-blue-600'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div className="p-4 md:p-6">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default Accounting;
