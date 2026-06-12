import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchHighlights } from "../../utils/apiClient";

export function useHighlights() {
  return useQuery({
    queryKey: ["highlights"],
    queryFn: fetchHighlights,
    staleTime: 15 * 60_000,
    refetchInterval: 15 * 60_000,
  });
}

/* Embedded official video for one match (used in the match modal).
   Falls back to a YouTube search link when no official video matched yet. */
export function MatchHighlights({ match }) {
  const { data } = useHighlights();
  const [active, setActive] = useState(0);
  if (!match.home || !match.away || !["FT", "LIVE", "HT"].includes(match.status)) return null;

  const entry = data?.find((h) => h.match_id === match.id);
  if (!entry || !entry.best) {
    if (match.status !== "FT") return null;
    const q = encodeURIComponent(`${match.home.name} vs ${match.away.name} FIFA World Cup 2026 highlights`);
    return (
      <a
        href={entry?.search_url || `https://www.youtube.com/results?search_query=${q}`}
        target="_blank"
        rel="noopener noreferrer"
        className="card flex items-center justify-center gap-2 p-4 text-sm text-slate-300 transition hover:border-gold/50"
      >
        🎬 Search match highlights on YouTube →
      </a>
    );
  }

  // FIFA disables third-party embedding on its clips, so we present a rich
  // thumbnail that opens the video on YouTube instead of an inline player.
  const video = entry.videos[active] || entry.best;
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-navy-700 px-4 py-2.5 font-bold text-white">🎬 Official highlights</div>
      <a
        href={video.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative block aspect-video w-full overflow-hidden bg-navy-900"
      >
        <img
          src={video.thumbnail}
          alt={video.title}
          className="h-full w-full object-cover transition group-hover:scale-105"
        />
        <span className="absolute inset-0 grid place-items-center bg-black/30 transition group-hover:bg-black/10">
          <span className="rounded-2xl bg-black/70 px-6 py-3 text-3xl">▶️</span>
        </span>
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 text-sm font-semibold text-white">
          {video.title}
        </span>
      </a>
      {entry.videos.length > 1 && (
        <div className="flex flex-wrap gap-2 p-3">
          {entry.videos.map((v, i) => (
            <button
              key={v.video_id}
              onClick={() => setActive(i)}
              className={`max-w-full truncate rounded-full px-3 py-1 text-xs transition ${
                i === active ? "bg-gold font-semibold text-navy-900" : "border border-navy-600 text-slate-300"
              }`}
            >
              {v.title.split("|")[0].trim()}
            </button>
          ))}
        </div>
      )}
      <div className="px-4 pb-2.5 text-[10px] uppercase tracking-wider text-slate-600">
        {video.channel} · opens on YouTube
      </div>
    </div>
  );
}

/* Strip of every recent match, newest first — official video thumbnail when
   matched, branded search-fallback card otherwise. */
export function HighlightsStrip() {
  const { data } = useHighlights();
  if (!data?.length) return null;
  const items = data.slice(0, 8);
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold text-white">🎬 Match highlights</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((h) => (
          <a
            key={h.match_id}
            href={h.best ? h.best.url : h.search_url}
            target="_blank"
            rel="noopener noreferrer"
            className="card group overflow-hidden transition hover:border-gold/50"
          >
            <div className="relative aspect-video overflow-hidden bg-navy-900">
              {h.best ? (
                <img
                  src={h.best.thumbnail}
                  alt={h.best.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-5xl">
                  {h.home_flag} <span className="text-2xl text-slate-600">vs</span> {h.away_flag}
                </div>
              )}
              <span className="absolute inset-0 grid place-items-center text-4xl opacity-80">▶️</span>
            </div>
            <div className="p-3">
              <div className="truncate text-sm font-semibold text-slate-200">
                {h.home} vs {h.away}
              </div>
              <div className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                {h.best ? h.best.title : "Find highlights on YouTube →"}
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
