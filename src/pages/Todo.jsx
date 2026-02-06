import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
    Plus, Trash2, Calendar as CalIcon, Clock, Tag, CheckSquare, Square,
    AlertCircle, ChevronDown, ChevronUp, Home, X, Loader2
} from 'lucide-react';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend
} from 'recharts';
import useLocalStorage from '../hooks/useLocalStorage';
import { format, parseISO, isValid, isPast, isToday, isTomorrow } from 'date-fns';
import clsx from 'clsx';
import { useSupabase } from '../hooks/useSupabase';
import { supabase } from '../lib/supabaseClient';

// --- CONSTANTS ---
const DEFAULT_TAGS = [
    { id: 'urgent', name: '緊急', color: 'bg-red-500' },
    { id: 'school', name: '学校', color: 'bg-blue-500' },
    { id: 'work', name: '仕事', color: 'bg-purple-500' },
    { id: 'personal', name: 'プライベート', color: 'bg-green-500' }
];

const SafePieChart = ({ data }) => {
    if (!data || data.length === 0 || data.every(d => d.value === 0)) {
        return (
            <div className="flex items-center justify-center h-full text-xs text-gray-500">
                データなし
            </div>
        );
    }
    return (
        <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={25}
                    outerRadius={35}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                >
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                </Pie>
                <RechartsTooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', fontSize: '12px' }}
                    itemStyle={{ color: '#fff' }}
                />
            </PieChart>
        </ResponsiveContainer>
    );
};

