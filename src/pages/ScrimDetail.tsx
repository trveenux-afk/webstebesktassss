import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase, type LineupPosition, type Player, type Scrim, type ScrimLineup, type ScrimStat } from "../lib/supabase";

type ScrimWithData = Scrim & { scrim_stats: (ScrimStat & { players: Player })[]; scrim_lineups: (ScrimLineup & { players: Player })[] };
const PITCH_POSITIONS: { position: LineupPosition; className: string }[] = [
  { position: "CF", className: "left-1/2 top-[8%] -translate-x-1/2" },
  { position: "LF", className: "left-[16%] top-[23%] -translate-x-1/2" },
  { position: "RF", className: "left-[84%] top-[23%] -translate-x-1/2" },
  { position: "CM", className: "left-1/2 top-[45%] -translate-x-1/2" },
  { position: "LB", className: "left-[16%] top-[68%] -translate-x-1/2" },
  { position: "RB", className: "left-[84%] top-[68%] -translate-x-1/2" },
  { position: "GK", className: "left-1/2 bottom-[7%] -translate-x-1/2" },
];

export default function ScrimDetail() {
  const { id } = useParams<{ id: string }>();
  const [scrim, setScrim] = useState<ScrimWithData | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { if (id) loadScrim(id); }, [id]);
  async function loadScrim(scrimId: string) { const { data } = await supabase.from("scrims").select("*, scrim_stats(*, players(*)), scrim_lineups(*, players(*))").eq("id", scrimId).maybeSingle(); setScrim(data as ScrimWithData | null); setLoading(false); }
  if (loading) return <div className="flex h-64 items-center justify-center text-white/40">Loading...</div>;
  if (!scrim) return <div className="rounded-xl border border-white/10 bg-bjk-dark p-12 text-center"><p className="text-white/50">Scrim not found.</p><Link to="/scrims" className="mt-4 inline-block text-sm text-white underline">Back to Scrims</Link></div>;
  const statsByPlayer = new Map(scrim.scrim_stats.map((stat) => [stat.player_id, stat]));
  const lineupByPosition = new Map(scrim.scrim_lineups.map((entry) => [entry.position, entry]));
  const lineupPlayers = scrim.scrim_lineups.map((entry) => ({ entry, stat: statsByPlayer.get(entry.player_id) }));

  return <div className="fade-in"><Link to="/scrims" className="mb-6 inline-block text-sm text-white/50 hover:text-white">&larr; Back to Scrims</Link><div className="mb-8 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-bjk-gray to-bjk-black p-8"><div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between"><div><h2 className="font-display text-3xl font-bold uppercase tracking-wide">vs {scrim.opponent}</h2><p className="mt-1 text-sm text-white/50">{new Date(scrim.scrim_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p></div><div className="text-center"><div className="font-display text-5xl font-bold">{scrim.team_score} <span className="text-white/30">-</span> {scrim.opponent_score}</div><p className="mt-1 text-xs uppercase tracking-wide text-white/50">{scrim.result}</p></div></div></div>
    <section className="mb-10"><h3 className="mb-4 font-display text-xl font-bold uppercase">Starting Lineup</h3><div className="relative mx-auto aspect-[4/3] max-w-3xl overflow-hidden rounded-2xl border-4 border-white/10 bg-[#303246]" style={{ backgroundImage: "linear-gradient(90deg, transparent 49.7%, rgba(255,255,255,.12) 50%, transparent 50.3%), linear-gradient(0deg, rgba(255,255,255,.12) 0 2px, transparent 2px 100%)", backgroundSize: "100% 100%, 100% 50%" }}><div className="absolute inset-[12%] rounded-xl border-2 border-white/15" /><div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/15 sm:h-24 sm:w-24" />{PITCH_POSITIONS.map(({ position, className }) => { const entry = lineupByPosition.get(position); const player = entry?.players; const stat = entry ? statsByPlayer.get(entry.player_id) : undefined; return <div key={position} className={`absolute flex w-[23%] max-w-28 flex-col items-center ${className}`}><div className="h-9 w-9 overflow-hidden rounded-full border-2 border-white/70 bg-black/60 shadow-xl sm:h-14 sm:w-14">{player?.photo_url ? <img src={player.photo_url} alt={player.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs font-bold text-white/50">{player?.name?.charAt(0) ?? position}</div>}</div><span className="mt-1 max-w-full truncate rounded bg-black/75 px-1 text-center text-[9px] font-bold uppercase sm:px-2 sm:text-[10px]">{player?.name ?? "Empty"}</span><span className="text-[9px] font-bold text-white/60">{position}</span>{player && <span className="whitespace-nowrap text-[8px] font-semibold text-white/75 sm:text-[10px]">G {stat?.goals ?? 0} &nbsp;A {stat?.assists ?? 0} &nbsp;T {stat?.tackles ?? 0} &nbsp;S {stat?.saves ?? 0}</span>}</div>; })}</div></section>
    <section><h3 className="mb-4 font-display text-xl font-bold uppercase">Player Stats</h3>{lineupPlayers.length === 0 ? <div className="rounded-xl border border-white/10 bg-bjk-dark p-8 text-center text-white/40">No lineup recorded for this scrim.</div> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{lineupPlayers.map(({ entry, stat }) => <div key={entry.id} className="overflow-hidden rounded-xl border border-white/10 bg-bjk-dark"><div className="flex items-center gap-4 border-b border-white/10 bg-bjk-black p-4">{entry.players?.photo_url ? <img src={entry.players.photo_url} alt={entry.players.name} className="h-14 w-14 rounded-full border-2 border-white/20 object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/20 bg-white/10 text-xl font-bold">{entry.players?.name.charAt(0) ?? "?"}</div>}<div><h4 className="font-display text-lg font-semibold uppercase">{entry.players?.name}</h4><p className="text-xs text-white/50">{entry.position}</p><p className="mt-1 text-xs font-semibold text-white/70">G {stat?.goals ?? 0} &nbsp;A {stat?.assists ?? 0} &nbsp;T {stat?.tackles ?? 0} &nbsp;S {stat?.saves ?? 0}</p></div></div></div>)}</div>}</section>
  </div>;
}
