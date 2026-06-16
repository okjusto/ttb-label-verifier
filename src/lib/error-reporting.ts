type ReportedErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

type HostEvents = {
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: ReportedErrorOptions,
  ) => void;
};

declare global {
  interface Window {
    __lovableEvents?: HostEvents;
  }
}

export function reportError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  // The hosting platform exposes a global error-capture hook; we forward to it
  // when present and otherwise stay silent.
  window.__lovableEvents?.captureException?.(
    error,
    {
      source: "react_error_boundary",
      route: window.location.pathname,
      ...context,
    },
    {
      mechanism: "react_error_boundary",
      handled: false,
      severity: "error",
    },
  );
}
