"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  // Check if already authenticated — redirect silently without blocking the form
  useEffect(() => {
    let cancelled = false;
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/v1/auth/me", { credentials: "include" });
        if (!cancelled && res.ok) {
          setRedirecting(true);
          router.replace("/dashboard");
        }
      } catch {
        // Not authenticated — show form normally
      }
    };
    checkAuth();
    return () => { cancelled = true; };
  }, [router]);

  // Show a non-blocking redirect spinner when already logged in
  if (redirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#9d4edd] border-t-transparent animate-spin" />
          <span className="text-[#555] text-sm">Taking you to your dashboard…</span>
        </div>
      </div>
    );
  }

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
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#0a0a0a]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm flex flex-col items-center"
      >
        <div className="text-center mb-8 w-full border border-[#262626] bg-[#000] p-8 pb-10 flex flex-col items-center">
          <Link href="/" className="font-black text-3xl text-white mb-8 tracking-tight" style={{ fontFamily: "Instagram Sans, -apple-system, BlinkMacSystemFont, sans-serif" }}>
            CampusClout
          </Link>

          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
            {error && (
              <div className="text-sm text-red-500 mb-2">
                {error}
              </div>
            )}

            <div className="w-full">
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Phone number, username, or email"
                className="w-full bg-[#121212] border border-[#262626] rounded-[3px] px-3 py-2.5 text-xs text-[#f5f5f5] placeholder-[#a3a3a3] focus:outline-none focus:border-[#404040] transition-colors"
              />
            </div>

            <div className="w-full">
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Password"
                className="w-full bg-[#121212] border border-[#262626] rounded-[3px] px-3 py-2.5 text-xs text-[#f5f5f5] placeholder-[#a3a3a3] focus:outline-none focus:border-[#404040] transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="mt-2 w-full py-2 bg-[#0095f6] text-white font-semibold rounded-lg text-[14px] hover:bg-[#1877f2] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Logging in…" : "Log in"}
            </button>

            <div className="flex items-center gap-4 my-3 w-full">
              <div className="h-px bg-[#262626] flex-1" />
              <span className="text-[13px] text-[#a3a3a3] font-semibold">OR</span>
              <div className="h-px bg-[#262626] flex-1" />
            </div>

            <Link href="/forgot-password" className="text-xs text-[#e0e0e0] hover:text-white transition-colors mt-2">
              Forgot password?
            </Link>
          </form>
        </div>

        <div className="w-full border border-[#262626] bg-[#000] p-5 text-center">
          <p className="text-[14px] text-[#f5f5f5]">
            Don't have an account?{" "}
            <Link href="/register" className="text-[#0095f6] font-semibold hover:text-white transition-colors">
              Sign up
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
