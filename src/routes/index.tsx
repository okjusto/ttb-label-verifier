import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Info, X, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SingleLabelMode } from "@/components/single-label-mode";
import { BatchMode } from "@/components/batch-mode";
import ttbSeal from "@/assets/ttb-seal.png.asset.json";

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

function LabelVerifierPage() {
  const [mode, setMode] = useState<"single" | "batch">("single");

  return (
    <div className="min-h-screen w-full bg-muted/40">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>

      <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12 flex flex-col gap-6">
        {/* Header */}
        <header className="rounded-xl bg-primary text-primary-foreground p-6 md:p-8 shadow-lg flex items-center gap-5">
          <img
            src={ttbSeal.url}
            alt="Alcohol and Tobacco Tax and Trade Bureau seal"
            className="h-16 w-16 md:h-20 md:w-20 rounded-md shrink-0 object-contain"
          />
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              TTB Label Verifier
            </h1>
            <p className="mt-1.5 text-sm md:text-base opacity-90">
              Verify alcoholic beverage labels against application data for federal compliance.
            </p>
          </div>
        </header>

        {/* Instructions */}
        <section
          aria-labelledby="how-to-use"
          className="rounded-lg border border-accent bg-accent/60 p-4 flex gap-4 items-start"
        >
          <div className="rounded-full bg-primary text-primary-foreground p-1.5 shrink-0">
            <Info className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="text-sm text-foreground">
            <p id="how-to-use" className="font-semibold mb-1">
              How to use this tool
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 text-muted-foreground">
              <li>1. Select mode: <strong className="text-foreground">Single Label</strong> or <strong className="text-foreground">Batch</strong>.</li>
              <li>2. Upload clear JPG/PNG labels (max 8&nbsp;MB).</li>
              <li>
                3. Review results:{" "}
                <span className="font-medium text-success">Match</span>,{" "}
                <span className="font-medium text-warning-foreground">Review</span>, or{" "}
                <span className="font-medium text-destructive">Mismatch</span>.
              </li>
              <li>4. Verifications typically complete in under 5 seconds.</li>
            </ul>
          </div>
        </section>

        {/* Main interface */}
        <main id="main-content">
          <Tabs value={mode} onValueChange={(v) => setMode(v as "single" | "batch")}>
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="border-b border-border bg-muted/40 p-2">
                <TabsList className="bg-muted">
                  <TabsTrigger value="single" className="px-6">Single Label</TabsTrigger>
                  <TabsTrigger value="batch" className="px-6">Batch Process</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="single" className="m-0 p-6 md:p-8">
                <SingleLabelMode />
              </TabsContent>
              <TabsContent value="batch" className="m-0 p-6 md:p-8">
                <BatchMode />
              </TabsContent>
            </div>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
