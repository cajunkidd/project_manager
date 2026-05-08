import { Routes, Route, Navigate } from "react-router-dom";
import AppShell from "./components/AppShell";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import MyTasks from "./pages/MyTasks";
import Board from "./pages/Board";
import Reports from "./pages/Reports";
import Workload from "./pages/Workload";
import Forms from "./pages/Forms";
import FormSubmit from "./pages/FormSubmit";
import FormEdit from "./pages/FormEdit";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/my-tasks" element={<MyTasks />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/board" element={<Board />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/workload" element={<Workload />} />
        <Route path="/forms" element={<Forms />} />
        <Route path="/forms/:id" element={<FormSubmit />} />
        <Route path="/forms/:id/edit" element={<FormEdit />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<div className="p-6">Not found</div>} />
      </Route>
    </Routes>
  );
}
