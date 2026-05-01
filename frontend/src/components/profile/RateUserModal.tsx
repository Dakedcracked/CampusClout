"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface RateUserModalProps {
  username: string;
  displayName: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (rating: number, note: string) => Promise<void>;
}

export default function RateUserModal({
  username,
  displayName,
  isOpen,
  onClose,
  onSubmit,
}: RateUserModalProps) {
  const [rating, setRating] = useState(5);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSubmit(rating, note);
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setRating(5);
        setNote("");
        onClose();
      }, 1500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50"
          >
            <div className="glass-card p-6 space-y-6">
              {!submitted ? (
                <>
                  <div>
                    <h2 className="text-xl font-bold text-text-primary mb-1">
                      Rate {displayName ?? `@${username}`}
                    </h2>
                    <p className="text-sm text-text-muted">
                      Share your impression of this user
                    </p>
                  </div>

                  {/* Rating Slider */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-text-secondary">
                        Rating
                      </label>
                      <span className="text-2xl font-bold text-accent">
                        {rating}/10
                      </span>
                    </div>

                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={rating}
                      onChange={(e) => setRating(parseInt(e.target.value))}
                      className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-accent"
                      disabled={loading}
                    />

                    {/* Star Visualization */}
                    <div className="flex gap-1 justify-center">
                      {Array.from({ length: 10 }).map((_, idx) => (
                        <motion.span
                          key={idx}
                          animate={{
                            scale: idx < rating ? 1.2 : 1,
                            opacity: idx < rating ? 1 : 0.3,
                          }}
                          className="text-lg"
                        >
                          {idx < rating ? "⭐" : "☆"}
                        </motion.span>
                      ))}
                    </div>
                  </div>

                  {/* Note */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Optional Note (max 200 characters)
                    </label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value.slice(0, 200))}
                      placeholder="What made you give this rating?"
                      disabled={loading}
                      className={cn(
                        "w-full p-3 rounded-lg bg-surface border border-border text-text-primary placeholder-text-muted resize-none focus:outline-none focus:border-clout transition-colors",
                        "min-h-24"
                      )}
                    />
                    <p className="text-xs text-text-muted mt-1">
                      {note.length}/200
                    </p>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={onClose}
                      disabled={loading}
                      className="flex-1 px-4 py-2 rounded-lg border border-border text-text-secondary hover:bg-surface transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={loading}
                      className={cn(
                        "flex-1 px-4 py-2 rounded-lg font-medium transition-colors",
                        loading
                          ? "bg-clout/50 text-background cursor-not-allowed"
                          : "bg-clout text-background hover:bg-clout-hover"
                      )}
                    >
                      {loading ? "Submitting..." : "Submit Rating"}
                    </button>
                  </div>
                </>
              ) : (
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="flex flex-col items-center justify-center py-8 gap-3"
                >
                  <span className="text-4xl">✅</span>
                  <p className="text-center text-text-primary">
                    Rating submitted successfully!
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
