"use client";

import { motion } from "framer-motion";
import { Share2, Download, TrendingUp } from "lucide-react";
import DimensionCard from "./DimensionCard";
import { getAttractivenessLevel } from "@/lib/api-beauty";
import { BeautyScore } from "@/lib/api-beauty";
import { cn } from "@/lib/utils";

interface RatingDisplayProps {
  result: BeautyScore;
  onShare?: () => void;
  isDarkMode?: boolean;
}

export default function RatingDisplay({
  result,
  onShare,
  isDarkMode = true,
}: RatingDisplayProps) {
  const overallScore = result.overall_score;
  const attractivenessLevel = getAttractivenessLevel(overallScore);

  const dimensions = [
    { name: "skincare", score: result.skincare_score },
    { name: "style", score: result.style_score },
    { name: "grooming", score: result.grooming_score },
    { name: "fitness", score: result.fitness_score },
    { name: "confidence", score: result.confidence_score },
  ];

  const handleDownload = () => {
    const text = `
Beauty Analysis Report
Overall Score: ${overallScore.toFixed(1)}/100 (${attractivenessLevel})
Date: ${new Date(result.created_at).toLocaleDateString()}

Dimension Scores:
- Skincare: ${result.skincare_score.toFixed(1)}/100
- Style: ${result.style_score.toFixed(1)}/100
- Grooming: ${result.grooming_score.toFixed(1)}/100
- Fitness: ${result.fitness_score.toFixed(1)}/100
- Confidence: ${result.confidence_score.toFixed(1)}/100

Analysis:
${result.analysis}

Tips:
Skincare: ${result.tips.skincare.join(", ")}
Style: ${result.tips.style.join(", ")}
Grooming: ${result.tips.grooming.join(", ")}
Fitness: ${result.tips.fitness.join(", ")}
Confidence: ${result.tips.confidence.join(", ")}
    `;

    const element = document.createElement("a");
    element.setAttribute(
      "href",
      `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`
    );
    element.setAttribute("download", "beauty-report.txt");
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full space-y-6"
    >
      {/* Overall Score Card */}
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className={cn(
          "rounded-xl p-8 border",
          isDarkMode
            ? "bg-gradient-to-br from-purple-900/30 to-pink-900/30 border-purple-700/50"
            : "bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200"
        )}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className={cn("text-sm mb-1", isDarkMode ? "text-gray-400" : "text-gray-600")}>
              Your Overall Beauty Score
            </p>
            <h2 className={cn("text-4xl font-bold", isDarkMode ? "text-white" : "text-gray-900")}>
              {overallScore.toFixed(1)}
              <span className={cn("text-2xl", isDarkMode ? "text-gray-500" : "text-gray-500")}>
                /100
              </span>
            </h2>
          </div>
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-6xl"
          >
            ✨
          </motion.div>
        </div>

        <p className={cn("text-xl font-semibold mb-2", isDarkMode ? "text-purple-300" : "text-purple-700")}>
          {attractivenessLevel}
        </p>
        <p className={cn("mb-6", isDarkMode ? "text-gray-300" : "text-gray-700")}>
          {result.analysis}
        </p>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onShare}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium transition-all"
          >
            <Share2 className="w-4 h-4" />
            Share Result
          </button>
          <button
            onClick={handleDownload}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
              isDarkMode
                ? "bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-200"
                : "bg-white border border-gray-300 hover:bg-gray-50 text-gray-700"
            )}
          >
            <Download className="w-4 h-4" />
            Download Report
          </button>
        </div>
      </motion.div>

      {/* Dimension Scores */}
      <div>
        <div className={cn("flex items-center gap-2 mb-4")}>
          <TrendingUp className="w-5 h-5 text-purple-600" />
          <h3 className={cn("text-xl font-bold", isDarkMode ? "text-white" : "text-gray-900")}>
            Detailed Breakdown
          </h3>
        </div>
        <div className="grid gap-4">
          {dimensions.map((dim, idx) => (
            <motion.div
              key={dim.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <DimensionCard
                dimension={dim.name}
                score={dim.score}
                tips={result.tips[dim.name as keyof typeof result.tips]}
                isDarkMode={isDarkMode}
              />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Motivational Message */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className={cn(
          "rounded-xl p-6 border",
          isDarkMode
            ? "bg-blue-900/20 border-blue-800/50"
            : "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200"
        )}
      >
        <h4 className={cn("font-semibold mb-2", isDarkMode ? "text-blue-300" : "text-gray-900")}>
          💪 Your Growth Journey
        </h4>
        <p className={cn("text-sm mb-4", isDarkMode ? "text-blue-200" : "text-gray-700")}>
          Beauty isn&apos;t just about physical appearance — it&apos;s about taking care of yourself and building
          confidence. Your score reflects multiple dimensions of self-care and presentation. Use these
          insights as a roadmap to enhance the areas that matter most to you.
        </p>
        <p className={cn("text-sm font-medium", isDarkMode ? "text-blue-300" : "text-indigo-700")}>
          ✓ Track your progress over time by analyzing new photos regularly
        </p>
      </motion.div>

      {/* Date Info */}
      <p className={cn("text-sm text-center", isDarkMode ? "text-gray-500" : "text-gray-500")}>
        Analysis completed on {new Date(result.created_at).toLocaleDateString()} at{" "}
        {new Date(result.created_at).toLocaleTimeString()}
      </p>
    </motion.div>
  );
}
