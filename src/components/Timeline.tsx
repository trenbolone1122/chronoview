import { cn } from "@/lib/utils";
import type { Era } from "@/types";

interface TimelineProps {
  eras: Era[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

export function Timeline({ eras, activeIndex, onSelect }: TimelineProps) {
  if (!eras.length) return null;

  const DOT_SIZE = 14;
  const ACTIVE_DOT_SIZE = 20;
  const MASK_PAD = 6; // extra px around dot for line masking

  return (
    <div className="w-full px-4 py-2">
      {/* Single unified row: each column contains dot + label vertically */}
      <div className="relative flex w-full items-start justify-between">
        {/* Background line — spans between first and last dot centers */}
        <div
          className="pointer-events-none absolute h-px bg-white/10"
          style={{
            top: ACTIVE_DOT_SIZE / 2,
            left: `${100 / (eras.length * 2)}%`,
            right: `${100 / (eras.length * 2)}%`,
          }}
        />

        {/* Progress line */}
        {eras.length > 1 && (
          <div
            className="pointer-events-none absolute h-px bg-cyan-400/60 transition-all duration-700 ease-out"
            style={{
              top: ACTIVE_DOT_SIZE / 2,
              left: `${100 / (eras.length * 2)}%`,
              width: `${(activeIndex / (eras.length - 1)) * (1 - 1 / eras.length) * 100}%`,
            }}
          />
        )}

        {/* Columns */}
        {eras.map((era, i) => {
          const isActive = i === activeIndex;
          const isFilled = era.imageStatus === "ready";
          const isLoading = era.imageStatus === "loading";
          const isError = era.imageStatus === "error";
          const isPast = i <= activeIndex;
          const dotSize = isActive ? ACTIVE_DOT_SIZE : DOT_SIZE;

          return (
            <button
              key={era.id}
              type="button"
              onClick={() => onSelect(i)}
              className="z-10 flex flex-col items-center gap-1.5"
              style={{ width: `${100 / eras.length}%` }}
            >
              {/* Dot container — fixed height to keep all dots aligned */}
              <div
                className="relative flex items-center justify-center"
                style={{ width: ACTIVE_DOT_SIZE, height: ACTIVE_DOT_SIZE }}
              >
                {/* Dark mask — hides line behind dot */}
                <div
                  className="absolute rounded-full bg-[#0a0a0a] transition-all duration-300"
                  style={{
                    width: dotSize + MASK_PAD,
                    height: dotSize + MASK_PAD,
                  }}
                />

                {/* Visible dot */}
                <div
                  className={cn(
                    "relative flex items-center justify-center rounded-full border-2 transition-all duration-300",
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
                  style={{ width: dotSize, height: dotSize }}
                >
                  {isLoading && (
                    <div className="absolute inset-0 animate-ping rounded-full bg-cyan-400/30" />
                  )}
                  {isActive && isFilled && (
                    <div className="absolute -inset-1.5 rounded-full bg-cyan-400/20 blur-sm" />
                  )}
                </div>
              </div>

              {/* Label + year — directly below its dot */}
              <div className="flex flex-col items-center gap-0.5">
                <span
                  className={cn(
                    "max-w-[140px] truncate text-center text-[11px] font-semibold uppercase leading-tight tracking-[0.04em] transition-colors",
                    isActive
                      ? "text-cyan-300"
                      : isFilled
                        ? "text-white/60"
                        : "text-white/25"
                  )}
                >
                  {era.label}
                </span>
                <span
                  className={cn(
                    "text-[10px] tabular-nums transition-colors",
                    isActive ? "text-cyan-300/70" : "text-white/20"
                  )}
                >
                  {era.year < 0 ? `${Math.abs(era.year)} BC` : era.year}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
