import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, MoreHorizontal, Building2, Calendar, FileText, Trash2, Home } from 'lucide-react';
import useLocalStorage from '../hooks/useLocalStorage';
import clsx from 'clsx';

const COLUMNS = {
    entry: { id: 'entry', title: 'エントリー', color: 'border-gray-500' },
    es: { id: 'es', title: 'ES提出', color: 'border-blue-500' },
    gd: { id: 'gd', title: 'GD', color: 'border-indigo-500' },
    interview1: { id: 'interview1', title: '一次面接', color: 'border-yellow-500' },
    interview2: { id: 'interview2', title: '二次面接', color: 'border-orange-500' },
    final: { id: 'final', title: '最終面接', color: 'border-red-500' },
    offer: { id: 'offer', title: '内定', color: 'border-green-500' },
};

import { useSupabase } from '../hooks/useSupabase';

const Career = ({ user }) => {
    // --- SUPABASE HOOK ---
    const {
        data: jobsData,
        loading,
        addData: addJob,
        updateData: updateJob,
        deleteData: removeJob
    } = useSupabase('career_jobs', user?.id);

    // Grouping jobs into columns for the Kanban board
    const jobs = useMemo(() => {
        const initialColumns = {
            entry: [],
            es: [],
            gd: [],
            interview1: [],
            interview2: [],
            final: [],
            offer: []
        };

        return jobsData.reduce((acc, job) => {
            if (acc[job.status]) {
                acc[job.status].push(job);
            }
            return acc;
        }, initialColumns);
    }, [jobsData]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newJob, setNewJob] = useState({ company: '', date: '', memo: '' });

    const onDragEnd = async (result) => {
        const { source, destination, draggableId } = result;
        if (!destination) return;

        if (source.droppableId === destination.droppableId && source.index === destination.index) {
            return;
        }

        try {
            await updateJob(draggableId, { status: destination.droppableId });
        } catch (err) {
            alert('移動に失敗しました');
        }
    };

    const handleAddJob = async (e) => {
        e.preventDefault();
        if (!newJob.company) return;

        try {
            await addJob({
                company: newJob.company,
                date: newJob.date || null,
                memo: newJob.memo || '',
                status: 'entry'
            });
            setNewJob({ company: '', date: '', memo: '' });
            setIsModalOpen(false);
        } catch (err) {
            alert('追加に失敗しました');
        }
    };

    const deleteJob = async (jobId) => {
        if (!window.confirm('このエントリーを削除しますか？')) return;
        try {
            await removeJob(jobId);
        } catch (err) {
            alert('削除に失敗しました');
        }
    };

    return (
        <div className="space-y-6 animate-fade-in h-full flex flex-col relative">
            <Link to="/" className="absolute top-0 right-0 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-10">
                <Home size={20} />
            </Link>
            <header className="flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Career</h1>
                    <p className="text-gray-400 mt-1">就職活動の進捗管理</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all font-medium"
                >
                    <Plus size={18} /> 新規登録
                </button>
            </header>

            {/* Kanban Board */}
            <DragDropContext onDragEnd={onDragEnd}>
                <div className="flex-1 overflow-x-auto pb-4">
                    <div className="flex gap-4 h-full min-w-[1400px]"> {/* Increased min-width for extra column */}
                        {Object.values(COLUMNS).map((column) => (
                            <div key={column.id} className="flex-1 min-w-[280px] flex flex-col h-full glass-card bg-gray-900/40">
                                <div className={`p-4 border-b border-white/5 flex items-center justify-between border-t-2 ${column.color}`}>
                                    <h3 className="font-semibold text-white">{column.title}</h3>
                                    <span className="bg-white/10 text-xs px-2 py-0.5 rounded-full text-gray-400">
                                        {jobs[column.id]?.length || 0}
                                    </span>
                                </div>

                                <Droppable droppableId={column.id}>
                                    {(provided, snapshot) => (
                                        <div
                                            {...provided.droppableProps}
                                            ref={provided.innerRef}
                                            className={clsx(
                                                "flex-1 p-3 space-y-3 overflow-y-auto custom-scrollbar transition-colors",
                                                snapshot.isDraggingOver ? "bg-white/5" : ""
                                            )}
                                        >
                                            {jobs[column.id]?.map((job, index) => (
                                                <Draggable key={job.id} draggableId={job.id} index={index}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                            className={clsx(
                                                                "bg-gray-800 p-4 rounded-xl border border-white/5 shadow-md group hover:border-white/20 transition-all",
                                                                snapshot.isDragging && "rotate-2 scale-105 z-50 ring-2 ring-blue-500/50"
                                                            )}
                                                        >
                                                            <div className="flex justify-between items-start mb-2">
                                                                <h4 className="font-bold text-white leading-tight">{job.company}</h4>
                                                                <button
                                                                    onClick={() => deleteJob(job.id)}
                                                                    className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>

                                                            {job.date && (
                                                                <div className="flex items-center gap-1.5 text-xs text-blue-300 mb-2">
                                                                    <Calendar size={12} />
                                                                    <span>{job.date}</span>
                                                                </div>
                                                            )}

                                                            {job.memo && (
                                                                <div className="flex gap-1.5 text-xs text-gray-500 bg-black/20 p-2 rounded-lg">
                                                                    <FileText size={12} className="shrink-0 mt-0.5" />
                                                                    <p className="line-clamp-3">{job.memo}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </div>
                        ))}
                    </div>
                </div>
            </DragDropContext>

            {/* New Job Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="glass-card w-full max-w-md p-6 relative">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <Building2 className="text-blue-400" /> エントリー追加
                        </h2>
                        <form onSubmit={handleAddJob} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs text-gray-500 uppercase">会社名</label>
                                <input
                                    type="text"
                                    value={newJob.company}
                                    onChange={e => setNewJob({ ...newJob, company: e.target.value })}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500/50"
                                    placeholder="例: 株式会社〇〇"
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-gray-500 uppercase">日付 (締め切り・面接日など)</label>
                                <input
                                    type="date"
                                    value={newJob.date}
                                    onChange={e => setNewJob({ ...newJob, date: e.target.value })}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500/50"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-gray-500 uppercase">メモ / URL</label>
                                <textarea
                                    value={newJob.memo}
                                    onChange={e => setNewJob({ ...newJob, memo: e.target.value })}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500/50 h-20 resize-none"
                                    placeholder="採用サイトのURLやメモ..."
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-2 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 transition-colors"
                                >
                                    キャンセル
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-medium transition-colors"
                                >
                                    カードを追加
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Career;
