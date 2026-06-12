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
        {team.flag} {team.code}
      </span>
      {pct !== undefined && <span className="stat shrink-0 text-[10px] text-slate-500">{pct}%</span>}
    </button>
  );
}

export default function TournamentBracket({ teams }) {
  const [picks, setPicks] = useState({});
  const [params] = useSearchParams();
  const loadedFromUrl = useRef(false);

  const seeds = useMemo(() => {
    const sorted = [...teams].sort((a, b) => b.rating - a.rating).slice(0, 32);
    const pairs = [];
    for (let i = 0; i < 16; i++) pairs.push([sorted[i], sorted[31 - i]]);
    return pairs;
  }, [teams]);

  // A shared link carries the picks as ?b=<31 winner ids> — rebuild them,
  // validating each id against the two teams actually feeding that slot.
  useEffect(() => {
    const encoded = params.get("b");
    if (!encoded || !seeds.length || loadedFromUrl.current) return;
    loadedFromUrl.current = true;
    const ids = encoded.split(".").map((s) => (s ? Number(s) : null));
    const next = {};
    let current = seeds;
    let idx = 0;
    for (let r = 0; r < 5; r++) {
      const upcoming = [];
      current.forEach(([a, b], m) => {
        const id = ids[idx++];
        const winner = a && a.id === id ? a : b && b.id === id ? b : null;
        if (winner) next[`${r}-${m}`] = winner;
        if (m % 2 === 0) upcoming.push([winner, null]);
        else upcoming[upcoming.length - 1][1] = winner;
      });
      current = upcoming;
    }
    setPicks(next);
  }, [params, seeds]);

  // Round r match m is fed by round r-1 matches 2m and 2m+1.
  const rounds = useMemo(() => {
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

  const autoFill = () => {
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

  const shareUrl = () => {
    const slots = [];
    for (let r = 0; r < 5; r++) {
      for (let m = 0; m < 16 >> r; m++) slots.push(picks[`${r}-${m}`]?.id ?? "");
    }
    return `${window.location.origin}/bracket?b=${slots.join(".").replace(/\.+$/, "")}`;
  };

  const copySummary = async () => {
    const lines = ["🏆 My FIFA 2026 bracket (via MatchIQ)"];
    if (champion) lines.push(`My champion: ${champion.flag} ${champion.name}`);
    const url = shareUrl();
    lines.push(`See my full bracket: ${url}`);
    const payload = lines.join("\n");
    if (navigator.share) {
      try {
        await navigator.share({ title: "My FIFA 2026 bracket", text: payload, url });
        return;
      } catch {
        /* user dismissed the share sheet — fall through to clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(payload);
      alert("Bracket link copied — anyone who opens it sees your full bracket!");
    } catch {
      prompt("Copy your bracket link:", url);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          Tap a team to advance them. Changing an earlier pick cascades and resets later rounds ("what-if" mode).
        </p>
        <div className="flex gap-2">
          <button onClick={autoFill} className="btn-ghost text-sm">
            ⚡ Auto-fill (model picks)
          </button>
          <button onClick={() => setPicks({})} className="btn-ghost text-sm">
            Reset
          </button>
          <button onClick={copySummary} className="btn-gold text-sm">
            Share bracket
          </button>
        </div>
      </div>

      {champion && (
        <div className="card flex items-center justify-center gap-3 border-gold/40 bg-gold/5 p-4 text-lg font-bold text-gold">
          🏆 Your champion: {champion.flag} {champion.name}
        </div>
      )}

      <div className="overflow-x-auto pb-3">
        <div className="flex min-w-[1100px] gap-4">
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
                    <div key={m} className="card space-y-1 p-1.5">
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
  );
}
