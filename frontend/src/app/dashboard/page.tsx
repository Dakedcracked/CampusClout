import { Suspense } from "react";

export const dynamic = "force-dynamic";

import DashboardComponent from "@/components/dashboard/DashboardComponent";

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <DashboardComponent />
    </Suspense>
  );
}
