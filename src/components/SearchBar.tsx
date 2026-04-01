import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X, Loader2 } from "lucide-react";

interface SearchResult {
  id: string;
  placeName: string;
  fullText: string;
  lat: number;
  lng: number;
}

interface SearchBarProps {
  mapboxToken: string;
  onSelect: (lat: number, lng: number) => void;
}

export function SearchBar({ mapboxToken, onSelect }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  // Forward geocode via Mapbox Geocoding API
  const search = useCallback(
    async (q: string) => {
      if (!q.trim() || !mapboxToken) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(
          q
        )}&access_token=${mapboxToken}&limit=5&language=en&types=place,locality,region`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Geocoding failed");
        const data = await res.json();
        const features = data.features ?? [];
        setResults(
          features.map(
            (f: {
              id: string;
              properties: { name: string; full_address?: string; place_formatted?: string };
              geometry: { coordinates: [number, number] };
            }) => ({
              id: f.id,
              placeName: f.properties.name,
              fullText: f.properties.full_address || f.properties.place_formatted || f.properties.name,
              lng: f.geometry.coordinates[0],
              lat: f.geometry.coordinates[1],
            })
          )
        );
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [mapboxToken]
  );

  // Debounced search
  const handleChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!value.trim()) {
        setResults([]);
        setOpen(false);
        return;
      }
      debounceRef.current = setTimeout(() => search(value), 300);
    },
    [search]
  );

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (result: SearchResult) => {
    setQuery(result.placeName);
    setOpen(false);
    onSelect(result.lat, result.lng);
  };

  return (
    <div ref={containerRef} className="relative w-72">
      {/* Input */}
      <div
        className={`flex items-center gap-2 rounded-lg border bg-black/80 px-3 py-2 backdrop-blur-lg transition-colors ${
          focused
            ? "border-cyan-400/50 ring-1 ring-cyan-400/25"
            : "border-white/25 hover:border-white/40"
        }`}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-cyan-400/60" />
        ) : (
          <Search className="h-3.5 w-3.5 shrink-0 text-white/50" />
        )}
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => {
            setFocused(true);
            if (results.length > 0) setOpen(true);
          }}
          onBlur={() => setFocused(false)}
          placeholder="Search for a place..."
          className="w-full bg-transparent text-xs text-white placeholder:text-white/40 focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults([]);
              setOpen(false);
            }}
            className="shrink-0 text-white/25 transition-colors hover:text-white/60"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Dropdown results */}
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-white/10 bg-[#0d0d0d]/95 shadow-xl backdrop-blur-xl">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => handleSelect(r)}
              className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-white/5"
            >
              <span className="text-xs font-medium text-white/80">
                {r.placeName}
              </span>
              <span className="text-[10px] text-white/30">{r.fullText}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
