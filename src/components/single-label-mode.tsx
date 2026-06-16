import { useCallback, useEffect, useRef, useState } from "react";
import {
  FIELD_DEFS,
  STATUS_STYLES,
  compareField,
  formatDuration,
  readFileAsDataUrl,
  verifyLabel,
  warningStatus,
  type FormState,
  type TimedVerifyResult,
  type VerifyResult,
} from "@/lib/verify-label-client";

const MAX_BYTES = 8 * 1024 * 1024;

function describeFileError(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return `"${file.name}" is not an image file. Please choose a JPG or PNG.`;
  }
  if (!/^image\/(png|jpe?g)$/i.test(file.type)) {
    return `"${file.name}" is a ${file.type.replace("image/", "").toUpperCase()} image. Please use JPG or PNG instead.`;
  }
  if (file.size > MAX_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return `"${file.name}" is ${mb} MB — too large. Please use an image under 8 MB.`;
  }
  return null;
}

export function SingleLabelMode() {
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
  const [result, setResult] = useState<TimedVerifyResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);

  const handleField = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleFiles = useCallback(async (files: FileList | null) => {
    setError(null);
    const file = files?.[0];
    if (!file) return;
    const issue = describeFileError(file);
    if (issue) {
      setError(issue);
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setImageFile(file);
      setImagePreview(dataUrl);
    } catch {
      setError("Could not read that file. Please try a different image.");
    }
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
      const r = await verifyLabel({ ...form, imageBase64: imagePreview });
      setResult(r);
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (result && resultsHeadingRef.current) {
      resultsHeadingRef.current.focus();
    }
  }, [result]);


  return (
    <div className="space-y-8">
      <div className="grid gap-8 md:grid-cols-2">
        <section
          aria-labelledby="app-data-heading"
          className="rounded-lg border-2 border-border bg-card p-6"
        >
          <h2 id="app-data-heading" className="text-2xl font-bold mb-6">
            Application Data
          </h2>
          <div className="space-y-5">
            <FormFieldInput
              id="brandName"
              label="Brand Name"
              value={form.brandName}
              onChange={handleField("brandName")}
              placeholder="e.g. Mountain Crest"
            />
            <FormFieldInput
              id="classType"
              label="Class/Type Designation"
              value={form.classType}
              onChange={handleField("classType")}
              placeholder="e.g. Straight Bourbon Whiskey"
            />
            <FormFieldInput
              id="abv"
              label="Alcohol Content (ABV)"
              value={form.abv}
              onChange={handleField("abv")}
              placeholder="e.g. 45% ALC/VOL"
            />
            <FormFieldInput
              id="netContents"
              label="Net Contents"
              value={form.netContents}
              onChange={handleField("netContents")}
              placeholder="e.g. 750 ML"
            />
          </div>
        </section>

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
                "rounded-lg border-4 border-dashed p-10 min-h-[280px] transition-colors",
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

      <section
        aria-labelledby="results-heading"
        aria-live="polite"
        aria-busy={submitting}
        className="rounded-lg border-2 border-border bg-card p-6 min-h-[160px]"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
          <h2
            id="results-heading"
            ref={resultsHeadingRef}
            tabIndex={-1}
            className="text-2xl font-bold focus:outline-none focus:ring-4 focus:ring-ring rounded"
          >
            Verification Results
          </h2>
          {result && <DurationBadge ms={result.durationMs} />}
        </div>
        {!result && !submitting && (
          <p className="text-lg text-muted-foreground">
            Results will appear here after you click <strong>Verify Label</strong>.
          </p>
        )}
        {submitting && (
          <p className="text-lg" role="status">
            <span className="inline-block h-3 w-3 mr-2 rounded-full bg-primary animate-pulse" aria-hidden="true" />
            Analyzing label image. This usually takes 2–5 seconds…
          </p>
        )}
        {result && <SingleLabelResult result={result} submitted={form} />}
      </section>

    </div>
  );
}

