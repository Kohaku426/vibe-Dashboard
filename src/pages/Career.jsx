import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, Building2, Calendar, FileText, Trash2, Home, ExternalLink, User, X, Edit2 } from 'lucide-react';
import clsx from 'clsx';
import { useSupabase } from '../hooks/useSupabase';

const COLUMNS = {
    entry: { id: 'entry', title: 'エントリー', color: 'border-gray-500' },
    es: { id: 'es', title: 'ES提出', color: 'border-blue-500' },
    gd: { id: 'gd', title: 'GD', color: 'border-indigo-500' },
    interview1: { id: 'interview1', title: '一次面接', color: 'border-yellow-500' },
    interview2: { id: 'interview2', title: '二次面接', color: 'border-orange-500' },
    final: { id: 'final', title: '最終面接', color: 'border-red-500' },
    offer: { id: 'offer', title: '内定', color: 'border-green-500' },
};

const Career = ({ user }) => {
    const {
        data: jobsData,
        addData: addJob,
        updateData: updateJob,
        deleteData: removeJob
    } = useSupabase('career_jobs', user?.id);

    const jobs = useMemo(() => {
        const initialColumns = { entry: [], es: [], gd: [], interview1: [], interview2: [], final: [], offer: [] };
        return jobsData.reduce((acc, job) => {
            if (acc[job.status]) acc[job.status].push(job);
            return acc;
        }, initialColumns);
    }, [jobsData]);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [selectedJob, setSelectedJob] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [newJob, setNewJob] = useState({ company: '', date: '', memo: '', url: '', login_id: '' });

    const handleSelectJob = (job) => {
        setSelectedJob(job);
        setEditForm({ ...job });
        setIsEditing(false);
    };

    const handleUpdateJob = async () => {
        try {
            await updateJob(selectedJob.id, editForm);
            setSelectedJob({ ...editForm });
            setIsEditing(false);
        } catch (err) {
            alert('更新に失敗しました');
        }
    };

    const onDragEnd = async (result) => {
        const { source, destination, draggableId } = result;
        if (!destination || (source.droppableId === destination.droppableId && source.index === destination.index)) return;
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
                url: newJob.url || '',
                login_id: newJob.login_id || '',
                status: 'entry'
            });
            setNewJob({ company: '', date: '', memo: '', url: '', login_id: '' });
            setIsAddModalOpen(false);
        } catch (err) {
            console.error('[Career] addJob error:', err);
            alert('追加に失敗しました: ' + (err.message || err.details || '不明なエラー'));
        }
    };

    const deleteJob = async (jobId, e) => {
        e.stopPropagation();
        if (!window.confirm('このエントリーを削除しますか？')) return;
        try {
            await removeJob(jobId);
            if (selectedJob?.id === jobId) setSelectedJob(null);
        } catch (err) {
            alert('削除に失敗しました');
        }
    };

    return (
        <div className="space-y-6 animate-fade-in h-full flex flex-col relative pb-10">
            <Link to="/" className="absolute top-0 right-0 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-10">
                <Home size={20} />
            </Link>
            <header className="flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Career</h1>
                    <p className="text-gray-400 mt-1">就活進捗・アカウント管理</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all font-medium"
                >
                    <Plus size={18} /> 新規登録
                </button>
            </header>

            <DragDropContext onDragEnd={onDragEnd}>
                <div className="flex-1 overflow-x-auto pb-4">
                    <div className="flex gap-4 h-full min-w-[1600px]">
                        {Object.values(COLUMNS).map((column) => (
                            <div key={column.id} className="flex-1 min-w-[280px] flex flex-col h-full glass-card bg-gray-900/40">
                                <div className={clsx("p-4 border-b border-white/5 flex items-center justify-between border-t-2", column.color)}>
                                    <h3 className="font-semibold text-white">{column.title}</h3>
                                    <span className="bg-white/10 text-xs px-2 py-0.5 rounded-full text-gray-400">{jobs[column.id]?.length || 0}</span>
                                </div>

                                <Droppable droppableId={column.id}>
                                    {(provided, snapshot) => (
                                        <div {...provided.droppableProps} ref={provided.innerRef} className={clsx("flex-1 p-3 space-y-3 overflow-y-auto custom-scrollbar transition-colors", snapshot.isDraggingOver ? "bg-white/5" : "")}>
                                            {jobs[column.id]?.map((job, index) => (
                                                <Draggable key={job.id} draggableId={job.id} index={index}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                            onClick={() => handleSelectJob(job)}
                                                            className={clsx(
                                                                "bg-gray-800 p-4 rounded-xl border border-white/5 shadow-md group hover:border-blue-500/40 transition-all cursor-pointer relative",
                                                                snapshot.isDragging && "rotate-2 scale-105 z-50 ring-2 ring-blue-500/50"
                                                            )}
                                                        >
                                                            <div className="flex justify-between items-start mb-2">
                                                                <h4 className="font-bold text-white pr-6">{job.company}</h4>
                                                                <button onClick={(e) => deleteJob(job.id, e)} className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4"><Trash2 size={14} /></button>
                                                            </div>
                                                            {job.date && <div className="flex items-center gap-1.5 text-[10px] text-blue-300 mb-1"><Calendar size={10} /><span>{job.date}</span></div>}
                                                            <div className="flex gap-1 mt-2">
                                                                {job.url && <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                                                                {job.login_id && <div className="w-1.5 h-1.5 rounded-full bg-green-400" />}
                                                                {job.memo && <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />}
                                                            </div>
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

            {/* Detail Modal (The "Mini Page") */}
            {selectedJob && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in overflow-y-auto">
                    <div className="glass-card w-full max-w-lg p-8 relative overflow-hidden border-t-4 border-blue-500 my-auto">
                        <div className="absolute top-6 right-6 flex items-center gap-2">
                            <button onClick={() => setIsEditing(!isEditing)} className={clsx("p-2 rounded-lg transition-all", isEditing ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white")}><Edit2 size={20} /></button>
                            <button onClick={() => setSelectedJob(null)} className="text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
                        </div>

                        <div className="mb-8">
                            {isEditing && editForm ? (
                                <div className="flex flex-col gap-2 w-full">
                                    <input
                                        type="text"
                                        value={editForm.company || ''}
                                        onChange={e => setEditForm({ ...editForm, company: e.target.value })}
                                        className="text-3xl font-bold bg-transparent text-white border-b border-white/10 w-full focus:outline-none focus:border-blue-500 pb-1"
                                    />
                                    <select
                                        value={editForm.status || 'entry'}
                                        onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                                        className="mt-2 bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-fit"
                                    >
                                        {Object.entries(COLUMNS).map(([id, col]) => (
                                            <option key={id} value={id}>{col.title}</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <>
                                    <h2 className="text-3xl font-bold text-white mb-2">{selectedJob?.company}</h2>
                                    {selectedJob && COLUMNS[selectedJob.status] && (
                                        <span className={clsx(
                                            "px-3 py-1 rounded-full text-xs font-bold border block w-fit mt-2",
                                            COLUMNS[selectedJob.status].color,
                                            COLUMNS[selectedJob.status].color.replace('border-', 'text-')
                                        )}>
                                            {COLUMNS[selectedJob.status].title}
                                        </span>
                                    )}
                                </>
                            )}
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <section className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-2 flex items-center gap-1"><Calendar size={12} /> 日付</p>
                                    {isEditing ? (
                                        <input
                                            type="date"
                                            value={editForm.date || ''}
                                            onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                                            className="w-full input-dark px-3 py-2 text-sm"
                                        />
                                    ) : (
                                        <p className="text-white text-sm">{selectedJob.date || '未設定'}</p>
                                    )}
                                </section>
                                <section className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-2 flex items-center gap-1"><User size={12} /> ログインID</p>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={editForm.login_id || ''}
                                            onChange={e => setEditForm({ ...editForm, login_id: e.target.value })}
                                            className="w-full input-dark px-3 py-2 text-sm font-mono"
                                        />
                                    ) : (
                                        <p className="text-white text-sm font-mono">{selectedJob.login_id || '未登録'}</p>
                                    )}
                                </section>
                            </div>
                            <section className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-2 flex items-center gap-1"><ExternalLink size={12} /> 採用ページ</p>
                                {isEditing ? (
                                    <input
                                        type="url"
                                        value={editForm.url || ''}
                                        onChange={e => setEditForm({ ...editForm, url: e.target.value })}
                                        className="w-full input-dark px-3 py-2 text-sm"
                                        placeholder="https://..."
                                    />
                                ) : (
                                    selectedJob.url ? (
                                        <a href={selectedJob.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors text-sm break-all flex items-center gap-2 underline underline-offset-4 decoration-blue-500/30">
                                            {selectedJob.url} <ArrowRight size={14} />
                                        </a>
                                    ) : <p className="text-gray-600 text-sm">未設定</p>
                                )}
                            </section>
                            <section className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-2 flex items-center gap-1"><FileText size={12} /> メモ</p>
                                {isEditing ? (
                                    <textarea
                                        value={editForm.memo || ''}
                                        onChange={e => setEditForm({ ...editForm, memo: e.target.value })}
                                        className="w-full input-dark px-3 py-2 text-sm h-32 resize-none"
                                    />
                                ) : (
                                    <div className="text-gray-300 text-sm whitespace-pre-wrap max-h-40 overflow-y-auto custom-scrollbar italic">{selectedJob.memo || 'メモはありません'}</div>
                                )}
                            </section>
                        </div>

                        <div className="mt-8 flex gap-3">
                            <button
                                onClick={(e) => deleteJob(selectedJob.id, e)}
                                className="px-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-all flex items-center justify-center"
                                title="削除"
                            >
                                <Trash2 size={20} />
                            </button>

                            {isEditing ? (
                                <button
                                    onClick={handleUpdateJob}
                                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2"
                                >
                                    <Save size={18} /> 変更を保存
                                </button>
                            ) : (
                                <button onClick={() => setSelectedJob(null)} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-bold transition-all text-sm">
                                    閉じる
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )
            }

            {/* Add Modal */}
            {
                isAddModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                        <div className="glass-card w-full max-w-md p-6 relative">
                            <button onClick={() => setIsAddModalOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X size={20} /></button>
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Building2 className="text-blue-400" /> エントリー登録</h2>
                            <form onSubmit={handleAddJob} className="space-y-4">
                                <input type="text" placeholder="会社名" value={newJob.company} onChange={e => setNewJob({ ...newJob, company: e.target.value })} className="w-full input-dark px-4 py-2.5" autoFocus required />
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-gray-500 uppercase">日付</label>
                                        <input type="date" value={newJob.date} onChange={e => setNewJob({ ...newJob, date: e.target.value })} className="w-full input-dark px-3 py-2 text-sm" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-gray-500 uppercase">ログインID</label>
                                        <input type="text" value={newJob.login_id} onChange={e => setNewJob({ ...newJob, login_id: e.target.value })} className="w-full input-dark px-3 py-2 text-sm" />
                                    </div>
                                </div>
                                <input type="url" placeholder="採用ページURL (https://...)" value={newJob.url} onChange={e => setNewJob({ ...newJob, url: e.target.value })} className="w-full input-dark px-4 py-2.5 text-sm" />
                                <textarea placeholder="選考ステップの詳細、筆記試験の内容など..." value={newJob.memo} onChange={e => setNewJob({ ...newJob, memo: e.target.value })} className="w-full input-dark px-4 py-2 text-sm h-32 resize-none" />
                                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all">追加する</button>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default Career;
