"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, Zap, ShoppingBag, Gift } from "lucide-react";

interface CurrencyWalletProps {
  walletBalance: number;
  marketCap: number;
  beautyCons?: number;
  onBuyTokens?: () => void;
  onInvest?: () => void;
}

export default function CurrencyWallet({
  walletBalance,
  marketCap,
  beautyCons = 0,
  onBuyTokens,
  onInvest,
}: CurrencyWalletProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/20 rounded-2xl p-4 backdrop-blur-sm">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between cursor-pointer hover:opacity-80 transition"
      >
        <div className="flex items-center gap-3">
          <div className="text-2xl">💰</div>
          <div className="text-left">
            <p className="text-xs text-gray-400">Your Wallet</p>
            <p className="text-sm font-bold text-white">
              ◈ {walletBalance.toLocaleString()} Tokens
            </p>
          </div>
        </div>
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          className="text-gray-400"
        >
          ▼
        </motion.span>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 space-y-3 border-t border-purple-500/10 pt-4"
          >
            {/* Market Cap */}
            <div className="flex items-center justify-between p-2 bg-black/20 rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-blue-400" />
                <span className="text-xs text-gray-300">Market Cap</span>
              </div>
              <span className="font-bold text-blue-400">
                ◈ {marketCap.toLocaleString()}
              </span>
            </div>

            {/* Beauty Coins */}
            {beautyCons > 0 && (
              <div className="flex items-center justify-between p-2 bg-black/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-yellow-400" />
                  <span className="text-xs text-gray-300">Beauty Coins</span>
                </div>
                <span className="font-bold text-yellow-400">
                  ✨ {beautyCons.toLocaleString()}
                </span>
              </div>
            )}

            {/* How to Use */}
            <div className="bg-black/40 rounded-lg p-3 border border-purple-500/10">
              <p className="text-xs font-bold text-purple-300 mb-2">
                💡 How to Use Your Currency
              </p>
              <ul className="space-y-1.5 text-xs text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">→</span>
                  <span>
                    <strong>Send Messages:</strong> Use tokens to send DMs to
                    higher market cap users
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-pink-400 mt-0.5">→</span>
                  <span>
                    <strong>Invest in Profiles:</strong> Buy tokens in other
                    users' profiles to grow their market cap
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">→</span>
                  <span>
                    <strong>Earn More:</strong> Get tokens from followers
                    investing in you
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-400 mt-0.5">→</span>
                  <span>
                    <strong>Beauty Features:</strong> Use Beauty Coins for AI
                    beauty analysis
                  </span>
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onBuyTokens}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition"
              >
                <ShoppingBag size={14} />
                Buy Tokens
              </button>
              <button
                onClick={onInvest}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold transition"
              >
                <Gift size={14} />
                Invest
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
