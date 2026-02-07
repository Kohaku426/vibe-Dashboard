import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    TrendingUp, TrendingDown, CheckSquare, Clock,
    Activity, Briefcase, Calendar as CalendarIcon, ArrowRight,
    Wallet, ChevronRight, Mail, ExternalLink, Search, Sparkles, FileText,
    Zap, ArrowUpRight, Timer, AlertTriangle, ArrowRight as ArrowRightIcon
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
    const [jobsData, setJobsData] = useState([]);
    const [calendarEvents, setCalendarEvents] = useState([]);
    const [calendarCategories, setCalendarCategories] = useState([]);
    const [shiftsData, setShiftsData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!user?.id) {
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const results = await Promise.all([
                    supabase.from('todos').select('*').eq('user_id', user.id),
                    supabase.from('finance_transactions').select('*').eq('user_id', user.id),
                    supabase.from('health_weights').select('*').eq('user_id', user.id),
                    supabase.from('health_meals').select('*').eq('user_id', user.id),
                    supabase.from('health_workouts').select('*').eq('user_id', user.id),
                    supabase.from('career_jobs').select('*').eq('user_id', user.id),
                    supabase.from('calendar_events').select('*').eq('user_id', user.id),
                    supabase.from('calendar_categories').select('*').eq('user_id', user.id),
                    supabase.from('work_shifts').select('*').eq('user_id', user.id)
                ]);

                const [
                    { data: todoData }, { data: txnData }, { data: wData }, { data: mData },
                    { data: workoutData }, { data: careerData }, { data: calData }, { data: catData },
                    { data: sData }
                ] = results;

                setTodos(todoData || []);
                setFinance(txnData || []);
                setWeights(wData || []);
                setMeals(mData || []);
                setWorkouts(workoutData || []);
                setJobsData(careerData || []);
                setCalendarEvents(calData || []);
                setCalendarCategories(catData || []);
                setShiftsData(sData || []);
            } catch (err) {
                console.error('[Dashboard] fetch error:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchDashboardData();
    }, [user?.id]);

    const [timetableData] = useLocalStorage('university_timetable', {});
    const timetable = timetableData || {};
    const [geminiPrompt, setGeminiPrompt] = useState('');

    const today = new Date();
    const dateStr = format(today, 'yyyy-MM-dd');
    const dayName = format(today, 'EEE');

    const GEMINI_QUICK_ACTIONS = [
        "今日の献立を提案して", "明日の1限の教室は？", "就活の自己PR添削して", "やる気が出る名言"
    ];

    // --- Data Processing ---
    const todoStats = useMemo(() => {
        const list = todos || [];
        const completed = list.filter(t => t.completed).length;
        const total = list.length;
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
        return {
            completed, total, rate,
            data: [
                { name: '完了', value: completed, color: '#10b981' },
                { name: '未完了', value: total - completed, color: 'rgba(255,255,255,0.1)' }
            ]
        };
    }, [todos]);

    const activeTodos = useMemo(() => {
        return (todos || []).filter(t => !t.completed)
            .sort((a, b) => (a.dueDate && b.dueDate) ? new Date(a.dueDate) - new Date(b.dueDate) : 0)
            .slice(0, 4);
    }, [todos]);

    const financeStats = useMemo(() => {
        const list = finance || [];
        const income = list.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const expense = list.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        const last6Months = [];
        for (let i = 5; i >= 0; i--) {
            const d = subMonths(new Date(), i);
            const monthKey = format(d, 'yyyy-MM');
            last6Months.push({ month: monthKey, display: format(d, 'M月'), expense: 0 });
        }
        list.forEach(t => {
            if (t.type === 'expense') {
                const m = t.date.slice(0, 7);
                const entry = last6Months.find(x => x.month === m);
                if (entry) entry.expense += Number(t.amount);
            }
        });
        const calcCard = (m) => {
            const today = new Date();
            const d = today.getDate();
            let payDate, cS, cE;
            if (m === 'olive') {
                if (d <= 26) { payDate = setDate(today, 26); cS = startOfMonth(subMonths(today, 1)); cE = endOfMonth(subMonths(today, 1)); }
                else { payDate = setDate(addMonths(today, 1), 26); cS = startOfMonth(today); cE = endOfMonth(today); }
            } else {
                if (d <= 10) { payDate = setDate(today, 10); cE = setDate(subMonths(today, 1), 15); cS = setDate(subMonths(today, 2), 16); }
                else { payDate = setDate(addMonths(today, 1), 10); cE = setDate(today, 15); cS = setDate(subMonths(today, 1), 16); }
            }
            cS.setHours(0, 0, 0, 0); cE.setHours(23, 59, 59, 999);
            const amt = list.filter(t => t.method === m && t.type === 'expense')
                .reduce((s, t) => { const dt = new Date(t.date); return (dt >= cS && dt <= cE) ? s + Number(t.amount) : s; }, 0);
            return { amount: amt, date: format(payDate, 'M/d') };
        };
        return { balance: income - expense, monthlyData: last6Months, cards: { smbc: calcCard('smbc'), jcb: calcCard('jcb'), olive: calcCard('olive') } };
    }, [finance]);

    const healthStats = useMemo(() => {
        const wList = weights || [];
        const curW = wList.length > 0 ? Number(wList[wList.length - 1].weight) : null;
        const cals = (meals || []).filter(m => m.date.startsWith(dateStr)).reduce((s, m) => s + m.calories, 0);
        const getPR = (ex) => {
            const ws = (workouts || []).filter(w => w.exercise === ex && w.type === 'strength');
            return ws.length === 0 ? '--' : Math.max(...ws.map(w => Number(w.weight)));
        };
        return { currentWeight: curW, cals, prs: { bench: getPR('ベンチプレス'), squat: getPR('スクワット'), deadlift: getPR('デッドリフト') }, isMotivated: false };
    }, [weights, meals, workouts, dateStr]);

    const nextCareerEvent = useMemo(() => {
        const up = jobsData.filter(j => j.date && isAfter(parseISO(j.date), today)).sort((a, b) => new Date(a.date) - new Date(b.date));
        return up[0] || null;
    }, [jobsData, today]);

    const nextShift = useMemo(() => {
        const up = shiftsData.filter(s => isAfter(parseISO(s.date), today)).sort((a, b) => new Date(a.date) - new Date(b.date));
        return up[0] || null;
    }, [shiftsData, today]);

    const handleGeminiSearch = (e, pOverride) => {
        if (e) e.preventDefault();
        const q = pOverride || geminiPrompt;
        if (!q.trim()) return;
        window.open(`https://gemini.google.com/app?q=${encodeURIComponent(q)}`, '_blank');
        setGeminiPrompt('');
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading Dashboard...</div>;

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <header>
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 tracking-tight">Dashboard</h1>
                    <p className="text-gray-400 mt-2 text-lg">{format(today, 'yyyy年M月d日 (EEE)')} • {['Sun', 'Sat'].includes(dayName) ? '良い週末を！' : '今日も一日頑張りましょう！'}</p>
                </header>
                <div className="flex-1 max-w-xl relative group z-20 flex flex-col gap-2">
                    <form onSubmit={handleGeminiSearch} className="relative w-full">
                        <input type="text" value={geminiPrompt} onChange={e => setGeminiPrompt(e.target.value)} placeholder="Geminiに質問..." className="w-full bg-gray-800/50 backdrop-blur-md border border-white/10 rounded-full pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all shadow-lg" />
                        <Sparkles size={18} className="absolute left-3 top-3.5 text-purple-400 animate-pulse" />
                    </form>
                    <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                        {GEMINI_QUICK_ACTIONS.map((a, i) => (
                            <button key={i} onClick={() => handleGeminiSearch(null, a)} className="whitespace-nowrap px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[10px] text-gray-400 hover:text-white transition-all"># {a}</button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Finance */}
                <div className="glass-card p-6 md:col-span-2 relative group flex flex-col justify-between min-h-[300px]">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={64} className="text-green-500" /></div>
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4"><Wallet size={20} className="text-green-400" /> Finance</h3>
                        <div className="flex items-baseline gap-6">
                            <div><p className="text-xs text-gray-500 uppercase mb-1">Total Balance</p><p className="text-3xl font-bold text-white">¥{financeStats.balance.toLocaleString()}</p></div>
                            <div className="flex gap-2">
                                <div className="bg-white/5 p-2 rounded border border-white/5"><p className="text-[10px] text-gray-500 uppercase">SM/JC</p><p className="text-sm font-bold text-white">¥{financeStats.cards.smbc.amount.toLocaleString()}</p></div>
                                <div className="bg-white/5 p-2 rounded border border-white/5"><p className="text-[10px] text-gray-500 uppercase">Olive</p><p className="text-sm font-bold text-white">¥{financeStats.cards.olive.amount.toLocaleString()}</p></div>
                            </div>
                        </div>
                    </div>
                    <div className="h-[120px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={financeStats.monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                <XAxis dataKey="display" stroke="#4b5563" fontSize={10} axisLine={false} tickLine={false} />
                                <Bar dataKey="expense" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <Link to="/finance" className="absolute bottom-4 right-4 text-xs text-gray-500 hover:text-white"><ArrowRight size={16} /></Link>
                </div>

                {/* Internal Calendar Widget */}
                <div className="lg:col-span-2 glass-card p-5 relative group flex flex-col min-h-[350px]">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2"><CalendarIcon size={20} className="text-blue-400" /> Schedule</h3>
                        <Link to="/calendar" className="text-xs text-gray-500 hover:text-white transition-colors">Go to Calendar</Link>
                    </div>
                    <div className="grid grid-cols-7 gap-1 flex-1">
                        {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
                            <div key={d} className={clsx("text-center text-[10px] uppercase font-bold py-1", i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-500")}>{d}</div>
                        ))}
                        {eachDayOfInterval({ start: startOfWeek(startOfMonth(today)), end: endOfWeek(endOfMonth(today)) }).map((day, i) => {
                            const dKey = format(day, 'yyyy-MM-dd');
                            const dayEvents = calendarEvents.filter(e => e.date === dKey);
                            const dayShift = shiftsData.find(s => s.date === dKey);
                            const isCurMonth = isSameMonth(day, today);
                            return (
                                <Link key={i} to="/calendar" className={clsx("relative p-1 rounded-md transition-all border border-transparent flex flex-col gap-0.5 min-h-[45px] overflow-hidden", !isCurMonth && "opacity-20 grayscale", isToday(day) ? "bg-blue-500/10 border-blue-500/20" : "hover:bg-white/5")}>
                                    <span className={clsx("text-[9px] font-bold self-end", isToday(day) ? "text-blue-400" : "text-gray-500")}>{format(day, 'd')}</span>
                                    <div className="flex-1 flex flex-col gap-0.5 mt-auto w-full overflow-hidden">
                                        {dayShift && (
                                            <div className="w-full h-1 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]" title="Shift" />
                                        )}
                                        {dayEvents.slice(0, 3).map(e => {
                                            const cat = calendarCategories.find(c => c.id === e.category_id);
                                            return <div key={e.id} className={clsx("w-full h-1 rounded-full", cat?.color || "bg-gray-500")} title={e.title} />;
                                        })}
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>

                {/* Tasks */}
                <div className="glass-card p-6 md:col-span-2 relative group flex items-center gap-6">
                    <div className="absolute top-0 right-0 p-4 opacity-5"><CheckSquare size={48} className="text-purple-500" /></div>
                    <div className="w-24 h-24 relative shrink-0">
                        <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={todoStats.data} innerRadius={35} outerRadius={45} paddingAngle={5} dataKey="value" stroke="none">{todoStats.data.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}</Pie></PieChart></ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-white">{todoStats.rate}%</div>
                    </div>
                    <div className="flex-1 space-y-2">
                        <h3 className="text-sm font-bold text-purple-400 uppercase tracking-widest mb-2">Priority Tasks</h3>
                        {activeTodos.map(t => (
                            <div key={t.id} className="flex items-center gap-2 p-2 bg-white/5 rounded-lg border border-white/5 text-xs text-gray-200">
                                <div className="w-1 h-1 rounded-full bg-purple-400" /> <span className="truncate flex-1">{t.text}</span>
                            </div>
                        ))}
                        <Link to="/todo" className="text-[10px] text-gray-500 hover:text-white flex items-center gap-1">View all <ArrowRight size={10} /></Link>
                    </div>
                </div>

                {/* Health */}
                <div className="glass-card p-6 relative group flex flex-col justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4"><Activity size={20} className="text-pink-400" /> Health</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <div><p className="text-[10px] text-gray-500 uppercase">Weight</p><p className="text-2xl font-bold text-white">{healthStats.currentWeight || '--'}<span className="text-xs text-gray-500 font-normal ml-1">kg</span></p></div>
                                <div className="text-right"><p className="text-[10px] text-gray-500 uppercase">Today's Cals</p><p className="text-lg font-bold text-white">{healthStats.cals}<span className="text-[10px] text-gray-500 font-normal ml-1">kcal</span></p></div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {['BP', 'SQ', 'DL'].map((ex, i) => (
                                    <div key={ex} className="bg-white/5 rounded p-2 text-center border border-white/5">
                                        <p className="text-[8px] text-gray-500">{ex}</p>
                                        <p className="text-xs font-bold text-white">{Object.values(healthStats.prs)[i]}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <Link to="/health" className="mt-4 inline-block text-[10px] text-gray-500 hover:text-white">Detailed Stats</Link>
                </div>

                {/* Career */}
                {/* Career & Work Shift */}
                <div className="glass-card p-6 relative group bg-gradient-to-br from-gray-900/60 to-blue-900/20 flex flex-col justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4"><Briefcase size={20} className="text-blue-300" /> Career & Work</h3>
                        <div className="space-y-3">
                            {nextCareerEvent ? (
                                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                    <p className="text-[9px] text-blue-400 font-bold uppercase mb-1">Upcoming Job Event</p>
                                    <p className="text-sm font-bold text-white truncate">{nextCareerEvent.company}</p>
                                    <p className="text-[10px] text-blue-300 mt-1 flex items-center gap-1"><CalendarIcon size={10} /> {format(parseISO(nextCareerEvent.date), 'M月d日')}</p>
                                </div>
                            ) : null}
                            {nextShift ? (
                                <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                                    <p className="text-[9px] text-green-400 font-bold uppercase mb-1">Next Work Shift</p>
                                    <p className="text-sm font-bold text-white">{nextShift.start} - {nextShift.end}</p>
                                    <p className="text-[10px] text-green-300 mt-1 flex items-center gap-1"><Clock size={10} /> {format(parseISO(nextShift.date), 'M月d日 (EEE)')}</p>
                                </div>
                            ) : null}
                            {!nextCareerEvent && !nextShift && (
                                <div className="text-center py-6 text-xs text-gray-600 italic">No upcoming events</div>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-4 mt-4">
                        <Link to="/career" className="text-[10px] text-gray-500 hover:text-white">Job Progress</Link>
                        <Link to="/calendar" className="text-[10px] text-gray-500 hover:text-white">Calendar</Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
