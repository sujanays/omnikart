import type { Metadata } from "next";
import Link from "next/link";
import { JudgeView } from "@/assistant/components/JudgeView";

export const metadata: Metadata = { title: "Judge view" };

/** Outside the store group on purpose: this is our tooling, not part of the reference store. */
export default function JudgePage() {
  return (
    <main id="main" tabIndex={-1} className="judge">
      <p>
        <Link href="/">Back to the Haat store</Link>
      </p>
      <JudgeView />
    </main>
  );
}
