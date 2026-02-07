import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, differenceInMinutes, parse, startOfDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Clock, Save, Trash2, Home, Settings, DollarSign, Briefcase, X, Calendar as CalendarIcon, Tag } from 'lucide-react';
import useLocalStorage from '../hooks/useLocalStorage';
import clsx from 'clsx';
import { useSupabase } from '../hooks/useSupabase';
import { supabase } from '../lib/supabaseClient';

const Calendar = ({ user }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    // --- SUPABASE DATA ---
    const {
        data: eventsData,
        loading: loadingEvents,
        addData: addEvent,
        deleteData: removeEvent
    } = useSupabase('calendar_events', user?.id);

    const {
        data: categoriesData,
        loading: loadingCategories,
        addData: addCategory,
        deleteData: removeCategory
    } = useSupabase('calendar_categories', user?.id);

    const {
        data: shiftsData,
        loading: loadingShifts,
        addData: addShift,
        deleteData: removeShift
    } = useSupabase('work_shifts', user?.id);

    // Default categories if none exist
    const categories = useMemo(() => {
        if (categoriesData.length > 0) return categoriesData;
        return [
            { id: '1', name: '仕事', color: 'bg-green-500' },
            { id: '2', name: 'プライベート', color: 'bg-blue-500' },
            { id: '3', name: '大学', color: 'bg-purple-500' },
            { id: '4', name: '重要', color: 'bg-red-500' }
        ];
    }, [categoriesData]);

    const [settings, setSettings] = useLocalStorage('work_settings', { hourlyRate: 1200, transport: 1000 });

    // UI State
    const [showSettings, setShowSettings] = useState(false);
    const [inputType, setInputType] = useState('shift'); // 'shift' or 'event'
    const [shiftForm, setShiftForm] = useState({ start: '09:00', end: '17:00', break: '60' });
    const [eventForm, setEventForm] = useState({ title: '', start_time: '', end_time: '', category_id: '', is_all_day: false });

    // Calendar generation
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

    // Initialize category_id once categories are loaded
    useEffect(() => {
        if (categories.length > 0 && !eventForm.category_id) {
            setEventForm(prev => ({ ...prev, category_id: categories[0].id }));
        }
    }, [categories]);

    // --- Logic ---
    const handleSaveShift = async (e) => {
        e.preventDefault();
        const dateKey = format(selectedDate, 'yyyy-MM-dd');
        try {
            await addShift({
                date: dateKey,
                start: shiftForm.start,
                end: shiftForm.end,
                break: Number(shiftForm.break)
            });
        } catch (err) {
            console.error('[Calendar] saveShift error:', err);
            alert('シフトの保存に失敗しました: ' + (err.message || '不明なエラー'));
        }
    };

    const handleSaveEvent = async (e) => {
        e.preventDefault();
        if (!eventForm.title) return;

        try {
            await addEvent({
                date: format(selectedDate, 'yyyy-MM-dd'),
                title: eventForm.title,
                start_time: eventForm.is_all_day ? null : (eventForm.start_time || null),
                end_time: eventForm.is_all_day ? null : (eventForm.end_time || null),
                is_all_day: eventForm.is_all_day,
                category_id: eventForm.category_id || null
            });
            setEventForm({ ...eventForm, title: '', start_time: '', end_time: '', is_all_day: false });
        } catch (err) {
            console.error('[Calendar] saveEvent error:', err);
            alert('予定の保存に失敗しました: ' + (err.message || '不明なエラー'));
        }
    };

    const calculateDailySalary = (shift) => {
        if (!shift || !shift.start || !shift.end) return 0;
        try {
            const start = parse(shift.start, 'HH:mm', new Date());
            const end = parse(shift.end, 'HH:mm', new Date());
            if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
            let minutes = differenceInMinutes(end, start);
            if (minutes < 0) minutes += 24 * 60;
            const workMinutes = Math.max(0, minutes - (shift.break || 0));
            return Math.floor((workMinutes / 60) * settings.hourlyRate) + settings.transport;
        } catch (e) {
            return 0;
        }
    };

    // Derived Data
    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
    const selectedShift = shiftsData.find(s => s.date === selectedDateStr);
    const selectedEvents = useMemo(() => {
        return eventsData
            .filter(e => e.date === selectedDateStr)
            .sort((a, b) => (a.start_time || '00:00').localeCompare(b.start_time || '00:00'));
    }, [eventsData, selectedDateStr]);

    const getCategoryColor = (catId) => {
        return categories.find(c => c.id === catId)?.color || 'bg-gray-500';
    };

    const getCategoryName = (catId) => {
        return categories.find(c => c.id === catId)?.name || '未分類';
    };

    const monthSummary = useMemo(() => {
        const currentMonthShifts = shiftsData.filter(s => s.date.startsWith(format(currentDate, 'yyyy-MM')));
        const totalSalary = currentMonthShifts.reduce((sum, s) => sum + calculateDailySalary(s), 0);
        return { totalSalary, totalDays: currentMonthShifts.length };
    }, [shiftsData, currentDate, settings]);

    return (
        <div className="space-y-6 animate-fade-in md:h-[calc(100vh-140px)] flex flex-col items-stretch relative pb-10">
            <Link to="/" className="absolute top-0 right-0 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-10">
                <Home size={20} />
            </Link>

            <header className="flex-none flex items-center justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Calendar</h1>
                    <p className="text-xs md:text-gray-400 mt-1">予定とカテゴリ管理</p>
                </div>
                <button
                    onClick={() => setShowSettings(true)}
                    className="glass px-3 py-1.5 md:px-4 md:py-2 rounded-lg flex items-center gap-2 text-gray-300 hover:text-white transition-colors text-xs md:text-base"
                >
                    <Settings size={18} /> 設定
                </button>
            </header>

            {/* Settings Modal (Categories & Salary) */}
            {showSettings && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="glass-card w-full max-w-sm p-6 relative max-h-[80vh] overflow-y-auto custom-scrollbar">
                        <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"><X size={20} /></button>
                        <h3 className="text-lg font-bold text-white mb-6">カレンダー設定</h3>

                        <div className="space-y-8">
                            {/* Salary */}
                            <section>
                                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4">給与設定</h4>
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-gray-500 uppercase">時給 (円)</label>
                                        <input type="number" value={settings.hourlyRate} onChange={e => setSettings({ ...settings, hourlyRate: Number(e.target.value) })} className="w-full input-dark px-3 py-2" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-gray-500 uppercase">交通費 (1日)</label>
                                        <input type="number" value={settings.transport} onChange={e => setSettings({ ...settings, transport: Number(e.target.value) })} className="w-full input-dark px-3 py-2" />
                                    </div>
                                </div>
                            </section>

                            {/* Categories */}
                            <section>
                                <h4 className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-4">カテゴリー</h4>
                                <div className="space-y-2 mb-4">
                                    {categoriesData.map(cat => (
                                        <div key={cat.id} className="flex items-center gap-2 p-2 bg-white/5 rounded-lg border border-white/5">
                                            <div className={`w-3 h-3 rounded-full ${cat.color}`} />
                                            <span className="flex-1 text-sm text-gray-200">{cat.name}</span>
                                            <button onClick={() => removeCategory(cat.id)} className="text-gray-500 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input type="text" placeholder="新規" className="flex-1 input-dark px-2 py-1.5 text-xs" id="newCatName" />
                                    <select className="input-dark px-2 py-1.5 text-xs w-20" id="newCatColor">
                                        <option value="bg-blue-500">Blue</option>
                                        <option value="bg-green-500">Green</option>
                                        <option value="bg-red-500">Red</option>
                                        <option value="bg-purple-500">Purple</option>
                                        <option value="bg-yellow-500">Gold</option>
                                    </select>
                                    <button
                                        onClick={async () => {
                                            const n = document.getElementById('newCatName').value;
                                            const c = document.getElementById('newCatColor').value;
                                            if (n) {
                                                await addCategory({ name: n, color: c });
                                                document.getElementById('newCatName').value = '';
                                            }
                                        }}
                                        className="bg-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold"
                                    >追</button>
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 min-h-0">
                {/* Monthly Calendar Grid */}
                <div className="lg:col-span-2 glass-card p-4 md:p-6 flex flex-col h-full overflow-hidden">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-white tracking-widest">{format(currentDate, 'yyyy MM')}</h2>
                        <div className="flex gap-2">
                            <button onClick={prevMonth} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><ChevronLeft size={20} /></button>
                            <button onClick={nextMonth} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><ChevronRight size={20} /></button>
                        </div>
                    </div>

                    <div className="grid grid-cols-7 mb-2">
                        {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
                            <div key={d} className={`text-center text-[10px] font-bold uppercase py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500'}`}>{d}</div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 flex-1 auto-rows-fr gap-1 h-full min-h-0">
                        {calendarDays.map((day) => {
                            const dKey = format(day, 'yyyy-MM-dd');
                            const dayEvents = eventsData.filter(e => e.date === dKey);
                            const dayShift = shiftsData.find(s => s.date === dKey);
                            const isSel = isSameDay(day, selectedDate);
                            const isCurMonth = isSameMonth(day, currentDate);

                            return (
                                <div
                                    key={day.toString()}
                                    onClick={() => setSelectedDate(day)}
                                    className={clsx(
                                        "relative p-1 rounded-lg cursor-pointer transition-all border border-white/5 flex flex-col gap-1 min-h-[60px]",
                                        !isCurMonth && "opacity-20 grayscale",
                                        isToday(day) ? "bg-blue-500/10 border-blue-500/40" : "hover:bg-white/5",
                                        isSel && "ring-2 ring-white/30 bg-white/10"
                                    )}
                                >
                                    <span className={clsx(
                                        "text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full self-end",
                                        isToday(day) ? "bg-blue-500 text-white" : "text-gray-400"
                                    )}>{format(day, 'd')}</span>

                                    <div className="flex-1 overflow-hidden space-y-0.5">
                                        {dayShift && (
                                            <div className="text-[8px] px-1 rounded truncate text-white border-l-2 border-green-500 bg-green-500/20 font-bold">
                                                {dayShift.start}-{dayShift.end}
                                            </div>
                                        )}
                                        {dayEvents.slice(0, 2).map(e => (
                                            <div key={e.id} className={clsx("text-[8px] px-1 rounded truncate text-white border-l-2", getCategoryColor(e.category_id), "bg-white/10")}>
                                                {e.title}
                                            </div>
                                        ))}
                                        {(dayEvents.length + (dayShift ? 1 : 0)) > 3 && <div className="text-[7px] text-gray-500 text-center">+{dayEvents.length + (dayShift ? 1 : 0) - 3} items</div>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Sidebar: Detail & Forms */}
                <div className="space-y-6 flex flex-col h-full overflow-hidden">
                    <div className="glass-card p-6 flex flex-col shrink-0 flex-1 min-h-0">
                        <div className="flex items-center justify-between mb-6 shrink-0">
                            <h3 className="text-lg font-bold text-white">{format(selectedDate, 'M月 d日 (EEE)')}</h3>
                            <div className="flex bg-black/40 rounded-lg p-1 gap-1">
                                <button onClick={() => setInputType('event')} className={clsx("p-1.5 rounded-md transition-all", inputType === 'event' ? "bg-blue-600 shadow-lg text-white" : "text-gray-500 hover:text-white")}><Plus size={16} /></button>
                                <button onClick={() => setInputType('shift')} className={clsx("p-1.5 rounded-md transition-all", inputType === 'shift' ? "bg-green-600 shadow-lg text-white" : "text-gray-500 hover:text-white")}><DollarSign size={16} /></button>
                            </div>
                        </div>

                        <div className="overflow-y-auto custom-scrollbar flex-1 space-y-6 pr-1">
                            {/* Input Form */}
                            {inputType === 'event' ? (
                                <form onSubmit={handleSaveEvent} className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                    <input type="text" placeholder="予定名" value={eventForm.title} onChange={e => setEventForm({ ...eventForm, title: e.target.value })} className="w-full input-dark px-3 py-2 text-sm" />
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="time"
                                            value={eventForm.start_time}
                                            onChange={e => setEventForm({ ...eventForm, start_time: e.target.value })}
                                            className="input-dark px-2 py-1.5 text-xs"
                                            disabled={eventForm.is_all_day}
                                        />
                                        <input
                                            type="time"
                                            value={eventForm.end_time}
                                            onChange={e => setEventForm({ ...eventForm, end_time: e.target.value })}
                                            className="input-dark px-2 py-1.5 text-xs"
                                            disabled={eventForm.is_all_day}
                                        />
                                    </div>
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={eventForm.is_all_day}
                                            onChange={e => setEventForm({ ...eventForm, is_all_day: e.target.checked })}
                                            className="w-3 h-3 rounded border-white/10 bg-black/40 text-blue-500 focus:ring-blue-500/50"
                                        />
                                        <span className="text-[10px] text-gray-400 group-hover:text-white transition-colors">終日の予定</span>
                                    </label>
                                    <select value={eventForm.category_id} onChange={e => setEventForm({ ...eventForm, category_id: e.target.value })} className="w-full input-dark px-3 py-2 text-xs">
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-xl text-xs font-bold tracking-widest transition-all">追加</button>
                                </form>
                            ) : (
                                <form onSubmit={handleSaveShift} className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <input type="time" value={shiftForm.start} onChange={e => setShiftForm({ ...shiftForm, start: e.target.value })} className="input-dark px-3 py-2 text-xs" />
                                        <input type="time" value={shiftForm.end} onChange={e => setShiftForm({ ...shiftForm, end: e.target.value })} className="input-dark px-3 py-2 text-xs" />
                                    </div>
                                    <input type="number" placeholder="休憩(分)" value={shiftForm.break} onChange={e => setShiftForm({ ...shiftForm, break: e.target.value })} className="w-full input-dark px-3 py-2 text-xs" />
                                    <button type="submit" className="w-full bg-green-600 hover:bg-green-500 text-white py-2 rounded-xl text-xs font-bold tracking-widest transition-all">保存</button>
                                </form>
                            )}

                            {/* Daily Content */}
                            <div className="space-y-3 pt-4 border-t border-white/5">
                                {selectedShift && (
                                    <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-green-500/20 rounded-lg text-green-300"><Briefcase size={16} /></div>
                                            <div>
                                                <p className="text-xs font-bold text-white">勤務シフト</p>
                                                <p className="text-[10px] text-green-400/80">{selectedShift.start} - {selectedShift.end} (休憩{selectedShift.break}分)</p>
                                            </div>
                                        </div>
                                        <button onClick={() => removeShift(selectedShift.id)} className="text-gray-500 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                                    </div>
                                )}
                                {selectedEvents.map(e => (
                                    <li key={e.id} className="group relative bg-white/5 border border-white/5 rounded-xl p-3 hover:bg-white/10 transition-all">
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="flex items-center gap-2">
                                                <div className={clsx("w-2 h-2 rounded-full", getCategoryColor(e.category_id))} />
                                                <h4 className="text-sm font-bold text-white leading-tight">{e.title}</h4>
                                            </div>
                                            <button onClick={() => removeEvent(e.id)} className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] text-gray-500">
                                            <span className="flex items-center gap-1">
                                                <Clock size={10} />
                                                {e.is_all_day ? '終日' : (e.start_time ? `${e.start_time} - ${e.end_time || ''}` : '時間未設定')}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                                {!selectedShift && selectedEvents.length === 0 && (
                                    <div className="text-center py-10">
                                        <CalendarIcon className="mx-auto text-gray-700 mb-2" size={32} />
                                        <p className="text-xs text-gray-600 italic">予定はありません</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Salary Summary (Monthly) */}
                    <div className="glass-card p-6 bg-gradient-to-br from-blue-900/40 to-indigo-900/10 shrink-0">
                        <p className="text-[10px] text-blue-300 uppercase font-bold tracking-widest mb-1">{format(currentDate, 'M月')}の給与予測</p>
                        <p className="text-3xl font-bold text-white">¥{monthSummary.totalSalary.toLocaleString()}</p>
                        <div className="mt-2 flex items-center gap-2 text-[10px] text-gray-500">
                            <Briefcase size={12} /> {monthSummary.totalDays}日勤務
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Calendar;
