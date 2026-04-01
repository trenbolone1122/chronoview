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
  const MASK_PAD = 6;

  const cols = eras.length;
  const last = cols - 1;

  const dotPct = (i: number) => (last === 0 ? 50 : (i / last) * 100);

  return (
    <div className="w-full px-2 py-2">
      <div className="relative w-full" style={{ minHeight: ACTIVE_DOT_SIZE }}>
        {/* Background line — first dot to last dot */}
        {cols > 1 && (
          <div
            className="pointer-events-none absolute h-px bg-white/10"
            style={{ top: ACTIVE_DOT_SIZE / 2, left: "0%", right: "0%" }}
          />
        )}

        {/* Progress (lit) line */}
        {cols > 1 && activeIndex > 0 && (
          <div
            className="pointer-events-none absolute h-px bg-cyan-400/60 transition-all duration-700 ease-out"
            style={{
              top: ACTIVE_DOT_SIZE / 2,
              left: "0%",
              width: `${dotPct(activeIndex)}%`,
            }}
          />
        )}

        {eras.map((era, i) => {
          const isActive = i === activeIndex;
          const isFilled = era.imageStatus === "ready";
          const isLoading = era.imageStatus === "loading";
          const isError = era.imageStatus === "error";
          const isPast = i <= activeIndex;
          const dotSize = isActive ? ACTIVE_DOT_SIZE : DOT_SIZE;

          const isFirst = i === 0;
          const isLast = i === last && last > 0;

          /*
           * The button is always centered on the dot position via translateX(-50%).
           * The label <div> inside shifts to avoid clipping at edges:
           *   - First: shift right so its left edge starts at the dot center
           *   - Last:  shift left so its right edge ends at the dot center
           *   - Middle: no shift, stays centered
           */
          const labelStyle: React.CSSProperties = isFirst
            ? { transform: "translateX(calc(50% - 10px))" }
            : isLast
              ? { transform: "translateX(calc(-50% + 10px))" }
              : {};

          const labelAlign = isFirst
            ? "items-start text-left"
            : isLast
              ? "items-end text-right"
              : "items-center text-center";

          return (
            <button
              key={era.id}
              type="button"
              onClick={() => onSelect(i)}
              className="absolute z-10 flex flex-col items-center"
              style={{
                left: `${dotPct(i)}%`,
                top: 0,
                transform: "translateX(-50%)",
              }}
            >
              {/* Dot */}
              <div
                className="relative flex items-center justify-center"
                style={{ width: ACTIVE_DOT_SIZE, height: ACTIVE_DOT_SIZE }}
              >
                <div
                  className="absolute rounded-full bg-[#0a0a0a] transition-all duration-300"
                  style={{ width: dotSize + MASK_PAD, height: dotSize + MASK_PAD }}
                />
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

              {/* Label + year */}
              <div
                className={cn("mt-1.5 flex w-max flex-col gap-0.5", labelAlign)}
                style={labelStyle}
              >
                <span
                  className={cn(
                    "max-w-[160px] truncate text-[11px] font-semibold uppercase leading-tight tracking-[0.04em] transition-colors",
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

      {/* Spacer for labels below the absolutely positioned dots */}
      <div style={{ height: 36 }} />
    </div>
  );
}
