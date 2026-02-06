import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Plus, Trash2, Activity, Scale, Utensils, Flame, ChevronRight, Home, ChevronDown, ChevronUp, Search, X
} from 'lucide-react';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Line, ComposedChart
} from 'recharts';
import useLocalStorage from '../hooks/useLocalStorage';
import { format, parseISO, isValid } from 'date-fns';

const MEAL_CATEGORIES = [
    { id: 'breakfast', label: '朝食', icon: '🍳', color: 'text-yellow-400' },
    { id: 'lunch', label: '昼食', icon: '🍱', color: 'text-orange-400' },
    { id: 'dinner', label: '夕食', icon: '🍽️', color: 'text-blue-400' },
    { id: 'snack', label: '間食', icon: '🍪', color: 'text-pink-400' }
];

const DEFAULT_EXERCISES = [
    "ベンチプレス", "スクワット", "デッドリフト", "ショルダープレス", "懸垂", "ダンベルカール",
    "ランニング", "サイクリング", "エリプティカル", "HIIT"
];

const SafeChart = ({ data }) => {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500 border border-dashed border-white/10 rounded-xl">
                データがありません
            </div>
        );
    }

    // Double check data validity
    const safeData = data.filter(item => item && item.date && !isNaN(item.weight));

    return (
        <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={safeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis
                    dataKey="date"
                    stroke="#94a3b8"
                    fontSize={12}
                    tickFormatter={(str) => {
                        if (!str) return '';
                        // Simple robust formatter
                        return str.length > 5 ? str.slice(5) : str;
                    }}
                />

                <YAxis yAxisId="left" domain={['auto', 'auto']} stroke="#3b82f6" fontSize={12} width={30} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 40]} stroke="#10b981" fontSize={12} width={30} />

                <RechartsTooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                    labelFormatter={(label) => label}
                />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />

                <Area yAxisId="left" type="monotone" dataKey="weight" name="体重 (kg)" stroke="#3b82f6" fill="url(#colorWeight)" strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="bfp" name="体脂肪率 (%)" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                <defs>
                    <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                </defs>
            </ComposedChart>
        </ResponsiveContainer>
    );
};

import { useSupabase } from '../hooks/useSupabase';
import { supabase } from '../lib/supabaseClient';

