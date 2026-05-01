"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface Product {
  id: string;
  storefront_id: string;
  name: string;
  description: string | null;
  base_price: number;
  stock_count: number;
  is_active: boolean;
  total_sold: number;
  discount_pct: number;
  final_price: number;
  tokens_invested: number;
  savings: number;
  created_at: string;
  image_url?: string | null;
}

export default function ProductCard({
  product,
  isOwner,
  onBuy,
  onEdit,
  onDelete,
}: {
  product: Product;
  isOwner?: boolean;
  onBuy?: (p: Product) => void;
  onEdit?: (p: Product) => void;
  onDelete?: (id: string) => void;
}) {
  const [buying, setBuying] = useState(false);
  const [bought, setBought] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasDiscount = product.discount_pct > 0;
  const outOfStock = product.stock_count === 0;

  async function handleBuy() {
    if (!onBuy || buying || bought || outOfStock) return;
    setBuying(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/store/products/${product.id}/purchase`, {
        method: "POST",
        credentials: "include",
      });
      const d = await res.json();
      if (!res.ok) { setError(d.detail ?? "Purchase failed"); return; }
      setBought(true);
      onBuy(product);
    } finally {
      setBuying(false);
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "glass-card p-5 flex flex-col gap-3",
        outOfStock && "opacity-60"
      )}
    >
      {product.image_url && (
        <div className="w-full h-32 bg-surface rounded-lg overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate">{product.name}</h3>
          {product.description && (
            <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{product.description}</p>
          )}
        </div>
        {product.stock_count !== -1 && (
          <span className="text-xs text-text-muted flex-shrink-0">
            {outOfStock ? "Sold out" : `${product.stock_count} left`}
          </span>
        )}
      </div>

      {/* Pricing */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          {hasDiscount && (
            <span className="text-xs text-text-muted line-through font-mono">
              {product.base_price}◈
            </span>
          )}
          <span className="text-lg font-bold font-mono text-accent">
            {product.final_price}◈
          </span>
        </div>
        {hasDiscount && (
          <div className="flex flex-col gap-0.5">
            <span className="clout-badge text-xs">
              -{product.discount_pct.toFixed(0)}%
            </span>
            <span className="text-xs text-text-muted">
              save {product.savings}◈
            </span>
          </div>
        )}
      </div>

      {hasDiscount && (
        <p className="text-xs text-clout/70 font-mono">
          Loyalty discount · {product.tokens_invested}◈ invested in creator
        </p>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}

      {/* Actions */}
      <div className="flex gap-2 mt-auto">
        {!isOwner && (
          <button
            onClick={handleBuy}
            disabled={buying || bought || outOfStock}
            className={cn(
              "flex-1 py-2 text-sm font-semibold rounded-lg transition-colors",
              bought
                ? "bg-accent-dim text-accent cursor-default"
                : outOfStock
                ? "bg-surface border border-border text-text-muted cursor-default"
                : "bg-accent text-background hover:bg-accent-hover"
            )}
          >
            {bought ? "Purchased ✓" : outOfStock ? "Out of stock" : buying ? "Buying…" : `Buy · ${product.final_price}◈`}
          </button>
        )}
        {isOwner && (
          <>
            <button
              onClick={() => onEdit?.(product)}
              className="flex-1 py-2 text-sm font-semibold rounded-lg border border-border
                         hover:bg-surface-raised transition-colors text-text-muted"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete?.(product.id)}
              className="px-4 py-2 text-sm text-danger hover:bg-red-950/40 rounded-lg transition-colors"
            >
              Remove
            </button>
          </>
        )}
      </div>

      <p className="text-xs text-text-muted font-mono">{product.total_sold} sold</p>
    </motion.div>
  );
}
