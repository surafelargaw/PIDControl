import { Suspense } from "react";
import { LearnBrowser } from "@/components/content/learn-browser";

export default function LearnPage() {
  return (
    <Suspense fallback={<main className="page-stack"><section className="page-card"><p>Loading lessons...</p></section></main>}>
      <LearnBrowser />
    </Suspense>
  );
}
