import type { Metadata } from "next";
import { Suspense } from "react";
import { ResultsView } from "@/store/components/ResultsView";

export const metadata: Metadata = { title: "Search results" };

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="s-page">…</div>}>
      <ResultsView />
    </Suspense>
  );
}
