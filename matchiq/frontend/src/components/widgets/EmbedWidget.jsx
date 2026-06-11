import { useMemo, useState } from "react";
import { API_URL } from "../../utils/apiClient";

const GROUPS = "ABCDEFGHIJKL".split("");

export default function EmbedWidget() {
  const [type, setType] = useState("ticker");
  const [theme, setTheme] = useState("dark");
  const [group, setGroup] = useState("A");
  const [copied, setCopied] = useState(false);

  const src = useMemo(() => {
    const params = new URLSearchParams({ type, theme, api: API_URL });
    if (type === "standings") params.set("group", group);
    return `${window.location.origin}/embed.html?${params.toString()}`;
  }, [type, theme, group]);

  const code = `<iframe src="${src}" width="100%" height="${type === "ticker" ? 120 : 320}" frameborder="0" style="border-radius:12px;overflow:hidden" title="MatchIQ FIFA 2026 widget"></iframe>`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card space-y-5 p-5">
        <h3 className="font-bold text-white">Configure your widget</h3>

        <div>
          <div className="mb-2 text-sm text-slate-400">Widget type</div>
          <div className="flex gap-2">
            {[
              ["ticker", "⚽ Live score ticker"],
              ["standings", "📊 Group standings"],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setType(value)}
                className={`rounded-lg px-4 py-2 text-sm transition ${
                  type === value ? "bg-gold font-semibold text-navy-900" : "border border-navy-600 text-slate-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm text-slate-400">Theme</div>
          <div className="flex gap-2">
            {["dark", "light"].map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`rounded-lg px-4 py-2 text-sm capitalize transition ${
                  theme === t ? "bg-gold font-semibold text-navy-900" : "border border-navy-600 text-slate-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {type === "standings" && (
          <div>
            <div className="mb-2 text-sm text-slate-400">Group</div>
            <select value={group} onChange={(e) => setGroup(e.target.value)} className="input-dark">
              {GROUPS.map((g) => (
                <option key={g} value={g}>
                  Group {g}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <div className="mb-2 text-sm text-slate-400">Embed code — paste into any article or CMS</div>
          <textarea
            readOnly
            value={code}
            rows={4}
            className="input-dark w-full font-mono text-xs"
            onFocus={(e) => e.target.select()}
          />
          <button onClick={copy} className="btn-gold mt-2 w-full">
            {copied ? "✓ Copied to clipboard" : "Copy embed code"}
          </button>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="mb-3 font-bold text-white">Live preview</h3>
        <iframe
          key={src}
          src={src}
          title="MatchIQ widget preview"
          width="100%"
          height={type === "ticker" ? 120 : 320}
          className="rounded-xl border border-navy-600"
        />
        <p className="mt-3 text-xs text-slate-500">
          The widget is a standalone HTML file (no React) — it loads in under 50 KB and works on any site,
          including WordPress, Medium embeds and custom CMSs.
        </p>
      </div>
    </div>
  );
}
