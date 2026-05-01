"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/v1/auth/me", { credentials: "include" });
        if (res.ok) {
          router.push("/dashboard");
        }
      } catch {
        // Not authenticated, allow to continue
      }
    }
    checkAuth();
  }, [router]);

  return <>{children}</>;
}
