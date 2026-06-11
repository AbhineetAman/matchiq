import { motion } from "framer-motion";
import TeamFormGuide from "../analytics/TeamFormGuide";

const ROW_TONE = {
  qualified: "border-l-2 border-l-pitch bg-pitch/5",
  playoff: "border-l-2 border-l-amber bg-amber/5",
  out: "border-l-2 border-l-danger/60",
};

function rowTone(position) {
  if (position <= 2) return ROW_TONE.qualified;
  if (position === 3) return ROW_TONE.playoff;
  return ROW_TONE.out;
}

export default function GroupStandingsTable({ group, compact = false }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-navy-700 px-4 py-3">
        <h3 className="font-bold text-white">Group {group.group}</h3>
        {!compact && <span className="text-xs text-slate-500">P · W · D · L · GD · Pts</span>}
      </div>
      <table className="w-full text-sm">
        <tbody>
          {group.rows.map((row) => (
            <motion.tr
              key={row.team.id}
              layout
              transition={{ duration: 0.3 }}
              className={`border-b border-navy-700/50 last:border-0 ${rowTone(row.position)}`}
            >
              <td className="w-8 px-3 py-2.5 text-center stat text-slate-500">{row.position}</td>
              <td className="px-1 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-lg leading-none">{row.team.flag}</span>
                  <span className="truncate font-medium text-slate-200">{row.team.name}</span>
                </div>
              </td>
              {!compact && (
                <>
                  <td className="stat px-1 py-2.5 text-center text-slate-400">{row.played}</td>
                  <td className="stat hidden px-1 py-2.5 text-center text-slate-400 sm:table-cell">{row.won}</td>
                  <td className="stat hidden px-1 py-2.5 text-center text-slate-400 sm:table-cell">{row.drawn}</td>
                  <td className="stat hidden px-1 py-2.5 text-center text-slate-400 sm:table-cell">{row.lost}</td>
                  <td className="stat px-1 py-2.5 text-center text-slate-400">
                    {row.goal_diff > 0 ? `+${row.goal_diff}` : row.goal_diff}
                  </td>
                  <td className="hidden px-2 py-2.5 md:table-cell">
                    <TeamFormGuide form={row.form} size="xs" />
                  </td>
                </>
              )}
              <td className="stat px-3 py-2.5 text-center font-bold text-gold">{row.points}</td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
