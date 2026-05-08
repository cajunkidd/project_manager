import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

interface Row {
  userId: string;
  displayName: string;
  department: string | null;
  open: number;
  overdue: number;
  urgent: number;
  dueThisWeek: number;
  completedThisWeek: number;
}

const OVERLOAD_THRESHOLD = 12;

export default function Workload() {
  const [department, setDepartment] = useState<string>("");
  const { data: rows = [] } = useQuery({
    queryKey: ["workload"],
    queryFn: () => api.get<Row[]>("/reports/workload"),
  });

  const departments = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) if (r.department) s.add(r.department);
    return [...s].sort();
  }, [rows]);

  const filtered = department
    ? rows.filter((r) => r.department === department)
    : rows;
  const max = Math.max(1, ...filtered.map((r) => r.open));

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Workload</h1>
        {departments.length > 0 && (
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="border border-slate-300 rounded px-2 py-1 text-sm bg-white"
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-2 font-medium">User</th>
              <th className="text-left px-4 py-2 font-medium">Open</th>
              <th className="text-left px-4 py-2 font-medium">Overdue</th>
              <th className="text-left px-4 py-2 font-medium">Urgent</th>
              <th className="text-left px-4 py-2 font-medium">Due this week</th>
              <th className="text-left px-4 py-2 font-medium">Done this week</th>
              <th className="text-left px-4 py-2 font-medium">Load</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((r) => {
              const overloaded = r.open >= OVERLOAD_THRESHOLD || r.overdue >= 3;
              const pct = Math.round((r.open / max) * 100);
              return (
                <tr key={r.userId} className={overloaded ? "bg-rose-50/40" : ""}>
                  <td className="px-4 py-2">
                    <div className="font-medium">{r.displayName}</div>
                    <div className="text-xs text-slate-500">{r.department ?? "—"}</div>
                  </td>
                  <td className="px-4 py-2">{r.open}</td>
                  <td className={`px-4 py-2 ${r.overdue > 0 ? "text-rose-700 font-medium" : ""}`}>
                    {r.overdue}
                  </td>
                  <td className={`px-4 py-2 ${r.urgent > 0 ? "text-orange-700 font-medium" : ""}`}>
                    {r.urgent}
                  </td>
                  <td className="px-4 py-2">{r.dueThisWeek}</td>
                  <td className="px-4 py-2 text-emerald-700">{r.completedThisWeek}</td>
                  <td className="px-4 py-2 w-40">
                    <div className="h-2 bg-slate-100 rounded">
                      <div
                        className={`h-2 rounded ${overloaded ? "bg-rose-500" : "bg-brand"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No users.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-slate-500">
        Highlighted rows: {OVERLOAD_THRESHOLD}+ open or 3+ overdue tasks.
      </div>
    </div>
  );
}