const Health = ({ user }) => {
    // --- SUPABASE HOOKS ---
    const {
        data: weights,
        loading: loadingWeights,
        addData: addWeight
    } = useSupabase('health_weights', user?.id);

    const {
        data: meals,
        loading: loadingMeals,
        addData: addMeal,
        deleteData: removeMeal
    } = useSupabase('health_meals', user?.id);

    const {
        data: workouts,
        loading: loadingWorkouts,
        addData: addWorkout,
        deleteData: removeWorkout
    } = useSupabase('health_workouts', user?.id);

    const [settings, setSettingsState] = useState({});
    const [loadingSettings, setLoadingSettings] = useState(true);

    useEffect(() => {
        const fetchSettings = async () => {
            if (!user?.id) return;
            const { data, error } = await supabase
                .from('health_settings')
                .select('*')
                .eq('user_id', user.id)
                .single();
            if (data) setSettingsState(data);
            setLoadingSettings(false);
        };
        fetchSettings();
    }, [user?.id]);

    const updateSettings = async (newSettings) => {
        try {
            const { error } = await supabase
                .from('health_settings')
                .upsert({ user_id: user.id, ...newSettings });
            if (error) throw error;
            setSettingsState({ ...settings, ...newSettings });
        } catch (err) {
            alert('設定の保存に失敗しました');
        }
    };

    // --- Local State ---
    const [weightForm, setWeightForm] = useState({ date: new Date().toISOString().split('T')[0], weight: '', bfp: '' });
    const [showSettings, setShowSettings] = useState(false);

    // Meal Form
    const [mealForm, setMealForm] = useState({ name: '', calories: '', protein: '', fat: '', carbs: '', category: 'lunch' });
    const [showFoodSearch, setShowFoodSearch] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Workout Form
    const [workoutForm, setWorkoutForm] = useState({
        date: new Date().toISOString().split('T')[0],
        type: 'strength',
        exercise: '',
        weight: '', sets: '', reps: '',
        time: '', speed: '', incline: ''
    });
    const [isCustomExercise, setIsCustomExercise] = useState(false);
    const [newExerciseName, setNewExerciseName] = useState('');

    // --- Calculated Data ---
    const latestWeight = useMemo(() => {
        if (weights.length === 0) return '--';
        return weights[weights.length - 1].weight || '--';
    }, [weights]);

    const latestBfp = useMemo(() => {
        if (weights.length === 0) return '--';
        return weights[weights.length - 1].bfp || '--';
    }, [weights]);

    const weightChartData = useMemo(() => {
        return weights
            .filter(w => w && w.date && w.weight)
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .slice(-30);
    }, [weights]);

    const todayStr = new Date().toISOString().split('T')[0];

    const todayMeals = useMemo(() => {
        return meals.filter(m => m && m.date && m.date.startsWith(todayStr));
    }, [meals, todayStr]);

    const totalNutrients = useMemo(() => {
        return todayMeals.reduce((acc, m) => ({
            calories: acc.calories + (Number(m.calories) || 0),
            protein: acc.protein + (Number(m.protein) || 0),
            fat: acc.fat + (Number(m.fat) || 0),
            carbs: acc.carbs + (Number(m.carbs) || 0)
        }), { calories: 0, protein: 0, fat: 0, carbs: 0 });
    }, [todayMeals]);

    // --- Handlers ---
    const handleWeightSubmit = async (e) => {
        e.preventDefault();
        if (!weightForm.weight) return;
        try {
            await addWeight({
                date: weightForm.date || todayStr,
                weight: parseFloat(weightForm.weight),
                bfp: weightForm.bfp ? parseFloat(weightForm.bfp) : null
            });
            setWeightForm(prev => ({ ...prev, weight: '', bfp: '' }));
        } catch (err) {
            alert('体重の記録に失敗しました');
        }
    };

    const handleMealSubmit = async (e) => {
        e.preventDefault();
        if (!mealForm.name || !mealForm.calories) return;

        try {
            await addMeal({
                date: new Date().toISOString(),
                name: mealForm.name,
                calories: parseInt(mealForm.calories) || 0,
                protein: parseFloat(mealForm.protein) || 0,
                fat: parseFloat(mealForm.fat) || 0,
                carbs: parseFloat(mealForm.carbs) || 0,
                category: mealForm.category
            });
            setMealForm({ ...mealForm, name: '', calories: '', protein: '', fat: '', carbs: '' });
            setShowFoodSearch(false);
        } catch (err) {
            alert('食事の記録に失敗しました');
        }
    };

    const handleWorkoutSubmit = async (e) => {
        e.preventDefault();
        let exerciseName = workoutForm.exercise;
        if (isCustomExercise) {
            if (!newExerciseName) return;
            exerciseName = newExerciseName;
            setIsCustomExercise(false);
            setNewExerciseName('');
        }

        if (!exerciseName) return;

        try {
            await addWorkout({
                date: workoutForm.date,
                type: workoutForm.type,
                exercise: exerciseName,
                weight: parseFloat(workoutForm.weight) || null,
                sets: parseInt(workoutForm.sets) || null,
                reps: parseInt(workoutForm.reps) || null,
                time: parseFloat(workoutForm.time) || null,
                speed: parseFloat(workoutForm.speed) || null,
                incline: parseFloat(workoutForm.incline) || null
            });
            setWorkoutForm({ ...workoutForm, exercise: '', weight: '', sets: '', reps: '', time: '', speed: '', incline: '' });
        } catch (err) {
            alert('トレーニングの記録に失敗しました');
        }
    };

    const deleteMeal = async (id) => {
        try {
            await removeMeal(id);
        } catch (err) {
            alert('削除に失敗しました');
        }
    };

    const deleteWorkout = async (id) => {
        try {
            await removeWorkout(id);
        } catch (err) {
            alert('削除に失敗しました');
        }
    };

    // --- Render ---
    return (
        <div className="space-y-6 pb-10 relative">
            <Link to="/" className="absolute top-0 right-0 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-10">
                <Home size={20} />
            </Link>

            <header className="flex items-end justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Health & Fitness</h1>
                    <p className="text-gray-400 mt-1">日々の健康管理と運動ログ</p>
                </div>
                <div className="flex gap-4">
                    <div className="glass px-4 py-2 rounded-xl text-center">
                        <p className="text-xs text-gray-400 uppercase">体重</p>
                        <p className="text-xl font-bold text-white">{latestWeight} <span className="text-sm font-normal text-gray-400">kg</span></p>
                    </div>
                    <div className="glass px-4 py-2 rounded-xl text-center">
                        <p className="text-xs text-gray-400 uppercase">体脂肪率</p>
                        <p className="text-xl font-bold text-white">{latestBfp} <span className="text-sm font-normal text-gray-400">%</span></p>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Weight Chart */}
                    <div className="glass-card p-6">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <Scale className="text-blue-400" size={20} /> 体重・体脂肪率推移
                        </h2>
                        <div className="h-[300px] w-full mb-6">
                            <SafeChart data={weightChartData} />
                        </div>
                        <form onSubmit={handleWeightSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <input type="date" value={weightForm.date} onChange={e => setWeightForm({ ...weightForm, date: e.target.value })} className="input-dark" required />
                            <input type="number" step="0.1" placeholder="体重 (kg)" value={weightForm.weight} onChange={e => setWeightForm({ ...weightForm, weight: e.target.value })} className="input-dark" required />
                            <input type="number" step="0.1" placeholder="体脂肪率 (%)" value={weightForm.bfp} onChange={e => setWeightForm({ ...weightForm, bfp: e.target.value })} className="input-dark" />
                            <button type="submit" className="md:col-span-3 btn-primary">記録する</button>
                        </form>
                    </div>

                    {/* Meals Section */}
                    <div className="glass-card p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Utensils className="text-orange-400" size={20} /> 今日の食事
                            </h2>
                            <div className="text-xs text-gray-400">
                                {Math.round(totalNutrients.calories)} / {settings.goalCalories || 2000} kcal
                            </div>
                        </div>

                        {/* Progress Bars */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            {['calories', 'protein', 'fat', 'carbs'].map(k => {
                                const val = totalNutrients[k];
                                const labels = { calories: 'カロリー', protein: 'タンパク質', fat: '脂質', carbs: '炭水化物' };
                                const goalKey = k === 'calories' ? 'goalCalories' : `goal${k.charAt(0).toUpperCase() + k.slice(1)}`;
                                const goal = settings[goalKey] || (k === 'calories' ? 2000 : 100);
                                const pct = Math.min(100, (val / goal) * 100);
                                const colors = { calories: 'bg-orange-500', protein: 'bg-red-500', fat: 'bg-yellow-500', carbs: 'bg-green-500' };

                                return (
                                    <div key={k} className="bg-black/20 rounded-lg p-3 border border-white/5">
                                        <p className="text-[10px] text-gray-500 uppercase">{labels[k]}</p>
                                        <p className="text-lg font-bold text-white">{Math.round(val)} <span className="text-[10px] text-gray-400">/ {goal}</span></p>
                                        <div className="h-1 w-full bg-gray-700 rounded-full mt-1 overflow-hidden">
                                            <div className={`h-full ${colors[k]}`} style={{ width: `${pct}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Meal List */}
                        <div className="space-y-4">
                            {MEAL_CATEGORIES.map(cat => {
                                const catMeals = todayMeals.filter(m => m.category === cat.id);
                                if (catMeals.length === 0) return null;
                                return (
                                    <div key={cat.id}>
                                        <p className={`text-xs font-bold uppercase mb-2 flex items-center gap-2 ${cat.color}`}>{cat.icon} {cat.label}</p>
                                        <div className="space-y-2">
                                            {catMeals.map(meal => (
                                                <div key={meal.id} className="flex justify-between items-center p-3 rounded-lg bg-white/5 border border-white/5">
                                                    <div>
                                                        <p className="font-medium text-white">{meal.name}</p>
                                                        <p className="text-xs text-gray-400">{meal.calories} kcal</p>
                                                    </div>
                                                    <button onClick={() => deleteMeal(meal.id)} className="text-gray-600 hover:text-red-400"><X size={16} /></button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                            {todayMeals.length === 0 && <p className="text-center text-gray-500 py-4">今日の食事はまだ記録されていません。</p>}
                        </div>
                    </div>
                </div>

                {/* Right Column: Input & Log */}
                <div className="space-y-6">
                    {/* Meal Input */}
                    <div className="glass-card p-6">
                        <h3 className="font-bold mb-4 flex items-center gap-2"><Plus size={16} className="text-green-400" /> 食事を記録</h3>

                        <div className="flex bg-gray-800/50 rounded-lg p-1 mb-4 overflow-x-auto">
                            {MEAL_CATEGORIES.map(cat => (
                                <button key={cat.id} onClick={() => setMealForm({ ...mealForm, category: cat.id })}
                                    className={`flex-1 py-1 px-2 rounded text-xs whitespace-nowrap ${mealForm.category === cat.id ? 'bg-white/10 text-white' : 'text-gray-500'}`}>
                                    {cat.icon} {cat.label}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-3">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="品目名"
                                    value={mealForm.name}
                                    onChange={e => {
                                        setMealForm({ ...mealForm, name: e.target.value });
                                        setSearchTerm(e.target.value);
                                        setShowFoodSearch(true);
                                    }}
                                    className="input-dark w-full"
                                />
                                {showFoodSearch && searchTerm && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-white/10 rounded-lg shadow-xl z-50 max-h-40 overflow-y-auto">
                                        {foodHistory.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 5).map((item, idx) => (
                                            <button key={idx} onClick={() => {
                                                setMealForm({ ...mealForm, ...item });
                                                setShowFoodSearch(false);
                                            }} className="w-full text-left px-3 py-2 hover:bg-white/10 text-xs text-gray-300">
                                                {item.name} ({item.calories}kcal)
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                <input type="number" placeholder="kcal" value={mealForm.calories} onChange={e => setMealForm({ ...mealForm, calories: e.target.value })} className="input-dark px-1 text-center" />
                                <input type="number" placeholder="P" value={mealForm.protein} onChange={e => setMealForm({ ...mealForm, protein: e.target.value })} className="input-dark px-1 text-center" />
                                <input type="number" placeholder="F" value={mealForm.fat} onChange={e => setMealForm({ ...mealForm, fat: e.target.value })} className="input-dark px-1 text-center" />
                                <input type="number" placeholder="C" value={mealForm.carbs} onChange={e => setMealForm({ ...mealForm, carbs: e.target.value })} className="input-dark px-1 text-center" />
                            </div>
                            <button onClick={handleMealSubmit} className="btn-primary w-full">追加する</button>
                        </div>
                    </div>

                    {/* Workout Input */}
                    <div className="glass-card p-6">
                        <h3 className="font-bold mb-4 flex items-center gap-2"><Flame size={16} className="text-red-400" /> トレーニング</h3>
                        <div className="space-y-3">
                            <div className="flex bg-gray-800/50 rounded-lg p-1">
                                <button onClick={() => setWorkoutForm({ ...workoutForm, type: 'strength' })} className={`flex-1 py-1 text-xs rounded ${workoutForm.type === 'strength' ? 'bg-purple-500/20 text-purple-300' : 'text-gray-500'}`}>筋トレ</button>
                                <button onClick={() => setWorkoutForm({ ...workoutForm, type: 'cardio' })} className={`flex-1 py-1 text-xs rounded ${workoutForm.type === 'cardio' ? 'bg-orange-500/20 text-orange-300' : 'text-gray-500'}`}>有酸素</button>
                            </div>

                            <div className="relative">
                                {isCustomExercise ? (
                                    <div className="flex gap-2">
                                        <input type="text" placeholder="新しい種目" value={newExerciseName} onChange={e => setNewExerciseName(e.target.value)} className="input-dark flex-1" autoFocus />
                                        <button onClick={() => setIsCustomExercise(false)} className="text-gray-400"><X size={16} /></button>
                                    </div>
                                ) : (
                                    <select value={workoutForm.exercise} onChange={e => e.target.value === 'custom' ? setIsCustomExercise(true) : setWorkoutForm({ ...workoutForm, exercise: e.target.value })} className="input-dark w-full">
                                        <option value="" disabled>種目を選択</option>
                                        {exercises.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                                        <option value="custom">+ カスタム追加...</option>
                                    </select>
                                )}
                            </div>

                            {workoutForm.type === 'strength' ? (
                                <div className="grid grid-cols-3 gap-2">
                                    <input type="number" placeholder="kg" value={workoutForm.weight} onChange={e => setWorkoutForm({ ...workoutForm, weight: e.target.value })} className="input-dark text-center" />
                                    <input type="number" placeholder="セット" value={workoutForm.sets} onChange={e => setWorkoutForm({ ...workoutForm, sets: e.target.value })} className="input-dark text-center" />
                                    <input type="number" placeholder="レップ" value={workoutForm.reps} onChange={e => setWorkoutForm({ ...workoutForm, reps: e.target.value })} className="input-dark text-center" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-2">
                                    <input type="number" placeholder="分" value={workoutForm.time} onChange={e => setWorkoutForm({ ...workoutForm, time: e.target.value })} className="input-dark text-center" />
                                    <input type="number" placeholder="km/h" value={workoutForm.speed} onChange={e => setWorkoutForm({ ...workoutForm, speed: e.target.value })} className="input-dark text-center" />
                                    <input type="number" placeholder="傾斜%" value={workoutForm.incline} onChange={e => setWorkoutForm({ ...workoutForm, incline: e.target.value })} className="input-dark text-center" />
                                </div>
                            )}
                            <button onClick={handleWorkoutSubmit} className="btn-primary w-full">記録する</button>
                        </div>

                        <div className="mt-4 space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                            {workouts.slice(0, 5).map(w => (
                                <div key={w.id} className="p-2 rounded bg-white/5 flex justify-between items-center text-xs">
                                    <span className="text-gray-300">{w.exercise}</span>
                                    <button onClick={() => deleteWorkout(w.id)} className="text-gray-600 hover:text-red-400"><X size={12} /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Config Button */}
            <button onClick={() => setShowSettings(true)} className="fixed bottom-6 right-6 p-3 bg-white/10 rounded-full hover:bg-white/20 text-white"><ChevronRight /></button>

            {/* Settings Modal */}
            {showSettings && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="glass-card w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-white">目標設定</h2>
                            <button onClick={() => setShowSettings(false)} className="text-gray-400"><X size={20} /></button>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                {[{ id: 'goalWeight', label: '目標体重' }, { id: 'goalCalories', label: '目標カロリー' }, { id: 'goalProtein', label: '目標タンパク質' }, { id: 'goalFat', label: '目標脂質' }, { id: 'goalCarbs', label: '目標炭水化物' }].map(f => (
                                    <div key={f.id}>
                                        <label className="text-[10px] text-gray-500 uppercase">{f.label}</label>
                                        <input type="number" value={settings[f.id] || ''} onChange={e => setSettings({ ...settings, [f.id]: e.target.value })} className="input-dark w-full" />
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => setShowSettings(false)} className="btn-primary w-full">保存する</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Health;
