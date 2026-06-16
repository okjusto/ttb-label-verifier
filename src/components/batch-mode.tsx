import { useCallback, useEffect, useRef, useState } from "react";
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
  previewUrl: string; // object URL for thumbnail
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

  // Release object URLs on unmount.
  useEffect(() => {
    return () => {
      items.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = useCallback(
    (files: FileList | File[] | null) => {
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
        const extra =
          rejections.length > 3 ? ` and ${rejections.length - 3} more` : "";
        setGlobalError(
          (prev) =>
            (prev ? prev + " " : "") +
            `${rejections.length} file(s) skipped — only JPG/PNG under 8 MB are allowed: ${preview}${extra}.`,
        );
      }
    },
    [],
  );


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
      updateItem(id, {
        status: "error",
        error: e?.message ?? "Verification failed.",
      });
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

    // Reset items that previously errored or were never processed; keep done ones.
    setItems((prev) =>
      prev.map((it) =>
        it.status === "done"
          ? it
          : { ...it, status: "pending", error: undefined, result: undefined },
      ),
    );

    // Snapshot the queue.
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

  const completed = items.filter((i) => i.status === "done" || i.status === "error").length;
  const processingNow = items.filter((i) => i.status === "processing").length;
  const total = items.length;
  const progressPct = total === 0 ? 0 : Math.round((completed / total) * 100);

  const openItem = items.find((i) => i.id === openItemId) ?? null;

  return (
    <div className="space-y-6">
      {/* Upload zone */}
      <section className="rounded-lg border-2 border-border bg-card p-6">
        <h2 className="text-2xl font-bold mb-4">Upload Labels</h2>
        <label
          htmlFor="batch-file"
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={[
            "flex flex-col items-center justify-center gap-3 text-center cursor-pointer",
            "rounded-lg border-4 border-dashed p-10 min-h-[200px] transition-colors",
            dragOver
              ? "border-primary bg-accent"
              : "border-border bg-secondary hover:bg-accent",
          ].join(" ")}
        >
          <span className="text-xl font-semibold">
            Drag and drop label images here
          </span>
          <span className="text-base text-muted-foreground">
            or click to choose multiple files
          </span>
          <span className="text-sm text-muted-foreground">
            JPG or PNG, up to 8 MB each. Up to {MAX_FILES} images per batch.
          </span>
          <input
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
          <p
            role="alert"
            className="mt-4 rounded-md border-2 border-destructive bg-destructive/10 px-4 py-3 text-base font-semibold text-destructive"
          >
            {globalError}
          </p>
        )}
      </section>

      {/* Controls + progress */}
      {items.length > 0 && (
        <section className="rounded-lg border-2 border-border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-lg font-semibold">
              {total} label{total === 1 ? "" : "s"} loaded
              {running && (
                <>
                  {" — Processing "}
                  <span aria-live="polite">
                    {Math.min(completed + processingNow, total)}
                  </span>
                  {" of "}
                  {total}
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              {!running ? (
                <>
                  <button
                    type="button"
                    onClick={runQueue}
                    className="rounded-lg bg-primary px-6 py-3 text-lg font-bold text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-ring focus:ring-offset-2"
                  >
                    {completed > 0 ? "Run remaining" : "Verify all labels"}
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="rounded-md border-2 border-border bg-background px-4 py-3 text-base font-semibold hover:bg-accent focus:outline-none focus:ring-4 focus:ring-ring focus:ring-offset-2"
                  >
                    Clear all
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={cancel}
                  className="rounded-md border-2 border-destructive bg-destructive/10 text-destructive px-4 py-3 text-base font-bold hover:bg-destructive/20 focus:outline-none focus:ring-4 focus:ring-ring focus:ring-offset-2"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          <div className="mt-4">
            <div
              className="h-4 w-full overflow-hidden rounded-full bg-secondary border-2 border-border"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={completed}
              aria-label="Batch verification progress"
            >
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="mt-2 text-base text-muted-foreground">
              {completed} of {total} complete ({progressPct}%)
            </div>
          </div>
        </section>
      )}

      {/* Results table */}
      {items.length > 0 && (
        <section className="rounded-lg border-2 border-border bg-card p-2 sm:p-4">
          <ResultsTable
            items={items}
            onOpen={(id) => setOpenItemId(id)}
          />
        </section>
      )}

      {/* Detail modal */}
      {openItem && (
        <DetailModal item={openItem} onClose={() => setOpenItemId(null)} />
      )}
    </div>
  );
}

function ResultsTable({
  items,
  onOpen,
}: {
  items: BatchItem[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-base border-collapse">
        <thead>
          <tr className="text-left border-b-2 border-border">
            <th className="p-3 w-20">Image</th>
            <th className="p-3">Brand Name</th>
            <th className="p-3">ABV</th>
            <th className="p-3">Net Contents</th>
            <th className="p-3">Warning</th>
            <th className="p-3">Image Quality</th>
            <th className="p-3 w-32">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <BatchRow key={it.id} item={it} onOpen={onOpen} />
          ))}
        </tbody>
      </table>
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
    <tr
      onClick={() => isClickable && onOpen(item.id)}
      className={[
        "border-b border-border align-middle",
        isClickable ? "cursor-pointer hover:bg-accent focus:bg-accent" : "",
      ].join(" ")}
      tabIndex={isClickable ? 0 : -1}
      onKeyDown={(e) => {
        if (isClickable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen(item.id);
        }
      }}
    >
      <td className="p-3">
        <img
          src={item.previewUrl}
          alt={item.file.name}
          className="h-14 w-14 object-cover rounded border border-border"
          loading="lazy"
        />
      </td>
      <td className="p-3 break-words max-w-[14rem]">
        {item.result?.extracted.brandName || <Dim status={item.status} />}
      </td>
      <td className="p-3 break-words max-w-[10rem]">
        {item.result?.extracted.abv || <Dim status={item.status} />}
      </td>
      <td className="p-3 break-words max-w-[10rem]">
        {item.result?.extracted.netContents || <Dim status={item.status} />}
      </td>
      <td className="p-3">{warning ? <WarningPill status={warning.status} /> : <Dim status={item.status} />}</td>
      <td className="p-3">
        {item.result ? (
          <QualityPill quality={item.result.imageQuality} />
        ) : (
          <Dim status={item.status} />
        )}
      </td>
      <td className="p-3">
        <StatusPill status={item.status} error={item.error} />
      </td>
    </tr>
  );
}

function Dim({ status }: { status: ItemStatus }) {
  if (status === "processing")
    return <em className="text-muted-foreground">Analyzing…</em>;
  if (status === "pending")
    return <em className="text-muted-foreground">Waiting</em>;
  return <em className="text-muted-foreground">—</em>;
}

function StatusPill({ status, error }: { status: ItemStatus; error?: string }) {
  if (status === "done")
    return <span className="font-semibold text-success">Done</span>;
  if (status === "error")
    return (
      <span className="font-semibold text-destructive" title={error}>
        Error
      </span>
    );
  if (status === "processing")
    return <span className="font-semibold text-primary">Processing…</span>;
  return <span className="text-muted-foreground">Pending</span>;
}

function WarningPill({ status }: { status: WarningStatus }) {
  const s = STATUS_STYLES[status];
  const label =
    status === "match" ? "PASS" : status === "review" ? "REVIEW" : "FAIL";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border-2 px-2 py-1 text-sm font-bold ${s.badge}`}
    >
      <span aria-hidden="true">{s.icon}</span>
      {label}
    </span>
  );
}

function QualityPill({ quality }: { quality: string }) {
  const cls =
    quality === "good"
      ? "bg-success text-success-foreground border-success"
      : quality === "poor"
      ? "bg-warning text-warning-foreground border-warning"
      : "bg-destructive text-destructive-foreground border-destructive";
  return (
    <span
      className={`inline-block rounded-md border-2 px-2 py-1 text-sm font-bold ${cls}`}
    >
      {String(quality).toUpperCase()}
    </span>
  );
}

function DetailModal({
  item,
  onClose,
}: {
  item: BatchItem;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Label details"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-4xl rounded-lg bg-background border-4 border-border shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b-2 border-border p-4">
          <h2 className="text-2xl font-bold truncate">{item.file.name}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border-2 border-border bg-background px-4 py-2 text-base font-semibold hover:bg-accent focus:outline-none focus:ring-4 focus:ring-ring focus:ring-offset-2"
          >
            Close
          </button>
        </div>
        <div className="p-6 grid gap-6 md:grid-cols-[280px_1fr]">
          <div>
            <img
              src={item.previewUrl}
              alt={item.file.name}
              className="w-full rounded border-2 border-border object-contain bg-secondary"
            />
          </div>
          <div className="space-y-4">
            {item.status === "error" && (
              <div className="rounded-md border-2 border-destructive bg-destructive/10 p-4 text-destructive font-semibold">
                {item.error || "Verification failed."}
              </div>
            )}
            {item.result && <DetailBody result={item.result} />}
            {!item.result && item.status !== "error" && (
              <p className="text-lg text-muted-foreground">No result yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailBody({ result }: { result: TimedVerifyResult }) {
  if (result.imageQuality === "unreadable") {
    return (
      <div className="rounded-lg border-4 border-destructive bg-destructive/10 p-4 text-destructive font-semibold">
        Image is unreadable. Please re-shoot this label.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {result.imageQuality === "poor" && (
        <div className="rounded-md border-2 border-warning bg-warning/10 p-3 text-warning-foreground font-semibold">
          ⚠ Image quality is poor. Results may be unreliable.
        </div>
      )}
      <div>
        <h3 className="text-lg font-bold mb-2">Extracted fields</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-base">
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
    <div className="rounded-md border-2 border-border bg-background p-3">
      <div className="font-semibold text-muted-foreground text-sm">{label}</div>
      <div className="text-lg break-words">
        {value || <em className="text-muted-foreground">Not found</em>}
      </div>
    </div>
  );
}
