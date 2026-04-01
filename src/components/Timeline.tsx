import { cn } from "@/lib/utils";
import type { Era } from "@/types";

interface TimelineProps {
  eras: Era[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

export function Timeline({ eras, activeIndex, onSelect }: TimelineProps) {
  if (!eras.length) return null;

  return (
    <div className="flex w-full flex-col gap-2 px-2 py-3">
      {/* ── Dot row with connector lines ─────────────────────── */}
      <div className="relative flex w-full items-center justify-between">
        {/* Background connector line — runs through the dots only */}
        <div className="absolute left-2 right-2 top-1/2 h-px -translate-y-1/2 bg-white/10" />

        {/* Filled connector line (progress) */}
        {eras.length > 1 && (
          <div
            className="absolute left-2 top-1/2 h-px -translate-y-1/2 bg-cyan-400/60 transition-all duration-700 ease-out"
            style={{
              width: `${(activeIndex / (eras.length - 1)) * 100}%`,
              maxWidth: "calc(100% - 1rem)",
            }}
          />
        )}

        {/* Dot nodes */}
        {eras.map((era, i) => {
          const isActive = i === activeIndex;
          const isFilled = era.imageStatus === "ready";
          const isLoading = era.imageStatus === "loading";
          const isError = era.imageStatus === "error";
          const isPast = i <= activeIndex;

          return (
            <button
              key={era.id}
              type="button"
              onClick={() => onSelect(i)}
              className="group relative z-10 flex h-5 w-5 items-center justify-center"
              title={`${era.label} (${era.year})`}
            >
              <div
                className={cn(
                  "relative flex h-4 w-4 items-center justify-center rounded-full border-2 transition-all duration-300",
                  isActive && "scale-[1.35]",
                  isError
                    ? "border-red-400/60 bg-red-400/20"
                    : isLoading
                      ? "border-cyan-400/60 bg-transparent"
                      : isFilled
                        ? "border-cyan-400 bg-cyan-400"
                        : isPast
                          ? "border-white/40 bg-white/10"
                          : "border-white/20 bg-transparent"
                )}
              >
                {isLoading && (
                  <div className="absolute inset-0 animate-ping rounded-full bg-cyan-400/30" />
                )}
                {isActive && isFilled && (
                  <div className="absolute -inset-1 rounded-full bg-cyan-400/20 blur-sm" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Label row beneath the dots ────────────────────────── */}
      <div className="flex w-full items-start justify-between">
        {eras.map((era, i) => {
          const isActive = i === activeIndex;
          const isFilled = era.imageStatus === "ready";

          return (
            <button
              key={`label-${era.id}`}
              type="button"
              onClick={() => onSelect(i)}
              className="flex w-0 flex-1 flex-col items-center gap-0.5"
            >
              <span
                className={cn(
                  "max-w-[90px] truncate text-center text-[10px] font-semibold uppercase leading-tight tracking-[0.12em] transition-colors",
                  isActive
                    ? "text-cyan-300"
                    : isFilled
                      ? "text-white/70"
                      : "text-white/30"
                )}
              >
                {era.label}
              </span>
              <span
                className={cn(
                  "text-[9px] tabular-nums transition-colors",
                  isActive ? "text-cyan-300/80" : "text-white/20"
                )}
              >
                {era.year < 0 ? `${Math.abs(era.year)} BC` : era.year}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
