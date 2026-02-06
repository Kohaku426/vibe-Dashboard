import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    Home,
    Calendar,
    Clock,
    CheckSquare,
    PieChart,
    Activity,
    Briefcase,
    Settings
} from 'lucide-react';
import clsx from 'clsx';

const NavItem = ({ to, icon: Icon, label }) => {
    return (
        <NavLink
            to={to}
            className={({ isActive }) =>
                clsx(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                    isActive
                        ? "bg-white/10 text-white shadow-[0_0_15px_rgba(139,92,246,0.3)] border border-white/10"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                )
            }
        >
            <Icon className="w-5 h-5 transition-transform group-hover:scale-110" />
            <span className="font-medium">{label}</span>
        </NavLink>
    );
};

const Sidebar = () => {
    return (
        <div className="hidden md:flex flex-col w-64 h-full glass-panel p-6">
            <div className="mb-10 px-2">
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 tracking-tight">
                    Vibe OS
                </h1>
                <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider">パーソナル・ダッシュボード</p>
            </div>

            <nav className="flex-1 space-y-2">
                <NavItem to="/" icon={Home} label="ダッシュボード" />
                <NavItem to="/calendar" icon={Calendar} label="カレンダー" />
                <NavItem to="/timetable" icon={Clock} label="時間割" />
                <NavItem to="/todo" icon={CheckSquare} label="タスク" />
                <NavItem to="/finance" icon={PieChart} label="家計簿" />
                <NavItem to="/health" icon={Activity} label="健康管理" />
                <NavItem to="/career" icon={Briefcase} label="就活" />
            </nav>

            <div className="pt-6 mt-6 border-t border-white/5">
                <NavItem to="/settings" icon={Settings} label="設定" />
            </div>
        </div>
    );
};

export default Sidebar;
