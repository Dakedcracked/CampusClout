"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ProductCard, { type Product } from "./ProductCard";

interface Storefront {
  id: string;
  owner_username: string;
  owner_display_name: string | null;
  owner_market_cap: number;
  name: string;
  description: string | null;
  total_sales_volume: number;
  product_count: number;
}

export default function BrowseStorefronts() {
  const [storefronts, setStorefronts] = useState<Storefront[]>([]);
  const [selected, setSelected] = useState<Storefront | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    fetch("/api/v1/store/storefronts?limit=20")
      .then((r) => r.json())
      .then((d) => setStorefronts(d))
      .finally(() => setLoading(false));
  }, []);

  async function openStorefront(sf: Storefront) {
    setSelected(sf);
    setLoadingProducts(true);
    try {
      const res = await fetch(`/api/v1/store/storefronts/${sf.owner_username}/products`, {
        credentials: "include",
      });
      if (res.ok) setProducts(await res.json());
    } finally {
      setLoadingProducts(false);
    }
  }

  if (selected) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setSelected(null); setProducts([]); }}
            className="text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            ← All Stores
          </button>
          <div className="flex-1">
            <h2 className="font-semibold">{selected.name}</h2>
            <p className="text-xs text-text-muted">by @{selected.owner_username}</p>
          </div>
          <span className="font-mono text-xs text-clout">
            {selected.owner_market_cap.toLocaleString(undefined, { maximumFractionDigits: 0 })} cap
          </span>
        </div>

        {selected.description && (
          <p className="text-sm text-text-muted">{selected.description}</p>
        )}

        {loadingProducts ? (
          <p className="text-sm text-text-muted text-center py-6 animate-pulse">Loading products…</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-6">No products listed yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            <AnimatePresence>
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onBuy={() => {}}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Campus Storefronts</h2>
        <span className="text-xs text-text-muted">Ranked by sales volume</span>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted text-center py-8 animate-pulse">Loading storefronts…</p>
      ) : storefronts.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-8">
          No storefronts yet. Be the first to open one!
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <AnimatePresence>
            {storefronts.map((sf, i) => (
              <motion.button
                key={sf.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => openStorefront(sf)}
                className="glass-card p-5 flex items-center gap-4 text-left hover:bg-surface-raised transition-colors w-full"
              >
                <div className="w-10 h-10 rounded-xl bg-accent-dim flex items-center justify-center text-accent font-bold text-sm flex-shrink-0">
                  ◈
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{sf.name}</p>
                  <p className="text-xs text-text-muted">
                    @{sf.owner_username}
                    {sf.owner_display_name && ` · ${sf.owner_display_name}`}
                  </p>
                  {sf.description && (
                    <p className="text-xs text-text-muted truncate mt-0.5">{sf.description}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-mono text-sm text-accent">{sf.product_count} items</p>
                  <p className="text-xs text-text-muted font-mono">
                    {sf.total_sales_volume.toLocaleString()}◈ sold
                  </p>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
