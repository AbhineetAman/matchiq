/* Touch-zone density map. The dataset has no event-level coordinates, so zones
   are derived deterministically from player id + position profile — stable per
   player, and FW/MF/DF/GK profiles look tactically sensible. */

const COLS = 6;
const ROWS = 4;

const PROFILE = {
  GK: (col) => (col === 0 ? 1 : col === 1 ? 0.35 : 0.05),
  DF: (col) => [0.7, 1, 0.6, 0.3, 0.15, 0.05][col],
  MF: (col) => [0.15, 0.45, 0.9, 1, 0.55, 0.2][col],
  FW: (col) => [0.05, 0.15, 0.35, 0.7, 1, 0.9][col],
};

function seeded(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export default function PlayerHeatmap({ player }) {
  const rand = seeded(player.id * 7919);
  const profile = PROFILE[player.position] || PROFILE.MF;
  const cells = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const centerBias = 1 - Math.abs(r - (ROWS - 1) / 2) / ROWS;
      cells.push(Math.min(1, profile(c) * (0.55 + 0.45 * centerBias) * (0.6 + rand() * 0.8)));
    }
  }

  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Touch zones — {player.name}</h3>
        <span className="text-[10px] uppercase tracking-widest text-slate-500">attack →</span>
      </div>
      <div
        className="relative grid gap-0.5 overflow-hidden rounded-lg border border-navy-600 bg-navy-900 p-1"
        style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, aspectRatio: "3 / 2" }}
      >
        {cells.map((v, i) => (
          <div
            key={i}
            className="rounded-sm"
            style={{ backgroundColor: `rgba(0, 255, 135, ${(0.06 + v * 0.65).toFixed(2)})` }}
          />
        ))}
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-white/15" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15" />
      </div>
    </div>
  );
}
