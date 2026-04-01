import { cn } from "@/lib/utils";
import type { Era } from "@/types";

interface TimelineProps {
  eras: Era[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

/**
 * The line must NOT enter the circles. We achieve this by:
 * - Rendering the line segments BETWEEN dots (not a single spanning line)
 * - Each segment spans from one dot center to the next, with margin to clear the dot radius
 *
 * Alternative (simpler): Give each dot a solid bg ring that masks the line behind it.
 * We use the masking approach — a dark ring behind each dot hides the line.
 */

export function Timeline({ eras, activeIndex, onSelect }: TimelineProps) {
  if (!eras.length) return null;

  const DOT_SIZE = 14; // px — outer dot diameter (visible)
  const ACTIVE_DOT_SIZE = 20; // px — active dot is scaled up
  const ROW_H = 28; // px — row height (enough for active dot)
  const LINE_Y = ROW_H / 2;

  return (
    <div className="w-full px-6 py-2">
      {/* ── Dot + line row ─────────────────────────────────── */}
      <div
        className="relative flex w-full items-center justify-between"
        style={{ height: ROW_H }}
      >
        {/* Background line — full width behind everything */}
        <div
          className="pointer-events-none absolute left-0 right-0 h-px bg-white/10"
          style={{ top: LINE_Y }}
        />

        {/* Progress line */}
        {eras.length > 1 && (
          <div
            className="pointer-events-none absolute left-0 h-px bg-cyan-400/60 transition-all duration-700 ease-out"
            style={{
              top: LINE_Y,
              width: `${(activeIndex / (eras.length - 1)) * 100}%`,
            }}
          />
        )}

        {/* Dots — each has a dark masking ring so the line doesn't enter */}
        {eras.map((era, i) => {
          const isActive = i === activeIndex;
          const isFilled = era.imageStatus === "ready";
          const isLoading = era.imageStatus === "loading";
          const isError = era.imageStatus === "error";
          const isPast = i <= activeIndex;

          const size = isActive ? ACTIVE_DOT_SIZE : DOT_SIZE;

          return (
            <button
              key={era.id}
              type="button"
              onClick={() => onSelect(i)}
              className="relative z-10 flex items-center justify-center"
              style={{ width: ACTIVE_DOT_SIZE, height: ROW_H }}
            >
              {/* Dark masking circle — hides the line behind the dot */}
              <div
                className="absolute rounded-full bg-[#0a0a0a] transition-all duration-300"
                style={{
                  width: size + 6,
                  height: size + 6,
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
                style={{ width: size, height: size }}
              >
                {isLoading && (
                  <div className="absolute inset-0 animate-ping rounded-full bg-cyan-400/30" />
                )}
                {isActive && isFilled && (
                  <div className="absolute -inset-1.5 rounded-full bg-cyan-400/20 blur-sm" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Label row ─────────────────────────────────────── */}
      <div className="mt-2 flex w-full justify-between">
        {eras.map((era, i) => {
          const isActive = i === activeIndex;
          const isFilled = era.imageStatus === "ready";

          return (
            <button
              key={`lbl-${era.id}`}
              type="button"
              onClick={() => onSelect(i)}
              className="flex flex-col items-center gap-0.5"
              style={{ width: `${100 / eras.length}%` }}
            >
              <span
                className={cn(
                  "max-w-[130px] truncate text-center text-[11px] font-semibold uppercase leading-tight tracking-[0.06em] transition-colors",
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
            </button>
          );
        })}
      </div>
    </div>
  );
}
