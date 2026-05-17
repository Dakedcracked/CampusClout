"use client";

import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { getConfidenceLevel, getDimensionRecommendations } from "@/lib/api-beauty";
import { cn } from "@/lib/utils";

interface DimensionCardProps {
  dimension: string;
  score: number;
  tips?: string[];
  isDarkMode?: boolean;
}

const dimensionConfig: Record<
  string,
  { icon: string; color: string; darkColor: string; description: string }
> = {
  skincare: {
    icon: "🧴",
    color: "from-blue-500 to-blue-600",
    darkColor: "from-blue-600 to-blue-700",
    description: "Skin health, routine quality, and skin clarity",
  },
  style: {
    icon: "👗",
    color: "from-pink-500 to-pink-600",
    darkColor: "from-pink-600 to-pink-700",
    description: "Fashion sense, outfit coordination, and personal style",
  },
  grooming: {
    icon: "💇",
    color: "from-purple-500 to-purple-600",
    darkColor: "from-purple-600 to-purple-700",
    description: "Hair, nails, hygiene, and overall maintenance",
  },
  fitness: {
    icon: "💪",
    color: "from-green-500 to-green-600",
    darkColor: "from-green-600 to-green-700",
    description: "Fitness level, posture, and physical health appearance",
  },
  confidence: {
    icon: "✨",
    color: "from-yellow-500 to-yellow-600",
    darkColor: "from-yellow-600 to-yellow-700",
    description: "Presence, energy, and self-assurance",
  },
};

export default function DimensionCard({
  dimension,
  score,
  tips: initialTips,
  isDarkMode = true,
}: DimensionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = dimensionConfig[dimension] || dimensionConfig.skincare;
  const confidenceInfo = getConfidenceLevel(score);
  const recommendations = initialTips || getDimensionRecommendations(dimension);

  const percentage = Math.min(100, Math.max(0, score));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-lg border overflow-hidden hover:shadow-lg transition-shadow",
        isDarkMode
          ? "bg-[#1a1a1a] border-[#262626]"
          : "bg-white border-gray-200"
      )}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full p-4 flex items-center justify-between hover:opacity-80 transition-colors",
          isDarkMode ? "hover:bg-[#262626]" : "hover:bg-gray-50"
        )}
      >
        <div className="flex items-center gap-3 flex-1 text-left">
          <div className="text-2xl">{config.icon}</div>
          <div className="flex-1">
            <h3 className={cn("font-semibold capitalize", isDarkMode ? "text-white" : "text-gray-900")}>
              {dimension}
            </h3>
            <p className={cn("text-sm", isDarkMode ? "text-gray-400" : "text-gray-600")}>
              {config.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div
              className={cn(
                "text-2xl font-bold",
                confidenceInfo.color.includes("green")
                  ? isDarkMode ? "text-green-400" : "text-green-600"
                  : confidenceInfo.color.includes("blue")
                    ? isDarkMode ? "text-blue-400" : "text-blue-600"
                    : confidenceInfo.color.includes("yellow")
                      ? isDarkMode ? "text-yellow-400" : "text-yellow-600"
                      : isDarkMode ? "text-red-400" : "text-red-600"
              )}
            >
              {score.toFixed(1)}
            </div>
            <div className={cn("text-xs", isDarkMode ? "text-gray-500" : "text-gray-600")}>
              {confidenceInfo.level}
            </div>
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <ChevronDown className={cn("w-5 h-5", isDarkMode ? "text-gray-600" : "text-gray-600")} />
          </motion.div>
        </div>
      </button>

      {/* Progress Bar */}
      <div className={cn("px-4 pb-3", isDarkMode ? "bg-[#0a0a0a]" : "bg-gray-50")}>
        <div className={cn("h-2 rounded-full overflow-hidden", isDarkMode ? "bg-gray-800" : "bg-gray-200")}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`h-full bg-gradient-to-r ${isDarkMode ? config.darkColor : config.color}`}
          />
        </div>
      </div>

      {/* Expanded Content */}
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{
          height: isExpanded ? "auto" : 0,
          opacity: isExpanded ? 1 : 0,
        }}
        transition={{ duration: 0.3 }}
        className={cn(
          "overflow-hidden border-t",
          isDarkMode ? "border-[#262626]" : "border-gray-200"
        )}
      >
        <div className={cn("p-4", isDarkMode ? "bg-[#0a0a0a]" : "bg-gradient-to-br from-gray-50 to-gray-100")}>
          {/* Confidence Breakdown */}
          <div className="mb-4">
            <p className={cn("text-sm font-semibold mb-2", isDarkMode ? "text-white" : "text-gray-900")}>
              Performance Level
            </p>
            <p className={cn("text-sm", isDarkMode ? "text-gray-300" : "text-gray-700")}>
              {confidenceInfo.description}
            </p>
          </div>

          {/* Tips */}
          <div>
            <p className={cn("text-sm font-semibold mb-3", isDarkMode ? "text-white" : "text-gray-900")}>
              💡 Improvement Tips
            </p>
            <ul className="space-y-2">
              {recommendations.slice(0, 3).map((tip, idx) => (
                <motion.li
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={cn("text-sm flex gap-2", isDarkMode ? "text-gray-300" : "text-gray-700")}
                >
                  <span className="text-purple-600 font-bold flex-shrink-0">
                    •
                  </span>
                  <span>{tip}</span>
                </motion.li>
              ))}
            </ul>
          </div>

          {/* Improvement Potential */}
          <div className={cn(
            "mt-4 p-3 rounded-lg border",
            isDarkMode
              ? "bg-blue-900/20 border-blue-800/50"
              : "bg-blue-50 border-blue-200"
          )}>
            <p className={cn("text-xs font-medium", isDarkMode ? "text-blue-300" : "text-blue-900")}>
              📈 Improvement Potential
            </p>
            <p className={cn("text-sm mt-1", isDarkMode ? "text-blue-200" : "text-blue-800")}>
              {100 - percentage > 20
                ? "You have significant room to grow in this area. Focus on the tips above and track your progress."
                : percentage > 80
                  ? "You\'re performing excellently here! Keep up your good habits and maintain consistency."
                  : "Steady progress is key. Implement the recommended changes gradually."}
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
