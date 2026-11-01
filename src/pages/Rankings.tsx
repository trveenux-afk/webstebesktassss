import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, type Player, type ScrimStat } from "../lib/supabase";

type Aggregated = {
  player_id: string;
  total_goals: number;
  total_assists: number;
  total_tackles: number;
  total_saves: number;
  scrim_count: number;
  avg_rating: number;
};

type RankingRow = Aggregated & { player: Player };

export default function Rankings() {
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"goals" | "assists" | "tackles" | "saves">("goals");

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const [playersRes, statsRes] = await Promise.all([
      supabase.from("players").select("*"),
      supabase.from("scrim_stats").select("*"),
    ]);

    const players = playersRes.data ?? [];
    const stats = (statsRes.data ?? []) as ScrimStat[];

    const byPlayer: Record<string, Aggregated> = {};
    for (const s of stats) {
      if (!byPlayer[s.player_id]) {
        byPlayer[s.player_id] = {
          player_id: s.player_id,
          total_goals: 0,
          total_assists: 0,
          total_tackles: 0,
          total_saves: 0,
          scrim_count: 0,
          avg_rating: 0,
        };
      }
      const a = byPlayer[s.player_id];
      a.total_goals += s.goals;
      a.total_assists += s.assists;
      a.total_tackles += s.tackles;
      a.total_saves += s.saves;
      a.scrim_count += 1;
      a.avg_rating += s.rating;
    }

    const result: RankingRow[] = Object.values(byPlayer)
      .map((a) => {
        const player = players.find((p) => p.id === a.player_id);
        return {
          ...a,
          avg_rating: a.scrim_count > 0 ? a.avg_rating / a.scrim_count : 0,
          player: player as Player,
        };
      })
      .filter((r) => r.player);

    setRows(result);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-white/40">
        Loading...
      </div>
    );
  }

  function sortValue(r: RankingRow): number {
    switch (tab) {
      case "goals": return r.total_goals;
      case "assists": return r.total_assists;
      case "tackles": return r.total_tackles;
      case "saves": return r.total_saves;
    }
  }

  const sorted = [...rows].sort((a, b) => {
    const val = sortValue(b) - sortValue(a);
    if (val === 0) return b.avg_rating - a.avg_rating;
    return val;
  });

  const tabConfig: { key: typeof tab; label: string; short: string }[] = [
    { key: "goals", label: "Top Scorers", short: "Goals" },
    { key: "assists", label: "Top Assists", short: "Assists" },
    { key: "tackles", label: "Top Tackles", short: "Tackles" },
    { key: "saves", label: "Top Saves", short: "Saves" },
  ];

  return (
    <div className="fade-in">
      <div className="mb-8">
        <h2 className="font-display text-3xl font-bold uppercase tracking-wide">
          Rankings
        </h2>
        <p className="mt-1 text-sm text-white/50">
          Leaderboards across all scrim matches
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {tabConfig.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === t.key
                ? "bg-white text-black"
                : "border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-bjk-dark p-12 text-center text-white/40">
          No stats recorded yet. Record some scrims to see rankings.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-bjk-dark text-left text-xs uppercase tracking-wide text-white/50">
                <th className="px-4 py-3 text-center">#</th>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3 text-center">Pos</th>
                <th className="px-4 py-3 text-center">Scrims</th>
                <th className="px-4 py-3 text-center">G</th>
                <th className="px-4 py-3 text-center">A</th>
                <th className="px-4 py-3 text-center">T</th>
                <th className="px-4 py-3 text-center">S</th>
                <th className="px-4 py-3 text-center font-bold text-white">
                  {tabConfig.find((t) => t.key === tab)?.short}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => {
                const highlightValue =
                  tab === "goals" ? r.total_goals
                  : tab === "assists" ? r.total_assists
                  : tab === "tackles" ? r.total_tackles
                  : tab === "saves" ? r.total_saves
                   : r.total_saves;

                return (
                  <tr
                    key={r.player_id}
                    className={`border-b border-white/5 transition-colors last:border-0 hover:bg-white/5 ${i === 0 ? "bg-yellow-400/5" : i === 1 ? "translate-y-1 bg-white/[0.03]" : i === 2 ? "translate-y-2 bg-orange-700/[0.04]" : ""}`}
                  >
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                          i === 0
                            ? "bg-yellow-400/20 text-yellow-400"
                            : i === 1
                              ? "bg-white/30 text-white"
                              : i === 2
                                ? "bg-orange-700/30 text-orange-400"
                                : "text-white/50"
                        }`}
                      >
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/player/${r.player_id}`}
                        className="flex items-center gap-3 hover:underline"
                      >
                        {r.player.photo_url ? (
                          <img
                            src={r.player.photo_url}
                            alt={r.player.name}
                            className={`rounded-full object-cover ${i === 0 ? "h-12 w-12" : i < 3 ? "h-10 w-10" : "h-8 w-8"}`}
                          />
                        ) : (
                          <div className={`flex items-center justify-center rounded-full bg-white/10 text-xs font-bold ${i === 0 ? "h-12 w-12" : i < 3 ? "h-10 w-10" : "h-8 w-8"}`}>
                            {r.player.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="font-medium">{r.player.name.replace(/\b\w/g, (letter) => letter.toUpperCase())}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-center text-white/60">{(r.player.positions?.length ? r.player.positions[0] : r.player.position)}</td>
                    <td className="px-4 py-3 text-center text-white/60">{r.scrim_count}</td>
                    <td className="px-4 py-3 text-center">{r.total_goals}</td>
                    <td className="px-4 py-3 text-center">{r.total_assists}</td>
                    <td className="px-4 py-3 text-center">{r.total_tackles}</td>
                    <td className="px-4 py-3 text-center">{r.total_saves}</td>
                    <td className="px-4 py-3 text-center font-display text-lg font-bold">
                      {highlightValue}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
