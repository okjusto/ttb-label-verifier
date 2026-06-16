import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useRef, useState } from "react";
import { verifyLabel, type VerifyLabelResult } from "@/lib/verify-label.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TTB Label Verifier" },
      {
        name: "description",
        content:
          "Internal TTB compliance tool. Compare an alcoholic beverage label image against the submitted application data.",
      },
      { property: "og:title", content: "TTB Label Verifier" },
      {
        property: "og:description",
        content:
          "Internal TTB compliance tool. Compare an alcoholic beverage label image against the submitted application data.",
      },
    ],
  }),
  component: LabelVerifierPage,
});

type FormState = {
  brandName: string;
  classType: string;
  abv: string;
  netContents: string;
};

const MAX_BYTES = 8 * 1024 * 1024; // 8MB

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function LabelVerifierPage() {
  const runVerify = useServerFn(verifyLabel);
  const [form, setForm] = useState<FormState>({
    brandName: "",
    classType: "",
    abv: "",
    netContents: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyLabelResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleField = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleFiles = useCallback(async (files: FileList | null) => {
    setError(null);
    const file = files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpe?g)$/i.test(file.type)) {
      setError("Please choose a JPG or PNG image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image is too large. Please use an image under 8 MB.");
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    setImageFile(file);
    setImagePreview(dataUrl);
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    void handleFiles(e.dataTransfer.files);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onVerify = async () => {
    setError(null);
    setResult(null);
    if (!imagePreview) {
      setError("Please upload a label image before verifying.");
      return;
    }
    if (!form.brandName && !form.classType && !form.abv && !form.netContents) {
      setError("Please fill in at least one application field before verifying.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await runVerify({ data: { ...form, imageDataUrl: imagePreview } });
      setResult(r);
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-primary text-primary-foreground border-b-4 border-primary">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            TTB Label Verifier
          </h1>
          <p className="mt-2 text-base sm:text-lg opacity-90">
            Compare a label image against the submitted application data.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-8">
        <div className="grid gap-8 md:grid-cols-2">
          {/* LEFT: Application Data */}
          <section
            aria-labelledby="app-data-heading"
            className="rounded-lg border-2 border-border bg-card p-6"
          >
            <h2 id="app-data-heading" className="text-2xl font-bold mb-6">
              Application Data
            </h2>
            <div className="space-y-5">
              <FormField
                id="brandName"
                label="Brand Name"
                value={form.brandName}
                onChange={handleField("brandName")}
                placeholder="e.g. Mountain Crest"
              />
              <FormField
                id="classType"
                label="Class/Type Designation"
                value={form.classType}
                onChange={handleField("classType")}
                placeholder="e.g. Straight Bourbon Whiskey"
              />
              <FormField
                id="abv"
                label="Alcohol Content (ABV)"
                value={form.abv}
                onChange={handleField("abv")}
                placeholder="e.g. 45% ALC/VOL"
              />
              <FormField
                id="netContents"
                label="Net Contents"
                value={form.netContents}
                onChange={handleField("netContents")}
                placeholder="e.g. 750 ML"
              />
            </div>
          </section>

          {/* RIGHT: Label Image */}
          <section
            aria-labelledby="image-heading"
            className="rounded-lg border-2 border-border bg-card p-6"
          >
            <h2 id="image-heading" className="text-2xl font-bold mb-6">
              Label Image
            </h2>

            {!imagePreview ? (
              <label
                htmlFor="label-file"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={[
                  "flex flex-col items-center justify-center gap-3 text-center cursor-pointer",
                  "rounded-lg border-4 border-dashed p-10 min-h-[280px]",
                  "transition-colors",
                  dragOver
                    ? "border-primary bg-accent"
                    : "border-border bg-secondary hover:bg-accent",
                  "focus-within:ring-4 focus-within:ring-ring focus-within:ring-offset-2",
                ].join(" ")}
              >
                <span className="text-xl font-semibold">
                  Drag and drop a label image here
                </span>
                <span className="text-base text-muted-foreground">
                  or click to choose a file
                </span>
                <span className="text-sm text-muted-foreground">
                  JPG or PNG, up to 8 MB
                </span>
                <input
                  ref={fileInputRef}
                  id="label-file"
                  type="file"
                  accept="image/png,image/jpeg"
                  className="sr-only"
                  onChange={(e) => void handleFiles(e.target.files)}
                />
              </label>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border-2 border-border bg-secondary p-3">
                  <img
                    src={imagePreview}
                    alt="Uploaded label preview"
                    className="mx-auto max-h-[360px] w-auto object-contain"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-base text-muted-foreground">
                    {imageFile?.name}
                  </span>
                  <button
                    type="button"
                    onClick={clearImage}
                    className="rounded-md border-2 border-border bg-background px-4 py-2 text-base font-semibold hover:bg-accent focus:outline-none focus:ring-4 focus:ring-ring focus:ring-offset-2"
                  >
                    Replace image
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Verify button */}
        <div>
          <button
            type="button"
            onClick={onVerify}
            disabled={submitting}
            className="w-full rounded-lg bg-primary px-8 py-6 text-2xl font-bold text-primary-foreground shadow-md transition-colors hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Verifying label…" : "Verify Label"}
          </button>
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-md border-2 border-destructive bg-destructive/10 px-4 py-3 text-lg font-semibold text-destructive"
            >
              {error}
            </p>
          )}
        </div>

        {/* Results */}
        <section
          aria-labelledby="results-heading"
          aria-live="polite"
          className="rounded-lg border-2 border-border bg-card p-6 min-h-[160px]"
        >
          <h2 id="results-heading" className="text-2xl font-bold mb-4">
            Verification Results
          </h2>

          {!result && !submitting && (
            <p className="text-lg text-muted-foreground">
              Results will appear here after you click <strong>Verify Label</strong>.
            </p>
          )}

          {submitting && (
            <p className="text-lg">Analyzing label image. This may take a few seconds…</p>
          )}

          {result && <ResultView result={result} />}
        </section>
      </main>
    </div>
  );
}

function FormField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-lg font-semibold mb-2">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-md border-2 border-input bg-background px-4 py-3 text-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-ring focus:ring-offset-2"
      />
    </div>
  );
}

function ResultView({ result }: { result: VerifyLabelResult }) {
  const isPass = result.overall === "pass";
  return (
    <div className="space-y-6">
      <div
        className={[
          "rounded-lg border-4 p-5",
          isPass
            ? "border-success bg-success/10 text-success"
            : "border-warning bg-warning/10 text-warning-foreground",
        ].join(" ")}
      >
        <div className="text-2xl font-bold">
          {isPass ? "PASS — Label matches application" : "NEEDS REVIEW"}
        </div>
        {result.summary && (
          <p className="mt-2 text-lg text-foreground">{result.summary}</p>
        )}
      </div>

      <div>
        <h3 className="text-xl font-bold mb-3">Field-by-field check</h3>
        <ul className="space-y-3">
          {result.fields.map((f) => (
            <li
              key={f.field}
              className="rounded-md border-2 border-border bg-background p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-lg font-semibold">{f.label}</div>
                <VerdictBadge verdict={f.verdict} />
              </div>
              <dl className="mt-3 grid gap-2 sm:grid-cols-2 text-base">
                <div>
                  <dt className="font-semibold text-muted-foreground">Submitted</dt>
                  <dd className="text-foreground break-words">
                    {f.submitted || <em className="text-muted-foreground">(blank)</em>}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-muted-foreground">On the label</dt>
                  <dd className="text-foreground break-words">
                    {f.foundOnLabel || (
                      <em className="text-muted-foreground">Not found</em>
                    )}
                  </dd>
                </div>
              </dl>
              {f.note && <p className="mt-2 text-base">{f.note}</p>}
            </li>
          ))}
        </ul>
      </div>

      {result.observations.length > 0 && (
        <div>
          <h3 className="text-xl font-bold mb-3">Other observations</h3>
          <ul className="list-disc pl-6 space-y-2 text-lg">
            {result.observations.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: "match" | "mismatch" | "not_found" }) {
  const map = {
    match: { label: "MATCH", cls: "bg-success text-success-foreground border-success" },
    mismatch: {
      label: "MISMATCH",
      cls: "bg-destructive text-destructive-foreground border-destructive",
    },
    not_found: {
      label: "NOT FOUND",
      cls: "bg-warning text-warning-foreground border-warning",
    },
  } as const;
  const { label, cls } = map[verdict];
  return (
    <span
      className={`inline-block rounded-md border-2 px-3 py-1 text-base font-bold ${cls}`}
    >
      {label}
    </span>
  );
}