function FormFieldInput({
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

export function SingleLabelResult({
  result,
  submitted,
}: {
  result: VerifyResult;
  submitted: FormState;
}) {
  const quality = result.imageQuality;

  if (quality === "unreadable") {
    return (
      <div className="rounded-lg border-4 border-destructive bg-destructive/10 p-6">
        <div className="text-2xl font-bold text-destructive mb-2">
          Image cannot be read
        </div>
        <p className="text-lg text-foreground">
          The label image is too unclear to verify. Please upload a sharper,
          well-lit photo of the entire label and try again.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {quality === "poor" && (
        <div
          role="status"
          className="rounded-lg border-4 border-warning bg-warning/10 p-5"
        >
          <div className="text-xl font-bold text-warning-foreground">
            ⚠ Image quality is poor
          </div>
          <p className="mt-1 text-base text-foreground">
            Results below may be unreliable. A clearer photo will improve accuracy.
          </p>
        </div>
      )}

      <div>
        <h3 className="text-xl font-bold mb-3">Field comparison</h3>
        <ul className="space-y-3">
          {FIELD_DEFS.map((f) => {
            const sub = submitted[f.key];
            const got = (result.extracted as any)[f.key] as string;
            const status = compareField(sub, got);
            const style = STATUS_STYLES[status];
            return (
              <li
                key={f.key}
                className={`rounded-lg border-4 bg-background p-5 ${style.cardBorder}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-lg font-semibold">{f.label}</div>
                  <span
                    className={`inline-flex items-center gap-2 rounded-md border-2 px-4 py-2 text-lg font-bold ${style.badge}`}
                  >
                    <span aria-hidden="true" className="text-xl">{style.icon}</span>
                    {style.label.toUpperCase()}
                  </span>
                </div>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-base">
                  <div>
                    <dt className="font-semibold text-muted-foreground">You entered</dt>
                    <dd className="text-foreground break-words text-lg">
                      {sub || <em className="text-muted-foreground">(blank)</em>}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-muted-foreground">On the label</dt>
                    <dd className="text-foreground break-words text-lg">
                      {got || <em className="text-muted-foreground">Not found</em>}
                    </dd>
                  </div>
                </dl>
                {status === "review" && (
                  <p className="mt-3 text-base font-semibold text-warning-foreground">
                    Values differ only in capitalization, punctuation, or spacing.
                    Please review and make the final call.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <WarningBlock result={result} />
    </div>
  );
}

export function WarningBlock({ result }: { result: VerifyResult }) {
  const { status, message } = warningStatus(result.warningChecks);
  const style = STATUS_STYLES[status];
  const { exactWordingPresent, isAllCaps, isBold } = result.warningChecks;

  return (
    <div>
      <h3 className="text-xl font-bold mb-3">Government warning</h3>
      <div className={`rounded-lg border-4 bg-background p-5 ${style.cardBorder}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-lg font-semibold">Compliance check</div>
          <span
            className={`inline-flex items-center gap-2 rounded-md border-2 px-4 py-2 text-lg font-bold ${style.badge}`}
          >
            <span aria-hidden="true" className="text-xl">{style.icon}</span>
            {style.label.toUpperCase()}
          </span>
        </div>
        <p className="mt-3 text-base font-semibold">{message}</p>

        <ul className="mt-4 space-y-2 text-base">
          <CheckLine
            ok={exactWordingPresent}
            label="Mandatory TTB wording present word-for-word"
          />
          <CheckLine ok={isAllCaps} label={'"GOVERNMENT WARNING:" in all caps'} />
          <CheckLine ok={isBold} label={'"GOVERNMENT WARNING:" in bold'} />
        </ul>

        <div className="mt-4">
          <div className="font-semibold text-muted-foreground mb-1">
            Warning text on the label
          </div>
          <p className="whitespace-pre-wrap text-base">
            {result.extracted.warningText || (
              <em className="text-muted-foreground">Not found on label</em>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function CheckLine({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className={`mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border-2 text-sm font-bold ${
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

export function DurationBadge({ ms }: { ms: number }) {
  const fast = ms < 5000;
  return (
    <span
      title={fast ? "Within the 5-second performance target" : "Slower than the 5-second target"}
      className={`inline-flex items-center gap-1.5 rounded-md border-2 px-3 py-1 text-sm font-bold ${
        fast
          ? "bg-success/10 text-success border-success"
          : "bg-warning/10 text-warning-foreground border-warning"
      }`}
    >
      <span aria-hidden="true">⏱</span>
      <span>{formatDuration(ms)}</span>
      <span className="sr-only">{fast ? "within performance target" : "above performance target"}</span>
    </span>
  );
}
