"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface User {
  id: string;
  username: string;
  email: string;
  role: "USER" | "MEMBER" | "CO_ADMIN" | "ADMIN";
  is_banned: boolean;
  created_at: string;
}

export default function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "banned">("all");
  const [page, setPage] = useState(1);

  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    loadUsers();
  }, [filter, page, search]);

  async function loadUsers() {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: String(ITEMS_PER_PAGE),
        skip: String((page - 1) * ITEMS_PER_PAGE),
      });

      if (search) params.append("search", search);
      if (filter !== "all") params.append("is_banned", filter === "banned" ? "true" : "false");

      const res = await fetch(`/api/v1/admin/users?${params}`, {
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : data.users || []);
      }
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoading(false);
    }
  }

  async function updateUserRole(userId: string, newRole: User["role"]) {
    try {
      const res = await fetch(`/api/v1/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
        );
      }
    } catch (err) {
      console.error("Failed to update role:", err);
    }
  }

  async function toggleBan(userId: string, isBanned: boolean) {
    try {
      const res = await fetch(`/api/v1/admin/users/${userId}/ban`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_banned: !isBanned }),
      });

      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId ? { ...u, is_banned: !isBanned } : u
          )
        );
      }
    } catch (err) {
      console.error("Failed to update ban status:", err);
    }
  }

  const roleColors: Record<User["role"], string> = {
    USER: "bg-blue-500/20 text-blue-300",
    MEMBER: "bg-green-500/20 text-green-300",
    CO_ADMIN: "bg-yellow-500/20 text-yellow-300",
    ADMIN: "bg-red-500/20 text-red-300",
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search by username…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="flex-1 px-4 py-2 rounded-lg bg-surface border border-border text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-neon-purple/50"
        />

        <div className="flex items-center gap-2">
          {["all", "active", "banned"].map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f as "all" | "active" | "banned");
                setPage(1);
              }}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                filter === f
                  ? "bg-neon-purple text-white"
                  : "bg-surface text-text-secondary hover:text-text-primary"
              }`}
            >
              {f === "all" ? "All" : f === "active" ? "Active" : "Banned"}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-text-muted">
              <th className="text-left px-4 py-3 font-semibold">Username</th>
              <th className="text-left px-4 py-3 font-semibold">Email</th>
              <th className="text-left px-4 py-3 font-semibold">Role</th>
              <th className="text-left px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="text-center py-8 text-text-muted">
                  Loading…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-8 text-text-muted">
                  No users found
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border-b border-border/50 hover:bg-surface/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="font-semibold text-text-primary">
                      {user.username}
                    </span>
                    {user.is_banned && (
                      <span className="ml-2 text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded">
                        🚫 Banned
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{user.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role}
                      onChange={(e) =>
                        updateUserRole(user.id, e.target.value as User["role"])
                      }
                      className={`px-2 py-1 rounded text-xs font-semibold border border-border bg-surface cursor-pointer ${roleColors[user.role]}`}
                    >
                      <option value="USER">USER</option>
                      <option value="MEMBER">MEMBER</option>
                      <option value="CO_ADMIN">CO_ADMIN</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleBan(user.id, user.is_banned)}
                      className={`px-2 py-1 rounded text-xs font-semibold transition-all ${
                        user.is_banned
                          ? "bg-green-500/20 text-green-300 hover:bg-green-500/30"
                          : "bg-red-500/20 text-red-300 hover:bg-red-500/30"
                      }`}
                    >
                      {user.is_banned ? "Unban" : "Ban"}
                    </button>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {users.length > 0 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-xs text-text-muted">Page {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={users.length < ITEMS_PER_PAGE}
            className="btn-secondary text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
