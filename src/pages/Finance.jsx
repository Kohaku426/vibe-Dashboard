import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { Plus, Trash2, TrendingUp, TrendingDown, Wallet, PieChart as PieChartIcon, Home, CreditCard, Settings, X, Save, DollarSign } from 'lucide-react';
import useLocalStorage from '../hooks/useLocalStorage';
import { format, subMonths, isAfter, isBefore, addMonths, setDate, startOfDay, endOfDay, differenceInMinutes, parse, startOfMonth, endOfMonth } from 'date-fns';
import { useSupabase } from '../hooks/useSupabase';
import { supabase } from '../lib/supabaseClient';

const FALLBACK_CATEGORIES = [
    { name: '食費', color: '#ec4899' },
    { name: '交通費', color: '#8b5cf6' },
    { name: '娯楽', color: '#3b82f6' },
    { name: '水道光熱費', color: '#10b981' },
    { name: '買い物', color: '#f59e0b' },
    { name: '給与', color: '#6366f1' },
    { name: 'その他', color: '#64748b' },
];


const Finance = ({ user }) => {
    // --- SUPABASE: TRANSACTIONS ---
    const {
        data: transactions,
        loading: loadingTxns,
        addData: addTxn,
        deleteData: removeTxn
    } = useSupabase('finance_transactions', user?.id);

    // --- SUPABASE: CATEGORIES ---
    const {
        data: categoriesData,
        loading: loadingCats,
        addData: addCategory,
        deleteData: removeCategory
    } = useSupabase('finance_categories', user?.id);

    const categories = useMemo(() => {
        if (categoriesData && categoriesData.length > 0) return categoriesData;
        return FALLBACK_CATEGORIES;
    }, [categoriesData]);

    // --- SUPABASE: BALANCES (Single Row) ---
    const [balances, setBalancesState] = useState({ cash: 0, bank: 0 });
    const [loadingBalances, setLoadingBalances] = useState(true);

    useEffect(() => {
        const fetchBalances = async () => {
            if (!user?.id) {
                console.warn('[Finance] fetchBalances skipped: No user ID');
                return;
            }
            console.log('[Finance] Fetching balances for userId:', user.id);
            const { data, error } = await supabase
                .from('finance_balances')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (error) {
                console.error('[Finance] fetchBalances error:', error);
            }
            if (data) {
                console.log('[Finance] Balances found:', data);
                setBalancesState({ cash: data.cash, bank: data.bank });
            } else {
                console.log('[Finance] No balance record found for user');
            }
            setLoadingBalances(false);
        };
        fetchBalances();
    }, [user?.id]);

    const updateBalances = async (newBalances) => {
        try {
            const { error } = await supabase
                .from('finance_balances')
                .upsert({ user_id: user.id, ...newBalances });
            if (error) throw error;
            setBalancesState(newBalances);
        } catch (err) {
            alert('残高の更新に失敗しました');
        }
    };

    // Work Data
    const {
        data: shifts = [],
        loading: loadingShifts
    } = useSupabase('work_shifts', user?.id);

    const [workSettingsData] = useLocalStorage('work_settings', { hourlyRate: 1200, transport: 1000 });
    const workSettings = workSettingsData || { hourlyRate: 1200, transport: 1000 };

    const [showSettings, setShowSettings] = useState(false);
    const [newCat, setNewCat] = useState({ name: '', color: '#3b82f6' });

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        item: '',
        amount: '',
        type: 'expense', // 'income' or 'expense'
        category: '食費',
        method: 'cash' // 'cash', 'smbc', 'jcb', 'olive'
    });

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleBalanceChange = (e) => {
        const { name, value } = e.target;
        setBalancesState(prev => ({ ...prev, [name]: Number(value) }));
    };

    const addTransaction = async (e) => {
        e.preventDefault();
        if (!formData.amount) return; // Only amount is strictly required now

        try {
            await addTxn({
                date: formData.date,
                item: formData.item.trim() || '未分類',
                amount: parseFloat(formData.amount),
                type: formData.type,
                category: formData.category,
                method: formData.method
            });
            setFormData(prev => ({ ...prev, item: '', amount: '' }));
        } catch (err) {
            alert('取引の追加に失敗しました');
        }
    };

    const deleteTransaction = async (id) => {
        if (!window.confirm('この取引を削除しますか？')) return;
        try {
            await removeTxn(id);
        } catch (err) {
            alert('削除に失敗しました');
        }
    };

    // --- Calculations ---

    // 0. Estimated Salary (Current Month)
    const estimatedSalary = useMemo(() => {
        if (!shifts || shifts.length === 0) return 0;
        const today = new Date();
        const start = format(startOfMonth(today), 'yyyy-MM-dd');
        const end = format(endOfMonth(today), 'yyyy-MM-dd');

        const currentMonthShifts = shifts.filter(s => s.date >= start && s.date <= end);

        const total = currentMonthShifts.reduce((sum, s) => {
            const startTime = parse(s.start, 'HH:mm', new Date());
            const endTime = parse(s.end, 'HH:mm', new Date());
            if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) return sum;
            let minutes = differenceInMinutes(endTime, startTime);
            if (minutes < 0) minutes += 24 * 60;
            const workMinutes = Math.max(0, minutes - (s.break || 0));
            const hours = workMinutes / 60;
            return sum + Math.floor(hours * workSettings.hourlyRate) + workSettings.transport;
        }, 0);

        return total;
    }, [shifts, workSettings]);

    // 1. Credit Card Logic (15th Close, 10th Pay)
    const calculateCardUsage = (method) => {
        const today = new Date();
        const currentDay = today.getDate();

        let paymentDate;
        let cycleStart;
        let cycleEnd;

        if (method === 'olive') {
            // Olive: End of month close, 26th pay (EOM-26 logic)
            // If today <= 26, next payment is This Month 26th (Source: Month-1 full month)
            // If today > 26, next payment is Next Month 26th (Source: This Month full month)
            if (currentDay <= 26) {
                paymentDate = setDate(today, 26);
                cycleStart = startOfMonth(subMonths(today, 1));
                cycleEnd = endOfMonth(subMonths(today, 1));
            } else {
                paymentDate = setDate(addMonths(today, 1), 26);
                cycleStart = startOfMonth(today);
                cycleEnd = endOfMonth(today);
            }
        } else {
            // SMBC/JCB: 15th close, 10th pay
            if (currentDay <= 10) {
                paymentDate = setDate(today, 10);
                cycleEnd = setDate(subMonths(today, 1), 15);
                cycleStart = setDate(subMonths(today, 2), 16);
            } else {
                paymentDate = setDate(addMonths(today, 1), 10);
                cycleEnd = setDate(today, 15);
                cycleStart = setDate(subMonths(today, 1), 16);
            }
        }

        // Set times for accurate comparison
        cycleStart.setHours(0, 0, 0, 0);
        cycleEnd.setHours(23, 59, 59, 999);

        // Filter transactions
        const cardTxns = transactions.filter(t => t.method === method && t.type === 'expense');

        const nextPaymentAmount = cardTxns.reduce((sum, t) => {
            const tDate = new Date(t.date);
            if (tDate >= cycleStart && tDate <= cycleEnd) {
                return sum + t.amount;
            }
            return sum;
        }, 0);

        const currentUsageAmount = cardTxns.reduce((sum, t) => {
            const tDate = new Date(t.date);
            if (tDate > cycleEnd) {
                return sum + t.amount;
            }
            return sum;
        }, 0);

        return { nextPaymentDate: paymentDate, nextPaymentAmount, currentUsageAmount };
    };

    const smbcStats = useMemo(() => calculateCardUsage('smbc'), [transactions]);
    const jcbStats = useMemo(() => calculateCardUsage('jcb'), [transactions]);
    const oliveStats = useMemo(() => calculateCardUsage('olive'), [transactions]);

    // 2. Totals
    const { totalIncome, totalExpense, balance, assets, liabilities, netWorth } = useMemo(() => {
        const income = transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);
        const expense = transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

        const calculatedBalance = income - expense; // Simple Cashflow

        const totalAssets = (balances.cash || 0) + (balances.bank || 0);
        const totalLiabilities =
            (smbcStats.nextPaymentAmount + smbcStats.currentUsageAmount) +
            (jcbStats.nextPaymentAmount + jcbStats.currentUsageAmount) +
            (oliveStats.nextPaymentAmount + oliveStats.currentUsageAmount);

        return {
            totalIncome: income,
            totalExpense: expense,
            balance: calculatedBalance,
            assets: totalAssets,
            liabilities: totalLiabilities,
            netWorth: totalAssets - totalLiabilities
        };
    }, [transactions, balances, smbcStats, jcbStats]);

    // Data for Pie Chart (Expenses only)
    const pieData = useMemo(() => {
        const expenseTransactions = transactions.filter(t => t.type === 'expense');
        const categoryTotals = {};

        expenseTransactions.forEach(t => {
            if (!categoryTotals[t.category]) {
                categoryTotals[t.category] = 0;
            }
            categoryTotals[t.category] += t.amount;
        });

        return Object.keys(categoryTotals).map(cat => ({
            name: cat,
            value: categoryTotals[cat],
            color: categories.find(c => c.name === cat)?.color || '#94a3b8'
        }));
    }, [transactions, categories]);

    // Monthly Expense Data for Bar Chart
    const monthlyData = useMemo(() => {
        const last6Months = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const monthKey = d.toISOString().slice(0, 7); // YYYY-MM
            last6Months.push({ month: monthKey, expense: 0 });
        }

        transactions.forEach(t => {
            if (t.type === 'expense') {
                const tMonth = t.date.slice(0, 7);
                const monthEntry = last6Months.find(m => m.month === tMonth);
                if (monthEntry) {
                    monthEntry.expense += Number(t.amount);
                }
            }
        });

        return last6Months.map(m => ({
            ...m,
            month: m.month.slice(5) // Remove YYYY- part for display (e.g., "05", "06")
        }));
    }, [transactions]);

    return (
        <div className="space-y-6 animate-fade-in relative pb-10">
            <Link to="/" className="absolute top-0 right-0 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-10">
                <Home size={20} />
            </Link>

            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Finance</h1>
                    <p className="text-gray-400 mt-1">収支 & 資産管理</p>
                </div>

                {/* Balance Card with Settings Trigger */}
                <div className="flex gap-4">
                    <button
                        onClick={() => setShowSettings(true)}
                        className="glass px-4 py-3 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                    >
                        <Settings size={20} />
                    </button>
                    <div className="glass px-6 py-3 rounded-xl flex items-center gap-6 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setShowSettings(true)}>
                        <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wider">純資産 (Net Worth)</p>
                            <p className={`text-2xl font-bold ${netWorth >= 0 ? 'text-white' : 'text-red-400'}`}>
                                ¥{netWorth.toLocaleString()}
                            </p>
                        </div>
                        <div className="h-8 w-px bg-white/10"></div>
                        <div className="flex gap-4 text-sm">
                            <div>
                                <p className="text-gray-500">現金+銀行</p>
                                <p className="text-blue-300">¥{assets.toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-gray-500">カード未払</p>
                                <p className="text-red-400">-¥{liabilities.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* --- Settings Modal --- */}
            {showSettings && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="glass-card w-full max-w-md p-6 relative">
                        <button
                            onClick={() => setShowSettings(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <Settings size={20} /> 残高設定
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-gray-500 uppercase block mb-2">手持ち現金</label>
                                <input
                                    type="number"
                                    name="cash"
                                    value={balances.cash}
                                    onChange={(e) => setBalancesState({ ...balances, cash: Number(e.target.value) })}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 uppercase block mb-2">銀行預金</label>
                                <input
                                    type="number"
                                    name="bank"
                                    value={balances.bank}
                                    onChange={(e) => setBalancesState({ ...balances, bank: Number(e.target.value) })}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Category Management */}
                            <div className="pt-4 border-t border-white/10">
                                <label className="text-xs text-gray-500 uppercase block mb-3 font-bold">カテゴリー管理</label>
                                <div className="space-y-2 mb-4 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                                    {categoriesData && categoriesData.map(cat => (
                                        <div key={cat.id} className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                                                <span className="text-xs text-white">{cat.name}</span>
                                            </div>
                                            <button onClick={() => removeCategory(cat.id)} className="text-gray-500 hover:text-red-400 p-1 transition-colors"><Trash2 size={14} /></button>
                                        </div>
                                    ))}
                                    {(!categoriesData || categoriesData.length === 0) && (
                                        <p className="text-[10px] text-gray-500 italic">カスタムカテゴリーはありません（デフォルトを使用中）</p>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="新規名"
                                        value={newCat.name}
                                        onChange={e => setNewCat({ ...newCat, name: e.target.value })}
                                        className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                    <input
                                        type="color"
                                        value={newCat.color}
                                        onChange={e => setNewCat({ ...newCat, color: e.target.value })}
                                        className="w-8 h-8 rounded border-none bg-transparent cursor-pointer p-0"
                                    />
                                    <button
                                        onClick={async () => {
                                            if (newCat.name) {
                                                await addCategory({ name: newCat.name, color: newCat.color });
                                                setNewCat({ name: '', color: '#3b82f6' });
                                            }
                                        }}
                                        className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-blue-500/30 font-mono"
                                    >ADD</button>
                                </div>
                            </div>
                            <div className="pt-4 flex justify-end">
                                <button
                                    onClick={() => {
                                        updateBalances(balances);
                                        setShowSettings(false);
                                    }}
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                                >
                                    <Save size={16} /> 保存して閉じる
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* --- LEFT COLUMN: CHARTS & CARDS (2/3 width) --- */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Est. Monthly Income Card */}
                    <div className="glass-card p-5 flex items-center justify-between bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border-indigo-500/20">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                <DollarSign size={24} />
                            </div>
                            <div>
                                <p className="text-xs text-indigo-300 font-bold uppercase tracking-wider">今月の給与見込み (Est.)</p>
                                <p className="text-2xl font-bold text-white">¥{estimatedSalary.toLocaleString()}</p>
                            </div>
                        </div>
                        <div className="text-right hidden sm:block">
                            <p className="text-xs text-gray-400">Shift Manager連携</p>
                            <Link to="/calendar" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center justify-end gap-1 mt-1">
                                シフト確認 <TrendingUp size={12} />
                            </Link>
                        </div>
                    </div>

                    {/* Credit Cards Summary Widget */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* SMBC Card */}
                        <div className="glass-card p-5 relative overflow-hidden group">
                            <div className="absolute -right-4 -top-4 w-24 h-24 bg-green-500/10 rounded-full blur-2xl group-hover:bg-green-500/20 transition-all"></div>
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-2">
                                    <CreditCard className="text-green-400" size={20} />
                                    <span className="font-bold text-white">SMBC (NL)</span>
                                </div>
                                <span className="text-[10px] bg-green-900/40 text-green-300 px-2 py-0.5 rounded border border-green-500/30">15締 10払</span>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-xs text-gray-400 flex justify-between">
                                        <span>次回引落 ({format(smbcStats.nextPaymentDate, 'M/d')})</span>
                                        {smbcStats.nextPaymentAmount > 0 && <span className="text-white font-bold">確定</span>}
                                    </p>
                                    <p className="text-xl font-bold text-white">¥{smbcStats.nextPaymentAmount.toLocaleString()}</p>
                                </div>
                                <div className="pt-2 border-t border-white/5">
                                    <p className="text-xs text-gray-500">現在の未確定利用額</p>
                                    <p className="text-sm font-medium text-gray-300">¥{smbcStats.currentUsageAmount.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        {/* JCB Card */}
                        <div className="glass-card p-5 relative overflow-hidden group">
                            <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-2">
                                    <CreditCard className="text-blue-400" size={20} />
                                    <span className="font-bold text-white">JCB W</span>
                                </div>
                                <span className="text-[10px] bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">15締 10払</span>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-xs text-gray-400 flex justify-between">
                                        <span>次回引落 ({format(jcbStats.nextPaymentDate, 'M/d')})</span>
                                        {jcbStats.nextPaymentAmount > 0 && <span className="text-white font-bold">確定</span>}
                                    </p>
                                    <p className="text-xl font-bold text-white">¥{jcbStats.nextPaymentAmount.toLocaleString()}</p>
                                </div>
                                <div className="pt-2 border-t border-white/5">
                                    <p className="text-xs text-gray-500">現在の未確定利用額</p>
                                    <p className="text-sm font-medium text-gray-300">¥{jcbStats.currentUsageAmount.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        {/* Olive Card */}
                        <div className="glass-card p-5 relative overflow-hidden group border-olive-500/20 md:col-span-2">
                            <div className="absolute -right-4 -top-4 w-24 h-24 bg-olive-500/10 rounded-full blur-2xl group-hover:bg-olive-500/20 transition-all"></div>
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-2">
                                    <CreditCard className="text-yellow-400" size={20} />
                                    <span className="font-bold text-white">Olive</span>
                                </div>
                                <span className="text-[10px] bg-yellow-900/40 text-yellow-300 px-2 py-0.5 rounded border border-yellow-500/30">末締 26払</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <p className="text-xs text-gray-400 flex justify-between">
                                        <span>次回引落 ({format(oliveStats.nextPaymentDate, 'M/d')})</span>
                                        {oliveStats.nextPaymentAmount > 0 && <span className="text-white font-bold">確定</span>}
                                    </p>
                                    <p className="text-xl font-bold text-white">¥{oliveStats.nextPaymentAmount.toLocaleString()}</p>
                                </div>
                                <div className="border-l border-white/5 pl-6">
                                    <p className="text-xs text-gray-500">現在の未確定利用額</p>
                                    <p className="text-sm font-medium text-gray-300">¥{oliveStats.currentUsageAmount.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Monthly Trends Bar Chart */}
                    <div className="glass-card p-6 flex flex-col h-fit">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <TrendingDown className="text-blue-400" size={20} /> 月別支出推移 (Trends)
                        </h2>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                    <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `¥${value / 1000}k`} />
                                    <RechartsTooltip
                                        cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                                        contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                                        formatter={(value) => [`¥${value.toLocaleString()}`, '支出']}
                                    />
                                    <Bar dataKey="expense" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Expense Breakdown Pie Chart */}
                    <div className="glass-card p-6 flex flex-col items-center">
                        <h2 className="text-xl font-bold mb-4 w-full flex items-center gap-2">
                            <PieChartIcon className="text-purple-400" size={20} /> 支出の内訳 (Category)
                        </h2>
                        <div className="h-[300px] w-full">
                            {pieData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={80}
                                            outerRadius={100}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
                                        <Legend verticalAlign="bottom" height={36} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-gray-500 border border-dashed border-white/10 rounded-xl">
                                    データがありません
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* --- RIGHT COLUMN: INPUT & LIST (1/3 width) --- */}
                <div className="space-y-6">
                    {/* Input Form */}
                    <div className="glass-card p-6 h-fit">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Plus className="w-5 h-5 text-blue-400" /> 新規取引を追加
                        </h2>
                        <form onSubmit={addTransaction} className="space-y-4">
                            <div className="flex bg-gray-800/50 rounded-lg p-1">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'expense' })}
                                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${formData.type === 'expense' ? 'bg-red-500/20 text-red-400 shadow-sm' : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                >
                                    支出
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'income' })}
                                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${formData.type === 'income' ? 'bg-green-500/20 text-green-400 shadow-sm' : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                >
                                    収入
                                </button>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs text-gray-500 uppercase">日付</label>
                                <input
                                    type="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleInputChange}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs text-gray-500 uppercase">項目名</label>
                                <input
                                    type="text"
                                    name="item"
                                    value={formData.item}
                                    onChange={handleInputChange}
                                    placeholder="例: ランチ, 給料 (空欄で未分類)"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs text-gray-500 uppercase">金額 (円)</label>
                                <input
                                    type="number"
                                    name="amount"
                                    value={formData.amount}
                                    onChange={handleInputChange}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                    required
                                    min="0"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs text-gray-500 uppercase">支払い方法</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['cash', 'smbc', 'jcb', 'olive'].map((method) => (
                                        <button
                                            key={method}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, method })}
                                            className={`py-2 rounded-lg text-xs font-medium border transition-all ${formData.method === method
                                                ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                                                : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                                                }`}
                                        >
                                            {method === 'cash' ? '現金' : method === 'smbc' ? 'SMBC' : method === 'jcb' ? 'JCB' : 'Olive'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs text-gray-500 uppercase">カテゴリー</label>
                                <select
                                    name="category"
                                    value={formData.category}
                                    onChange={handleInputChange}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all [&>option]:bg-gray-900"
                                >
                                    {categories.map(cat => (
                                        <option key={cat.id || cat.name} value={cat.name}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium py-2 rounded-lg shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] mt-2"
                            >
                                追加する
                            </button>
                        </form>
                    </div>

                    {/* Recent List */}
                    <div className="glass-card p-6">
                        <h3 className="text-lg font-medium mb-4 text-gray-300">最近の取引</h3>
                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {transactions.length > 0 ? (
                                transactions.map((t) => (
                                    <div key={t.id} className="group flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${t.type === 'income' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                                }`}>
                                                {t.type === 'income' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                                            </div>
                                            <div>
                                                <p className="font-medium text-white">{t.item}</p>
                                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                                    <span>{t.date}</span>
                                                    <span>•</span>
                                                    <span className="px-2 py-0.5 rounded-full bg-white/5 text-gray-400">{t.category}</span>
                                                    {t.method && t.method !== 'cash' && (
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] border ${t.method === 'smbc' ? 'border-green-500/30 text-green-300' : t.method === 'jcb' ? 'border-blue-500/30 text-blue-300' : 'border-yellow-500/30 text-yellow-300'
                                                            }`}>
                                                            {t.method.toUpperCase()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className={`font-medium ${t.type === 'income' ? 'text-green-400' : 'text-white'}`}>
                                                {t.type === 'income' ? '+' : '-'}¥{t.amount.toLocaleString()}
                                            </span>
                                            <button
                                                onClick={() => deleteTransaction(t.id)}
                                                className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all p-1"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-gray-500 py-4">取引履歴がありません。</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Finance;
