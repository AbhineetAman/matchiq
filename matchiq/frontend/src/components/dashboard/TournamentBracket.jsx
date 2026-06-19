import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { quickPredict } from "../../utils/poissonModel";

const ROUND_NAMES = ["Round of 32", "Round of 16", "Quarter-finals", "Semi-finals", "Final"];

function TeamSlot({ team, picked, eliminated, pct, onPick }) {
  if (!team) {
    return <div className="flex h-9 items-center rounded-md bg-navy-900/60 px-2 text-xs text-slate-600">TBD</div>;
  }
  return (
    <button
      onClick={onPick}
      className={`flex h-9 w-full items-center justify-between gap-1 rounded-md px-2 text-left text-xs transition ${
        picked
          ? "bg-pitch/15 text-pitch font-bold"
          : eliminated
            ? "bg-navy-900/60 text-slate-600 line-through"
            : "bg-navy-900 text-slate-200 hover:bg-navy-700"
      }`}
    >
      <span className="truncate">
        {team.flag} {team.code || team.name.substring(0,3).toUpperCase()}
      </span>
      {pct !== undefined && <span className="stat shrink-0 text-[10px] text-slate-500">{pct}%</span>}
    </button>
  );
}

export default function TournamentBracket({ teams }) {
  const [groupWinners, setGroupWinners] = useState({});
  const [thirdPlaces, setThirdPlaces] = useState([]);
  const [picks, setPicks] = useState({});

  const groups = useMemo(() => {
    if (!teams) return {};
    const g = {};
    teams.forEach(t => {
      const grp = t.group || "A";
      if (!g[grp]) g[grp] = [];
      g[grp].push(t);
    });
    // Ensure all 12 groups A-L exist
    "ABCDEFGHIJKL".split("").forEach(l => { if (!g[l]) g[l] = []; });
    return g;
  }, [teams]);

  const toggleTeam = (team) => {
    const g = team.group || "A";
    const gw = groupWinners[g] || [];
    const isFirst = gw[0] && gw[0].id === team.id;
    const isSecond = gw[1] && gw[1].id === team.id;
    const isThird = thirdPlaces.some(t => t.id === team.id);

    if (isFirst) {
      // Removing 1st place shifts 2nd to 1st
      setGroupWinners(prev => ({ ...prev, [g]: gw.slice(1) }));
      setPicks({});
    } else if (isSecond) {
      setGroupWinners(prev => ({ ...prev, [g]: [gw[0]] }));
      setPicks({});
    } else if (isThird) {
      setThirdPlaces(prev => prev.filter(t => t.id !== team.id));
      setPicks({});
    } else {
      if (gw.length < 2) {
        setGroupWinners(prev => ({ ...prev, [g]: [...gw, team] }));
      } else if (thirdPlaces.length < 8) {
        setThirdPlaces(prev => [...prev, team]);
      } else {
        alert("You have already selected 8 third-place teams!");
      }
    }
  };

  const seeds = useMemo(() => {
    let allCount = 0;
    Object.values(groupWinners).forEach(arr => { allCount += arr.length; });
    allCount += thirdPlaces.length;
    
    if (allCount !== 32) return [];

    const getTeam = (group, rank) => {
      const g = groupWinners[group] || [];
      return g[rank - 1] || null;
    };

    const t3 = [...thirdPlaces]; // pool of 8 third-place teams
    const pop3 = () => t3.pop() || null;

    const pairs = [
      [getTeam("E", 1), pop3()],         // 1E vs 3rd
      [getTeam("I", 1), pop3()],         // 1I vs 3rd
      [getTeam("A", 2), getTeam("B", 2)], // 2A vs 2B
      [getTeam("F", 1), getTeam("C", 2)], // 1F vs 2C
      [getTeam("K", 2), getTeam("L", 2)], // 2K vs 2L
      [getTeam("H", 1), getTeam("J", 2)], // 1H vs 2J
      [getTeam("D", 1), pop3()],         // 1D vs 3rd
      [getTeam("G", 1), pop3()],         // 1G vs 3rd
      [getTeam("C", 1), getTeam("F", 2)], // 1C vs 2F
      [getTeam("E", 2), getTeam("I", 2)], // 2E vs 2I
      [getTeam("A", 1), pop3()],         // 1A vs 3rd
      [getTeam("L", 1), pop3()],         // 1L vs 3rd
      [getTeam("J", 1), getTeam("H", 2)], // 1J vs 2H
      [getTeam("D", 2), getTeam("G", 2)], // 2D vs 2G
      [getTeam("B", 1), pop3()],         // 1B vs 3rd
      [getTeam("K", 1), pop3()]          // 1K vs 3rd
    ];

    return pairs;
  }, [groupWinners, thirdPlaces]);

  const rounds = useMemo(() => {
    if (!seeds.length) return [];
    const all = [seeds];
    for (let r = 1; r < 5; r++) {
      const prev = all[r - 1];
      const matches = [];
      for (let m = 0; m < prev.length / 2; m++) {
        const a = picks[`${r - 1}-${2 * m}`] ?? null;
        const b = picks[`${r - 1}-${2 * m + 1}`] ?? null;
        matches.push([a, b]);
      }
      all.push(matches);
    }
    return all;
  }, [seeds, picks]);

  const champion = picks["4-0"];

  const pick = (r, m, team) => {
    setPicks((prev) => {
      const next = { ...prev, [`${r}-${m}`]: team };
      let cr = r + 1;
      let cm = Math.floor(m / 2);
      while (cr <= 4) {
        delete next[`${cr}-${cm}`];
        cm = Math.floor(cm / 2);
        cr += 1;
      }
      next[`${r}-${m}`] = team;
      return next;
    });
  };

  const autoFillGroupStage = () => {
    const gw = {};
    const thirds = [];
    let remaining = [];
    Object.keys(groups).forEach(g => {
      const sorted = [...groups[g]].sort((a,b) => b.rating - a.rating);
      gw[g] = sorted.slice(0, 2);
      if (sorted[2]) remaining.push(sorted[2]);
    });
    remaining.sort((a,b) => b.rating - a.rating);
    setGroupWinners(gw);
    setThirdPlaces(remaining.slice(0, 8));
    setPicks({});
  };

  const autoFillKnockouts = () => {
    if (seeds.length !== 16) return;
    const next = {};
    let current = seeds;
    for (let r = 0; r < 5; r++) {
      const upcoming = [];
      current.forEach(([a, b], m) => {
        let winner = null;
        if (a && b) {
          const p = quickPredict(a, b);
          winner = p.homeWin >= p.awayWin ? a : b;
        } else {
          winner = a || b;
        }
        next[`${r}-${m}`] = winner;
        if (m % 2 === 0) upcoming.push([winner, null]);
        else upcoming[upcoming.length - 1][1] = winner;
      });
      current = upcoming;
    }
    setPicks(next);
  };

  const resetAll = () => {
    setGroupWinners({});
    setThirdPlaces([]);
    setPicks({});
  };

  if (!teams || teams.length === 0) return null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-700 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">1. Group Stage Selection</h2>
          <p className="text-sm text-slate-400">
            Select the top 2 teams from each group, plus the 8 best 3rd-place teams (32 total).
          </p>
          <div className="mt-2 text-sm">
            <span className="text-pitch mr-4">Top 2 selected: {Object.values(groupWinners).flat().length} / 24</span>
            <span className="text-blue-400">3rd place selected: {thirdPlaces.length} / 8</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={autoFillGroupStage} className="btn-ghost text-sm">⚡ Auto-pick Groups</button>
          <button onClick={resetAll} className="btn-ghost text-sm">Reset</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {Object.entries(groups).map(([g, tms]) => (
          <div key={g} className="card p-3 space-y-2">
            <h3 className="text-center font-bold text-gold text-sm border-b border-navy-700 pb-1">Group {g}</h3>
            {tms.map(t => {
              const gw = groupWinners[g] || [];
              const isFirst = gw[0] && gw[0].id === t.id;
              const isSecond = gw[1] && gw[1].id === t.id;
              const isThird = thirdPlaces.some(x => x.id === t.id);
              
              const isSelected = isFirst || isSecond;
              return (
                <button
                  key={t.id}
                  onClick={() => toggleTeam(t)}
                  className={`w-full text-left text-xs p-1.5 rounded flex justify-between items-center transition ${
                    isSelected ? 'bg-pitch/20 text-pitch font-bold border border-pitch' : 
                    isThird ? 'bg-blue-500/20 text-blue-400 font-bold border border-blue-500' : 
                    'bg-navy-800 text-slate-300 hover:bg-navy-700 border border-transparent'
                  }`}
                >
                  <span className="truncate">{t.flag} {t.name}</span>
                  {isFirst && <span className="text-[9px] uppercase tracking-wider">1st</span>}
                  {isSecond && <span className="text-[9px] uppercase tracking-wider">2nd</span>}
                  {isThird && <span className="text-[9px] uppercase tracking-wider">3rd</span>}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {seeds.length === 16 && (
        <div className="mt-12 space-y-4 pt-8 border-t border-navy-700">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">2. Knockout Bracket</h2>
              <p className="text-sm text-slate-400">
                Tap a team to advance them through the Round of 32 to the Final.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={autoFillKnockouts} className="btn-ghost text-sm">⚡ Auto-fill Knockouts</button>
            </div>
          </div>

          {champion && (
            <div className="card flex items-center justify-center gap-3 border-gold/40 bg-gold/5 p-4 text-lg font-bold text-gold">
              🏆 Your champion: {champion.flag} {champion.name}
            </div>
          )}

          <div className="overflow-x-auto pb-3">
            <div className="flex min-w-[1000px] gap-4">
              {rounds.map((matches, r) => (
                <div key={r} className="flex flex-1 flex-col">
                  <div className="mb-2 text-center text-xs font-bold uppercase tracking-wider text-slate-400">
                    {ROUND_NAMES[r]}
                  </div>
                  <div className="flex flex-1 flex-col justify-around gap-2">
                    {matches.map(([a, b], m) => {
                      const winner = picks[`${r}-${m}`];
                      const probs = a && b ? quickPredict(a, b) : null;
                      return (
                        <div key={m} className="card space-y-1 p-1.5 border border-navy-600/50 hover:border-navy-500 transition-colors">
                          <TeamSlot
                            team={a}
                            picked={winner && a && winner.id === a.id}
                            eliminated={winner && a && winner.id !== a.id}
                            pct={probs ? Math.round(probs.homeWin * 100) : undefined}
                            onPick={a ? () => pick(r, m, a) : undefined}
                          />
                          <TeamSlot
                            team={b}
                            picked={winner && b && winner.id === b.id}
                            eliminated={winner && b && winner.id !== b.id}
                            pct={probs ? Math.round(probs.awayWin * 100) : undefined}
                            onPick={b ? () => pick(r, m, b) : undefined}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
