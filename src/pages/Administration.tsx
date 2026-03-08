import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
    Calendar,
    Download,
    DollarSign,
    TrendingUp,
    AlertCircle,
    Users,
    AlertTriangle,
    ArrowUpRight,
    ArrowDownRight,
    MoreHorizontal,
    Search,
    Filter,
    Activity,
    CheckCircle2,
    Clock,
    Building2,
    Plus,
    ChevronDown,
    Trash2,
    ChevronLeft,
    ChevronRight,
    QrCode,
    Edit2
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

// Interfaces
interface FinancialKPIs {
    mrr: number; // Stored MRR (Projection)
    mrr_growth_percent: number;
    forecast_30d: number;
    overdue_amount: number;
    avg_ticket: number;
    active_subscribers: number;
    churn_rate: number;
    churn_growth_percent: number;
    expenses?: number;
    balance?: number;
}

interface Transaction {
    id: string; // uuid
    client_name: string;
    description: string;
    transaction_date: string;
    amount: number;
    status: 'pago' | 'pendente' | 'atrasado' | 'cancelado';
    manual_override?: boolean;
    payment_method?: string;
    category?: 'profissional';
}

type DateRange = 'today' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'nextMonth' | 'all' | 'custom';

const TransactionMenu: React.FC<{ transaction: Transaction, onUpdate: () => void, onEdit: (trx: Transaction) => void }> = ({ transaction, onUpdate, onEdit }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleMarkPaid = async (method: string) => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('financial_transactions')
                .update({
                    status: 'pago',
                    manual_override: true,
                    payment_method: method
                })
                .eq('id', transaction.id);

            if (error) throw error;
            onUpdate();
        } catch (err: any) {
            alert('Erro: ' + err.message);
        } finally {
            setLoading(false);
            setIsOpen(false);
        }
    };



    const [menuStyle, setMenuStyle] = useState<{ top?: number, bottom?: number, left?: number, right?: number }>({});
    const buttonRef = useRef<HTMLButtonElement>(null);

    const toggleMenu = () => {
        if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const menuHeight = 200; // Approx height

            const newStyle: any = {
                // Align right edge of menu with right edge of button
                // right prop is distance from right edge of viewport
                right: window.innerWidth - rect.right,
            };

            // Vertical collision detection
            if (spaceBelow < menuHeight) {
                // Open upwards
                newStyle.bottom = window.innerHeight - rect.top + 4;
            } else {
                // Open downwards
                newStyle.top = rect.bottom + 4;
            }

            setMenuStyle(newStyle);
        }
        setIsOpen(!isOpen);
    };

    // Close on scroll or resize to prevent floating menu issues
    useEffect(() => {
        const handleScroll = () => { if (isOpen) setIsOpen(false); };
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleScroll);
        return () => {
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleScroll);
        };
    }, [isOpen]);

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                onClick={toggleMenu}
                className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                disabled={loading}
            >
                <MoreHorizontal size={18} />
            </button>

            {/* Menu via Portal */}
            {isOpen && createPortal(
                <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)}></div>
                    <div
                        style={menuStyle}
                        className="fixed w-48 bg-white border border-slate-200 rounded-xl shadow-xl p-1 z-[70] animate-in fade-in zoom-in-95 duration-100 origin-top-right"
                    >
                        <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Ações</div>

                        {transaction.status !== 'pago' && (
                            <>
                                <button
                                    onClick={() => handleMarkPaid('dinheiro')}
                                    className="w-full text-left px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 rounded-lg flex items-center gap-2"
                                >
                                    <DollarSign size={14} />
                                    <span>Receber (Dinheiro)</span>
                                </button>
                                <button
                                    onClick={() => handleMarkPaid('pix')}
                                    className="w-full text-left px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 rounded-lg flex items-center gap-2"
                                >
                                    <ArrowDownRight size={14} />
                                    <span>Receber (PIX)</span>
                                </button>
                            </>
                        )}

                        <button
                            onClick={async () => {
                                if (confirm('Tem certeza que deseja excluir esta transação?')) {
                                    setLoading(true);
                                    try {
                                        const { error } = await supabase.from('financial_transactions').delete().eq('id', transaction.id);
                                        if (error) throw error;
                                        onUpdate();
                                    } catch (e: any) {
                                        alert('Erro ao excluir: ' + e.message);
                                    } finally {
                                        setLoading(false);
                                    }
                                }
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2"
                        >
                            <Trash2 size={14} />
                            <span>Excluir</span>
                        </button>

                        <button
                            onClick={() => {
                                setIsOpen(false);
                                onEdit(transaction);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-2"
                        >
                            <Edit2 size={14} className="lucide-edit-2" />
                            <span>Editar</span>
                        </button>

                        <button className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg">
                            Ver Detalhes
                        </button>

                        <div className="h-px bg-slate-100 my-1"></div>


                    </div>
                </>,
                document.body
            )}
        </div >
    );
};

