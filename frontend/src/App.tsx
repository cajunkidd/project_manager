import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext, useAuthState } from '@/hooks/useAuth';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import MyTasks from '@/pages/MyTasks';
import Projects from '@/pages/Projects';
import ProjectDetail from '@/pages/ProjectDetail';
import Board from '@/pages/Board';
import TaskDetail from '@/pages/TaskDetail';
import Reports from '@/pages/Reports';
import Workload from '@/pages/Workload';
import Forms from '@/pages/Forms';
import Automations from '@/pages/Automations';
import Settings from '@/pages/Settings';
import Gantt from '@/pages/Gantt';

export default function App() {
  const auth = useAuthState();

  return (
    <AuthContext.Provider value={auth}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="my-tasks" element={<MyTasks />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="tasks/:id" element={<TaskDetail />} />
          <Route path="board" element={<Board />} />
          <Route path="timeline" element={<Gantt />} />
          <Route path="forms" element={<Forms />} />
          <Route path="reports" element={<Reports />} />
          <Route path="workload" element={<Workload />} />
          <Route path="automations" element={<Automations />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthContext.Provider>
  );
}
