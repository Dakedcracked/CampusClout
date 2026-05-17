import { useState, useCallback } from "react";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;   // 10 MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;   // 50 MB

interface UploadResult {
  url: string;
  media_type: string;
  validation_warning?: string;
}

export function useImageUpload() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const upload = useCallback(
    async (file: File, endpoint: string): Promise<string | null> => {
      setLoading(true);
      setError(null);
      setProgress(0);

      try {
        const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
        const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

        if (!isImage && !isVideo) {
          throw new Error("Unsupported file type. Use JPEG/PNG/WebP/GIF for images or MP4/WebM/MOV for videos.");
        }

        const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
        if (file.size > maxSize) {
          const mb = maxSize / 1024 / 1024;
          throw new Error(`File too large. Maximum ${mb}MB for ${isVideo ? "videos" : "images"}.`);
        }

        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(endpoint, {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || "Upload failed");
        }

        const data: UploadResult = await res.json();
        setProgress(100);
        return data.url;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { upload, loading, error, progress };
}