interface TransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    user_id: string;
    defaultCategory: 'profissional';
    editingTransaction?: Transaction | null;
}

const TransactionModal: React.FC<TransactionModalProps> = ({ isOpen, onClose, onSuccess, user_id, defaultCategory, editingTransaction }) => {
    const [type, setType] = useState<'income' | 'expense'>('income');
    const [category, setCategory] = useState<'pessoal' | 'profissional'>(defaultCategory);
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [clientName, setClientName] = useState('');
    const [date, setDate] = useState(new Date().toLocaleDateString('en-CA')); // ISO format YYYY-MM-DD
    const [status, setStatus] = useState<'pago' | 'pendente'>('pago');
    const [loading, setLoading] = useState(false);

    // Sync with editingTransaction
    useEffect(() => {
        if (editingTransaction) {
            setType(editingTransaction.amount >= 0 ? 'income' : 'expense');
            setCategory('profissional');
            setDescription(editingTransaction.description);
            setAmount(Math.abs(editingTransaction.amount).toString().replace('.', ','));
            setClientName(editingTransaction.client_name);

            // Format date for <input type="date">
            const d = new Date(editingTransaction.transaction_date);
            // Use local date for input to prevent timezone shift
            const localDate = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
            setDate(localDate);

            setStatus(editingTransaction.status === 'pago' ? 'pago' : 'pendente');
        } else {
            // Reset for new transaction
            setType('income');
            setCategory('profissional');
            setDescription('');
            setAmount('');
            setClientName('');
            setDate(new Date().toLocaleDateString('en-CA'));
            setStatus('pago');
        }
    }, [editingTransaction, isOpen, defaultCategory]);

    // Recurrence State
    const [isRecurring, setIsRecurring] = useState(false);
    const [recurrenceCount, setRecurrenceCount] = useState(1); // 1 = 1 month (just the transaction itself actually, but let's say repetitions)
    // Actually user said "repeats for X months". 
    // If I check "Recurrence", I expect at least 2? Or just "Repeat X times"?
    // "2 mil por mes durante 3 meses" -> 3 transactions.

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const numericAmount = parseFloat(amount.replace(/\./g, '').replace(',', '.'));
            if (isNaN(numericAmount)) throw new Error("Valor inválido");

            const finalAmount = type === 'expense' ? -Math.abs(numericAmount) : Math.abs(numericAmount);

            if (editingTransaction) {
                // Update existing
                const { error } = await supabase
                    .from('financial_transactions')
                    .update({
                        description,
                        amount: finalAmount,
                        transaction_date: new Date(date + 'T12:00:00').toISOString(), // Use mid-day to avoid TZ shifts
                        status,
                        client_name: clientName,
                        category,
                        manual_override: true
                    })
                    .eq('id', editingTransaction.id);

                if (error) throw error;
            } else {
                // Insert new
                const transactionsToInsert = [];
                // Use T12:00:00 to ensure the date stays the same in different timezones
                const baseDate = new Date(date + 'T12:00:00');

                const count = isRecurring ? Math.max(1, recurrenceCount) : 1;

                for (let i = 0; i < count; i++) {
                    const currentDate = new Date(baseDate);
                    currentDate.setMonth(baseDate.getMonth() + i);

                    transactionsToInsert.push({
                        user_id,
                        description: isRecurring ? `${description} (${i + 1}/${count})` : description,
                        amount: finalAmount,
                        transaction_date: currentDate.toISOString(),
                        status,

                        client_name: clientName || (type === 'expense' ? 'Despesa Operacional' : 'Cliente Avulso'),
                        manual_override: true,
                        category
                    });
                }

                const { error } = await supabase.from('financial_transactions').insert(transactionsToInsert);
                if (error) throw error;
            }
            onSuccess();
            onClose();
        } catch (error: any) {
            alert('Erro ao salvar: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 m-4 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-900">
                        {editingTransaction ? 'Editar Transação' : 'Nova Transação'}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <Plus className="rotate-45" size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                            type="button"
                            onClick={() => setType('income')}
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${type === 'income' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Receita (Ganho)
                        </button>
                        <button
                            type="button"
                            onClick={() => setType('expense')}
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${type === 'expense' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Despesa (Custo)
                        </button>
                    </div>



                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Descrição</label>
                        <input
                            required
                            type="text"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-500 transition-colors"
                            placeholder="Ex: Consultoria, Servidor, Aluguel"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Valor</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">R$</span>
                            <input
                                required
                                type="number"
                                step="0.01"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-500 transition-colors font-mono"
                                placeholder="0,00"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Data</label>
                            <input
                                required
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-500 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Status</label>
                            <select
                                value={status}
                                onChange={e => setStatus(e.target.value as any)}
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-500 transition-colors appearance-none"
                            >
                                <option value="pago">Pago / Recebido</option>
                                <option value="pendente">Pendente</option>
                            </select>
                        </div>
                    </div>

                    {/* Recurrence Options - Only for NEW transactions */}
                    {!editingTransaction && (
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <div className="flex items-center gap-2 mb-2">
                                <input
                                    type="checkbox"
                                    id="recurrence"
                                    checked={isRecurring}
                                    onChange={e => setIsRecurring(e.target.checked)}
                                    className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                                />
                                <label htmlFor="recurrence" className="text-sm font-medium text-slate-700">Repetir parcelas?</label>
                            </div>

                            {isRecurring && (
                                <div className="animate-in slide-in-from-top-1 duration-200">
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Número de Meses</label>
                                    <input
                                        type="number"
                                        min="2"
                                        max="120"
                                        value={recurrenceCount}
                                        onChange={e => setRecurrenceCount(parseInt(e.target.value))}
                                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-500 transition-colors"
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">Ex: 12 para 1 ano. Será gerado um lançamento por mês.</p>
                                </div>
                            )}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Cliente / Fornecedor (Opcional)</label>
                        <input
                            type="text"
                            value={clientName}
                            onChange={e => setClientName(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-500 transition-colors"
                            placeholder="Nome do cliente ou fornecedor"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-3 rounded-xl font-bold text-white shadow-lg shadow-brand-100 transition-all active:scale-95 ${loading ? 'bg-slate-300 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800'}`}
                    >
                        {loading ? 'Salvando...' : 'Salvar Transação'}
                    </button>
                </form>
            </div>
        </div>
    );
};

const AdministrationDashboard: React.FC = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'finance'>('finance');
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);


    // Data State
    const [storedKpis, setStoredKpis] = useState<FinancialKPIs | null>(null);
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
    const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Bulk Selection State
    const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());

    const toggleSelectAll = () => {
        if (selectedTransactions.size === paginatedTransactions.length && paginatedTransactions.length > 0) {
            setSelectedTransactions(new Set());
        } else {
            const newSet = new Set(selectedTransactions);
            paginatedTransactions.forEach(t => newSet.add(t.id));
            setSelectedTransactions(newSet);
        }
    };

    const toggleSelectTransaction = (id: string) => {
        const newSet = new Set(selectedTransactions);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedTransactions(newSet);
    };

    const handleBulkDelete = async () => {
        if (!selectedTransactions.size) return;
        if (!confirm(`Tem certeza que deseja excluir ${selectedTransactions.size} transações?`)) return;

        setLoading(true);
        try {
            const { error } = await supabase
                .from('financial_transactions')
                .delete()
                .in('id', Array.from(selectedTransactions));

            if (error) throw error;

            setSelectedTransactions(new Set());
            fetchFinancialData();
        } catch (err: any) {
            alert('Erro ao excluir: ' + err.message);
        } finally {
            setLoading(false);
        }
    };


    const paginatedTransactions = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredTransactions.slice(start, start + itemsPerPage);
    }, [filteredTransactions, currentPage]);

    const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);

    // Filter State
    const [dateRange, setDateRange] = useState<DateRange>('thisMonth');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    // Applied state for manual search trigger
    const [appliedCustomStart, setAppliedCustomStart] = useState('');
    const [appliedCustomEnd, setAppliedCustomEnd] = useState('');

    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const toggleFilter = () => setIsFilterOpen(!isFilterOpen);
    const selectRange = (range: DateRange) => {
        setDateRange(range);
        setIsFilterOpen(false);
    };

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user && activeTab === 'finance') {
            fetchFinancialData();
        }
    }, [user, activeTab]);

    // Filter Logic
    useEffect(() => {
        if (!allTransactions.length) return;

        const now = new Date();
        let start = new Date(0); // Epoch
        let end = new Date(); // Now

        // Helper to ensure we cover the full day
        const getStartOfDay = (d: Date) => {
            const newDate = new Date(d);
            newDate.setHours(0, 0, 0, 0);
            return newDate;
        };

        const getEndOfDay = (d: Date) => {
            const newDate = new Date(d);
            newDate.setHours(23, 59, 59, 999);
            return newDate;
        };

        switch (dateRange) {
            case 'today':
                start = getStartOfDay(now);
                end = getEndOfDay(now);
                break;
            case 'last7':
                start = getStartOfDay(now);
                start.setDate(now.getDate() - 7);
                end = getEndOfDay(now);
                break;
            case 'last30':
                start = getStartOfDay(now);
                start.setDate(now.getDate() - 30);
                end = getEndOfDay(now);
                break;
            case 'thisMonth':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                // Last day of current month
                end = getEndOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
                break;
            case 'lastMonth':
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                // Last day of previous month
                end = getEndOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
                break;
            case 'nextMonth':
                start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                // Last day of next month
                end = getEndOfDay(new Date(now.getFullYear(), now.getMonth() + 2, 0));
                break;
            case 'all':
                start = new Date(0);
                end = new Date(8640000000000000); // Max valid date
                break;
            case 'custom':
                // Custom range - Use APPLIED values
                if (appliedCustomStart) start = getStartOfDay(new Date(appliedCustomStart));
                if (appliedCustomEnd) end = getEndOfDay(new Date(appliedCustomEnd));
                break;
        }

        const filtered = allTransactions.filter(t => {
            // Adjust transaction date to handle potential timezone issues if stored as UTC but meant as local day
            // Assuming transaction_date is ISO string. 
            // We compare timestamps to be safe.
            const tDate = new Date(t.transaction_date);
            return tDate.getTime() >= start.getTime() && tDate.getTime() <= end.getTime();
        });

        // Apply Dashboard Scope Filter
        const scopedFiltered = filtered.filter(t => (t.category || 'profissional') === 'profissional');

        setFilteredTransactions(scopedFiltered);
        setCurrentPage(1); // Reset to first page on filter change
    }, [dateRange, allTransactions, appliedCustomStart, appliedCustomEnd]);

    const dynamicKPIs = useMemo(() => {
        if (!filteredTransactions.length) return {
            revenue: 0,
            expenses: 0,
            balance: 0,
            forecast: 0,
            overdue: 0,
            avgTicket: 0,
            count: 0
        };

        const revenue = filteredTransactions
            .filter(t => t.status === 'pago' && t.amount > 0)
            .reduce((acc, curr) => acc + curr.amount, 0);

        const expenses = filteredTransactions
            .filter(t => t.status === 'pago' && t.amount < 0)
            .reduce((acc, curr) => acc + Math.abs(curr.amount), 0);

        const balance = revenue - expenses;

        const forecast = filteredTransactions
            .filter(t => t.status === 'pendente')
            .reduce((acc, curr) => acc + curr.amount, 0);

        const overdue = filteredTransactions
            .filter(t => t.status === 'atrasado')
            .reduce((acc, curr) => acc + curr.amount, 0);

        const paidCount = filteredTransactions.filter(t => t.status === 'pago' && t.amount > 0).length;
        const avgTicket = paidCount > 0 ? revenue / paidCount : 0;

        return { revenue, expenses, balance, forecast, overdue, avgTicket, count: filteredTransactions.length };
    }, [filteredTransactions]);

    // Chart Data Generation
    const chartData = useMemo(() => {

        // 1. Calculate Start and End dates for the range to pre-fill missing days
        const now = new Date();
        let start = new Date(0);
        let end = new Date();

        switch (dateRange) {
            case 'today':
                start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'last7':
                start = new Date();
                start.setDate(now.getDate() - 7);
                break;
            case 'last30':
                start = new Date();
                start.setDate(now.getDate() - 30);
                break;
            case 'thisMonth':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                break;
            case 'lastMonth':
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                end = new Date(now.getFullYear(), now.getMonth(), 0);
                break;
            case 'nextMonth':
                start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
                break;
            case 'custom':
                if (appliedCustomStart) start = new Date(appliedCustomStart);
                if (appliedCustomEnd) end = new Date(appliedCustomEnd);
                break;
        }

        // 2. Pre-fill the map with all dates in the range (ascending order)
        const grouped = new Map<string, { revenue: number, expenses: number }>();
        if (dateRange !== 'all') {
            const current = new Date(start);
            const safetyLimit = 366;
            let count = 0;
            while (current <= end && count < safetyLimit) {
                const dateKey = current.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
                grouped.set(dateKey, { revenue: 0, expenses: 0 });
                current.setDate(current.getDate() + 1);
                count++;
            }
        }

        filteredTransactions.forEach(t => {
            // Include paid and pending? Usually charts show recognized revenue/cash flow.
            // Let's stick to 'pago' for actual cash flow, or 'pago' + 'pendente' for projection? 
            // "datas futuras... para ter noção do quanto irá receber" -> This implies Project/Forecast.
            // So I should include 'pendente' as well?
            // "O quanto ele irá receber"

            // Let's include everything except 'cancelado'.
            if (t.status !== 'cancelado') {
                const dateKey = new Date(t.transaction_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
                const curr = grouped.get(dateKey) || { revenue: 0, expenses: 0 };

                if (t.amount > 0) {
                    curr.revenue += t.amount;
                } else {
                    curr.expenses += Math.abs(t.amount);
                }
                grouped.set(dateKey, curr);
            }
        });

        const result = Array.from(grouped.entries()).map(([date, values]) => ({
            month_label: date,
            revenue: values.revenue,
            expenses: values.expenses,
        }));

        if (dateRange === 'all') {
            return result.reverse();
        }

        return result;
    }, [filteredTransactions, dateRange, appliedCustomStart, appliedCustomEnd]);


    const fetchFinancialData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Stored KPIs (for MRR reference)
            const { data: kpiData } = await supabase
                .from('financial_kpis')
                .select('*')
                .eq('user_id', user?.id)
                .single();

            if (kpiData) setStoredKpis(kpiData);

            // 2. Fetch ALL Transactions (Limit 500)
            const { data: trxData } = await supabase
                .from('financial_transactions')
                .select('*')
                .eq('user_id', user?.id)
                .order('transaction_date', { ascending: false })
                .limit(500);

            if (trxData) {
                const mappedTrx = trxData.map(t => ({ ...t, amount: t.amount || 0 })); // Ensure amount
                setAllTransactions(mappedTrx);
                setFilteredTransactions(mappedTrx); // Init
            }

        } catch (error) {
            console.error('Error fetching financial data:', error);
        } finally {
            setLoading(false);
        }
    };

    const TabButton = ({ id, label, icon: Icon }: { id: typeof activeTab, label: string, icon: any }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl transition-all duration-300 font-bold text-sm ${activeTab === id
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`}
        >
            <Icon size={18} className={activeTab === id ? 'text-brand-400' : ''} />
            <span className="whitespace-nowrap">{label}</span>
        </button>
    );



    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            {user && (
                <TransactionModal
                    isOpen={isTransactionModalOpen}
                    onClose={() => {
                        setIsTransactionModalOpen(false);
                        setEditingTransaction(null);
                    }}
                    onSuccess={() => { fetchFinancialData(); }}
                    user_id={user.id}
                    defaultCategory="profissional"
                    editingTransaction={editingTransaction}
                />
            )}

            {/* Header - Premium Dark Hero */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900 text-white p-8 rounded-3xl overflow-hidden relative shadow-2xl shadow-slate-900/10">
                <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-400 rounded-full blur-[100px] opacity-20 -translate-y-1/2 translate-x-1/2"></div>

                <div className="relative z-10">
                    <h1 className="text-3xl font-black mb-2 tracking-tight flex items-center gap-3">
                        <Building2 className="text-yellow-500" size={32} />
                        Administração
                    </h1>
                    <p className="text-slate-300 font-medium w-full">Gestão centralizada de departamentos, contratos e recursos da plataforma.</p>
                </div>

                <div className="relative z-10 flex gap-3">
                    {/* Actions specific to context could go here */}
                </div>
            </div>


            <div className="pt-6">
                {/* Finance Tab (Default) */}
                {activeTab === 'finance' && (
                    <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-300">

                        {/* Filters Toolbar */}
                        <div className="flex justify-end items-center gap-3">
                            <button
                                onClick={() => setIsTransactionModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-bold shadow-sm shadow-slate-200"
                            >
                                <Plus size={16} />
                                Nova Transação
                            </button>



                            <div className="relative">
                                <button
                                    onClick={toggleFilter}
                                    className={`flex items-center space-x-2 bg-white border px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm ${isFilterOpen ? 'border-slate-900 bg-slate-50 text-slate-900' : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                >
                                    <Calendar size={16} className={isFilterOpen ? "text-slate-900" : "text-slate-500"} />
                                    <span>
                                        {dateRange === 'today' && 'Hoje'}
                                        {dateRange === 'last7' && 'Últimos 7 dias'}
                                        {dateRange === 'last30' && 'Últimos 30 dias'}
                                        {dateRange === 'thisMonth' && 'Este Mês'}
                                        {dateRange === 'lastMonth' && 'Mês Passado'}
                                        {dateRange === 'nextMonth' && 'Próximo Mês'}
                                        {dateRange === 'all' && 'Todo o Período'}
                                        {dateRange === 'custom' && 'Personalizado'}
                                    </span>
                                    <ChevronDown size={14} className={`transition-transform duration-200 ${isFilterOpen ? 'rotate-180 text-slate-900' : 'text-slate-400'}`} />
                                </button>

                                {/* Custom Date Inputs */}
                                {dateRange === 'custom' && (
                                    <div className="flex items-center gap-2 animate-in fade-in duration-200">
                                        <input
                                            type="date"
                                            value={customStart}
                                            onChange={e => setCustomStart(e.target.value)}
                                            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-900"
                                        />
                                        <span className="text-slate-400">-</span>
                                        <input
                                            type="date"
                                            value={customEnd}
                                            onChange={e => setCustomEnd(e.target.value)}
                                            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-900"
                                        />
                                        <button
                                            onClick={() => {
                                                setAppliedCustomStart(customStart);
                                                setAppliedCustomEnd(customEnd);
                                            }}
                                            className="p-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
                                            title="Pesquisar"
                                        >
                                            <Search size={14} />
                                        </button>
                                    </div>
                                )}

                                {/* Overlay to close */}
                                {isFilterOpen && (
                                    <div className="fixed inset-0 z-40" onClick={() => setIsFilterOpen(false)}></div>
                                )}

                                {/* Dropdown */}
                                {isFilterOpen && (
                                    <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                                        <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Período</div>
                                        <button onClick={() => selectRange('today')} className={`w-full text-left px-3 py-2 text-sm rounded-lg mb-1 flex items-center justify-between ${dateRange === 'today' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>
                                            <span>Hoje</span>
                                            {dateRange === 'today' && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>}
                                        </button>
                                        <button onClick={() => selectRange('last7')} className={`w-full text-left px-3 py-2 text-sm rounded-lg mb-1 flex items-center justify-between ${dateRange === 'last7' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>
                                            <span>Últimos 7 dias</span>
                                            {dateRange === 'last7' && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>}
                                        </button>
                                        <button onClick={() => selectRange('last30')} className={`w-full text-left px-3 py-2 text-sm rounded-lg mb-1 flex items-center justify-between ${dateRange === 'last30' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>
                                            <span>Últimos 30 dias</span>
                                            {dateRange === 'last30' && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>}
                                        </button>
                                        <div className="h-px bg-slate-100 my-1"></div>
                                        <button onClick={() => selectRange('thisMonth')} className={`w-full text-left px-3 py-2 text-sm rounded-lg mb-1 flex items-center justify-between ${dateRange === 'thisMonth' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>
                                            <span>Este Mês</span>
                                            {dateRange === 'thisMonth' && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>}
                                        </button>
                                        <button onClick={() => selectRange('lastMonth')} className={`w-full text-left px-3 py-2 text-sm rounded-lg mb-1 flex items-center justify-between ${dateRange === 'lastMonth' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>
                                            <span>Mês Passado</span>
                                            {dateRange === 'lastMonth' && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>}
                                        </button>
                                        <button onClick={() => selectRange('nextMonth')} className={`w-full text-left px-3 py-2 text-sm rounded-lg mb-1 flex items-center justify-between ${dateRange === 'nextMonth' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>
                                            <span>Próximo Mês</span>
                                            {dateRange === 'nextMonth' && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>}
                                        </button>
                                        <div className="h-px bg-slate-100 my-1"></div>
                                        <button onClick={() => selectRange('all')} className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center justify-between ${dateRange === 'all' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>
                                            <span>Todo o Período</span>
                                            {dateRange === 'all' && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>}
                                        </button>
                                        <div className="h-px bg-slate-100 my-1"></div>
                                        <button onClick={() => selectRange('custom')} className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center justify-between ${dateRange === 'custom' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>
                                            <span>Personalizado</span>
                                            {dateRange === 'custom' && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>}
                                        </button>

                                    </div>

                                )}
                            </div>
                        </div>

                        {/* Metric Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Revenue (Dynamic) */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform">
                                        <TrendingUp size={20} />
                                    </div>
                                    <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Receita</span>
                                </div>
                                <div>
                                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Entradas (Pago)</h3>
                                    <div className="text-2xl font-black text-slate-900 tracking-tight">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dynamicKPIs.revenue)}
                                    </div>
                                </div>
                                <div className="h-1 w-full bg-emerald-100 mt-4 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 w-full"></div>
                                </div>
                            </div>

                            {/* Expenses (Dynamic) */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl group-hover:scale-110 transition-transform">
                                        <ArrowDownRight size={20} />
                                    </div>
                                    <span className="text-[10px] font-black uppercase text-rose-600 bg-rose-50 px-2 py-1 rounded-full">Despesas</span>
                                </div>
                                <div>
                                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Saídas (Pago)</h3>
                                    <div className="text-2xl font-black text-slate-900 tracking-tight">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dynamicKPIs.expenses)}
                                    </div>
                                </div>
                                <div className="h-1 w-full bg-rose-100 mt-4 rounded-full overflow-hidden">
                                    <div className="h-full bg-rose-500 w-3/4"></div>
                                </div>
                            </div>

                            {/* Balance (Dynamic) */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition-transform">
                                        <DollarSign size={20} />
                                    </div>
                                    <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Saldo</span>
                                </div>
                                <div>
                                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Caixa Líquido</h3>
                                    <div className={`text-2xl font-black tracking-tight ${dynamicKPIs.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dynamicKPIs.balance)}
                                    </div>
                                </div>
                                <div className="h-1 w-full bg-blue-100 mt-4 rounded-full overflow-hidden">
                                    <div className={`h-full bg-blue-500 w-1/2`}></div>
                                </div>
                            </div>

                            {/* Forecast (Dynamic) */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 transition-transform">
                                        <Clock size={20} />
                                    </div>
                                    <span className="text-[10px] font-black uppercase text-amber-600 bg-amber-50 px-2 py-1 rounded-full">Futuro</span>
                                </div>
                                <div>
                                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">A Receber</h3>
                                    <div className="text-2xl font-black text-slate-900 tracking-tight">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dynamicKPIs.forecast)}
                                    </div>
                                </div>
                                <div className="h-1 w-full bg-amber-100 mt-4 rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-500 w-1/3"></div>
                                </div>
                            </div>

                            {/* Overdue (Dynamic) */}
                        </div>

                        {/* Main Grid: Chart & Table */}
                        <div className="grid grid-cols-1 gap-8">

                            {/* Revenue Chart */}
                            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                                <div className="flex justify-between items-center mb-8">
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-900">Fluxo de Caixa (Periodo)</h2>
                                        <p className="text-xs text-slate-500 mt-1">Receitas confirmadas por dia no período selecionado</p>
                                    </div>
                                </div>

                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis
                                                dataKey="month_label"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#94a3b8', fontSize: 10 }}
                                                dy={10}
                                                interval="preserveStartEnd"
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#94a3b8', fontSize: 12 }}
                                                tickFormatter={(value) => {
                                                    if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}k`;
                                                    return `R$ ${value}`;
                                                }}
                                            />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="revenue"
                                                name="Receitas"
                                                stroke="#10b981"
                                                strokeWidth={3}
                                                fillOpacity={1}
                                                fill="url(#colorReceita)"
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="expenses"
                                                name="Despesas"
                                                stroke="#f43f5e"
                                                strokeWidth={3}
                                                fillOpacity={1}
                                                fill="url(#colorDespesa)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Transactions Table */}
                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div>
                                            <h2 className="text-lg font-bold text-slate-900">Transações Recentes</h2>
                                            <p className="text-xs text-slate-500 mt-1">Histórico completo de movimentações</p>
                                        </div>
                                        {selectedTransactions.size > 0 && (
                                            <button
                                                onClick={handleBulkDelete}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors text-xs font-bold animate-in fade-in zoom-in-95"
                                            >
                                                <Trash2 size={14} />
                                                <span>Excluir ({selectedTransactions.size})</span>
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <div className="relative group">
                                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                                            <input
                                                type="text"
                                                placeholder="Buscar transações..."
                                                className="pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all w-64"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-slate-100">
                                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-10 w-16">
                                                    <input
                                                        type="checkbox"
                                                        checked={paginatedTransactions.length > 0 && selectedTransactions.size >= paginatedTransactions.length}
                                                        onChange={toggleSelectAll}
                                                        className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                                    />
                                                </th>
                                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-0">Data</th>
                                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cliente / Descrição</th>
                                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Categoria</th>
                                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor</th>
                                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                                                <th className="px-8 py-5"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {paginatedTransactions.length > 0 ? (
                                                paginatedTransactions.map((trx, i) => (
                                                    <tr key={trx.id} className="hover:bg-slate-50/80 transition-colors group">
                                                        <td className="px-8 py-5 pl-10">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedTransactions.has(trx.id)}
                                                                onChange={() => toggleSelectTransaction(trx.id)}
                                                                className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                                            />
                                                        </td>
                                                        <td className="px-8 py-5 text-sm text-slate-500 pl-0 font-medium">
                                                            {(() => {
                                                                const d = new Date(trx.transaction_date);
                                                                // Display in local date format (BR) using local interpretation
                                                                return new Date(d.getTime() + d.getTimezoneOffset() * 60000).toLocaleDateString();
                                                            })()}
                                                        </td>
                                                        <td className="px-8 py-5">
                                                            <div className="font-bold text-slate-900 text-sm">{trx.client_name}</div>
                                                            <div className="text-xs text-slate-400 mt-0.5">{trx.description}</div>
                                                        </td>
                                                        <td className="px-8 py-5">
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border bg-slate-100 text-slate-600 border-slate-200">
                                                                Profissional
                                                            </span>
                                                        </td>
                                                        <td className="px-8 py-5 text-sm font-black text-slate-900">
                                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(trx.amount)}
                                                        </td>
                                                        <td className="px-8 py-5">
                                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${trx.status === 'pago' ? 'bg-emerald-100 text-emerald-700' :
                                                                trx.status === 'pendente' ? 'bg-amber-100 text-amber-700' :
                                                                    trx.status === 'atrasado' ? 'bg-rose-100 text-rose-700' :
                                                                        'bg-slate-100 text-slate-700'
                                                                }`}>
                                                                {trx.status === 'pago' && <CheckCircle2 size={12} className="mr-1" />}
                                                                {trx.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-8 py-5 text-right pr-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <TransactionMenu
                                                                transaction={trx}
                                                                onUpdate={() => {
                                                                    fetchFinancialData(); // Refresh UI
                                                                }}
                                                                onEdit={(t) => {
                                                                    setEditingTransaction(t);
                                                                    setIsTransactionModalOpen(true);
                                                                }}
                                                            />
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={7} className="py-20 text-center">
                                                        <div className="flex flex-col items-center justify-center text-slate-400 gap-4">
                                                            <div className="p-4 bg-slate-50 rounded-full">
                                                                <Search size={32} />
                                                            </div>
                                                            <p>Nenhuma transação encontrada neste período.</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>

                                    {/* Pagination Controls */}
                                    {totalPages > 1 && (
                                        <div className="px-8 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                                            <button
                                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                disabled={currentPage === 1}
                                                className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                                            >
                                                <ChevronLeft size={16} />
                                            </button>
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                Página <span className="text-slate-900">{currentPage}</span> de <span className="text-slate-900">{totalPages}</span>
                                            </span>
                                            <button
                                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                disabled={currentPage === totalPages}
                                                className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                                            >
                                                <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>

                        {/* Financial Health - Simplified or Removed? Moved to side or keep? 
                            Let's remove Financial Health for cleaner UI as user focused on filtering data. 
                            Or keep it? 
                            User said "remove Mock Data". Health was mock data. I will remove it to be safe.
                        */}

                    </div>
                )}


            </div>

        </div >
    );
};

export default AdministrationDashboard;
