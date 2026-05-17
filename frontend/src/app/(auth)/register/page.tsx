"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
    display_name: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showWaitlist, setShowWaitlist] = useState(false);

  // Simple client-side check. Backend ALSO enforces this.
  function isEduEmail(email: string) {
    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain) return false;
    return domain.endsWith(".edu") || domain.endsWith(".ac.uk") || domain.endsWith(".edu.au");
  }

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isEduEmail(form.email)) {
      setShowWaitlist(true);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        if (Array.isArray(data.detail)) {
          setError(data.detail.map((d: { msg: string }) => d.msg).join(", "));
        } else {
          setError(data.detail ?? "Registration failed");
        }
        return;
      }

      setSuccess(data.message);
    } catch {
      setError("Network error. Is the server running?");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (success) {
      const timer = window.setTimeout(() => router.push("/login"), 2200);
      return () => window.clearTimeout(timer);
    }
  }, [success, router]);

  if (showWaitlist) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-black overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-violet-900/20 via-black to-black" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="relative z-10 glass-card p-10 max-w-md text-center flex flex-col gap-5 border border-white/10 shadow-[0_0_50px_rgba(157,78,221,0.15)]"
        >
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-violet-500 to-purple-800 rounded-full flex items-center justify-center shadow-lg shadow-violet-500/20 mb-2">
            <span className="text-2xl">🔒</span>
          </div>
          <h2 className="text-3xl font-black bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Exclusive Access</h2>
          <p className="text-sm text-[#aaa] leading-relaxed">
            CampusClout is currently restricted to verified university students to maintain an authentic dating and social environment.
          </p>
          <div className="bg-[#111] border border-[#333] rounded-lg p-4 mt-2">
            <p className="text-xs text-violet-400 font-mono mb-1">YOUR POSITION</p>
            <p className="text-2xl font-bold text-white">#14,291</p>
            <p className="text-[10px] text-[#666] mt-1">We&apos;ve added {form.email} to the waitlist.</p>
          </div>
          <button
            onClick={() => setShowWaitlist(false)}
            className="mt-2 py-3 bg-white/5 hover:bg-white/10 text-white font-medium rounded-lg text-sm transition-colors"
          >
            Try another email
          </button>
        </motion.div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-black relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-green-900/20 via-black to-black" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 glass-card p-10 max-w-md text-center flex flex-col gap-4 border border-green-500/20"
        >
          <span className="text-4xl">🎓</span>
          <h2 className="text-2xl font-bold text-white">You&apos;re verified!</h2>
          <p className="text-sm text-[#aaa] leading-relaxed">{success}</p>
          <Link
            href="/login"
            className="mt-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold rounded-lg text-sm text-center shadow-lg shadow-purple-500/25"
          >
            Enter CampusClout →
          </Link>
        </motion.div>
      </div>
    );
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
          <Link href="/" className="font-black text-2xl tracking-tighter bg-gradient-to-br from-[#fff] to-[#888] bg-clip-text text-transparent">
            CampusClout
          </Link>
          <h1 className="mt-6 text-3xl font-black text-white">Get Inside.</h1>
          <p className="text-[#888] mt-2 text-sm font-medium">An active <span className="text-violet-400">.edu</span> email is required to join.</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-8 flex flex-col gap-5">
          {error && (
            <div className="text-sm text-danger bg-red-950/40 border border-red-900/50 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {[
            { id: "email", label: "Email", type: "email", placeholder: "you@example.com", field: "email" as const },
            { id: "username", label: "Username", type: "text", placeholder: "coolperson42", field: "username" as const },
            { id: "display_name", label: "Display Name (optional)", type: "text", placeholder: "Your Name", field: "display_name" as const },
            { id: "password", label: "Password", type: "password", placeholder: "Min 8 chars, 1 uppercase, 1 digit", field: "password" as const },
          ].map(({ id, label, type, placeholder, field }) => (
            <div key={id} className="flex flex-col gap-1.5">
              <label htmlFor={id} className="text-sm font-medium text-text-muted">
                {label}
              </label>
              <input
                id={id}
                type={type}
                value={form[field]}
                onChange={update(field)}
                required={field !== "display_name"}
                placeholder={placeholder}
                className="bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-sm
                           text-white placeholder-[#555] focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500
                           transition-all"
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={loading}
            className="mt-4 py-3.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold rounded-xl text-sm
                       hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(139,92,246,0.3)]"
          >
            {loading ? "Verifying…" : "Request Access →"}
          </button>

          <p className="text-center text-sm text-text-muted">
            Already here?{" "}
            <Link href="/login" className="text-accent hover:underline">
              Log in
            </Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}
