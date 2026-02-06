import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
    Home,
    Calendar,
    CheckSquare,
    PieChart,
    MoreHorizontal,
    Activity,
    Briefcase,
    Clock,
    Settings,
    X
} from 'lucide-react';
import clsx from 'clsx';

const MobileNavItem = ({ to, icon: Icon, label, onClick }) => (
    <NavLink
        to={to}
        onClick={onClick}
        className={({ isActive }) =>
            clsx(
                "flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-colors",
                isActive ? "text-blue-400" : "text-gray-500"
            )
        }
    >
        <Icon size={20} />
        <span className="text-[10px] font-medium">{label}</span>
    </NavLink>
);

const MobileNav = () => {
    const [showMore, setShowMore] = useState(false);

    const secondaryLinks = [
        { to: '/health', icon: Activity, label: '健康管理' },
        { to: '/career', icon: Briefcase, label: '就活' },
        { to: '/timetable', icon: Clock, label: '時間割' },
        { to: '/settings', icon: Settings, label: '設定' },
    ];

    return (
        <>
            {/* Main Bottom Nav */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-4 pb-6 pt-2">
                <nav className="bg-gray-900/80 backdrop-blur-xl border border-white/10 rounded-2xl flex items-stretch justify-around shadow-2xl overflow-hidden h-16">
                    <MobileNavItem to="/" icon={Home} label="ホーム" />
                    <MobileNavItem to="/calendar" icon={Calendar} label="カレンダー" />
                    <MobileNavItem to="/todo" icon={CheckSquare} label="タスク" />
                    <MobileNavItem to="/finance" icon={PieChart} label="家計簿" />
                    <button
                        onClick={() => setShowMore(true)}
                        className="flex flex-col items-center justify-center gap-1 flex-1 py-1 text-gray-500"
                    >
                        <MoreHorizontal size={20} />
                        <span className="text-[10px] font-medium">その他</span>
                    </button>
                </nav>
            </div>

            {/* "More" Menu Overlay */}
            {showMore && (
                <div className="fixed inset-0 z-50 flex items-end justify-center animate-in fade-in">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowMore(false)}
                    />
                    <div className="relative w-full bg-gray-900 border-t border-white/10 rounded-t-3xl p-6 pb-24 animate-in slide-in-from-bottom-full duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-white">メニュー</h3>
                            <button onClick={() => setShowMore(false)} className="p-2 text-gray-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="grid grid-cols-4 gap-4">
                            {secondaryLinks.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    onClick={() => setShowMore(false)}
                                    className={({ isActive }) =>
                                        clsx(
                                            "flex flex-col items-center gap-2 p-3 rounded-xl transition-all",
                                            isActive ? "bg-white/10 text-white" : "text-gray-400 hover:bg-white/5"
                                        )
                                    }
                                >
                                    <item.icon size={24} />
                                    <span className="text-xs font-medium">{item.label}</span>
                                </NavLink>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default MobileNav;
