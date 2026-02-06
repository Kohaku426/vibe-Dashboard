import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Finance from './pages/Finance';
import Timetable from './pages/Timetable';
import Todo from './pages/Todo';
import Health from './pages/Health';
import Career from './pages/Career';
import CalendarPage from './pages/Calendar';

import { supabase } from './lib/supabaseClient';
import Auth from './components/auth/Auth';

// Placeholder Pages
// ... (Placeholder component remains the same)

function App() {
  const [session, setSession] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard user={session.user} />} />
          <Route path="/calendar" element={<CalendarPage user={session.user} />} />
          <Route path="/timetable" element={<Timetable user={session.user} />} />
          <Route path="/todo" element={<Todo user={session.user} />} />
          <Route path="/finance" element={<Finance user={session.user} />} />
          <Route path="/health" element={<Health user={session.user} />} />
          <Route path="/career" element={<Career user={session.user} />} />
          <Route path="/settings" element={<Placeholder title="Settings" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
