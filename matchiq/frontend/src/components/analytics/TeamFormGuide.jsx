const TONE = {
  W: "bg-pitch/20 text-pitch",
  D: "bg-amber/20 text-amber",
  L: "bg-danger/20 text-danger",
};

export default function TeamFormGuide({ form = [], size = "sm" }) {
  const box = size === "xs" ? "h-4 w-4 text-[9px]" : "h-6 w-6 text-xs";
  if (!form.length) {
    return <span className="text-xs text-slate-600">—</span>;
  }
  return (
    <span className="flex items-center gap-1" title={`Last ${form.length}: ${form.join(" ")}`}>
      {form.slice(-5).map((r, i) => (
        <span key={i} className={`grid place-items-center rounded font-bold ${box} ${TONE[r] || ""}`}>
          {r}
        </span>
      ))}
    </span>
  );
}
