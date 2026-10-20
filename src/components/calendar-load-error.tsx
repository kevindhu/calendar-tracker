"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function CalendarLoadError() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <main className="setup-shell">
      <section className="setup-panel" aria-labelledby="calendar-load-error-title">
        <p className="eyebrow">Connection issue</p>
        <h1 id="calendar-load-error-title">Calendar temporarily unavailable</h1>
        <p>We couldn’t load your calendar. Please try again in a moment.</p>
        <div className="calendar-load-error-actions">
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => router.refresh())}
          >
            {isPending ? "Trying again…" : "Try again"}
          </button>
          <a href="https://status.supabase.com/" target="_blank" rel="noreferrer">
            Service status
          </a>
        </div>
      </section>
    </main>
  );
}
