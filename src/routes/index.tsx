import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SingleLabelMode } from "@/components/single-label-mode";
import { BatchMode } from "@/components/batch-mode";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TTB Label Verifier" },
      {
        name: "description",
        content:
          "Internal TTB compliance tool. Compare an alcoholic beverage label image against the submitted application data, or run a batch of labels at once.",
      },
      { property: "og:title", content: "TTB Label Verifier" },
      {
        property: "og:description",
        content:
          "Internal TTB compliance tool. Compare alcoholic beverage labels against application data — one at a time or in batch.",
      },
    ],
  }),
  component: LabelVerifierPage,
});

type Mode = "single" | "batch";

function LabelVerifierPage() {
  const [mode, setMode] = useState<Mode>("single");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-primary text-primary-foreground border-b-4 border-primary">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            TTB Label Verifier
          </h1>
          <p className="mt-2 text-base sm:text-lg opacity-90">
            Verify alcoholic beverage labels against application data.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        <div
          role="tablist"
          aria-label="Verification mode"
          className="inline-flex rounded-lg border-2 border-border bg-card p-1"
        >
          <ModeTab
            active={mode === "single"}
            onClick={() => setMode("single")}
            label="Single Label"
          />
          <ModeTab
            active={mode === "batch"}
            onClick={() => setMode("batch")}
            label="Batch"
          />
        </div>

        {mode === "single" ? <SingleLabelMode /> : <BatchMode />}
      </main>
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        "px-6 py-3 text-lg font-bold rounded-md transition-colors",
        "focus:outline-none focus:ring-4 focus:ring-ring focus:ring-offset-2",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-transparent text-foreground hover:bg-accent",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
