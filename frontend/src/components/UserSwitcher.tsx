import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { User } from "../lib/types";
import { getCurrentUserId, setCurrentUserId } from "../lib/currentUser";

export default function UserSwitcher() {
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<User[]>("/users"),
  });
  const [current, setCurrent] = useState<string | null>(getCurrentUserId());

  useEffect(() => {
    if (!current && users.length > 0) {
      setCurrentUserId(users[0].id);
      setCurrent(users[0].id);
    }
  }, [users, current]);

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-500">Acting as</span>
      <select
        value={current ?? ""}
        onChange={(e) => {
          setCurrent(e.target.value);
          setCurrentUserId(e.target.value);
        }}
        className="border border-slate-300 rounded px-2 py-1 bg-white"
      >
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.displayName} ({u.role})
          </option>
        ))}
      </select>
    </div>
  );
}
