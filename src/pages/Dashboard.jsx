import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    TrendingUp, TrendingDown, CheckSquare, Clock,
    Activity, Briefcase, Calendar as CalendarIcon, ArrowRight,
    Wallet, ChevronRight, Mail, ExternalLink, Search, Sparkles, FileText,
    Zap, ArrowUpRight, Timer, AlertTriangle
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell, CartesianGrid
} from 'recharts';
import useLocalStorage from '../hooks/useLocalStorage';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday, isSameDay, parseISO, differenceInHours, differenceInDays, setDate, subMonths, addMonths, isAfter } from 'date-fns';
import clsx from 'clsx';

import { supabase } from '../lib/supabaseClient';

const Dashboard = ({ user }) => {
    // --- SUPABASE DATA FETCHING ---
    const [todos, setTodos] = useState([]);
    const [finance, setFinance] = useState([]);
    const [weights, setWeights] = useState([]);
    const [meals, setMeals] = useState([]);
    const [workouts, setWorkouts] = useState([]);
    const [jobsData, setJobsData] = useState([]); // Array from Supabase
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
        const fetchDashboardData = async () => {
            if (!user?.id) {
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                // Parallel fetching
                console.log('[Dashboard] Starting parallel fetch for userId:', user.id);
                const results = await Promise.all([
                    supabase.from('todos').select('*').eq('user_id', user.id),
                    supabase.from('finance_transactions').select('*').eq('user_id', user.id),
                    supabase.from('health_weights').select('*').eq('user_id', user.id),
                    supabase.from('health_meals').select('*').eq('user_id', user.id),
                    supabase.from('health_workouts').select('*').eq('user_id', user.id),
                    supabase.from('career_jobs').select('*').eq('user_id', user.id)
                ]);

                const [
                    { data: todoData, error: todoErr },
                    { data: txnData, error: txnErr },
                    { data: wData, error: wErr },
                    { data: mData, error: mErr },
                    { data: workoutData, error: workoutErr },
                    { data: careerData, error: careerErr }
                ] = results;

                if (todoErr) console.error('[Dashboard] todos error:', todoErr);
                if (txnErr) console.error('[Dashboard] finance_transactions error:', txnErr);
                if (wErr) console.error('[Dashboard] health_weights error:', wErr);
                if (mErr) console.error('[Dashboard] health_meals error:', mErr);
                if (workoutErr) console.error('[Dashboard] health_workouts error:', workoutErr);
                if (careerErr) console.error('[Dashboard] career_jobs error:', careerErr);

                console.log('[Dashboard] Fetch results:', {
                    todos: todoData?.length || 0,
                    finance: txnData?.length || 0,
                    weights: wData?.length || 0,
                    meals: mData?.length || 0,
                    workouts: workoutData?.length || 0,
                    jobs: careerData?.length || 0
                });

                setTodos(todoData || []);
                setFinance(txnData || []);
                setWeights(wData || []);
                setMeals(mData || []);
                setWorkouts(workoutData || []);
                setJobsData(careerData || []);
            } catch (err) {
                console.error('[Dashboard] Exception in fetchDashboardData:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [user?.id]);

    // Timetable & Events still use LocalStorage for now
    const [timetableData] = useLocalStorage('university_timetable', {});
    const timetable = timetableData || {};
    const [eventsData] = useLocalStorage('calendar_events', []);
    const events = Array.isArray(eventsData) ? eventsData : [];

    const [geminiPrompt, setGeminiPrompt] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);

    // --- Process Data ---

    // 1. Today's Date & Gemini
    const today = new Date();
    const dateStr = format(today, 'yyyy-MM-dd');
    const dayName = format(today, 'EEE');

    const GEMINI_QUICK_ACTIONS = [
        "今日の献立を提案して",
        "明日の1限の教室は？",
        "就活の自己PR添削して",
        "やる気が出る名言"
    ];

    // 2. Todos: Active & Progress & Deadline Alert
    const activeTodos = useMemo(() => {
        return (todos || [])
            .filter(t => !t.completed)
            .sort((a, b) => {
                if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
                if (a.dueDate) return -1;
                if (b.dueDate) return 1;
                return 0;
            })
            .slice(0, 4);
    }, [todos]);

    const todoStats = useMemo(() => {
        const list = todos || [];
        const completed = list.filter(t => t.completed).length;
        const total = list.length;
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
        return {
            completed,
            total,
            rate,
            data: [
                { name: '完了', value: completed, color: '#10b981' },
                { name: '未完了', value: total - completed, color: 'rgba(255,255,255,0.1)' }
            ]
        };
    }, [todos]);

    const deadlineAlert = useMemo(() => {
        const universityTodos = (todos || []).filter(t => !t.completed && (t.tag === '大学 (Uni)' || t.tag === 'University') && t.dueDate);
        if (universityTodos.length === 0) return null;

        const sorted = universityTodos.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
        const closest = sorted[0];
        const due = new Date(closest.dueDate);
        const now = new Date();

        const hoursLeft = differenceInHours(due, now);
        const daysLeft = differenceInDays(due, now);

        return {
            task: closest.text,
            hours: hoursLeft,
            days: daysLeft,
            isUrgent: hoursLeft < 24 // Urgent if less than 24h
        };
    }, [todos]);

    // 3. Finance: Balance & Trends
    const financeStats = useMemo(() => {
        const list = finance || [];
        const income = list.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const expense = list.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

        const last6Months = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const monthKey = d.toISOString().slice(0, 7);
            last6Months.push({ month: monthKey, display: format(d, 'M月'), expense: 0 });
        }

        list.forEach(t => {
            if (t.type === 'expense') {
                const tMonth = t.date.slice(0, 7);
                const monthEntry = last6Months.find(m => m.month === tMonth);
                if (monthEntry) {
                    monthEntry.expense += Number(t.amount);
                }
            }
        });

        const calculateCardUsage = (method) => {
            const today = new Date();
            const currentDay = today.getDate();

            let paymentDate;
            let cycleStart;
            let cycleEnd;

            if (method === 'olive') {
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
            cycleStart.setHours(0, 0, 0, 0);
            cycleEnd.setHours(23, 59, 59, 999);

            const cardTxns = list.filter(t => t.method === method && t.type === 'expense');
            const nextPaymentAmount = cardTxns.reduce((sum, t) => {
                const tDate = new Date(t.date);
                if (tDate >= cycleStart && tDate <= cycleEnd) return sum + Number(t.amount);
                return sum;
            }, 0);

            return { amount: nextPaymentAmount, date: format(paymentDate, 'M/d') };
        };

        return {
            balance: income - expense,
            monthlyData: last6Months,
            cards: {
                smbc: calculateCardUsage('smbc'),
                jcb: calculateCardUsage('jcb'),
                olive: calculateCardUsage('olive')
            }
        };
    }, [finance]);

    // 4. Timetable
    const todaysClasses = useMemo(() => {
        const classes = [];
        for (let i = 1; i <= 7; i++) {
            const key = `${dayName}-${i}`;
            if (timetable && timetable[key]?.name) {
                classes.push({ period: i, ...timetable[key] });
            }
        }
        return classes;
    }, [timetable, dayName]);

    // 6. Health
    const healthStats = useMemo(() => {
        const wList = weights || [];
        const currentWeight = wList.length > 0 ? Number(wList[wList.length - 1].weight) : null;
        const prevWeight = wList.length > 1 ? Number(wList[wList.length - 2].weight) : null;
        let diff = null;
        if (currentWeight !== null && prevWeight !== null) {
            diff = (currentWeight - prevWeight).toFixed(1);
        }

        const cals = (meals || []).filter(m => m.date === dateStr).reduce((sum, m) => sum + m.calories, 0);
        const isMotivated = diff && Number(diff) < 0;

        // Big 3 PRs
        const getPR = (exercise) => {
            const exerciseWorkouts = (workouts || []).filter(w => w.exercise === exercise && w.type === 'strength');
            if (exerciseWorkouts.length === 0) return '--';
            return Math.max(...exerciseWorkouts.map(w => Number(w.weight)));
        };

        return {
            currentWeight,
            diff,
            cals,
            isMotivated,
            prs: {
                bench: getPR('ベンチプレス'),
                squat: getPR('スクワット'),
                deadlift: getPR('デッドリフト')
            }
        };
    }, [weights, meals, workouts, dateStr]);

    const activeWorkouts = useMemo(() => {
        const start = format(startOfWeek(today), 'yyyy-MM-dd');
        const end = format(endOfWeek(today), 'yyyy-MM-dd');
        return (workouts || []).filter(w => w.date >= start && w.date <= end).length;
    }, [workouts, today]);

    // 7. Career
    const activeApplications = useMemo(() => {
        return jobsData.filter(j => !['offer', 'final'].includes(j.status)).length;
    }, [jobsData]);

    const recentJobs = useMemo(() => {
        const STATUS_MAP = {
            entry: 'エントリー',
            es: 'ES提出',
            gd: 'GD',
            interview1: '一次面接',
            interview2: '二次面接',
            final: '最終面接',
            offer: '内定'
        };
        const COLOR_MAP = {
            entry: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
            es: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
            gd: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
            interview1: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
            interview2: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
            final: 'bg-red-500/20 text-red-300 border-red-500/30',
            offer: 'bg-green-500/20 text-green-300 border-green-500/30'
        };

        return jobsData
            .map(j => ({
                ...j,
                statusLabel: STATUS_MAP[j.status] || j.status,
                color: COLOR_MAP[j.status] || 'bg-gray-500/20 text-gray-300 border-gray-500/30'
            }))
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 3);
    }, [jobsData]);

    const nextCareerEvent = useMemo(() => {
        const upcoming = jobsData
            .filter(j => j.date && isAfter(parseISO(j.date), today))
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        return upcoming[0] || null;
    }, [jobsData, today]);

    // Handle Gemini Launch
    const handleGeminiSearch = (e, promptOverride) => {
        if (e) e.preventDefault();
        const query = promptOverride || geminiPrompt;
        if (!query.trim()) return;
        const url = `https://gemini.google.com/app?q=${encodeURIComponent(query)}`;
        window.open(url, '_blank');
        setGeminiPrompt('');
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                <p className="text-gray-400 animate-pulse">データを同期中...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* Header Area with Gemini Launcher */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <header>
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 tracking-tight">
                        Dashboard
                    </h1>
                    <p className="text-gray-400 mt-2 text-lg">
                        {format(today, 'yyyy年M月d日 (EEE)')} • {dayName === 'Sun' || dayName === 'Sat' ? '良い週末を！' : '今日も一日頑張りましょう！'}
                    </p>
                </header>

                {/* Gemini Launcher */}
                <div className="flex-1 max-w-xl relative group z-20 flex flex-col gap-2">
                    <form onSubmit={handleGeminiSearch} className="relative w-full">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                            <Sparkles size={18} className="text-purple-400 animate-pulse" />
                        </div>
                        <input
                            type="text"
                            value={geminiPrompt}
                            onChange={(e) => setGeminiPrompt(e.target.value)}
                            placeholder="Geminiに何でも聞いてください..."
                            className="w-full bg-gray-800/50 backdrop-blur-md border border-white/10 rounded-full pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:bg-gray-800/80 transition-all shadow-lg"
                        />
                        <button type="submit" className="absolute inset-y-1 right-1 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-colors">
                            <ArrowRight size={16} />
                        </button>
                    </form>
                    {/* Quick Actions */}
                    <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                        {GEMINI_QUICK_ACTIONS.map((action, i) => (
                            <button
                                key={i}
                                onClick={() => handleGeminiSearch(null, action)}
                                className="whitespace-nowrap px-3 py-1 rounded-full bg-white/5 border border-white/5 text-xs text-gray-300 hover:bg-purple-500/20 hover:border-purple-400/30 hover:text-white transition-all flex items-center gap-1"
                            >
                                <Zap size={10} /> {action}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                {/* --- Row 1: Finance (2 cols) & Google Calendar (Month) (2 cols) --- */}

                {/* Widget 1: Finance */}
                <div className="glass-card glass-hover p-6 md:col-span-2 relative group flex flex-col justify-between">
                    <div className="absolute top-0 right-0 p-4 opacity-50"><TrendingUp size={48} className="text-green-500/20 group-hover:text-green-500/30 transition-all duration-500 animate-float" /></div>
                    <div className="flex items-start justify-between mb-2">
                        <div>
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Wallet size={20} className="text-green-400" /> Finance
                            </h3>
                            <div className="mt-2 flex items-baseline gap-4">
                                <div>
                                    <p className="text-xs text-gray-400 uppercase">残高</p>
                                    <p className={`text-2xl font-bold ${financeStats.balance >= 0 ? 'text-white' : 'text-red-400'}`}>
                                        ¥{financeStats.balance.toLocaleString()}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">Next Payments</p>
                                    <div className="flex gap-2 text-[10px]">
                                        <div className="bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                                            <span className="text-gray-500">SM/JC:</span> <span className="text-white font-mono">¥{financeStats.cards.smbc.amount.toLocaleString()}</span>
                                        </div>
                                        <div className="bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                                            <span className="text-gray-500">Olive:</span> <span className="text-white font-mono">¥{financeStats.cards.olive.amount.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="h-[160px] w-full mt-2 -ml-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={financeStats.monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                <XAxis dataKey="display" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis hide />
                                <RechartsTooltip
                                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                                    formatter={(value) => [`¥${value.toLocaleString()}`, '支出']}
                                />
                                <Bar dataKey="expense" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <Link to="/finance" className="absolute bottom-4 right-4 text-xs text-gray-500 hover:text-white flex items-center gap-1 transition-colors">
                        詳細 <ArrowRight size={12} />
                    </Link>
                </div>

                {/* Widget 2: Google Calendar Embed (Month View) */}
                <div className="glass-card glass-hover p-0 relative overflow-hidden group flex flex-col md:col-span-2 h-[500px] md:h-[450px]">
                    <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={() => setRefreshKey(prev => prev + 1)}
                            className="bg-black/40 hover:bg-black/60 text-white p-2 rounded-lg backdrop-blur-sm transition-all"
                            title="カレンダーを更新"
                        >
                            <Zap size={14} className="text-yellow-400" />
                        </button>
                    </div>
                    <iframe
                        key={refreshKey}
                        src="https://calendar.google.com/calendar/embed?height=600&wkst=1&ctz=Asia%2FTokyo&bgcolor=%23ffffff&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=1&showCalendars=0&src=ja.japanese%23holiday%40group.v.calendar.google.com&color=%230B8043"
                        style={{ border: 0, width: '100%', height: '100%', filter: 'invert(0.95) hue-rotate(180deg)' }}
                        frameBorder="0"
                        scrolling="no"
                        title="Google Calendar"
                        className="opacity-80 hover:opacity-100 transition-opacity"
                    ></iframe>
                </div>

                {/* --- Row 2: Tasks, Health, Career --- */}

                {/* Widget 4: Tasks */}
                <div className="glass-card glass-hover p-6 md:col-span-2 relative group flex items-center justify-between gap-6">
                    <div className="absolute top-0 right-0 p-4 opacity-50"><CheckSquare size={48} className="text-purple-500/20 group-hover:text-purple-500/30 transition-all duration-500" /></div>

                    <div className="flex flex-col items-center justify-center w-1/3">
                        <div className="w-24 h-24 relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={todoStats.data} innerRadius={35} outerRadius={45} paddingAngle={5} dataKey="value" stroke="none">
                                        {todoStats.data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex items-center justify-center flex-col">
                                <span className="text-xl font-bold text-white">{todoStats.rate}%</span>
                            </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">完了率</p>
                    </div>

                    <div className="flex-1 space-y-2 z-10 w-2/3">
                        <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                            <CheckSquare size={20} className="text-purple-400" /> 優先タスク
                        </h3>
                        {activeTodos.length > 0 ? (
                            activeTodos.map(todo => {
                                const daysLeft = todo.dueDate ? differenceInDays(parseISO(todo.dueDate), today) : null;
                                return (
                                    <div key={todo.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${todo.tag === 'University' ? 'bg-blue-400' : todo.tag === 'Job Hunting' ? 'bg-purple-400' : 'bg-green-400'}`} />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm text-gray-200 truncate">{todo.text}</p>
                                            <div className="flex items-center justify-between">
                                                {todo.dueDate && (
                                                    <p className="text-[10px] text-gray-500 flex items-center gap-1">
                                                        <Clock size={10} /> {format(parseISO(todo.dueDate), todo.dueDate.includes('T') ? 'M/d HH:mm' : 'M/d')}
                                                    </p>
                                                )}
                                                {daysLeft !== null && (
                                                    <span className={clsx(
                                                        "text-[9px] font-bold px-1 rounded",
                                                        daysLeft <= 1 ? "text-red-400 bg-red-400/10" : "text-gray-500 bg-white/5"
                                                    )}>
                                                        あと{daysLeft}日
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-sm text-gray-500">タスクはありません</p>
                        )}
                        <Link to="/todo" className="text-xs text-gray-500 hover:text-white flex items-center gap-1 transition-colors mt-2">
                            すべて表示 <ArrowRight size={12} />
                        </Link>
                    </div>
                </div>



                {/* Widget 5: Health */}
                <div className={clsx(
                    "glass-card glass-hover p-5 relative group flex flex-col justify-between transition-all",
                    healthStats.isMotivated ? "shadow-[0_0_20px_rgba(74,222,128,0.15)] border-green-500/30" : ""
                )}>
                    <div>
                        <div className="absolute top-0 right-0 p-4 opacity-50"><Activity size={48} className="text-pink-500/20 group-hover:text-pink-500/30 transition-all duration-500" /></div>
                        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                            <Activity size={20} className="text-pink-400" /> Health
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-xs text-gray-500">Weight</p>
                                    <p className={clsx("text-2xl font-bold transition-colors", healthStats.isMotivated ? "text-green-300" : "text-white")}>
                                        {healthStats.currentWeight !== null ? healthStats.currentWeight : '--'}
                                        <span className="text-sm text-gray-500 font-normal ml-1">kg</span>
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-gray-500 uppercase font-bold">Today's Calories</p>
                                    <p className="text-lg font-bold text-white">{healthStats.cals}<span className="text-xs text-gray-500 font-normal ml-1">kcal</span></p>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-white/10">
                                <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Big 3 PRs (kg)</p>
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="bg-white/5 rounded p-1.5">
                                        <p className="text-[8px] text-gray-500">BP</p>
                                        <p className="text-sm font-bold text-blue-400">{healthStats.prs.bench}</p>
                                    </div>
                                    <div className="bg-white/5 rounded p-1.5">
                                        <p className="text-[8px] text-gray-500">SQ</p>
                                        <p className="text-sm font-bold text-purple-400">{healthStats.prs.squat}</p>
                                    </div>
                                    <div className="bg-white/5 rounded p-1.5">
                                        <p className="text-[8px] text-gray-500">DL</p>
                                        <p className="text-sm font-bold text-pink-400">{healthStats.prs.deadlift}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <Link to="/health" className="text-xs text-gray-500 hover:text-white flex items-center gap-1 transition-colors mt-2">
                        詳細 <ArrowRight size={12} />
                    </Link>
                </div>


                {/* Widget 6: Career */}
                <div className="glass-card glass-hover p-6 relative group bg-gradient-to-br from-gray-900/60 to-blue-900/20 flex flex-col">
                    <div className="absolute top-0 right-0 p-4 opacity-50"><Briefcase size={48} className="text-blue-200/20 group-hover:text-blue-200/30 transition-all duration-500" /></div>
                    <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                        <Briefcase size={20} className="text-blue-300" /> Career
                    </h3>

                    <div className="flex-1 space-y-2 mb-2">
                        {nextCareerEvent ? (
                            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 animate-pulse-slow">
                                <p className="text-[10px] text-blue-300 font-bold uppercase mb-1">Upcoming Event</p>
                                <p className="text-sm font-bold text-white truncate">{nextCareerEvent.company}</p>
                                <p className="text-xs text-blue-400 flex items-center gap-1 mt-1">
                                    <CalendarIcon size={12} /> {format(parseISO(nextCareerEvent.date), 'M月d日')}
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col justify-center h-24">
                                <p className="text-5xl font-bold text-white translate-y-2">{activeApplications}</p>
                                <p className="text-xs text-gray-400 mt-2">エントリー中の企業数</p>
                            </div>
                        )}

                        <div className="space-y-1">
                            {recentJobs.slice(0, 2).map(job => (
                                <div key={job.id} className="flex items-center gap-2 p-1.5 rounded-lg bg-black/20 border border-white/5 text-[10px]">
                                    <span className={`px-1 rounded border ${job.color} whitespace-nowrap scale-90`}>
                                        {job.statusLabel}
                                    </span>
                                    <span className="text-white truncate flex-1">{job.company}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Link to="/career" className="absolute bottom-4 right-4 text-xs text-gray-500 hover:text-white flex items-center gap-1 transition-colors">
                        進捗ボード <ArrowRight size={12} />
                    </Link>
                </div>

                {/* --- Row 3: Timetable (Moved), Quick Links (Bottom) --- */}

                {/* Widget 3: Timetable (Relocated) */}
                <Link to="/timetable" className="glass-card glass-hover p-5 relative overflow-hidden group flex flex-col md:col-span-2 hover:ring-2 ring-blue-500/50 transition-all cursor-pointer">
                    <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                        <Clock size={16} className="text-blue-400" /> 今日の授業 <span className="text-[10px] text-gray-500 font-normal ml-auto">クリックで編集</span>
                    </h3>
                    <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar pr-1 max-h-[120px]">
                        {todaysClasses.length === 0 ? (
                            <p className="text-xs text-gray-500 text-center mt-4">授業はありません</p>
                        ) : (
                            todaysClasses.map(cls => (
                                <div key={cls.period} className="flex items-center gap-2 p-2 rounded bg-white/5 border border-white/5">
                                    <div className="w-6 h-6 rounded flex items-center justify-center bg-gray-700 text-[10px] text-white font-bold">{cls.period}</div>
                                    <div className="min-w-0">
                                        <p className="text-xs text-gray-200 truncate">{cls.name}</p>
                                        <p className="text-[10px] text-gray-500 truncate">{cls.room}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Deadline Alert (Moodle Style) */}
                    {deadlineAlert && (
                        <div className={clsx(
                            "mt-3 p-2 rounded-lg border flex items-center gap-3 animate-pulse",
                            deadlineAlert.isUrgent ? "bg-red-500/10 border-red-500/30 text-red-300" : "bg-yellow-500/10 border-yellow-500/30 text-yellow-300"
                        )}>
                            <AlertTriangle size={16} className="shrink-0" />
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-bold uppercase tracking-wider">締め切り警告</p>
                                <p className="text-xs font-medium truncate">{deadlineAlert.task}</p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-sm font-bold">{deadlineAlert.days > 0 ? `${deadlineAlert.days}日` : `${deadlineAlert.hours}時間`}</p>
                                <p className="text-[10px]">あと</p>
                            </div>
                        </div>
                    )}
                </Link>

                {/* Quick Links Widget (Bottom) */}
                <div className="glass-card p-4 relative md:col-span-2 flex items-center gap-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase shrink-0">クイックリンク</h3>
                    <div className="flex-1 flex gap-3 overflow-x-auto pb-1 custom-scrollbar">
                        <a href="https://mail.google.com/" target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 transition-colors shrink-0">
                            <Mail size={14} /> <span className="text-sm font-medium">Gmail</span>
                        </a>
                        <a href="https://wsdmoodle.waseda.jp/" target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 rounded-lg bg-red-900/20 hover:bg-red-900/30 text-red-400 transition-colors shrink-0">
                            <ExternalLink size={14} /> <span className="text-sm font-medium">Moodle</span>
                        </a>
                        <a href="https://www.notion.so/" target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 rounded-lg bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 transition-colors shrink-0">
                            <FileText size={14} /> <span className="text-sm font-medium">Notion</span>
                        </a>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Dashboard;
