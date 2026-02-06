import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';

const AppLayout = () => {
    return (
        <div className="flex h-screen w-full overflow-hidden selection:bg-purple-500/30">
            <Sidebar />
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Mobile Header */}
                <header className="md:hidden flex items-center justify-between px-6 py-4 border-b border-white/5 bg-gray-900/40 backdrop-blur-xl shrink-0">
                    <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                        Vibe OS
                    </h1>
                </header>

                <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 md:p-8 pb-24 md:pb-8 scroll-smooth">
                    <div className="max-w-[1600px] mx-auto min-h-full">
                        <Outlet />
                    </div>
                </main>
                <MobileNav />
            </div>
        </div>
    );
};

export default AppLayout;
