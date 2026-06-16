import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Play, X, Loader2, Layers, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  STATUS_STYLES,
  formatDuration,
  readFileAsDataUrl,
  verifyLabel,
  warningStatus,
  type TimedVerifyResult,
  type WarningStatus,
} from "@/lib/verify-label-client";
import { DurationBadge, WarningBlock } from "./single-label-mode";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_FILES = 500;
const CONCURRENCY = 4;

type ItemStatus = "pending" | "processing" | "done" | "error";

type BatchItem = {
  id: string;
  file: File;
  previewUrl: string;
  status: ItemStatus;
  result?: TimedVerifyResult;
  error?: string;
};

function describeBatchRejection(file: File): string | null {
  if (!file.type.startsWith("image/")) return "not an image";
  if (!/^image\/(png|jpe?g)$/i.test(file.type)) return "not JPG/PNG";
  if (file.size > MAX_BYTES) return "over 8 MB";
  return null;
}

export function BatchMode() {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [running, setRunning] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    return () => {
      items.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = useCallback((files: FileList | File[] | null) => {
    setGlobalError(null);
    if (!files) return;
    const arr = Array.from(files);
    const accepted: BatchItem[] = [];
    const rejections: string[] = [];
    for (const file of arr) {
      const reason = describeBatchRejection(file);
      if (reason) {
        rejections.push(`${file.name} (${reason})`);
        continue;
      }
      accepted.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        status: "pending",
      });
    }
    setItems((prev) => {
      const merged = [...prev, ...accepted].slice(0, MAX_FILES);
      if (prev.length + accepted.length > MAX_FILES) {
        setGlobalError(`Only the first ${MAX_FILES} images are kept.`);
      }
      return merged;
    });
    if (rejections.length > 0) {
      const preview = rejections.slice(0, 3).join("; ");
      const extra = rejections.length > 3 ? ` and ${rejections.length - 3} more` : "";
      setGlobalError(
        (prev) =>
          (prev ? prev + " " : "") +
          `${rejections.length} file(s) skipped — only JPG/PNG under 8 MB are allowed: ${preview}${extra}.`,
      );
    }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const clearAll = () => {
    if (running) return;
    items.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    setItems([]);
    setOpenItemId(null);
    setGlobalError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const updateItem = (id: string, patch: Partial<BatchItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const processItem = useCallback(async (id: string, file: File) => {
    updateItem(id, { status: "processing" });
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const result = await verifyLabel({ imageBase64: dataUrl });
      updateItem(id, { status: "done", result });
    } catch (e: any) {
      updateItem(id, { status: "error", error: e?.message ?? "Verification failed." });
    }
  }, []);

  const runQueue = async () => {
    if (running) return;
    if (items.length === 0) {
      setGlobalError("Please add some images first.");
      return;
    }
    setGlobalError(null);
    cancelRef.current = false;
    setRunning(true);

    setItems((prev) =>
      prev.map((it) =>
        it.status === "done"
          ? it
          : { ...it, status: "pending", error: undefined, result: undefined },
      ),
    );

    const queue = items
      .filter((it) => it.status !== "done")
      .map((it) => ({ id: it.id, file: it.file }));

    let idx = 0;
    const worker = async () => {
      while (!cancelRef.current) {
        const myIdx = idx++;
        if (myIdx >= queue.length) return;
        const { id, file } = queue[myIdx];
        await processItem(id, file);
      }
    };
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker);
    await Promise.all(workers);
    setRunning(false);
  };

  const cancel = () => {
    cancelRef.current = true;
  };

  const doneItems = items.filter((i) => i.status === "done");
  const errorItems = items.filter((i) => i.status === "error");
  const completed = doneItems.length + errorItems.length;
  const processingNow = items.filter((i) => i.status === "processing").length;
  const total = items.length;
  const progressPct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const avgMs =
    doneItems.length > 0
      ? Math.round(
          doneItems.reduce((sum, i) => sum + (i.result?.durationMs ?? 0), 0) /
            doneItems.length,
        )
      : 0;

  const openItem = items.find((i) => i.id === openItemId) ?? null;

  return (
    <div className="space-y-6">
      {/* Intro blurb */}
      <section
        aria-labelledby="batch-intro"
        className="rounded-lg border border-accent bg-accent/60 p-4 flex gap-4 items-start"
      >
        <div className="rounded-full bg-primary text-primary-foreground p-1.5 shrink-0">
          <Layers className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="text-sm text-foreground">
          <p id="batch-intro" className="font-semibold mb-1">
            Verify many labels in one pass
          </p>
          <p className="text-muted-foreground">
            Batch mode is built for high-volume reviews — peak-season importer
            submissions, brand portfolios, or any time you need to clear a stack of
            labels quickly. Drop in up to {MAX_FILES} JPG or PNG files at once and the
            tool processes them in parallel, surfacing brand, ABV, net contents,
            government warning status, and image quality in a single sortable table.
            Click any row to see the full per-label breakdown.
          </p>
        </div>
      </section>

      {/* Upload zone */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Upload Labels</h2>
        <label
          htmlFor="batch-file"
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={[
            "group relative flex flex-col items-center justify-center w-full",
            "border-2 border-dashed rounded-xl bg-muted/40 cursor-pointer transition-colors",
            "p-8 min-h-[180px] focus-within:ring-2 focus-within:ring-ring",
            dragOver
              ? "border-primary bg-accent"
              : "border-border hover:bg-muted hover:border-muted-foreground/50",
          ].join(" ")}
        >
          <div className="mb-3 p-3 rounded-full bg-card shadow-sm text-muted-foreground">
            <Upload className="h-6 w-6" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium">Drag and drop label images here</p>
          <p className="text-xs text-muted-foreground mt-1">
            or click to choose multiple files
          </p>
          <p className="mt-3 text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
            JPG or PNG, up to 8 MB · up to {MAX_FILES} per batch
          </p>
          <Input
            ref={fileInputRef}
            id="batch-file"
            type="file"
            accept="image/png,image/jpeg"
            multiple
            className="sr-only"
            onChange={(e) => addFiles(e.target.files)}
          />
        </label>

        {globalError && (
          <Alert variant="destructive">
            <AlertDescription>{globalError}</AlertDescription>
          </Alert>
        )}
      </section>

      {/* Controls + progress */}
      {items.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm font-semibold">
              {total} label{total === 1 ? "" : "s"} loaded
              {running && (
                <span className="ml-2 text-muted-foreground font-normal">
                  — Processing{" "}
                  <span aria-live="polite" className="font-semibold text-foreground">
                    {Math.min(completed + processingNow, total)}
                  </span>{" "}
                  of {total}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {!running ? (
                <>
                  <Button type="button" onClick={runQueue} size="sm">
                    <Play className="h-4 w-4 mr-1.5" aria-hidden="true" />
                    {completed > 0 ? "Run remaining" : "Verify all labels"}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={clearAll}>
                    Clear all
                  </Button>
                </>
              ) : (
                <Button type="button" variant="destructive" size="sm" onClick={cancel}>
                  Cancel
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Progress value={progressPct} aria-label="Batch verification progress" />
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span>
                {completed} of {total} complete ({progressPct}%)
              </span>
              {doneItems.length > 0 && (
                <span>
                  Avg time:{" "}
                  <strong
                    className={avgMs < 5000 ? "text-success" : "text-warning-foreground"}
                  >
                    {formatDuration(avgMs)}
                  </strong>
                </span>
              )}
              {errorItems.length > 0 && (
                <span className="font-semibold text-destructive">
                  {errorItems.length} error{errorItems.length === 1 ? "" : "s"} — click a row for details
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Results table */}
      {items.length > 0 && (
        <section className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Image</TableHead>
                  <TableHead>Brand Name</TableHead>
                  <TableHead>ABV</TableHead>
                  <TableHead>Net Contents</TableHead>
                  <TableHead>Warning</TableHead>
                  <TableHead>Quality</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <BatchRow key={it.id} item={it} onOpen={(id) => setOpenItemId(id)} />
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* Detail dialog */}
      <Dialog open={!!openItem} onOpenChange={(o) => !o && setOpenItemId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {openItem && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-3 pr-8">
                  <DialogTitle className="truncate">{openItem.file.name}</DialogTitle>
                  {openItem.result && <DurationBadge ms={openItem.result.durationMs} />}
                </div>
              </DialogHeader>
              <div className="grid gap-6 md:grid-cols-[260px_1fr] mt-2">
                <div>
                  <img
                    src={openItem.previewUrl}
                    alt={openItem.file.name}
                    className="w-full rounded-lg border border-border object-contain bg-muted"
                  />
                </div>
                <div className="space-y-4 min-w-0">
                  {openItem.status === "error" && (
                    <Alert variant="destructive">
                      <AlertTitle>Verification failed</AlertTitle>
                      <AlertDescription>
                        {openItem.error || "Verification failed."}
                      </AlertDescription>
                    </Alert>
                  )}
                  {openItem.result && <DetailBody result={openItem.result} />}
                  {!openItem.result && openItem.status !== "error" && (
                    <p className="text-sm text-muted-foreground">No result yet.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BatchRow({
  item,
  onOpen,
}: {
  item: BatchItem;
  onOpen: (id: string) => void;
}) {
  const isClickable = item.status === "done" || item.status === "error";
  const warning = item.result ? warningStatus(item.result.warningChecks) : null;

  return (
    <TableRow
      onClick={() => isClickable && onOpen(item.id)}
      tabIndex={isClickable ? 0 : -1}
      onKeyDown={(e) => {
        if (isClickable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen(item.id);
        }
      }}
      className={isClickable ? "cursor-pointer" : undefined}
    >
      <TableCell>
        <img
          src={item.previewUrl}
          alt={item.file.name}
          className="h-12 w-12 object-cover rounded border border-border"
          loading="lazy"
        />
      </TableCell>
      <TableCell className="break-words max-w-[14rem]">
        {item.result?.extracted.brandName || <Dim status={item.status} />}
      </TableCell>
      <TableCell className="break-words max-w-[8rem]">
        {item.result?.extracted.abv || <Dim status={item.status} />}
      </TableCell>
      <TableCell className="break-words max-w-[8rem]">
        {item.result?.extracted.netContents || <Dim status={item.status} />}
      </TableCell>
      <TableCell>
        {warning ? <WarningPill status={warning.status} /> : <Dim status={item.status} />}
      </TableCell>
      <TableCell>
        {item.result ? (
          <QualityPill quality={item.result.imageQuality} />
        ) : (
          <Dim status={item.status} />
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {item.result ? (
          <span
            className={
              "font-mono text-xs font-semibold " +
              (item.result.durationMs < 5000
                ? "text-success"
                : "text-warning-foreground")
            }
            title={
              item.result.durationMs < 5000
                ? "Within 5-second target"
                : "Above 5-second target"
            }
          >
            {formatDuration(item.result.durationMs)}
          </span>
        ) : (
          <Dim status={item.status} />
        )}
      </TableCell>
      <TableCell>
        <StatusPill status={item.status} error={item.error} />
      </TableCell>
    </TableRow>
  );
}

function Dim({ status }: { status: ItemStatus }) {
  if (status === "processing")
    return <em className="text-muted-foreground text-xs">Analyzing…</em>;
  if (status === "pending")
    return <em className="text-muted-foreground text-xs">Waiting</em>;
  return <em className="text-muted-foreground text-xs">—</em>;
}

function StatusPill({ status, error }: { status: ItemStatus; error?: string }) {
  if (status === "done")
    return (
      <Badge className="bg-success text-success-foreground hover:bg-success">Done</Badge>
    );
  if (status === "error")
    return (
      <Badge variant="destructive" title={error}>
        Error
      </Badge>
    );
  if (status === "processing")
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        Processing
      </Badge>
    );
  return <Badge variant="outline">Pending</Badge>;
}

function WarningPill({ status }: { status: WarningStatus }) {
  const s = STATUS_STYLES[status];
  const label =
    status === "match" ? "PASS" : status === "review" ? "REVIEW" : "FAIL";
  const cls =
    status === "match"
      ? "bg-success text-success-foreground hover:bg-success"
      : status === "review"
      ? "bg-warning text-warning-foreground hover:bg-warning"
      : "bg-destructive text-destructive-foreground hover:bg-destructive";
  return (
    <Badge className={`gap-1 ${cls}`}>
      <span aria-hidden="true">{s.icon}</span>
      {label}
    </Badge>
  );
}

function QualityPill({ quality }: { quality: string }) {
  const cls =
    quality === "good"
      ? "bg-success text-success-foreground hover:bg-success"
      : quality === "poor"
      ? "bg-warning text-warning-foreground hover:bg-warning"
      : "bg-destructive text-destructive-foreground hover:bg-destructive";
  return <Badge className={`uppercase ${cls}`}>{String(quality)}</Badge>;
}

function DetailBody({ result }: { result: TimedVerifyResult }) {
  if (result.imageQuality === "unreadable") {
    return (
      <Alert variant="destructive">
        <AlertTitle>Image is unreadable</AlertTitle>
        <AlertDescription>Please re-shoot this label.</AlertDescription>
      </Alert>
    );
  }
  return (
    <div className="space-y-4">
      {result.imageQuality === "poor" && (
        <Alert className="border-warning bg-warning/10">
          <AlertTitle className="text-warning-foreground">
            Image quality is poor
          </AlertTitle>
          <AlertDescription>Results may be unreliable.</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Extracted fields
        </h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <FieldRow label="Brand Name" value={result.extracted.brandName} />
          <FieldRow label="Class/Type" value={result.extracted.classType} />
          <FieldRow label="ABV" value={result.extracted.abv} />
          <FieldRow label="Net Contents" value={result.extracted.netContents} />
        </dl>
      </div>
      <WarningBlock result={result} />
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/40 p-3">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-sm mt-0.5 break-words">
        {value || <em className="text-muted-foreground">Not found</em>}
      </div>
    </div>
  );
}
