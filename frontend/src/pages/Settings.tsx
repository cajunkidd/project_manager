import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Role, User } from "../lib/types";

const ROLES: Role[] = ["admin", "manager", "user", "viewer"];

export default function Settings() {
  const qc = useQueryClient();
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<User[]>("/users"),
  });
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [department, setDepartment] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api.post<User>("/users", {
        email,
        displayName,
        role,
        department: department || null,
      }),
    onSuccess: () => {
      setEmail("");
      setDisplayName("");
      setDepartment("");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h1 className="text-2xl font-semibold">Settings · Users</h1>

      <section className="bg-white border border-slate-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Add user</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-slate-300 rounded px-3 py-1.5 text-sm"
          />
          <input
            placeholder="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="border border-slate-300 rounded px-3 py-1.5 text-sm"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="border border-slate-300 rounded px-3 py-1.5 text-sm bg-white"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <input
            placeholder="Department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="border border-slate-300 rounded px-3 py-1.5 text-sm"
          />
        </div>
        <div className="mt-3 flex justify-end">
          <button
            disabled={!email || !displayName || create.isPending}
            onClick={() => create.mutate()}
            className="bg-brand hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded"
          >
            Add user
          </button>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Users</h2>
        <table className="w-full text-sm">
          <thead className="text-slate-600">
            <tr>
              <th className="text-left py-1 font-medium">Name</th>
              <th className="text-left py-1 font-medium">Email</th>
              <th className="text-left py-1 font-medium">Role</th>
              <th className="text-left py-1 font-medium">Department</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="py-1.5">{u.displayName}</td>
                <td className="py-1.5 text-slate-600">{u.email}</td>
                <td className="py-1.5">{u.role}</td>
                <td className="py-1.5 text-slate-600">{u.department ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
