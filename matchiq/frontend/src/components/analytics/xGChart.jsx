import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function XGChart({ players, title = "Goals vs expected goals (xG)" }) {
  const data = [...players]
    .sort((a, b) => b.xg - a.xg)
    .slice(0, 8)
    .map((p) => ({ name: p.name.split(" ").slice(-1)[0], goals: p.goals, xG: p.xg }));

  if (!data.length) {
    return <div className="card p-6 text-center text-slate-400">No player data available.</div>;
  }

  return (
    <div className="card p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-200">{title}</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1C2438" />
          <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} stroke="#27314A" />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} stroke="#27314A" allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: "#131929", border: "1px solid #27314A", borderRadius: 8 }}
            labelStyle={{ color: "#e2e8f0" }}
            cursor={{ fill: "rgba(255,215,0,0.06)" }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="goals" fill="#FFD700" radius={[3, 3, 0, 0]} />
          <Bar dataKey="xG" fill="#00FF87" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