const Todo = ({ user }) => {
    // --- SUPABASE HOOK ---
    const {
        data: todos,
        loading,
        addData: addTodo,
        updateData: updateTodo,
        deleteData: removeTodo
    } = useSupabase('todos', user?.id);

    // Tags remain as constants for now unless user wants them dynamic
    const tags = DEFAULT_TAGS;

    const [form, setForm] = useState({ text: '', tag: '', date: '', time: '' });
    const [isFormOpen, setIsFormOpen] = useState(false);

    // --- COMPUTED ---
    const stats = useMemo(() => {
        const total = todos.length;
        const completed = todos.filter(t => t.completed).length;
        const active = total - completed;
        const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);

        return {
            total, completed, active, completionRate,
            chartData: [
                { name: '完了', value: completed, color: '#10b981' },
                { name: '進行中', value: active, color: '#3b82f6' }
            ]
        };
    }, [todos]);

    // Sorting: Urgent/Overdue first, then by date, then created
    const sortedTodos = useMemo(() => {
        return [...todos].sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            const dateA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
            const dateB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
            return dateA - dateB;
        });
    }, [todos]);

    // --- HANDLERS ---
    const handleAdd = async (e) => {
        e.preventDefault();
        if (!form.text.trim()) return;

        let deadline = null;
        if (form.date) {
            deadline = form.time ? `${form.date}T${form.time}:00Z` : `${form.date}T23:59:59Z`;
        }

        try {
            await addTodo({
                text: form.text,
                completed: false,
                tag: form.tag || 'personal',
                deadline: deadline
            });
            setForm({ text: '', tag: '', date: '', time: '' });
        } catch (err) {
            alert('タスクの追加に失敗しました');
        }
    };

    const toggleTodo = async (id, currentStatus) => {
        try {
            await updateTodo(id, { completed: !currentStatus });
        } catch (err) {
            alert('更新に失敗しました');
        }
    };

    const deleteTodo = async (id) => {
        if (!window.confirm('このタスクを削除しますか？')) return;
        try {
            await removeTodo(id);
        } catch (err) {
            alert('削除に失敗しました');
        }
    };

    const onDragEnd = (result) => {
        // Supabase migration: Drag & Drop order persistence would require a 'sort_order' column.
        // For now, we'll keep the drag end local or skip persistence until we add the column if critical.
        if (!result.destination) return;
        // Skipping local state reorder for simplicity in this phase
    };

    // --- HELPERS ---
    const getDeadlineStatus = (isoString) => {
        if (!isoString) return null;
        try {
            const date = parseISO(isoString);
            if (!isValid(date)) return null;

            if (isPast(date) && !isToday(date)) return { text: '期限切れ', color: 'text-red-500', icon: AlertCircle };
            if (isToday(date)) return { text: '今日', color: 'text-orange-500', icon: Clock };
            if (isTomorrow(date)) return { text: '明日', color: 'text-yellow-500', icon: Clock };
            return { text: format(date, 'M/d'), color: 'text-gray-400', icon: CalIcon };
        } catch (e) {
            return null;
        }
    };

    return (
        <div className="space-y-6 pb-20 relative animate-fade-in">
            <Link to="/" className="absolute top-0 right-0 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-10">
                <Home size={20} />
            </Link>

            <header className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Tasks</h1>
                    <p className="text-gray-400">タスクと優先順位の管理</p>
                </div>

                {/* Stats Widget */}
                <div className="flex gap-4 md:justify-end">
                    <div className="glass px-4 py-2 rounded-xl flex items-center gap-3">
                        <div className="h-10 w-10">
                            <SafePieChart data={stats.chartData} />
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 uppercase">完了率</p>
                            <p className="text-xl font-bold text-white">{stats.completionRate}%</p>
                        </div>
                    </div>
                    <div className="glass px-4 py-2 rounded-xl text-center min-w-[80px]">
                        <p className="text-xs text-gray-400 uppercase">進行中</p>
                        <p className="text-xl font-bold text-blue-400">{stats.active}</p>
                    </div>
                </div>
            </header>

            {/* Input Form */}
            <div className="glass-card p-1">
                <form onSubmit={handleAdd} className="p-3 space-y-3">
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            placeholder="新しいタスクを入力..."
                            value={form.text}
                            onChange={e => setForm({ ...form, text: e.target.value })}
                            className="bg-transparent text-white placeholder-gray-500 flex-1 outline-none text-lg"
                        />
                        <button type="button" onClick={() => setIsFormOpen(!isFormOpen)} className="text-gray-400 hover:text-white transition-colors">
                            {isFormOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                    </div>

                    {isFormOpen && (
                        <div className="pt-3 border-t border-white/5 grid grid-cols-1 md:grid-cols-4 gap-3 animate-fade-in">
                            {/* Deadline Date */}
                            <div className="flex items-center bg-white/5 rounded-lg px-2">
                                <CalIcon size={16} className="text-gray-500 mr-2" />
                                <input
                                    type="date"
                                    value={form.date}
                                    onChange={e => setForm({ ...form, date: e.target.value })}
                                    className="bg-transparent text-white text-sm outline-none w-full"
                                />
                            </div>

                            {/* Deadline Time (Optional) */}
                            <div className="flex items-center bg-white/5 rounded-lg px-2">
                                <Clock size={16} className="text-gray-500 mr-2" />
                                <input
                                    type="time"
                                    value={form.time}
                                    onChange={e => setForm({ ...form, time: e.target.value })}
                                    className="bg-transparent text-white text-sm outline-none w-full"
                                />
                            </div>

                            {/* Tag Select */}
                            <div className="relative">
                                <select
                                    value={form.tag}
                                    onChange={e => setForm({ ...form, tag: e.target.value })}
                                    className="w-full bg-white/5 rounded-lg px-3 py-2 text-white text-sm appearance-none outline-none"
                                >
                                    <option value="" disabled>タグを選択</option>
                                    {tags.map(tag => (
                                        <option key={tag.id} value={tag.id} className="bg-gray-900">{tag.name}</option>
                                    ))}
                                </select>
                                <Tag size={14} className="absolute right-3 top-3 text-gray-500 pointer-events-none" />
                            </div>

                            <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium text-sm py-2">
                                追加する
                            </button>
                        </div>
                    )}
                </form>
            </div>

            {loading && (
                <div className="flex justify-center py-10">
                    <Loader2 className="animate-spin text-blue-500" size={32} />
                </div>
            )}

            {/* Todo List */}
            <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="todos">
                    {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                            {sortedTodos.map((todo, index) => {
                                const status = getDeadlineStatus(todo.deadline);
                                const currentTag = tags.find(t => t.id === todo.tag);
                                const tagColor = currentTag?.color || 'bg-gray-500';

                                return (
                                    <Draggable key={todo.id} draggableId={todo.id} index={index}>
                                        {(provided) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                {...provided.dragHandleProps}
                                                className={clsx(
                                                    "glass-card p-4 flex items-center justify-between group transition-all duration-200 border-l-4",
                                                    todo.completed ? "border-green-500 opacity-60" : `border-blue-500`
                                                )}
                                                style={{ ...provided.draggableProps.style }}
                                            >
                                                <div className="flex items-center gap-4 flex-1">
                                                    <button onClick={() => toggleTodo(todo.id, todo.completed)} className="text-gray-400 hover:text-green-400 transition-colors">
                                                        {todo.completed ? <CheckSquare className="text-green-500" size={24} /> : <Square size={24} />}
                                                    </button>

                                                    <div className="flex-1">
                                                        <p className={clsx("font-medium text-lg", todo.completed && "line-through text-gray-500")}>
                                                            {todo.text}
                                                        </p>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <span className={clsx("text-[10px] px-2 py-0.5 rounded-full text-white bg-opacity-80", tagColor)}>
                                                                {currentTag?.name || todo.tag}
                                                            </span>

                                                            {status && !todo.completed && (
                                                                <span className={clsx("text-xs flex items-center gap-1", status.color)}>
                                                                    <status.icon size={12} /> {status.text}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <button onClick={() => deleteTodo(todo.id)} className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all p-2">
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        )}
                                    </Draggable>
                                );
                            })}
                            {provided.placeholder}

                            {sortedTodos.length === 0 && (
                                <div className="text-center py-10 text-gray-500 border border-dashed border-white/10 rounded-xl">
                                    タスクはありません。良い一日を！
                                </div>
                            )}
                        </div>
                    )}
                </Droppable>
            </DragDropContext>
        </div>
    );
};

export default Todo;
