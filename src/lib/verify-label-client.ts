import { supabase } from "@/integrations/supabase/client";

export type VerifyResult = {
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

export type FormState = {
  brandName: string;
  classType: string;
  abv: string;
  netContents: string;
};

export type FieldStatus = "match" | "review" | "mismatch" | "not_found";
export type WarningStatus = "match" | "review" | "mismatch";

export const FIELD_DEFS: Array<{ key: keyof FormState; label: string }> = [
  { key: "brandName", label: "Brand Name" },
  { key: "classType", label: "Class/Type Designation" },
  { key: "abv", label: "Alcohol Content (ABV)" },
  { key: "netContents", label: "Net Contents" },
];

function normalizeAggressive(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function compareField(submitted: string, found: string): FieldStatus {
  const s = submitted.trim();
  const f = found.trim();
  if (!f) return "not_found";
  if (!s) return "review";
  if (s.toLowerCase() === f.toLowerCase()) return "match";
  if (normalizeAggressive(s) === normalizeAggressive(f)) return "review";
  return "mismatch";
}

export function warningStatus(checks: VerifyResult["warningChecks"]): {
  status: WarningStatus;
  problems: string[];
  message: string;
} {
  const problems: string[] = [];
  if (!checks.isAllCaps) problems.push('"GOVERNMENT WARNING:" is not in all caps');
  if (!checks.isBold) problems.push('"GOVERNMENT WARNING:" is not bold');
  if (!checks.exactWordingPresent) {
    return {
      status: "mismatch",
      problems,
      message:
        "The mandatory TTB government warning text is missing or has been altered.",
    };
  }
  if (problems.length > 0) {
    return {
      status: "review",
      problems,
      message: `Wording is correct, but formatting needs review: ${problems.join("; ")}.`,
    };
  }
  return {
    status: "match",
    problems,
    message:
      "Mandatory TTB wording is present word-for-word, in all caps, and bold.",
  };
}

export const STATUS_STYLES: Record<
  FieldStatus | WarningStatus,
  { badge: string; icon: string; label: string; cardBorder: string }
> = {
  match: {
    badge: "bg-success text-success-foreground border-success",
    icon: "✓",
    label: "Match",
    cardBorder: "border-success",
  },
  review: {
    badge: "bg-warning text-warning-foreground border-warning",
    icon: "⚠",
    label: "Review",
    cardBorder: "border-warning",
  },
  mismatch: {
    badge: "bg-destructive text-destructive-foreground border-destructive",
    icon: "✗",
    label: "Mismatch",
    cardBorder: "border-destructive",
  },
  not_found: {
    badge: "bg-warning text-warning-foreground border-warning",
    icon: "⚠",
    label: "Not found",
    cardBorder: "border-warning",
  },
};

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export type TimedVerifyResult = VerifyResult & { durationMs: number };

export async function verifyLabel(input: {
  imageBase64: string;
  brandName?: string;
  classType?: string;
  abv?: string;
  netContents?: string;
}): Promise<TimedVerifyResult> {
  const started = performance.now();
  let data: unknown;
  let error: { message?: string } | null = null;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      await supabase.auth.signInAnonymously();
    }
    const res = await supabase.functions.invoke("verify-label", { body: input });
    data = res.data;
    error = res.error as any;
  } catch (e: any) {
    // Network failure / fetch threw before reaching the function.
    throw new Error(
      "Could not reach the verification service. Check your internet connection and try again.",
    );
  }
  const durationMs = Math.round(performance.now() - started);
  if (error) {
    const msg =
      (data as any)?.error ?? error.message ?? "Verification failed. Please try again.";
    throw new Error(msg);
  }
  if (!data || typeof data !== "object" || !(data as any).extracted) {
    throw new Error("Verification service returned an unexpected response.");
  }
  return { ...(data as VerifyResult), durationMs };
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

