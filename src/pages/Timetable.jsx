import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Home, Save, Info } from 'lucide-react';
import useLocalStorage from '../hooks/useLocalStorage';
import clsx from 'clsx';

const DAYS = ['月', '火', '水', '木', '金'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

const Timetable = () => {
    const [timetable, setTimetable] = useLocalStorage('university_timetable', {});
    const [selectedCell, setSelectedCell] = useState(null); // { day, period }
    const [editForm, setEditForm] = useState({ name: '', room: '', color: 'bg-blue-500' });

    const handleCellClick = (day, period) => {
        const key = `${day}-${period}`;
        const current = timetable[key] || { name: '', room: '', color: 'bg-blue-500' };
        setSelectedCell({ day, period });
        setEditForm(current);
    };

    const handleSave = (e) => {
        e.preventDefault();
        if (!selectedCell) return;
        const key = `${selectedCell.day}-${selectedCell.period}`;

        // If name is empty, delete entry
        if (!editForm.name.trim()) {
            const newTimetable = { ...timetable };
            delete newTimetable[key];
            setTimetable(newTimetable);
        } else {
            setTimetable(prev => ({
                ...prev,
                [key]: { ...editForm }
            }));
        }
        setSelectedCell(null);
    };

    const colors = [
        'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500', 'bg-red-500', 'bg-gray-600'
    ];

    return (
        <div className="space-y-6 animate-fade-in relative h-full flex flex-col">
            <Link to="/" className="absolute top-0 right-0 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-10">
                <Home size={20} />
            </Link>
            <header>
                <h1 className="text-3xl font-bold text-white tracking-tight">University Timetable</h1>
                <p className="text-gray-400 mt-1">時間割の管理・編集</p>
            </header>

            <div className="flex-1 glass-card p-6 overflow-auto">
                <div className="min-w-[800px]">
                    <div className="grid grid-cols-6 gap-2 mb-2">
                        <div className="text-center font-bold text-gray-500 text-sm py-2">時限</div>
                        {DAYS.map(day => (
                            <div key={day} className="text-center font-bold text-white bg-white/5 rounded py-2">
                                {day}
                            </div>
                        ))}
                    </div>

                    {PERIODS.map(period => (
                        <div key={period} className="grid grid-cols-6 gap-2 mb-2">
                            <div className="flex items-center justify-center text-gray-400 font-bold bg-white/5 rounded">
                                {period}
                            </div>
                            {DAYS.map(day => {
                                const key = `${day}-${period}`;
                                const data = timetable[key];
                                return (
                                    <div
                                        key={key}
                                        onClick={() => handleCellClick(day, period)}
                                        className={clsx(
                                            "h-24 p-2 rounded cursor-pointer transition-all border border-transparent hover:border-white/20 relative group",
                                            data ? `${data.color}/20` : "bg-white/5 hover:bg-white/10"
                                        )}
                                    >
                                        {data ? (
                                            <>
                                                <div className={`absolute top-0 left-0 w-1 h-full rounded-l ${data.color}`} />
                                                <p className="font-bold text-sm text-white truncate">{data.name}</p>
                                                <p className="text-xs text-gray-400 truncate">{data.room}</p>
                                            </>
                                        ) : (
                                            <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                <PlusIcon />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Edit Modal */}
            {selectedCell && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="glass-card w-full max-w-sm p-6">
                        <h3 className="text-lg font-bold text-white mb-4">
                            クラス編集: {selectedCell.day} - {selectedCell.period}限
                        </h3>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="text-xs text-gray-500 uppercase block mb-1">授業名</label>
                                <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                    placeholder="授業名を入力"
                                    className="w-full bg-black/40 border border-white/10 rounded p-2 text-white focus:outline-none focus:border-blue-500"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 uppercase block mb-1">教室</label>
                                <input
                                    type="text"
                                    value={editForm.room}
                                    onChange={e => setEditForm({ ...editForm, room: e.target.value })}
                                    placeholder="教室番号など"
                                    className="w-full bg-black/40 border border-white/10 rounded p-2 text-white focus:outline-none focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 uppercase block mb-2">カラー</label>
                                <div className="flex gap-2">
                                    {colors.map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setEditForm({ ...editForm, color: c })}
                                            className={clsx(
                                                "w-6 h-6 rounded-full transform transition-all",
                                                c,
                                                editForm.color === c ? "ring-2 ring-white scale-110" : "opacity-70 hover:opacity-100"
                                            )}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedCell(null)}
                                    className="flex-1 py-2 text-gray-400 hover:text-white transition-colors"
                                >
                                    キャンセル
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded py-2 font-bold transition-all"
                                >
                                    保存
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
);

export default Timetable;
