"use client";

import { useState, useRef, ChangeEvent, DragEvent, ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface FileInputDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
}

export default function FileInputDropZone({
  onFilesSelected,
  accept = "image/*",
  multiple = false,
  children,
  className,
  disabled = false,
}: FileInputDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFilesSelected(multiple ? files : [files[0]]);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      onFilesSelected(multiple ? files : [files[0]]);
    }
  };

  return (
    <motion.div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "relative border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer",
        isDragging
          ? "border-accent bg-accent/5"
          : "border-border hover:border-clout/50 hover:bg-clout/5",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      animate={isDragging ? { scale: 1.02 } : { scale: 1 }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleInputChange}
        className="absolute inset-0 opacity-0 cursor-pointer"
        disabled={disabled}
      />

      <div
        onClick={() => !disabled && inputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-2 text-center pointer-events-none"
      >
        {children || (
          <>
            <div className="text-2xl">📁</div>
            <p className="text-sm font-medium text-text-primary">
              Click to select or drag files here
            </p>
            <p className="text-xs text-text-muted">
              Supported: JPG, PNG, WebP, MP4, WebM, MOV (max 50MB)
            </p>
          </>
        )}
      </div>
    </motion.div>
  );
}
