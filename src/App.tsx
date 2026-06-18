import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { useStore } from './store/appStore';
import NavShell from './components/NavShell';
import Dashboard from './pages/Dashboard';
import Teachers from './pages/Teachers';
import Subjects from './pages/Subjects';
import Classes from './pages/Classes';
import AssignmentBoard from './pages/AssignmentBoard';
import TeacherSchedule from './pages/TeacherSchedule';
import ExportPage from './pages/ExportPage';
import Settings from './pages/Settings';

export default function App() {
  const theme = useStore((s) => s.ui.theme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <NavShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/plan" element={<AssignmentBoard />} />
        <Route path="/teachers" element={<Teachers />} />
        <Route path="/classes" element={<Classes />} />
        <Route path="/subjects" element={<Subjects />} />
        <Route path="/teacher/:id" element={<TeacherSchedule />} />
        <Route path="/export" element={<ExportPage />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </NavShell>
  );
}
