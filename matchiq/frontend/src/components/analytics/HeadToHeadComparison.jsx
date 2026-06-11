function StatDuel({ label, left, right, format = (v) => v }) {
  const total = (left || 0) + (right || 0) || 1;
  const leftPct = ((left || 0) / total) * 100;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-400">
        <span className="stat font-bold text-white">{format(left)}</span>
        <span>{label}</span>
        <span className="stat font-bold text-white">{format(right)}</span>
      </div>
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-navy-900">
        <div className="bg-gold" style={{ width: `${leftPct}%` }} />
        <div className="bg-pitch flex-1" />
      </div>
    </div>
  );
}

export default function HeadToHeadComparison({ homeRow, awayRow, homeTeam, awayTeam }) {
  const left = homeRow || { points: 0, goals_for: 0, goals_against: 0, won: 0, played: 0 };
  const right = awayRow || { points: 0, goals_for: 0, goals_against: 0, won: 0, played: 0 };

  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-center justify-between">
        <span className="font-bold text-white">
          {homeTeam.flag} {homeTeam.code}
        </span>
        <span className="text-xs uppercase tracking-widest text-slate-500">Head to head</span>
        <span className="font-bold text-white">
          {awayTeam.code} {awayTeam.flag}
        </span>
      </div>
      <StatDuel label="Team rating" left={homeTeam.rating} right={awayTeam.rating} />
      <StatDuel label="Points" left={left.points} right={right.points} />
      <StatDuel label="Wins" left={left.won} right={right.won} />
      <StatDuel label="Goals scored" left={left.goals_for} right={right.goals_for} />
      <StatDuel label="Goals conceded" left={left.goals_against} right={right.goals_against} />
    </div>
  );
}
