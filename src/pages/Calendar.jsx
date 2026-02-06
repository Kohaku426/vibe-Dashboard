import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, differenceInMinutes, parse, startOfDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Clock, Save, Trash2, Home, Settings, DollarSign, Briefcase, X } from 'lucide-react';
import useLocalStorage from '../hooks/useLocalStorage';
import clsx from 'clsx';

const Calendar = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    // Data Storage
    // Data Storage
    const [shiftsData, setShifts] = useLocalStorage('work_shifts', []); // { date, start, end, break }
    const shifts = Array.isArray(shiftsData) ? shiftsData : [];

    const [eventsData, setEvents] = useLocalStorage('calendar_events', []); // { id, date, title, time, type }
    const events = Array.isArray(eventsData) ? eventsData : [];

    const [eventTypesData, setEventTypes] = useLocalStorage('calendar_event_types', [
        { name: '仕事', color: 'bg-green-500' },
        { name: 'プライベート', color: 'bg-blue-500' },
        { name: '大学', color: 'bg-purple-500' },
        { name: 'その他', color: 'bg-gray-500' }
    ]);
    const eventTypes = Array.isArray(eventTypesData) ? eventTypesData : [
        { name: '仕事', color: 'bg-green-500' },
        { name: 'プライベート', color: 'bg-blue-500' },
        { name: '大学', color: 'bg-purple-500' },
        { name: 'その他', color: 'bg-gray-500' }
    ];
    const [settingsData, setSettings] = useLocalStorage('work_settings', { hourlyRate: 1200, transport: 1000 });
    const settings = settingsData || { hourlyRate: 1200, transport: 1000 };

    // UI State
    const [showSettings, setShowSettings] = useState(false);
    const [inputType, setInputType] = useState('shift'); // 'shift' or 'event'
    const [shiftForm, setShiftForm] = useState({ start: '09:00', end: '17:00', break: '60' });
    const [eventForm, setEventForm] = useState({ title: '', time: '', type: 'プライベート' });

    // Calendar generation
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

    // --- Logic ---

    const handleSaveShift = (e) => {
        e.preventDefault();
        const dateKey = format(selectedDate, 'yyyy-MM-dd');

        const newShift = {
            id: Date.now(),
            date: dateKey,
            start: shiftForm.start,
            end: shiftForm.end,
            break: Number(shiftForm.break)
        };

        // Remove existing shift for this date if any, then add new one
        setShifts(prev => [...prev.filter(s => s.date !== dateKey), newShift]);
    };

    const handleDeleteShift = () => {
        const dateKey = format(selectedDate, 'yyyy-MM-dd');
        setShifts(prev => prev.filter(s => s.date !== dateKey));
    };

    const handleSaveEvent = (e) => {
        e.preventDefault();
        if (!eventForm.title) return;

        const newEvent = {
            id: Date.now(),
            date: format(selectedDate, 'yyyy-MM-dd'),
            ...eventForm
        };

        setEvents(prev => [...prev, newEvent]);
        setEventForm({ title: '', time: '', type: 'プライベート' });
    };

    const handleDeleteEvent = (id) => {
        setEvents(prev => prev.filter(e => e.id !== id));
    };

    const calculateDailySalary = (shift) => {
        if (!shift || !shift.start || !shift.end) return 0;
        try {
            const start = parse(shift.start, 'HH:mm', new Date());
            const end = parse(shift.end, 'HH:mm', new Date());

            if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

            let minutes = differenceInMinutes(end, start);

            if (minutes < 0) minutes += 24 * 60; // Handle overnight shifts
            const workMinutes = Math.max(0, minutes - (shift.break || 0));
            const hours = workMinutes / 60;

            return Math.floor(hours * settings.hourlyRate) + settings.transport;
        } catch (e) {
            console.error('Salary calc error:', e);
            return 0;
        }
    };

    // Derived Data
    const currentMonthShifts = useMemo(() => {
        const start = format(monthStart, 'yyyy-MM-dd');
        const end = format(monthEnd, 'yyyy-MM-dd');
        return shifts.filter(s => s.date >= start && s.date <= end);
    }, [shifts, monthStart, monthEnd]);

    const monthSummary = useMemo(() => {
        const totalSalary = currentMonthShifts.reduce((sum, s) => sum + calculateDailySalary(s), 0);
        const totalHours = currentMonthShifts.reduce((sum, s) => {
            const start = parse(s.start, 'HH:mm', new Date());
            const end = parse(s.end, 'HH:mm', new Date());
            let minutes = differenceInMinutes(end, start);
            if (minutes < 0) minutes += 24 * 60;
            return sum + Math.max(0, minutes - s.break);
        }, 0) / 60;
        const totalDays = currentMonthShifts.length;
        return { totalSalary, totalHours, totalDays };
    }, [currentMonthShifts, settings]);

    const selectedShift = shifts.find(s => s.date === format(selectedDate, 'yyyy-MM-dd'));
    const selectedEvents = events.filter(e => e.date === format(selectedDate, 'yyyy-MM-dd'));

    const getEventTypeColor = (typeName) => {
        return eventTypes.find(t => t.name === typeName)?.color || 'bg-gray-500';
    };

    return (
        <div className="space-y-6 animate-fade-in h-[calc(100vh-140px)] flex flex-col items-stretch relative pb-10">
            <Link to="/" className="absolute top-0 right-0 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-10">
                <Home size={20} />
            </Link>

            <header className="flex-none flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Calendar & Work</h1>
                    <p className="text-gray-400 mt-1">予定とシフトの管理</p>
                </div>
                <button
                    onClick={() => setShowSettings(true)}
                    className="glass px-4 py-2 rounded-lg flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
                >
                    <Settings size={18} /> 設定
                </button>
            </header>

            {/* Settings Modal */}
            {showSettings && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="glass-card w-full max-w-sm p-6 relative max-h-[80vh] overflow-y-auto custom-scrollbar">
                        <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X size={20} /></button>

                        <h3 className="text-lg font-bold text-white mb-4">カレンダー設定</h3>

                        <div className="space-y-6">
                            {/* Salary Settings */}
                            <section className="space-y-4">
                                <h4 className="text-sm font-bold text-gray-300 border-b border-white/10 pb-1">給与設定</h4>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase block mb-1">時給 (円)</label>
                                    <input
                                        type="number"
                                        value={settings.hourlyRate}
                                        onChange={e => setSettings({ ...settings, hourlyRate: Number(e.target.value) })}
                                        className="w-full input-dark px-3 py-2"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase block mb-1">交通費 (1日あたり)</label>
                                    <input
                                        type="number"
                                        value={settings.transport}
                                        onChange={e => setSettings({ ...settings, transport: Number(e.target.value) })}
                                        className="w-full input-dark px-3 py-2"
                                    />
                                </div>
                            </section>

                            {/* Event Type Settings */}
                            <section className="space-y-4">
                                <h4 className="text-sm font-bold text-gray-300 border-b border-white/10 pb-1">予定の種類</h4>
                                <div className="space-y-2">
                                    {eventTypes.map(type => (
                                        <div key={type.name} className="flex items-center gap-2 p-2 bg-white/5 rounded">
                                            <div className={`w-3 h-3 rounded-full ${type.color}`} />
                                            <span className="flex-1 text-sm text-white">{type.name}</span>
                                            <button
                                                onClick={() => setEventTypes(prev => prev.filter(t => t.name !== type.name))}
                                                className="text-gray-500 hover:text-red-400"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="新しい種類名"
                                        id="newEventType"
                                        className="flex-1 input-dark px-2 py-1.5 text-xs"
                                    />
                                    <select id="newEventColor" className="input-dark px-2 py-1.5 text-xs w-24">
                                        <option value="bg-blue-500">Blue</option>
                                        <option value="bg-green-500">Green</option>
                                        <option value="bg-purple-500">Purple</option>
                                        <option value="bg-orange-500">Orange</option>
                                        <option value="bg-red-500">Red</option>
                                        <option value="bg-pink-500">Pink</option>
                                        <option value="bg-yellow-500">Yellow</option>
                                        <option value="bg-gray-500">Gray</option>
                                    </select>
                                    <button
                                        onClick={() => {
                                            const nameInput = document.getElementById('newEventType');
                                            const colorInput = document.getElementById('newEventColor');
                                            if (nameInput.value) {
                                                setEventTypes(prev => [...prev, { name: nameInput.value, color: colorInput.value }]);
                                                nameInput.value = '';
                                            }
                                        }}
                                        className="bg-blue-600 text-white px-3 rounded text-xs font-bold"
                                    >
                                        追加
                                    </button>
                                </div>
                            </section>

                            <button onClick={() => setShowSettings(false)} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg">閉じる</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-0">
                {/* Calendar View */}
                <div className="lg:col-span-2 glass-card p-6 flex flex-col h-full">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            {format(currentDate, 'yyyy年 M月')}
                        </h2>
                        <div className="flex gap-2">
                            <button onClick={prevMonth} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><ChevronLeft size={20} /></button>
                            <button onClick={nextMonth} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><ChevronRight size={20} /></button>
                        </div>
                    </div>

                    {/* Grid Header */}
                    <div className="grid grid-cols-7 mb-2">
                        {['日', '月', '火', '水', '木', '金', '土'].map(day => (
                            <div key={day} className="text-center text-xs text-gray-500 font-medium uppercase py-1">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Grid Body */}
                    <div className="grid grid-cols-7 flex-1 auto-rows-fr gap-1">
                        {calendarDays.map((day) => {
                            const dateKey = format(day, 'yyyy-MM-dd');
                            const dayShift = shifts.find(s => s.date === dateKey);
                            const dayEvents = events.filter(e => e.date === dateKey);
                            const isSelected = isSameDay(day, selectedDate);
                            const dailySal = dayShift ? calculateDailySalary(dayShift) : 0;

                            return (
                                <div
                                    key={day.toString()}
                                    onClick={() => setSelectedDate(day)}
                                    className={clsx(
                                        "relative p-1 rounded-lg cursor-pointer transition-all border border-transparent flex flex-col items-stretch overflow-hidden group",
                                        !isSameMonth(day, currentDate) && "opacity-30",
                                        isToday(day) && "bg-blue-500/10 border-blue-500/30",
                                        isSelected ? "bg-white/10 border-white/20 ring-1 ring-white/30" : "hover:bg-white/5",
                                        dayShift && "bg-green-500/5"
                                    )}
                                >
                                    <div className="flex justify-between items-start">
                                        <span className={clsx(
                                            "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-0.5",
                                            isToday(day) ? "bg-blue-500 text-white" : "text-gray-300"
                                        )}>
                                            {format(day, 'd')}
                                        </span>
                                        {dayEvents.length > 0 && <div className="flex flex-col gap-0.5 pt-1">
                                            {dayEvents.slice(0, 3).map(e => (
                                                <div key={e.id} className={`w-1.5 h-1.5 rounded-full ${getEventTypeColor(e.type)}`} />
                                            ))}
                                        </div>}
                                    </div>

                                    {dayShift && (
                                        <div className="mt-auto text-center">
                                            <div className="w-full h-1 rounded-full bg-green-400 mb-0.5"></div>
                                            <p className="text-[9px] text-green-300 leading-none">¥{dailySal.toLocaleString()}</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Sidebar: Shift Details & Monthly Summary */}
                <div className="space-y-6 flex flex-col h-full overflow-hidden">

                    {/* Selected Day Details */}
                    <div className="glass-card p-6 flex flex-col shrink-0 max-h-[60%]">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center justify-between shrink-0">
                            <span>{format(selectedDate, 'M月d日 (EEE)')}</span>
                            <div className="flex bg-black/20 rounded p-1 gap-1">
                                <button onClick={() => setInputType('shift')} className={clsx("p-1 rounded text-xs", inputType === 'shift' ? "bg-green-500 text-white" : "text-gray-400 hover:text-white")}><DollarSign size={14} /></button>
                                <button onClick={() => setInputType('event')} className={clsx("p-1 rounded text-xs", inputType === 'event' ? "bg-blue-500 text-white" : "text-gray-400 hover:text-white")}><Plus size={14} /></button>
                            </div>
                        </h3>

                        <div className="overflow-y-auto custom-scrollbar flex-1 pr-1 space-y-4">
                            {/* Shift Display/Form */}
                            {inputType === 'shift' && (
                                <form onSubmit={handleSaveShift} className="space-y-3 animate-fade-in">
                                    <h4 className="text-xs font-bold text-green-400 uppercase">シフト管理</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[10px] text-gray-500 uppercase block mb-1">開始時間</label>
                                            <input type="time" value={shiftForm.start} onChange={e => setShiftForm({ ...shiftForm, start: e.target.value })} className="w-full input-dark px-2 py-1.5 text-xs" required />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-500 uppercase block mb-1">終了時間</label>
                                            <input type="time" value={shiftForm.end} onChange={e => setShiftForm({ ...shiftForm, end: e.target.value })} className="w-full input-dark px-2 py-1.5 text-xs" required />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-500 uppercase block mb-1">休憩時間 (分)</label>
                                        <input type="number" value={shiftForm.break} onChange={e => setShiftForm({ ...shiftForm, break: e.target.value })} className="w-full input-dark px-2 py-1.5 text-xs" min="0" />
                                    </div>
                                    <div className="flex gap-2">
                                        <button type="submit" className="flex-1 bg-green-600 hover:bg-green-500 text-white py-1.5 rounded-lg text-xs font-bold">{selectedShift ? 'シフトを更新' : 'シフトを追加'}</button>
                                        {selectedShift && <button type="button" onClick={handleDeleteShift} className="px-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg"><Trash2 size={14} /></button>}
                                    </div>
                                </form>
                            )}

                            {/* Event Display/Form */}
                            {inputType === 'event' && (
                                <form onSubmit={handleSaveEvent} className="space-y-3 animate-fade-in">
                                    <h4 className="text-xs font-bold text-blue-400 uppercase">予定を追加</h4>
                                    <input type="text" placeholder="予定のタイトル" value={eventForm.title} onChange={e => setEventForm({ ...eventForm, title: e.target.value })} className="w-full input-dark px-3 py-2 text-sm" autoFocus />
                                    <div className="grid grid-cols-2 gap-2">
                                        <input type="time" value={eventForm.time} onChange={e => setEventForm({ ...eventForm, time: e.target.value })} className="w-full input-dark px-2 py-1.5 text-xs" />
                                        <select value={eventForm.type} onChange={e => setEventForm({ ...eventForm, type: e.target.value })} className="w-full input-dark px-2 py-1.5 text-xs">
                                            {eventTypes.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                                        </select>
                                    </div>
                                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white py-1.5 rounded-lg text-xs font-bold">追加する</button>
                                </form>
                            )}

                            {/* Existing Items List */}
                            <div className="space-y-2 pt-2 border-t border-white/5">
                                {selectedShift && (
                                    <div className="p-2 bg-green-500/10 border border-green-500/20 rounded-lg flex justify-between items-center group">
                                        <div>
                                            <div className="text-xs font-bold text-green-300">シフト</div>
                                            <div className="text-[10px] text-green-100/70">{selectedShift.start} - {selectedShift.end}</div>
                                        </div>
                                    </div>
                                )}
                                {selectedEvents.map(ev => (
                                    <div key={ev.id} className="p-2 bg-white/5 border border-white/10 rounded-lg flex justify-between items-center group hover:bg-white/10 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${getEventTypeColor(ev.type)}`} />
                                            <div>
                                                <div className="text-xs font-bold text-white">{ev.title}</div>
                                                {ev.time && <div className="text-[10px] text-gray-400">{ev.time}</div>}
                                            </div>
                                        </div>
                                        <button onClick={() => handleDeleteEvent(ev.id)} className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                                    </div>
                                ))}
                                {!selectedShift && selectedEvents.length === 0 && (
                                    <div className="text-center py-4 text-xs text-gray-500 italic">予定はありません。</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Monthly Summary */}
                    <div className="glass-card p-6 flex-1 flex flex-col bg-gradient-to-br from-gray-900/60 to-blue-900/20">
                        <h3 className="text-sm font-semibold text-blue-300 uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
                            {format(currentDate, 'M月')}の給与見込み
                        </h3>

                        <div className="space-y-6 flex-1">
                            <div>
                                <p className="text-gray-400 text-xs mb-1">給与見込み</p>
                                <p className="text-4xl font-bold text-white">¥{monthSummary.totalSalary.toLocaleString()}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-black/20 rounded-lg p-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Briefcase size={14} className="text-gray-400" />
                                        <span className="text-xs text-gray-400">勤務日数</span>
                                    </div>
                                    <p className="text-xl font-bold text-white">{monthSummary.totalDays} <span className="text-xs font-normal text-gray-500">日</span></p>
                                </div>
                                <div className="bg-black/20 rounded-lg p-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Clock size={14} className="text-gray-400" />
                                        <span className="text-xs text-gray-400">総労働時間</span>
                                    </div>
                                    <p className="text-xl font-bold text-white">{monthSummary.totalHours.toFixed(1)} <span className="text-xs font-normal text-gray-500">時間</span></p>
                                </div>
                            </div>

                            <div className="mt-auto pt-4 border-t border-white/5">
                                <p className="text-xs text-center text-gray-500">
                                    時給 ¥{settings.hourlyRate} / 交通費 ¥{settings.transport}
                                </p>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default Calendar;
