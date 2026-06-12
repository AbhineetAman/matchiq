import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import LoadingSkeleton from "../common/LoadingSkeleton";
import { fetchNews } from "../../utils/apiClient";

function timeAgo(iso) {
  if (!iso) return "";
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function FeedCard({ title, children }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="card min-w-0 overflow-hidden"
    >
      <div className="border-b border-navy-700 px-4 py-2.5 font-bold text-white">{title}</div>
      {children}
    </motion.section>
  );
}

export default function TournamentBuzz() {
  const { data, isLoading } = useQuery({
    queryKey: ["tournament-buzz"],
    queryFn: fetchNews,
    staleTime: 10 * 60_000,
    refetchInterval: 10 * 60_000,
  });

  if (isLoading) return <LoadingSkeleton variant="table" count={3} />;
  if (!data || (!data.news.length && !data.discussions.length)) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {data.topics.length > 0 && (
        <FeedCard title="🔥 Trending now">
          <div className="flex flex-wrap gap-2 p-4">
            {data.topics.map((t) => (
              <span
                key={t.topic}
                className="flex items-center gap-1.5 rounded-full border border-navy-600 bg-navy-900 px-3 py-1.5 text-sm text-slate-200"
              >
                {t.topic}
                <span className="stat rounded bg-gold/10 px-1.5 text-xs font-bold text-gold">{t.count}</span>
              </span>
            ))}
          </div>
          <div className="px-4 pb-3 text-[10px] uppercase tracking-wider text-slate-600">
            Mentions across headlines · refreshes every 10 min
          </div>
        </FeedCard>
      )}

      {data.news.length > 0 && (
        <FeedCard title="📰 Latest headlines">
          <div className="divide-y divide-navy-700/50">
            {data.news.slice(0, 6).map((n) => (
              <a
                key={n.url}
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-4 py-2.5 transition hover:bg-navy-700/40"
              >
                <div className="line-clamp-2 text-sm text-slate-200">{n.title}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {n.source}
                  {n.published ? ` · ${timeAgo(n.published)}` : ""}
                </div>
              </a>
            ))}
          </div>
        </FeedCard>
      )}

      {data.discussions.length > 0 && (
        <FeedCard title="💬 Fan discussions">
          <div className="divide-y divide-navy-700/50">
            {data.discussions.slice(0, 6).map((d) => (
              <a
                key={d.url}
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-4 py-2.5 transition hover:bg-navy-700/40"
              >
                <div className="line-clamp-2 text-sm text-slate-200">{d.title}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {d.subreddit}
                  {d.score > 0 ? ` · ⬆ ${d.score}` : ""}
                  {d.comments > 0 ? ` · 💬 ${d.comments}` : ""}
                  {d.published ? ` · ${timeAgo(d.published)}` : ""}
                </div>
              </a>
            ))}
          </div>
        </FeedCard>
      )}
    </div>
  );
}
