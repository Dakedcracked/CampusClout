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

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
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

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-10 max-w-md text-center flex flex-col gap-4"
        >
          <span className="text-4xl">❤️</span>
          <h2 className="text-xl font-bold text-accent">You&apos;re in!</h2>
          <p className="text-sm text-text-muted leading-relaxed">{success}</p>
          <Link
            href="/login"
            className="mt-4 py-3 bg-accent text-background font-bold rounded-lg text-sm text-center"
          >
            Go to Login →
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
          <Link href="/" className="font-mono text-xl font-bold text-accent">
            CampusClout
          </Link>
          <h1 className="mt-4 text-2xl font-bold">Create your dating profile</h1>
          <p className="text-text-muted mt-1 text-sm">Use any email to join the community</p>
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
                className="bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm
                           text-text-primary placeholder-text-muted focus:outline-none focus:border-accent
                           transition-colors"
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 py-3 bg-accent text-background font-bold rounded-lg text-sm
                       hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating account…" : "Start Matching →"}
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
