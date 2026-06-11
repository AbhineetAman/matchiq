import { useState } from "react";
import { toISTString } from "../../utils/timeUtils";

function shareText(match) {
  const home = match.home?.name || "TBD";
  const away = match.away?.name || "TBD";
  if (match.status === "LIVE" || match.status === "HT" || match.status === "FT") {
    return `⚽ ${home} ${match.home_score} - ${match.away_score} ${away} (${
      match.status === "FT" ? "Full time" : `${match.minute}'`
    }) — FIFA World Cup 2026 · via MatchIQ`;
  }
  return `⚽ ${home} vs ${away} — ${toISTString(match.kickoff_utc)} · ${match.venue} — FIFA World Cup 2026 · via MatchIQ`;
}

export default function ShareCard({ match }) {
  const [copied, setCopied] = useState(false);
  const text = shareText(match);
  const wa = `https://wa.me/?text=${encodeURIComponent(`${text}\n${window.location.origin}/matches`)}`;

  const copy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(`${text}\n${window.location.origin}/matches`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable (e.g. http) — ignore */
    }
  };

  return (
    <span className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <a
        href={wa}
        target="_blank"
        rel="noreferrer"
        title="Share on WhatsApp"
        className="text-pitch transition hover:scale-110"
      >
        🟢 WA
      </a>
      <button onClick={copy} title="Copy share text" className="text-slate-400 transition hover:text-gold">
        {copied ? "✓ copied" : "🔗"}
      </button>
    </span>
  );
}
