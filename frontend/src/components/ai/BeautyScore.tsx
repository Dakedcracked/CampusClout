"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface BeautyResult {
  overall_score: number;
  skincare_score: number;
  style_score: number;
  grooming_score: number;
  fitness_score: number;
  confidence_score: number;
  analysis: string;
  tips: Record<string, string[]>;
  source?: string;
}

const DIM_META = [
  { key: "skincare", name: "Skincare", emoji: "💧", color: "#60a5fa", weight: 0.20 },
  { key: "style", name: "Style", emoji: "👗", color: "#f472b6", weight: 0.25 },
  { key: "grooming", name: "Grooming", emoji: "✂️", color: "#a78bfa", weight: 0.20 },
  { key: "fitness", name: "Fitness", emoji: "💪", color: "#00e5a0", weight: 0.15 },
  { key: "confidence", name: "Confidence", emoji: "✨", color: "#fbbf24", weight: 0.20 },
];

function ScoreRing({ score, size = 140 }: { score: number; size?: number }) {
  const r = size * 0.38;
  const circ = 2 * Math.PI * r;
  // score is 0-100
  const pct = Math.min(Math.max(score / 100, 0), 1);
  const dash = pct * circ;
  const color = score >= 80 ? "#00e5a0" : score >= 60 ? "#fbbf24" : score >= 40 ? "#f97316" : "#ff4d6d";

  return (
    <svg width={size} height={size} style={{ filter: `drop-shadow(0 0 16px ${color}60)` }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1a1d35" strokeWidth={size * 0.07} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={size * 0.07}
        strokeLinecap="round"
        initial={{ strokeDasharray: `0 ${circ}`, strokeDashoffset: circ * 0.25 }}
        animate={{ strokeDasharray: `${dash} ${circ}`, strokeDashoffset: circ * 0.25 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
      <text x={size / 2} y={size / 2 - 4} textAnchor="middle"
        fill={color} fontSize={size * 0.22} fontWeight="900" fontFamily="JetBrains Mono, monospace">
        {score.toFixed(0)}
      </text>
      <text x={size / 2} y={size / 2 + size * 0.14} textAnchor="middle"
        fill="#606080" fontSize={size * 0.1} fontFamily="Inter, sans-serif">
        out of 100
      </text>
    </svg>
  );
}

function DimBar({ meta, score, tips }: { meta: typeof DIM_META[0]; score: number; tips: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <button onClick={() => setOpen(v => !v)} className="flex items-center gap-2 w-full text-left">
        <span>{meta.emoji}</span>
        <span className="text-sm font-semibold text-text-primary flex-1">{meta.name}</span>
        <span className="font-mono text-sm font-bold" style={{ color: meta.color }}>{score.toFixed(0)}<span className="text-text-muted font-normal">/100</span></span>
        <span className="text-text-muted text-xs ml-1">{open ? "▲" : "▼"}</span>
      </button>
      <div className="h-2 bg-surface-raised rounded-full overflow-hidden">
        <motion.div className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${meta.color}80, ${meta.color})` }}
          initial={{ width: 0 }} animate={{ width: `${(score / 100) * 100}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }} />
      </div>
      <AnimatePresence>
        {open && tips.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="flex flex-col gap-2 pl-6 pt-2">
            {tips.map((tip, i) => (
              <p key={i} className="text-xs text-text-secondary leading-relaxed">
                <span style={{ color: meta.color }}>→</span> {tip}
              </p>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type Mode = "landing" | "sliders" | "image" | "result";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function BeautyScore({ username }: { username?: string }) {
  const [mode, setMode] = useState<Mode>("landing");
  const [result, setResult] = useState<BeautyResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sliders, setSliders] = useState({ skincare: 5, style: 5, grooming: 5, fitness: 5, confidence: 5 });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/v1/ai/beauty/score", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setResult(d); setMode("result"); } })
      .catch(() => {});
  }, []);

  async function analyzeSliders() {
    setAnalyzing(true); setError(null);
    try {
      const r = await fetch("/api/v1/ai/beauty/analyze", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sliders),
      });
      if (r.ok) { setResult(await r.json()); setMode("result"); }
      else { const d = await r.json(); setError(d.detail ?? "Analysis failed"); }
    } finally { setAnalyzing(false); }
  }

  async function analyzeImage(file: File) {
    setAnalyzing(true); setError(null);
    setPreviewUrl(URL.createObjectURL(file));
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/v1/ai/beauty/analyze-image", {
        method: "POST", credentials: "include", body: fd,
      });
      if (r.ok) { setResult(await r.json()); setMode("result"); }
      else { const d = await r.json(); setError(d.detail ?? "Image analysis failed"); }
    } finally { setAnalyzing(false); }
  }

  const dims = result ? DIM_META.map(m => ({
    ...m,
    score: (result as unknown as Record<string, number>)[`${m.key}_score`] ?? 0,
    tips: result.tips?.[m.key] ?? [],
  })) : [];

  if (mode === "landing") {
    return (
      <div className="max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card-glow p-8 text-center flex flex-col items-center gap-6">
          <div className="text-6xl animate-float">✨</div>
          <div>
            <h2 className="text-2xl font-black gradient-text mb-2">AI Beauty Analysis</h2>
            <p className="text-text-muted max-w-sm mx-auto text-sm">
              Get a detailed beauty score powered by AI. Upload a photo for instant analysis, or use self-assessment sliders for personalized tips.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
            <button onClick={() => setMode("image")} className="btn-primary flex flex-col items-center gap-2 py-6 rounded-2xl">
              <span className="text-3xl">📸</span>
              <span className="font-bold">Photo Analysis</span>
              <span className="text-xs opacity-70">AI scans your image</span>
            </button>
            <button onClick={() => setMode("sliders")} className="btn-secondary flex flex-col items-center gap-2 py-6 rounded-2xl">
              <span className="text-3xl">🎚️</span>
              <span className="font-bold">Self Assessment</span>
              <span className="text-xs opacity-70">Rate yourself honestly</span>
            </button>
          </div>
          <div className="grid grid-cols-5 gap-3 w-full max-w-sm">
            {DIM_META.map(m => (
              <div key={m.key} className="text-center">
                <div className="text-xl mb-1">{m.emoji}</div>
                <div className="text-[10px] text-text-muted">{m.name}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  if (mode === "image") {
    return (
      <div className="max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card-glow p-8">
          <button onClick={() => { setMode("landing"); setPreviewUrl(null); setError(null); }}
            className="text-text-muted hover:text-text-primary text-sm mb-5 flex items-center gap-1.5">
            ← Back
          </button>
          <h2 className="text-xl font-black gradient-text mb-2">Photo Analysis</h2>
          <p className="text-text-muted text-sm mb-6">Upload a clear, well-lit photo. AI will analyze your overall appearance and provide a detailed score with improvement tips.</p>

          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) analyzeImage(f); }} />

          {analyzing ? (
            <div className="flex flex-col items-center gap-5 py-12">
              <div className="relative w-24 h-24">
                {previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="" className="w-24 h-24 rounded-full object-cover opacity-50" />
                )}
                <div className="absolute inset-0 rounded-full border-2 border-neon-purple border-t-transparent animate-spin" />
                <div className="absolute inset-2 rounded-full border border-neon-pink border-b-transparent animate-spin" style={{ animationDirection: "reverse", animationDuration: "0.8s" }} />
              </div>
              <div className="text-center">
                <p className="font-bold gradient-text text-lg">AI is reading your look…</p>
                <p className="text-text-muted text-sm mt-1">Analyzing 5 dimensions • May take up to 90 seconds</p>
              </div>
            </div>
          ) : (
            <>
              <div onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-border hover:border-neon-purple rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 hover:bg-neon-purple/5 group">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="Preview" className="max-h-56 rounded-xl mx-auto object-cover shadow-neon-purple" />
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="text-5xl group-hover:scale-110 transition-transform duration-200">📸</div>
                    <p className="font-semibold text-text-secondary">Click to upload or drag & drop</p>
                    <p className="text-text-muted text-sm">JPEG, PNG, WebP — Max 8 MB</p>
                  </div>
                )}
              </div>
              {error && <p className="text-danger text-sm mt-3">{error}</p>}
              {previewUrl && (
                <button onClick={() => fileRef.current?.click()} className="btn-primary w-full mt-4">
                  Analyze This Photo ✨
                </button>
              )}
            </>
          )}
        </motion.div>
      </div>
    );
  }

  if (mode === "sliders") {
    return (
      <div className="max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card-glow p-8">
          <button onClick={() => { setMode("landing"); setError(null); }}
            className="text-text-muted hover:text-text-primary text-sm mb-5 flex items-center gap-1.5">
            ← Back
          </button>
          <h2 className="text-xl font-black gradient-text mb-2">Self Assessment</h2>
          <p className="text-text-muted text-sm mb-6">Rate yourself honestly on each dimension from 1–10. AI will give you detailed, personalized improvement tips.</p>

          <div className="flex flex-col gap-6">
            {DIM_META.map(m => (
              <div key={m.key}>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold flex items-center gap-2">
                    <span className="text-lg">{m.emoji}</span> {m.name}
                  </label>
                  <span className="font-mono font-bold text-lg" style={{ color: m.color }}>
                    {(sliders as Record<string, number>)[m.key]}/10
                  </span>
                </div>
                <input type="range" min={1} max={10} step={1}
                  value={(sliders as unknown as Record<string, number>)[m.key]}
                  onChange={e => setSliders(s => ({ ...s, [m.key]: parseInt(e.target.value) }))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: m.color }} />
                <div className="flex justify-between text-[10px] text-text-muted mt-1">
                  <span>1 — Needs work</span><span>5 — Average</span><span>10 — Excellent</span>
                </div>
              </div>
            ))}
          </div>

          {error && <p className="text-danger text-sm mt-4">{error}</p>}
          <button onClick={analyzeSliders} disabled={analyzing} className="btn-primary w-full mt-6">
            {analyzing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                AI is analyzing…
              </span>
            ) : "Get My AI Analysis ✨"}
          </button>
        </motion.div>
      </div>
    );
  }

  if (mode === "result" && result) {
    const label = result.overall_score >= 80 ? "Stunning" : result.overall_score >= 60 ? "Attractive" : result.overall_score >= 40 ? "Average" : "Needs Work";
    const labelColor = result.overall_score >= 80 ? "text-accent text-glow-green" : result.overall_score >= 60 ? "text-warning" : result.overall_score >= 40 ? "text-orange-400" : "text-danger";

    return (
      <div className="max-w-2xl mx-auto flex flex-col gap-5">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card-glow p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6 mb-6">
            <ScoreRing score={result.overall_score} size={150} />
            <div className="flex-1 text-center sm:text-left">
              <p className={`text-4xl font-black ${labelColor}`}>{label}</p>
              <p className="text-text-muted text-sm mt-1">Overall Beauty Score</p>
              <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
                {result.source === "image" && <span className="neon-badge text-xs">📸 AI Photo Analysis</span>}
                {previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="" className="w-12 h-12 rounded-full object-cover avatar-ring" />
                )}
              </div>
            </div>
          </div>

          {result.analysis && (
            <div className="p-4 rounded-xl bg-surface-raised border border-border/50 mb-5">
              <p className="text-xs text-text-muted uppercase tracking-widest mb-2 font-semibold">AI Assessment</p>
              <p className="text-sm text-text-secondary leading-relaxed">{result.analysis}</p>
            </div>
          )}

          <div className="neon-divider mb-5" />

          <div className="flex flex-col gap-4">
            <p className="text-xs text-text-muted uppercase tracking-widest font-semibold">Breakdown — tap for improvement tips</p>
            {dims.map(d => (
              <DimBar key={d.key} meta={DIM_META.find(m => m.key === d.key)!} score={d.score} tips={d.tips} />
            ))}
          </div>
        </motion.div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => { setMode("image"); setPreviewUrl(null); setError(null); }} className="btn-primary">
            📸 New Photo
          </button>
          <button onClick={() => { setMode("sliders"); setError(null); }} className="btn-secondary">
            🎚️ Reassess
          </button>
        </div>
      </div>
    );
  }

  return null;
}
