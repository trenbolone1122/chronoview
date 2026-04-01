import { useState } from "react";
import { Clock, Calendar, Mountain, PersonStanding } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ViewMode, ImageStyle } from "@/types";

interface ModePickerProps {
  cityName: string;
  onSelect: (mode: ViewMode, imageStyle: ImageStyle, customYear?: number) => void;
  onClose: () => void;
}

export function ModePicker({ cityName, onSelect, onClose }: ModePickerProps) {
  const [yearInput, setYearInput] = useState("");
  const [isBc, setIsBc] = useState(false);
  const [showYearInput, setShowYearInput] = useState(false);
  const [imageStyle, setImageStyle] = useState<ImageStyle>("aerial");

  const handleYearSubmit = () => {
    const raw = parseInt(yearInput, 10);
    if (isNaN(raw) || raw <= 0) return;
    const y = isBc ? -raw : raw;
    onSelect("custom-year", imageStyle, y);
  };

  const parsedYear = parseInt(yearInput, 10);
  const isValidYear = !isNaN(parsedYear) && parsedYear > 0;
  const displayYear = isValidYear
    ? isBc
      ? `${parsedYear} BC`
      : `${parsedYear}`
    : "...";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0a0a0a]/95 p-6 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <h3 className="mb-1 text-lg font-semibold tracking-tight text-white">
          {cityName || "This location"}
        </h3>
        <p className="mb-5 text-xs text-white/40">How would you like to explore?</p>

        {!showYearInput ? (
          <div className="flex flex-col gap-4">
            {/* ── Image style toggle ────────────────────────────── */}
            <div>
              <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.15em] text-white/30">
                Image style
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setImageStyle("aerial")}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-all",
                    imageStyle === "aerial"
                      ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300"
                      : "border-white/10 bg-white/[0.03] text-white/50 hover:border-white/20 hover:bg-white/[0.05]"
                  )}
                >
                  <Mountain className="h-4 w-4 shrink-0" />
                  <div>
                    <div className="text-xs font-medium">Aerial</div>
                    <div className="text-[10px] opacity-60">Bird's-eye cityscape</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setImageStyle("street")}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-all",
                    imageStyle === "street"
                      ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300"
                      : "border-white/10 bg-white/[0.03] text-white/50 hover:border-white/20 hover:bg-white/[0.05]"
                  )}
                >
                  <PersonStanding className="h-4 w-4 shrink-0" />
                  <div>
                    <div className="text-xs font-medium">Street View</div>
                    <div className="text-[10px] opacity-60">Life at street level</div>
                  </div>
                </button>
              </div>
            </div>

            {/* ── Divider ───────────────────────────────────────── */}
            <div className="h-px bg-white/5" />

            {/* ── View mode choices ─────────────────────────────── */}
            <div className="flex flex-col gap-3">
              {/* Travel through eras */}
              <button
                type="button"
                onClick={() => onSelect("eras", imageStyle)}
                className="group flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3.5 text-left transition-all hover:border-cyan-400/30 hover:bg-cyan-400/[0.05]"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-400 transition-colors group-hover:bg-cyan-400/20">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white/90">Travel through eras</div>
                  <div className="text-[11px] text-white/35">5-6 historical periods with AI imagery</div>
                </div>
              </button>

              {/* Custom year */}
              <button
                type="button"
                onClick={() => setShowYearInput(true)}
                className="group flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3.5 text-left transition-all hover:border-cyan-400/30 hover:bg-cyan-400/[0.05]"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-400 transition-colors group-hover:bg-cyan-400/20">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white/90">Enter a custom year</div>
                  <div className="text-[11px] text-white/35">See this place in any specific year</div>
                </div>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                value={yearInput}
                onChange={(e) => setYearInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleYearSubmit()}
                placeholder={isBc ? "e.g. 500, 3000" : "e.g. 1850, 2020"}
                autoFocus
                className="w-full appearance-none rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/20 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
              />
              <button
                type="button"
                onClick={() => setIsBc(!isBc)}
                className={cn(
                  "shrink-0 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-all",
                  isBc
                    ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-300"
                    : "border-white/10 bg-white/5 text-white/40 hover:bg-white/10"
                )}
              >
                BC
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowYearInput(false); setIsBc(false); }}
                className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/50 transition-colors hover:bg-white/5"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleYearSubmit}
                disabled={!isValidYear}
                className="flex-1 rounded-lg bg-cyan-400/20 px-3 py-2 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-400/30 disabled:opacity-40 disabled:hover:bg-cyan-400/20"
              >
                Explore {displayYear}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
