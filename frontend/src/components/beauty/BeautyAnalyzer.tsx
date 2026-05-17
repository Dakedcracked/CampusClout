"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ImageUploader from "./ImageUploader";
import RatingDisplay from "./RatingDisplay";
import { uploadImageForBeautyAnalysis, BeautyScore } from "@/lib/api-beauty";
import { AlertCircle, Sparkles } from "lucide-react";

export default function BeautyAnalyzer() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<BeautyScore | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Initialize on mount
  useEffect(() => {
    setIsReady(true);
  }, []);

  const handleFileSelected = async (file: File) => {
    if (!isReady) {
      setUploadError("Component not ready. Please refresh.");
      return;
    }

    setUploadError(null);
    setUploadSuccess(false);
    setIsLoading(true);

    try {
      const analyzeResult = await uploadImageForBeautyAnalysis(file);
      setResult(analyzeResult as BeautyScore);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (err) {
      const errorMessage = (err as Error).message || "Failed to analyze image. Please try again.";
      setUploadError(errorMessage);
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = async () => {
    if (!result) return;

    const text = `Check out my beauty analysis! Overall Score: ${result.overall_score.toFixed(1)}/100. I used the AI Beauty Analyzer on Sau! 💫`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "My Beauty Score",
          text: text,
        });
      } catch {
        console.log("Share cancelled");
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(text);
      alert("Score copied to clipboard!");
    }
  };

  if (!isReady) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <Sparkles className="w-8 h-8 text-purple-600 mx-auto" />
          </div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto py-6 px-4">
      <div className="grid md:grid-cols-2 gap-8">
        {/* Left Column - Upload */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="md:sticky md:top-24 h-fit"
        >
          <div className="bg-[#1a1a1a] rounded-xl border border-[#262626] p-6">
            <h2 className="text-2xl font-bold text-white mb-6">
              Upload Your Photo
            </h2>
            <ImageUploader
              onFileSelected={handleFileSelected}
              isLoading={isLoading}
              error={uploadError}
              success={uploadSuccess}
              isDarkMode={true}
            />

            {/* Features List */}
            <div className="mt-8 space-y-3">
              <h3 className="font-semibold text-white">What We Analyze:</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex gap-2">
                  <span className="text-purple-600 font-bold">✓</span>
                  <span>Facial symmetry and proportions</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-purple-600 font-bold">✓</span>
                  <span>Skin quality and clarity</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-purple-600 font-bold">✓</span>
                  <span>Lighting and overall image quality</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-purple-600 font-bold">✓</span>
                  <span>5 beauty dimensions with personalized tips</span>
                </li>
              </ul>
            </div>

            {/* Safety Info */}
            <div className="mt-6 p-4 bg-green-900/20 rounded-lg border border-green-800/50">
              <p className="text-sm text-green-400 font-medium">
                🔒 Your Privacy Matters
              </p>
              <p className="text-xs text-green-300 mt-2">
                Your photos are analyzed locally and not stored permanently. We
                only keep your beauty scores for your records.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Right Column - Results */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <AnimatePresence mode="wait">
            {uploadError && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-4 bg-red-900/20 border border-red-800/50 rounded-lg flex gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <div>
                  <p className="font-medium text-red-400">Error</p>
                  <p className="text-sm text-red-300 mt-1">{uploadError}</p>
                </div>
              </motion.div>
            )}

            {result ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <RatingDisplay result={result} onShare={handleShare} isDarkMode={true} />

                {/* New Analysis Button */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="mt-8 text-center"
                >
                  <button
                    onClick={() => {
                      setResult(null);
                      setUploadError(null);
                    }}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg transition-all transform hover:scale-105"
                  >
                    Analyze Another Photo
                  </button>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#1a1a1a] rounded-xl border border-[#262626] p-8 text-center"
              >
                <div className="text-6xl mb-4">📸</div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  Ready to Get Your Beauty Score?
                </h3>
                <p className="text-gray-400 mb-6">
                  Upload a clear photo of your face on the left to get started. Our AI
                  will analyze multiple beauty dimensions and provide personalized
                  recommendations.
                </p>
                <p className="text-sm text-gray-500">
                  The analysis takes just a few seconds and gives you instant feedback.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
