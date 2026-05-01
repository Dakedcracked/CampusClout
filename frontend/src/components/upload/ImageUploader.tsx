"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useImageUpload } from "@/hooks/useImageUpload";
import FileInputDropZone from "@/components/common/FileInputDropZone";
import { cn } from "@/lib/utils";

interface ImageUploaderProps {
  onUpload: (url: string) => void;
  label?: string;
  imageType?: "avatar" | "cover";
  maxSize?: number;
  endpoint: string;
}

export default function ImageUploader({
  onUpload,
  label = "Upload Image",
  imageType = "avatar",
  maxSize = 10 * 1024 * 1024,
  endpoint,
}: ImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { upload, loading, error, progress } = useImageUpload();

  const handleFilesSelected = (files: File[]) => {
    if (files.length === 0) return;

    const file = files[0];

    if (file.size > maxSize) {
      alert(`File size must be less than ${maxSize / 1024 / 1024}MB`);
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;

    const url = await upload(selectedFile, endpoint);
    if (url) {
      onUpload(url);
      setPreview(null);
      setSelectedFile(null);
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setSelectedFile(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">
          {label}
        </label>

        {preview ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-3"
          >
            <div
              className={cn(
                "rounded-lg overflow-hidden bg-surface border border-border",
                imageType === "avatar" && "w-40 h-40 mx-auto",
                imageType === "cover" && "w-full h-48"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>

            {loading && (
              <div className="space-y-2">
                <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
                  <motion.div
                    className="h-full bg-accent"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <p className="text-xs text-text-muted">Uploading...</p>
              </div>
            )}

            {error && (
              <p className="text-xs text-danger">{error}</p>
            )}

            <div className="flex gap-2 justify-center">
              <button
                onClick={handleSubmit}
                disabled={loading}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  loading
                    ? "bg-border text-text-muted cursor-not-allowed"
                    : "bg-accent text-background hover:bg-accent-hover"
                )}
              >
                {loading ? "Uploading..." : "Confirm Upload"}
              </button>
              <button
                onClick={handleCancel}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-border text-text-secondary hover:bg-border/80 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        ) : (
          <FileInputDropZone
            onFilesSelected={handleFilesSelected}
            accept="image/jpeg,image/png,image/webp"
            disabled={loading}
          />
        )}
      </div>
    </div>
  );
}
