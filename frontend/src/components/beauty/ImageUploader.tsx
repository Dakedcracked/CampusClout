"use client";

import { useState, useRef, ChangeEvent, DragEvent } from "react";
import { motion } from "framer-motion";
import { Camera, Upload, AlertCircle, CheckCircle, Loader } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploaderProps {
  onFileSelected: (file: File) => void;
  isLoading?: boolean;
  error?: string | null;
  success?: boolean;
  isDarkMode?: boolean;
}

export default function ImageUploader({
  onFileSelected,
  isLoading = false,
  error = null,
  success = false,
  isDarkMode = true,
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isLoading) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (isLoading) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith("image/")) {
        handleFile(file);
      }
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
      onFileSelected(file);
    };
    reader.readAsDataURL(file);
  };

  const handleClick = () => {
    if (!isLoading && inputRef.current) {
      inputRef.current.click();
    }
  };

  const handleClear = () => {
    setPreview(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="w-full">
      {/* Preview Image */}
      {preview && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "mb-6 rounded-lg overflow-hidden",
            isDarkMode ? "bg-gray-800" : "bg-gray-100"
          )}
        >
          <img
            src={preview}
            alt="Preview"
            className="w-full max-h-96 object-cover"
          />
        </motion.div>
      )}

      {/* Upload Zone */}
      <motion.div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        animate={{
          borderColor: isDragging ? "#9333ea" : isDarkMode ? "#404040" : "#e5e7eb",
          backgroundColor: isDragging
            ? isDarkMode
              ? "#3f3024"
              : "#f5f3ff"
            : "transparent",
        }}
        className={cn(
          "relative rounded-xl border-2 border-dashed transition-colors cursor-pointer p-8",
          isLoading && "opacity-50 cursor-not-allowed",
          success && (isDarkMode ? "border-green-600 bg-green-900/20" : "border-green-500 bg-green-50"),
          isDarkMode && "hover:border-purple-500"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleInputChange}
          disabled={isLoading}
          className="hidden"
        />

        <div className="text-center">
          {isLoading ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="flex justify-center mb-3"
              >
                <Loader className="w-8 h-8 text-purple-600" />
              </motion.div>
              <p className={cn("font-medium", isDarkMode ? "text-gray-200" : "text-gray-700")}>
                Analyzing your image...
              </p>
              <p className={cn("text-sm mt-1", isDarkMode ? "text-gray-400" : "text-gray-500")}>
                Detecting face and computing beauty metrics
              </p>
            </>
          ) : success ? (
            <>
              <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-3" />
              <p className={cn("font-medium", isDarkMode ? "text-green-400" : "text-green-700")}>
                Analysis Complete!
              </p>
              <p className={cn("text-sm mt-1", isDarkMode ? "text-green-300" : "text-green-600")}>
                Your beauty score is ready below
              </p>
            </>
          ) : (
            <>
              {preview ? (
                <>
                  <Camera className="w-8 h-8 text-purple-600 mx-auto mb-3" />
                  <p className={cn("font-medium", isDarkMode ? "text-gray-200" : "text-gray-700")}>
                    Image Ready
                  </p>
                  <p className={cn("text-sm mt-1", isDarkMode ? "text-gray-400" : "text-gray-500")}>
                    Click to change image
                  </p>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-purple-600 mx-auto mb-3" />
                  <p className={cn("font-medium", isDarkMode ? "text-gray-200" : "text-gray-700")}>
                    Upload a Photo of Yourself
                  </p>
                  <p className={cn("text-sm mt-1", isDarkMode ? "text-gray-400" : "text-gray-500")}>
                    Drag and drop or click to browse
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </motion.div>

      {/* File Requirements */}
      <div className={cn(
        "mt-4 p-3 rounded-lg border",
        isDarkMode
          ? "bg-blue-900/20 border-blue-800/50 text-blue-300"
          : "bg-blue-50 border-blue-200 text-blue-900"
      )}>
        <p className={cn("text-sm font-medium mb-2", isDarkMode ? "text-blue-300" : "text-blue-900")}>
          📸 Photo Requirements:
        </p>
        <ul className={cn("text-sm space-y-1", isDarkMode ? "text-blue-200" : "text-blue-800")}>
          <li>✓ Clear, well-lit photo of your face</li>
          <li>✓ Face should be clearly visible (no hats/sunglasses)</li>
          <li>✓ Only single face in the photo (no group photos)</li>
          <li>✓ JPG, PNG, or WebP format (max 8 MB)</li>
        </ul>
      </div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "mt-4 p-4 rounded-lg flex gap-3 border",
            isDarkMode
              ? "bg-red-900/20 border-red-800/50"
              : "bg-red-50 border-red-200"
          )}
        >
          <AlertCircle className={cn(
            "w-5 h-5 flex-shrink-0",
            isDarkMode ? "text-red-400" : "text-red-600"
          )} />
          <div className="flex-1">
            <p className={cn("font-medium", isDarkMode ? "text-red-400" : "text-red-900")}>
              Analysis Failed
            </p>
            <p className={cn("text-sm mt-1", isDarkMode ? "text-red-300" : "text-red-700")}>
              {error}
            </p>
          </div>
        </motion.div>
      )}

      {/* Action Buttons */}
      {preview && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 flex gap-3"
        >
          <button
            onClick={handleClear}
            disabled={isLoading}
            className={cn(
              "flex-1 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50",
              isDarkMode
                ? "border border-gray-600 text-gray-300 hover:bg-gray-800"
                : "border border-gray-300 text-gray-700 hover:bg-gray-50"
            )}
          >
            Clear Image
          </button>
        </motion.div>
      )}
    </div>
  );
}

