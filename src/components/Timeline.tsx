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
    <div className="relative flex w-full items-center px-2 py-3">
      {/* Connector line (background) */}
      <div className="absolute left-6 right-6 top-1/2 h-px -translate-y-1/2 bg-white/10" />

      {/* Filled connector line (progress) */}
      {eras.length > 1 && (
        <div
          className="absolute left-6 top-1/2 h-px -translate-y-1/2 bg-cyan-400/60 transition-all duration-700 ease-out"
          style={{
            width: `calc(${(activeIndex / (eras.length - 1)) * 100}% - ${
              activeIndex === eras.length - 1 ? 0 : 0
            }px)`,
            maxWidth: "calc(100% - 3rem)",
          }}
        />
      )}

      {/* Era nodes */}
      <div className="relative z-10 flex w-full items-center justify-between">
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
              className="group flex flex-col items-center gap-2"
              title={`${era.label} (${era.year})`}
            >
              {/* Node circle */}
              <div
                className={cn(
                  "relative flex h-4 w-4 items-center justify-center rounded-full border-2 transition-all duration-300",
                  isActive && "scale-125",
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

              {/* Label */}
              <span
                className={cn(
                  "max-w-[80px] truncate text-center text-[10px] font-semibold uppercase tracking-[0.15em] transition-colors",
                  isActive
                    ? "text-cyan-300"
                    : isFilled
                      ? "text-white/70"
                      : "text-white/30"
                )}
              >
                {era.label}
              </span>

              {/* Year */}
              <span
                className={cn(
                  "-mt-1 text-[9px] tabular-nums transition-colors",
                  isActive ? "text-cyan-300/80" : "text-white/20"
                )}
              >
                {era.year < 0
                  ? `${Math.abs(era.year)} BC`
                  : era.year}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
