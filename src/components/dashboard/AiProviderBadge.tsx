"use client";

interface AiProviderBadgeProps {
  provider?: string | null;
  modelId?: string | null;
  className?: string;
}

function isMock(provider?: string | null, modelId?: string | null): boolean {
  const p = (provider ?? "").toLowerCase();
  const m = (modelId ?? "").toLowerCase();
  return p === "mock" || m.startsWith("mock");
}

/** Visible Gemini vs Mock label for reports / analysis results. */
export function AiProviderBadge({
  provider,
  modelId,
  className = "",
}: AiProviderBadgeProps) {
  const mock = isMock(provider, modelId);

  if (!provider && !modelId) {
    return null;
  }

  if (mock) {
    return (
      <span
        className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-950 ${className}`}
        title="Analiza zastępcza — nie korzysta z modelu Vision ani z obrazu satelitarnego"
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
        <span className="truncate">MOCK · nie patrzy na obraz</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-950 ${className}`}
      title={`Prawdziwy Gemini Vision · ${modelId ?? provider}`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
      <span className="truncate">
        Gemini Vision
        {modelId ? ` · ${modelId}` : ""}
      </span>
    </span>
  );
}
