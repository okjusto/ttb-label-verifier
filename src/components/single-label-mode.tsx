import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Upload, Loader2, Timer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

  const handleField =
    (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Application data */}
        <section aria-labelledby="app-data-heading" className="space-y-6">
          <SectionHeading id="app-data-heading">Application Data</SectionHeading>
          <div className="space-y-4">
            <FieldInput
              id="brandName"
              label="Brand Name"
              value={form.brandName}
              onChange={handleField("brandName")}
              placeholder="e.g. Mountain Crest"
            />
            <FieldInput
              id="classType"
              label="Class/Type Designation"
              value={form.classType}
              onChange={handleField("classType")}
              placeholder="e.g. Straight Bourbon Whiskey"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldInput
                id="abv"
                label="Alcohol Content (ABV)"
                value={form.abv}
                onChange={handleField("abv")}
                placeholder="e.g. 45% ALC/VOL"
              />
              <FieldInput
                id="netContents"
                label="Net Contents"
                value={form.netContents}
                onChange={handleField("netContents")}
                placeholder="e.g. 750 ML"
              />
            </div>
          </div>
        </section>

        {/* Image dropzone */}
        <section aria-labelledby="image-heading" className="space-y-6">
          <SectionHeading id="image-heading">Label Image</SectionHeading>

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
                "group relative flex flex-col items-center justify-center w-full h-[260px]",
                "border-2 border-dashed rounded-xl bg-muted/40 cursor-pointer transition-colors",
                "focus-within:ring-2 focus-within:ring-ring",
                dragOver
                  ? "border-primary bg-accent"
                  : "border-border hover:bg-muted hover:border-muted-foreground/50",
              ].join(" ")}
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <div className="mb-4 p-3 rounded-full bg-card shadow-sm text-muted-foreground">
                  <Upload className="h-8 w-8" aria-hidden="true" />
                </div>
                <p className="mb-1 text-sm font-medium text-foreground">
                  Drag and drop a label image here
                </p>
                <p className="text-xs text-muted-foreground">
                  or click to choose a file from your computer
                </p>
                <p className="mt-4 text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                  JPG or PNG, up to 8 MB
                </p>
              </div>
              <Input
                ref={fileInputRef}
                id="label-file"
                type="file"
                accept="image/png,image/jpeg"
                className="sr-only"
                onChange={(e) => void handleFiles(e.target.files)}
              />
            </label>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <img
                  src={imagePreview}
                  alt="Uploaded label preview"
                  className="mx-auto max-h-[240px] w-auto object-contain rounded"
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-sm text-muted-foreground">
                  {imageFile?.name}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearImage}
                >
                  <X className="h-4 w-4 mr-1" aria-hidden="true" />
                  Replace
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Action */}
      <div className="flex flex-col items-center gap-3">
        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <span tabIndex={!imagePreview ? 0 : -1} className="inline-block">
                <Button
                  type="button"
                  size="lg"
                  onClick={onVerify}
                  disabled={submitting || !imagePreview}
                  className="px-8 font-semibold shadow-md"
                  style={!imagePreview ? { pointerEvents: "none" } : undefined}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                      Verifying label…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" aria-hidden="true" />
                      Verify Label
                    </>
                  )}
                </Button>
              </span>
            </TooltipTrigger>
            {!imagePreview && (
              <TooltipContent>
                <p>Please upload labels</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        {!imagePreview && !submitting && (
          <p className="text-xs text-muted-foreground">
            Upload a label image to enable verification.
          </p>
        )}
        {error && (
          <Alert variant="destructive" className="max-w-2xl">
            <AlertTitle>Verification couldn't run</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      <Separator />

      {/* Results */}
      <section
        aria-labelledby="results-heading"
        aria-live="polite"
        aria-busy={submitting}
        className="space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2
              id="results-heading"
              ref={resultsHeadingRef}
              tabIndex={-1}
              className="text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-ring rounded"
            >
              Verification Results
            </h2>
            {!result && !submitting && (
              <Badge variant="secondary" className="uppercase text-[10px] tracking-wider">
                Pending
              </Badge>
            )}
            {submitting && (
              <Badge variant="secondary" className="uppercase text-[10px] tracking-wider">
                Analyzing
              </Badge>
            )}
          </div>
          {result && <DurationBadge ms={result.durationMs} />}
        </div>

        {!result && !submitting && (
          <div className="flex flex-col items-center justify-center py-12 border-2 border-dotted border-border rounded-lg text-muted-foreground bg-card">
            <p className="text-sm">
              Ready for analysis. Enter data and upload a label to begin.
            </p>
          </div>
        )}

        {submitting && (
          <div
            className="flex items-center gap-3 py-12 justify-center rounded-lg border border-border bg-card text-foreground"
            role="status"
          >
            <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
            <span>Analyzing label image. This usually takes 2–5 seconds…</span>
          </div>
        )}

        {result && <SingleLabelResult result={result} submitted={form} />}
      </section>
    </div>
  );
}

function SectionHeading({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <h2 id={id} className="text-base font-semibold text-foreground">
        {children}
      </h2>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function FieldInput({
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
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <Input
        id={id}
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
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
      <Alert variant="destructive">
        <AlertTitle>Image cannot be read</AlertTitle>
        <AlertDescription>
          The label image is too unclear to verify. Please upload a sharper, well-lit
          photo of the entire label and try again.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      {quality === "poor" && (
        <Alert className="border-warning/50 bg-warning/10">
          <AlertTitle className="text-warning-foreground">
            Image quality is poor
          </AlertTitle>
          <AlertDescription>
            Results below may be unreliable. A clearer photo will improve accuracy.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.12em]">
          Field comparison
        </h3>
        <div className="grid gap-3">
          {FIELD_DEFS.map((f) => {
            const sub = submitted[f.key];
            const got = (result.extracted as any)[f.key] as string;
            const status = compareField(sub, got);
            const accent =
              status === "match"
                ? "before:bg-success"
                : status === "mismatch"
                ? "before:bg-destructive"
                : "before:bg-warning";
            return (
              <Card
                key={f.key}
                className={`relative overflow-hidden border-border/70 shadow-sm transition-shadow hover:shadow-md before:absolute before:left-0 before:top-0 before:h-full before:w-1 ${accent}`}
              >
                <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 p-4 pl-5 pb-2">
                  <CardTitle className="text-sm font-semibold">{f.label}</CardTitle>
                  <StatusBadge status={status} />
                </CardHeader>
                <CardContent className="p-4 pl-5 pt-2">
                  <dl className="grid gap-4 sm:grid-cols-2 text-sm">
                    <div className="space-y-1">
                      <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                        You entered
                      </dt>
                      <dd className="break-words font-medium">
                        {sub || <em className="font-normal text-muted-foreground">(blank)</em>}
                      </dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                        On the label
                      </dt>
                      <dd className="break-words font-medium">
                        {got || <em className="font-normal text-muted-foreground">Not found</em>}
                      </dd>
                    </div>
                  </dl>
                  {status === "review" && (
                    <p className="mt-3 text-xs text-warning-foreground/80">
                      Values differ only in capitalization, punctuation, or spacing —
                      please review.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <WarningBlock result={result} />
    </div>
  );
}

export function StatusBadge({ status }: { status: keyof typeof STATUS_STYLES }) {
  const s = STATUS_STYLES[status];
  const variantClass =
    status === "match"
      ? "bg-success/15 text-success border border-success/30 hover:bg-success/15"
      : status === "mismatch"
      ? "bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/15"
      : "bg-warning/20 text-warning-foreground border border-warning/40 hover:bg-warning/20";
  return (
    <Badge className={`gap-1 rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.1em] font-semibold shadow-none ${variantClass}`}>
      <span aria-hidden="true">{s.icon}</span>
      {s.label}
    </Badge>
  );
}

export function WarningBlock({ result }: { result: VerifyResult }) {
  const { status, message } = warningStatus(result.warningChecks);
  const { exactWordingPresent, isAllCaps, isBold } = result.warningChecks;
  const accent =
    status === "match"
      ? "before:bg-success"
      : status === "mismatch"
      ? "before:bg-destructive"
      : "before:bg-warning";

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.12em]">
        Government warning
      </h3>
      <Card
        className={`relative overflow-hidden border-border/70 shadow-sm before:absolute before:left-0 before:top-0 before:h-full before:w-1 ${accent}`}
      >
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 p-4 pl-5 pb-2">
          <CardTitle className="text-sm font-semibold">Compliance check</CardTitle>
          <StatusBadge status={status} />
        </CardHeader>
        <CardContent className="p-4 pl-5 pt-2 space-y-4">
          <p className="text-sm text-foreground/90">{message}</p>

          <ul className="grid gap-2 text-sm">
            <CheckLine ok={exactWordingPresent} label="Mandatory TTB wording present word-for-word" />
            <CheckLine ok={isAllCaps} label={'"GOVERNMENT WARNING:" in all caps'} />
            <CheckLine ok={isBold} label={'"GOVERNMENT WARNING:" in bold'} />
          </ul>

          <div className="rounded-md border border-border/70 bg-muted/40 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-1.5">
              Warning text on the label
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {result.extracted.warningText || (
                <em className="text-muted-foreground">Not found on label</em>
              )}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CheckLine({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        aria-hidden="true"
        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
          ok
            ? "bg-success/15 text-success"
            : "bg-destructive/15 text-destructive"
        }`}
      >
        {ok ? "✓" : "✗"}
      </span>
      <span className="text-sm">
        <strong className={`font-semibold ${ok ? "text-success" : "text-destructive"}`}>
          {ok ? "PASS" : "FAIL"}
        </strong>{" "}
        <span className="text-foreground/90">— {label}</span>
      </span>
    </li>
  );
}

export function DurationBadge({ ms }: { ms: number }) {
  const fast = ms < 5000;
  return (
    <Badge
      variant="outline"
      title={fast ? "Within the 5-second performance target" : "Slower than the 5-second target"}
      className={
        "gap-1.5 rounded-full font-mono text-xs " +
        (fast
          ? "border-success/40 bg-success/10 text-success"
          : "border-warning/50 bg-warning/15 text-warning-foreground")
      }
    >
      <Timer className="h-3 w-3" aria-hidden="true" />
      {formatDuration(ms)}
      <span className="sr-only">
        {fast ? "within performance target" : "above performance target"}
      </span>
    </Badge>
  );
}

