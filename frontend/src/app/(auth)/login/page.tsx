"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.detail ?? "Login failed");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Network error. Is the server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link href="/" className="font-mono text-xl font-bold text-accent">
            CampusClout
          </Link>
          <h1 className="mt-4 text-2xl font-bold">Welcome back</h1>
          <p className="text-text-muted mt-1 text-sm">Log in to your campus matchmaker</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-8 flex flex-col gap-5">
          {error && (
            <div className="text-sm text-danger bg-red-950/40 border border-red-900/50 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-text-muted">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm
                         text-text-primary placeholder-text-muted focus:outline-none focus:border-accent
                         transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-text-muted">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm
                         text-text-primary placeholder-text-muted focus:outline-none focus:border-accent
                         transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 py-3 bg-accent text-background font-bold rounded-lg text-sm
                       hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Logging in…" : "Log In"}
          </button>

          <p className="text-center text-sm text-text-muted">
            New here?{" "}
            <Link href="/register" className="text-accent hover:underline">
              Join now
            </Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}
