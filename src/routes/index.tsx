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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none focus:ring-4 focus:ring-ring"
      >
        Skip to main content
      </a>
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

      <main id="main-content" className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        <section
          aria-labelledby="how-to-use-heading"
          className="rounded-lg border-2 border-primary bg-accent p-5"
        >
          <h2 id="how-to-use-heading" className="text-lg font-bold mb-2">
            How to use this tool
          </h2>
          <ol className="list-decimal pl-6 space-y-1 text-base">
            <li>
              Pick a mode: <strong>Single Label</strong> to check one application,
              or <strong>Batch</strong> to process many photos at once.
            </li>
            <li>
              Upload a clear JPG or PNG of the label (under 8&nbsp;MB). For Single
              Label, also type in the four application fields.
            </li>
            <li>
              Click <strong>Verify Label</strong>. Each result shows{" "}
              <span className="font-bold text-success">GREEN ✓ Match</span>,{" "}
              <span className="font-bold text-warning-foreground">YELLOW ⚠ Review</span>, or{" "}
              <span className="font-bold text-destructive">RED ✗ Mismatch</span>,
              plus a separate check for the government warning.
            </li>
            <li>
              Verifications should finish in under 5 seconds. If something fails,
              a red message will explain what to do.
            </li>
          </ol>
        </section>

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
