import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { AppShell } from './layout/AppShell';
import { NotificationsProvider } from './notifications/NotificationsContext';
import { AITasksPage } from './pages/AITasksPage';
import { AutomationsPage } from './pages/AutomationsPage';
import { BoardPage } from './pages/BoardPage';
import { DashboardPage } from './pages/DashboardPage';
import { FormBuilderPage } from './pages/FormBuilderPage';
import { FormsPage } from './pages/FormsPage';
import { FormSubmitPage } from './pages/FormSubmitPage';
import { LoginPage } from './pages/LoginPage';
import { MyTasksPage } from './pages/MyTasksPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { RecurringTasksPage } from './pages/RecurringTasksPage';
import { RegisterPage } from './pages/RegisterPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { TaskDetailPage } from './pages/TaskDetailPage';
import { TimelinePage } from './pages/TimelinePage';
import { WorkloadPage } from './pages/WorkloadPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="content muted">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin' && user.role !== 'manager') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        element={
          <RequireAuth>
            <NotificationsProvider>
              <AppShell />
            </NotificationsProvider>
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="my-tasks" element={<MyTasksPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:id" element={<ProjectDetailPage />} />
        <Route path="tasks/:id" element={<TaskDetailPage />} />
        <Route path="board" element={<BoardPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="forms" element={<FormsPage />} />
        <Route path="forms/:id/submit" element={<FormSubmitPage />} />
        <Route
          path="forms/new"
          element={
            <RequireAdmin>
              <FormBuilderPage mode="new" />
            </RequireAdmin>
          }
        />
        <Route
          path="forms/:id/edit"
          element={
            <RequireAdmin>
              <FormBuilderPage mode="edit" />
            </RequireAdmin>
          }
        />
        <Route
          path="automations"
          element={
            <RequireAdmin>
              <AutomationsPage />
            </RequireAdmin>
          }
        />
        <Route path="timeline" element={<TimelinePage />} />
        <Route path="ai/tasks" element={<AITasksPage />} />
        <Route
          path="reports"
          element={
            <RequireAdmin>
              <ReportsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="workload"
          element={
            <RequireAdmin>
              <WorkloadPage />
            </RequireAdmin>
          }
        />
        <Route
          path="recurring-tasks"
          element={
            <RequireAdmin>
              <RecurringTasksPage />
            </RequireAdmin>
          }
        />
        <Route
          path="settings"
          element={
            <RequireAdmin>
              <SettingsPage />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<div>Not found.</div>} />
      </Route>
    </Routes>
  );
}
