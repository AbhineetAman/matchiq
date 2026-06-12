import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import LoadingSkeleton from "../components/common/LoadingSkeleton";
import { ErrorState } from "../components/common/ErrorBoundary";
import { useStandings } from "../hooks/useStandings";
import { fetchMatches, fetchPlayers } from "../utils/apiClient";

const GOLD = "#FFD700";
const GREEN = "#00FF87";
const GRID = "#27314A";
const TICK = { fill: "#94a3b8", fontSize: 11 };

const tooltipStyle = {
  contentStyle: { background: "#131929", border: `1px solid ${GRID}`, borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#e2e8f0" },
  cursor: { fill: "rgba(255,255,255,0.04)" },
};

function Kpi({ label, value, accent, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: index * 0.04 }}
      className="card p-4 text-center"
    >
      <div className={`stat text-2xl font-extrabold ${accent ? "text-pitch" : "text-gold"}`}>{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
    </motion.div>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <section className="card min-w-0 p-4 sm:p-5">
      <h2 className="font-bold text-white">{title}</h2>
      {subtitle && <p className="mb-3 mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      {children}
    </section>
  );
}

export default function Analytics() {
  const standings = useStandings();
  const matches = useQuery({ queryKey: ["all-matches"], queryFn: () => fetchMatches(), staleTime: 60_000 });
  const players = useQuery({
    queryKey: ["players-analytics"],
    queryFn: () => fetchPlayers({ sort: "goals", limit: 2000 }),
    staleTime: 5 * 60_000,
  });

  const data = useMemo(() => {
    if (!standings.data || !matches.data || !players.data) return null;

    const finished = matches.data.filter((m) => m.status === "FT");
    const live = matches.data.filter((m) => ["LIVE", "HT"].includes(m.status));
    const goals = finished.reduce((s, m) => s + (m.home_score ?? 0) + (m.away_score ?? 0), 0)
      + live.reduce((s, m) => s + (m.home_score ?? 0) + (m.away_score ?? 0), 0);

    const rows = standings.data.flatMap((g) => g.rows);

    const goalsByGroup = standings.data.map((g) => ({
      group: g.group,
      goals: g.rows.reduce((s, r) => s + r.goals_for, 0),
    }));

    const scorers = players.data
      .filter((p) => p.goals > 0 || p.assists > 0)
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists)
      .slice(0, 10)
      .map((p) => ({ name: `${p.team_flag} ${p.name.split(" ").slice(-1)[0]}`, goals: p.goals, assists: p.assists }));

    const attackDefence = rows
      .filter((r) => r.played > 0)
      .map((r) => ({
        name: `${r.team.flag} ${r.team.name}`,
        scored: r.goals_for,
        conceded: r.goals_against,
        points: r.points,
      }));

    const carded = players.data
      .filter((p) => (p.yellow_cards || 0) + (p.red_cards || 0) > 0)
      .sort((a, b) => (b.red_cards - a.red_cards) || (b.yellow_cards - a.yellow_cards))
      .slice(0, 8);
    const teamCards = Object.values(
      players.data.reduce((acc, p) => {
        const y = p.yellow_cards || 0, r = p.red_cards || 0;
        if (!y && !r) return acc;
        (acc[p.team_id] ||= { name: `${p.team_flag} ${p.team_name}`, yellow: 0, red: 0 });
        acc[p.team_id].yellow += y;
        acc[p.team_id].red += r;
        return acc;
      }, {})
    ).sort((a, b) => (b.red - a.red) || (b.yellow - a.yellow)).slice(0, 8);

    const squadAges = Object.values(
      players.data.reduce((acc, p) => {
        if (!p.age) return acc;
        (acc[p.team_id] ||= { name: `${p.team_flag} ${p.team_name}`, sum: 0, n: 0 });
        acc[p.team_id].sum += p.age;
        acc[p.team_id].n += 1;
        return acc;
      }, {})
    )
      .map((t) => ({ name: t.name, age: +(t.sum / t.n).toFixed(1) }))
      .sort((a, b) => a.age - b.age);

    return {
      kpis: {
        played: finished.length,
        live: live.length,
        goals,
        perMatch: finished.length ? (goals / (finished.length + live.length || 1)).toFixed(2) : "—",
        players: players.data.length,
        teams: rows.length,
      },
      goalsByGroup,
      scorers,
      carded,
      teamCards,
      attackDefence,
      youngest: squadAges.slice(0, 8),
      oldest: squadAges.slice(-8).reverse(),
    };
  }, [standings.data, matches.data, players.data]);

  if (standings.isLoading || matches.isLoading || players.isLoading) return <LoadingSkeleton count={8} />;
  if (standings.isError || matches.isError || players.isError) {
    return <ErrorState message="Could not load analytics." onRetry={() => { standings.refetch(); matches.refetch(); players.refetch(); }} />;
  }
  if (!data) return <LoadingSkeleton count={8} />;

  const { kpis } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white">📈 Tournament Analytics</h1>
        <p className="mt-1 text-sm text-slate-400">
          Live metrics computed from real World Cup 2026 data — updates as matches are played.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi index={0} label="Matches played" value={kpis.played} />
        <Kpi index={1} label="Live right now" value={kpis.live} accent />
        <Kpi index={2} label="Goals scored" value={kpis.goals} />
        <Kpi index={3} label="Goals / match" value={kpis.perMatch} />
        <Kpi index={4} label="Players" value={kpis.players} />
        <Kpi index={5} label="Teams" value={kpis.teams} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="🥇 Golden Boot race" subtitle="Top 10 by goals, assists as tiebreak">
          {data.scorers.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.scorers} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid stroke={GRID} horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={TICK} />
                <YAxis type="category" dataKey="name" width={130} tick={{ ...TICK, fontSize: 10 }} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="goals" fill={GOLD} radius={[0, 4, 4, 0]} />
                <Bar dataKey="assists" fill={GREEN} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-[300px] place-items-center text-sm text-slate-500">
              No goals yet — check back after the first matches finish.
            </div>
          )}
        </ChartCard>

        <ChartCard title="⚽ Goals by group" subtitle="Total goals scored in each of the 12 groups">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.goalsByGroup} margin={{ right: 8 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="group" tick={TICK} />
              <YAxis allowDecimals={false} tick={TICK} width={28} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="goals" radius={[4, 4, 0, 0]}>
                {data.goalsByGroup.map((g, i) => (
                  <Cell key={g.group} fill={i % 2 ? GREEN : GOLD} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="⚔️ Attack vs defence" subtitle="Goals scored vs conceded — bubble size = points. Top-left is where champions live.">
          {data.attackDefence.length ? (
            <ResponsiveContainer width="100%" height={320}>
              <ScatterChart margin={{ left: -10, right: 16, top: 10 }}>
                <CartesianGrid stroke={GRID} />
                <XAxis dataKey="conceded" name="Conceded" allowDecimals={false} tick={TICK}
                  label={{ value: "conceded →", position: "insideBottomRight", fill: "#64748b", fontSize: 10, dy: 8 }} />
                <YAxis dataKey="scored" name="Scored" allowDecimals={false} tick={TICK}
                  label={{ value: "scored →", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 10 }} />
                <ZAxis dataKey="points" range={[40, 240]} name="Points" />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(v, n) => [v, n]}
                  labelFormatter={() => ""}
                  content={({ payload }) =>
                    payload?.length ? (
                      <div style={tooltipStyle.contentStyle} className="p-2">
                        <div className="text-xs font-bold text-white">{payload[0].payload.name}</div>
                        <div className="text-xs text-slate-400">
                          {payload[0].payload.scored} scored · {payload[0].payload.conceded} conceded · {payload[0].payload.points} pts
                        </div>
                      </div>
                    ) : null
                  }
                />
                <Scatter data={data.attackDefence} fill={GOLD} fillOpacity={0.75} />
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-[320px] place-items-center text-sm text-slate-500">
              Appears once group games are played.
            </div>
          )}
        </ChartCard>

        <ChartCard title="🟨🟥 Discipline watch" subtitle="Cards from live match data — bookings, sending-offs and team totals">
          {data.carded.length ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="min-w-0">
                <div className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">Players</div>
                <div className="space-y-1.5">
                  {data.carded.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 text-xs">
                      <span className="min-w-0 flex-1 truncate text-slate-300">{p.team_flag} {p.name}</span>
                      <span className="stat shrink-0">
                        {p.yellow_cards > 0 && <span className="text-amber">🟨{p.yellow_cards}</span>}
                        {p.red_cards > 0 && <span className="text-danger"> 🟥{p.red_cards}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="min-w-0">
                <div className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">Teams</div>
                <div className="space-y-1.5">
                  {data.teamCards.map((t) => (
                    <div key={t.name} className="flex items-center gap-2 text-xs">
                      <span className="min-w-0 flex-1 truncate text-slate-300">{t.name}</span>
                      <span className="stat shrink-0">
                        {t.yellow > 0 && <span className="text-amber">🟨{t.yellow}</span>}
                        {t.red > 0 && <span className="text-danger"> 🟥{t.red}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid h-[160px] place-items-center text-sm text-slate-500">
              No cards shown yet — referees have been kind.
            </div>
          )}
        </ChartCard>

        <ChartCard title="🎂 Squad age profile" subtitle="Average squad age — youngest vs most experienced">
          <div className="grid grid-cols-2 gap-4">
            {[["Youngest", data.youngest, GREEN], ["Most experienced", data.oldest, GOLD]].map(([label, list, color]) => (
              <div key={label} className="min-w-0">
                <div className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
                <div className="space-y-1.5">
                  {list.map((t) => (
                    <div key={t.name} className="flex items-center gap-2 text-xs">
                      <span className="min-w-0 flex-1 truncate text-slate-300">{t.name}</span>
                      <span className="stat font-bold" style={{ color }}>{t.age}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
