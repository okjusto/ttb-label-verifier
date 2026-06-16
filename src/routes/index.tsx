import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

type VerifyResult = {
  extracted: {
    brandName: string;
    classType: string;
    abv: string;
    netContents: string;
    warningText: string;
  };
  warningChecks: {
    exactWordingPresent: boolean;
    isAllCaps: boolean;
    isBold: boolean;
  };
  imageQuality: "good" | "poor" | "unreadable" | string;
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
  const [result, setResult] = useState<VerifyResult | null>(null);
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
      const { data, error: fnError } = await supabase.functions.invoke("verify-label", {
        body: { ...form, imageBase64: imagePreview },
      });
      if (fnError) {
        const msg =
          (data as any)?.error ??
          fnError.message ??
          "Verification failed. Please try again.";
        throw new Error(msg);
      }
      if (!data || typeof data !== "object" || !(data as any).extracted) {
        throw new Error("Verification service returned an unexpected response.");
      }
      setResult(data as VerifyResult);
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

          {result && <ResultView result={result} submitted={form} />}
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

function ResultView({
  result,
  submitted,
}: {
  result: VerifyResult;
  submitted: FormState;
}) {
  const fields: Array<{ key: keyof FormState; label: string }> = [
    { key: "brandName", label: "Brand Name" },
    { key: "classType", label: "Class/Type Designation" },
    { key: "abv", label: "Alcohol Content (ABV)" },
    { key: "netContents", label: "Net Contents" },
  ];

  const quality = result.imageQuality;
  const qualityCls =
    quality === "good"
      ? "border-success bg-success/10 text-success"
      : quality === "poor"
      ? "border-warning bg-warning/10 text-warning-foreground"
      : "border-destructive bg-destructive/10 text-destructive";

  return (
    <div className="space-y-6">
      <div className={`rounded-lg border-4 p-5 ${qualityCls}`}>
        <div className="text-2xl font-bold">
          Image quality: {String(quality).toUpperCase()}
        </div>
      </div>

      <div>
        <h3 className="text-xl font-bold mb-3">Extracted from the label</h3>
        <ul className="space-y-3">
          {fields.map((f) => {
            const sub = submitted[f.key];
            const got = (result.extracted as any)[f.key] as string;
            const match =
              sub && got && sub.trim().toLowerCase() === got.trim().toLowerCase();
            return (
              <li
                key={f.key}
                className="rounded-md border-2 border-border bg-background p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-lg font-semibold">{f.label}</div>
                  {sub ? (
                    <MatchBadge match={Boolean(match)} hasValue={Boolean(got)} />
                  ) : null}
                </div>
                <dl className="mt-3 grid gap-2 sm:grid-cols-2 text-base">
                  <div>
                    <dt className="font-semibold text-muted-foreground">Submitted</dt>
                    <dd className="text-foreground break-words">
                      {sub || <em className="text-muted-foreground">(blank)</em>}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-muted-foreground">On the label</dt>
                    <dd className="text-foreground break-words">
                      {got || <em className="text-muted-foreground">Not found</em>}
                    </dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h3 className="text-xl font-bold mb-3">Government warning</h3>
        <div className="rounded-md border-2 border-border bg-background p-4 space-y-4">
          <div>
            <div className="font-semibold text-muted-foreground mb-1">
              Warning text on the label
            </div>
            <p className="whitespace-pre-wrap text-base">
              {result.extracted.warningText || (
                <em className="text-muted-foreground">Not found on label</em>
              )}
            </p>
          </div>
          <ul className="space-y-2 text-lg">
            <CheckLine
              ok={result.warningChecks.exactWordingPresent}
              label="Mandatory TTB wording is present word-for-word"
            />
            <CheckLine
              ok={result.warningChecks.isAllCaps}
              label={'"GOVERNMENT WARNING:" appears in all caps'}
            />
            <CheckLine
              ok={result.warningChecks.isBold}
              label={'"GOVERNMENT WARNING:" appears in bold'}
            />
          </ul>
        </div>
      </div>
    </div>
  );
}

function MatchBadge({ match, hasValue }: { match: boolean; hasValue: boolean }) {
  if (!hasValue) {
    return (
      <span className="inline-block rounded-md border-2 px-3 py-1 text-base font-bold bg-warning text-warning-foreground border-warning">
        NOT FOUND
      </span>
    );
  }
  return match ? (
    <span className="inline-block rounded-md border-2 px-3 py-1 text-base font-bold bg-success text-success-foreground border-success">
      MATCH
    </span>
  ) : (
    <span className="inline-block rounded-md border-2 px-3 py-1 text-base font-bold bg-destructive text-destructive-foreground border-destructive">
      MISMATCH
    </span>
  );
}

function CheckLine({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className={`mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full border-2 text-sm font-bold ${
          ok
            ? "bg-success text-success-foreground border-success"
            : "bg-destructive text-destructive-foreground border-destructive"
        }`}
      >
        {ok ? "✓" : "✗"}
      </span>
      <span>
        <strong>{ok ? "PASS" : "FAIL"}</strong> — {label}
      </span>
    </li>
  );
}
