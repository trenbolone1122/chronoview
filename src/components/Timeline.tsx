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
    <div className="relative flex w-full items-start justify-between px-2 py-3">
      {/* Connector line (background) — positioned at the vertical center of the dots */}
      <div className="pointer-events-none absolute left-6 right-6 top-[12px] h-px bg-white/10" />

      {/* Filled connector line (progress) */}
      {eras.length > 1 && (
        <div
          className="pointer-events-none absolute left-6 top-[12px] h-px bg-cyan-400/60 transition-all duration-700 ease-out"
          style={{
            width: `calc(${(activeIndex / (eras.length - 1)) * 100}% * (1 - 3rem / 100%) + 0px)`,
            maxWidth: "calc(100% - 3rem)",
          }}
        />
      )}

      {/* Era columns: dot + label + year stacked vertically */}
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
            className="group relative z-10 flex flex-col items-center gap-1.5"
          >
            {/* Dot */}
            <div
              className={cn(
                "relative flex h-[24px] w-[24px] items-center justify-center"
              )}
            >
              <div
                className={cn(
                  "relative flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 transition-all duration-300",
                  isActive && "scale-[1.4]",
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
                  <div className="absolute -inset-1.5 rounded-full bg-cyan-400/20 blur-sm" />
                )}
              </div>
            </div>

            {/* Label — directly below dot */}
            <span
              className={cn(
                "max-w-[80px] text-center text-[9px] font-semibold uppercase leading-tight tracking-[0.1em] transition-colors",
                isActive
                  ? "text-cyan-300"
                  : isFilled
                    ? "text-white/60"
                    : "text-white/25"
              )}
            >
              {era.label}
            </span>

            {/* Year */}
            <span
              className={cn(
                "-mt-1 text-[8px] tabular-nums transition-colors",
                isActive ? "text-cyan-300/70" : "text-white/15"
              )}
            >
              {era.year < 0 ? `${Math.abs(era.year)} BC` : era.year}
            </span>
          </button>
        );
      })}
    </div>
  );
}
