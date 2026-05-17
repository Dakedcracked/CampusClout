"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export default function CloutCasino() {
  const [bet, setBet] = useState(10);
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<"win" | "lose" | null>(null);

  const handleFlip = () => {
    if (flipping) return;
    setFlipping(true);
    setResult(null);

    // Simulate coin flip (manipulate odds slightly in favor of the house, e.g. 45% win rate)
    setTimeout(() => {
      const isWin = Math.random() < 0.45;
      setResult(isWin ? "win" : "lose");
      setFlipping(false);
    }, 1500);
  };

  return (
    <div className="bg-[#111] border border-[#262626] rounded-2xl p-5 relative overflow-hidden group">
      {/* Neon background glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/10 rounded-full blur-3xl -mr-10 -mt-10" />
      
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div>
          <h3 className="font-black text-white text-[15px] flex items-center gap-2">
            🎰 Clout Casino
          </h3>
          <p className="text-xs text-[#a3a3a3] mt-0.5">Double or nothing. Test your luck.</p>
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-4">
        {/* Coin Animation */}
        <div className="w-16 h-16 perspective-1000">
          <motion.div
            className="w-full h-full rounded-full border-2 border-yellow-500 bg-yellow-400/20 shadow-[0_0_15px_rgba(250,204,21,0.5)] flex items-center justify-center font-black text-yellow-500 text-2xl"
            animate={{ 
              rotateY: flipping ? [0, 360, 720, 1080] : 0,
              scale: flipping ? [1, 1.2, 1] : 1
            }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          >
            ◈
          </motion.div>
        </div>

        {/* Result Message */}
        {result && !flipping && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`text-sm font-bold ${result === "win" ? "text-green-400" : "text-red-500"}`}
          >
            {result === "win" ? `+${bet} ◈ You Won!` : `-${bet} ◈ You Lost.`}
          </motion.div>
        )}

        {/* Betting Controls */}
        <div className="flex items-center gap-2 w-full mt-2">
          <button 
            disabled={flipping || bet <= 10}
            onClick={() => setBet(Math.max(10, bet - 10))}
            className="w-8 h-8 rounded-full bg-[#1a1a1a] flex items-center justify-center text-white font-bold hover:bg-[#262626] disabled:opacity-50"
          >
            -
          </button>
          <div className="flex-1 text-center font-mono font-bold text-[#f09433]">
            {bet} ◈
          </div>
          <button 
            disabled={flipping}
            onClick={() => setBet(bet + 10)}
            className="w-8 h-8 rounded-full bg-[#1a1a1a] flex items-center justify-center text-white font-bold hover:bg-[#262626] disabled:opacity-50"
          >
            +
          </button>
        </div>

        <button 
          disabled={flipping}
          onClick={handleFlip}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg"
        >
          {flipping ? "Flipping..." : "FLIP"}
        </button>
      </div>
    </div>
  );
}
