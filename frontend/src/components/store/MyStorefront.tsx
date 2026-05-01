"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ProductCard, { type Product } from "./ProductCard";

interface Storefront {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  total_sales_volume: number;
  product_count: number;
}

interface Eligibility {
  eligible: boolean;
  market_cap: number;
  required_market_cap: number;
  message: string;
}

const EMPTY_FORM = { name: "", description: "", base_price: "", stock_count: "-1", image: null as File | null };

export default function MyStorefront({ username }: { username: string }) {
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [storefront, setStorefront] = useState<Storefront | null | undefined>(undefined);
  const [products, setProducts] = useState<Product[]>([]);
  const [creating, setCreating] = useState(false);
  const [sfForm, setSfForm] = useState({ name: "", description: "" });
  const [productForm, setProductForm] = useState(EMPTY_FORM);
  const [addingProduct, setAddingProduct] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const [eligRes, sfRes] = await Promise.all([
      fetch("/api/v1/store/my/eligibility", { credentials: "include" }),
      fetch("/api/v1/store/my/storefront", { credentials: "include" }),
    ]);
    if (eligRes.ok) setEligibility(await eligRes.json());
    const sf = sfRes.ok ? await sfRes.json() : null;
    setStorefront(sf);
    if (sf) {
      const pRes = await fetch(`/api/v1/store/storefronts/${username}/products`, {
        credentials: "include",
      });
      if (pRes.ok) setProducts(await pRes.json());
    }
  }

  useEffect(() => { load(); }, [username]); // eslint-disable-line react-hooks/exhaustive-deps

  async function createStorefront(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/store/my/storefront", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(sfForm),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.detail ?? "Failed"); return; }
      setStorefront(d);
    } finally {
      setCreating(false);
    }
  }

  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    setAddingProduct(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/store/my/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: productForm.name,
          description: productForm.description || null,
          base_price: parseInt(productForm.base_price),
          stock_count: parseInt(productForm.stock_count),
        }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.detail ?? "Failed"); return; }

      if (productForm.image) {
        const reader = new FileReader();
        reader.onload = async (evt) => {
          const imageUrl = evt.target?.result as string;
          await fetch(`/api/v1/store/my/products/${d.id}/image`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              image_url: imageUrl,
              image_type: productForm.image!.type.startsWith("video") ? "video" : "image",
            }),
          });
        };
        reader.readAsDataURL(productForm.image);
      }

      setProducts((p) => [...p, { ...d, discount_pct: 0, final_price: d.base_price, tokens_invested: 0, savings: 0 }]);
      setProductForm(EMPTY_FORM);
      setShowProductForm(false);
    } finally {
      setAddingProduct(false);
    }
  }

  async function deleteProduct(id: string) {
    await fetch(`/api/v1/store/my/products/${id}`, { method: "DELETE", credentials: "include" });
    setProducts((p) => p.filter((x) => x.id !== id));
  }

  if (storefront === undefined) return null;

  // Not eligible yet
  if (eligibility && !eligibility.eligible && !storefront) {
    return (
      <div className="glass-card p-6 flex flex-col gap-3">
        <h2 className="font-semibold">My Storefront</h2>
        <div className="bg-surface-raised rounded-xl p-5 flex flex-col gap-2">
          <p className="text-sm text-text-muted">{eligibility.message}</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all"
                style={{ width: `${Math.min(100, (eligibility.market_cap / eligibility.required_market_cap) * 100)}%` }}
              />
            </div>
            <span className="text-xs font-mono text-text-muted">
              {eligibility.market_cap.toFixed(0)} / {eligibility.required_market_cap}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Eligible but no storefront yet
  if (!storefront) {
    return (
      <div className="glass-card p-6 flex flex-col gap-4">
        <div>
          <h2 className="font-semibold">Open Your Storefront</h2>
          <p className="text-xs text-text-muted mt-0.5">You&apos;ve earned it — sell anything to your backers</p>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <form onSubmit={createStorefront} className="flex flex-col gap-3">
          <input
            value={sfForm.name}
            onChange={(e) => setSfForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Storefront name"
            required
            maxLength={80}
            className="bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm
                       text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
          />
          <textarea
            value={sfForm.description}
            onChange={(e) => setSfForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Tell buyers what you're selling…"
            rows={2}
            maxLength={500}
            className="bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm
                       text-text-primary placeholder-text-muted focus:outline-none focus:border-accent
                       transition-colors resize-none"
          />
          <button
            type="submit"
            disabled={creating}
            className="py-2.5 bg-accent text-background font-semibold rounded-lg text-sm
                       hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {creating ? "Opening…" : "Open Storefront ◈"}
          </button>
        </form>
      </div>
    );
  }

  // Active storefront
  return (
    <div className="flex flex-col gap-4">
      <div className="glass-card p-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">{storefront.name}</h2>
          {storefront.description && (
            <p className="text-xs text-text-muted mt-0.5">{storefront.description}</p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-mono text-lg font-bold text-accent">
            {storefront.total_sales_volume.toLocaleString()}◈
          </div>
          <p className="text-xs text-text-muted">total sales</p>
        </div>
      </div>

      {error && <p className="text-xs text-danger px-1">{error}</p>}

      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">Products ({products.length})</h3>
        <button
          onClick={() => setShowProductForm((s) => !s)}
          className="text-xs px-3 py-1.5 bg-accent text-background font-semibold rounded-lg
                     hover:bg-accent-hover transition-colors"
        >
          + Add Product
        </button>
      </div>

      <AnimatePresence>
        {showProductForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={addProduct}
            className="glass-card p-5 flex flex-col gap-3 overflow-hidden"
          >
            <h4 className="text-sm font-medium">New product</h4>
            <input
              value={productForm.name}
              onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Product name"
              required
              maxLength={120}
              className="bg-surface-raised border border-border rounded-lg px-4 py-2 text-sm
                         text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
            />
            <textarea
              value={productForm.description}
              onChange={(e) => setProductForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Description (optional)"
              rows={2}
              className="bg-surface-raised border border-border rounded-lg px-4 py-2 text-sm
                         text-text-primary placeholder-text-muted focus:outline-none focus:border-accent
                         transition-colors resize-none"
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-text-muted">Price (◈ tokens)</label>
                <input
                  type="number"
                  min="1"
                  value={productForm.base_price}
                  onChange={(e) => setProductForm((f) => ({ ...f, base_price: e.target.value }))}
                  required
                  placeholder="e.g. 50"
                  className="bg-surface-raised border border-border rounded-lg px-3 py-2 text-sm
                             text-text-primary focus:outline-none focus:border-accent transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-text-muted">Stock (-1 = unlimited)</label>
                <input
                  type="number"
                  min="-1"
                  value={productForm.stock_count}
                  onChange={(e) => setProductForm((f) => ({ ...f, stock_count: e.target.value }))}
                  className="bg-surface-raised border border-border rounded-lg px-3 py-2 text-sm
                             text-text-primary focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-muted">Product Image</label>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setProductForm((f) => ({ ...f, image: e.target.files?.[0] || null }))}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2 bg-surface-raised border border-border rounded-lg text-sm
                             text-text-muted hover:text-text-primary transition-colors"
                >
                  {productForm.image ? `📷 ${productForm.image.name}` : "Choose image…"}
                </button>
                {productForm.image && (
                  <button
                    type="button"
                    onClick={() => setProductForm((f) => ({ ...f, image: null }))}
                    className="px-3 py-2 text-danger hover:bg-red-950/40 rounded-lg transition-colors"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={addingProduct}
                className="flex-1 py-2 bg-accent text-background text-sm font-semibold rounded-lg
                           hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {addingProduct ? "Adding…" : "Add Product"}
              </button>
              <button
                type="button"
                onClick={() => setShowProductForm(false)}
                className="px-4 py-2 text-sm text-text-muted hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {products.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-6">No products yet. Add your first listing!</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              isOwner
              onDelete={deleteProduct}
            />
          ))}
        </div>
      )}
    </div>
  );
}
