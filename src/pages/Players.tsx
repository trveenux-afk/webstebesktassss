import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, type Player, type SiteSettings } from "../lib/supabase";
import { useAuth } from "../lib/auth";

export default function Players() {
  const { isAdmin, profile } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [playersRes, settingsRes] = await Promise.all([
        supabase.from("players").select("*").order("overall", { ascending: false }),
        supabase.from("site_settings").select("*").eq("id", 1).maybeSingle(),
      ]);
      const nextPlayers = (playersRes.data ?? []) as Player[];
      setPlayers(nextPlayers);
      setSettings(settingsRes.data as SiteSettings | null);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex h-64 items-center justify-center text-white/40">Loading...</div>;

  return (
    <div className="fade-in">
      <div className="mb-8">
        <h2 className="font-display text-3xl font-bold uppercase tracking-wide">Squad</h2>
        <p className="mt-1 text-sm text-white/50">{players.length} players in the roster</p>
      </div>
      {players.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-bjk-dark p-12 text-center"><p className="text-white/40">No players yet. {isAdmin ? "Add players from the admin panel." : ""}</p></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {players.map((player) => (
            <PlayerCard key={player.id} player={player} settings={settings} isOwnCard={!!profile && player.user_id === profile.user_id} />
          ))}
        </div>
      )}
    </div>
  );
}

function PlayerCard({ player, settings, isOwnCard }: { player: Player; settings: SiteSettings | null; isOwnCard: boolean }) {
  const playerPositions = player.positions?.length ? player.positions : [player.position];
  const fit = settings?.object_fit ?? "cover";
  const pos = `${player.photo_position_x ?? 50}% ${player.photo_position_y ?? 50}%`;
  const zoom = player.photo_zoom || settings?.zoom || 100;

  return (
    <>
    <Link to={`/player/${player.id}`} className={`group block overflow-hidden rounded-xl border transition-all hover:shadow-2xl card-enter ${isOwnCard ? "border-blue-500/40 bg-gradient-to-br from-blue-950/50 to-bjk-dark" : "border-white/10 bg-bjk-dark hover:border-white/30"}`}>
      {isOwnCard && <div className="bg-blue-500/10 px-3 py-1 text-center text-[10px] font-bold uppercase tracking-widest text-blue-300">Your Card</div>}
      <div className="relative aspect-[4/3] overflow-hidden bg-bjk-black">
        {player.photo_url ? (
          <img src={player.photo_url} alt={player.name} style={{ objectFit: fit, objectPosition: pos, transform: `scale(${zoom / 100})` }} className="pointer-events-none h-full w-full" />
        ) : (
          <div className="flex h-full items-center justify-center text-6xl font-bold text-white/20">{player.name.charAt(0).toUpperCase()}</div>
        )}
        <div className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-black/70 font-display font-bold">{player.overall}</div>
        <div className="absolute right-2 top-2 flex max-w-[70%] flex-wrap justify-end gap-1">
          {playerPositions.map((position) => <span key={position} className="rounded-md border border-white/20 bg-black/70 px-1.5 py-1 text-[10px] font-semibold">{position}</span>)}
        </div>
      </div>
      <div className="p-3">
        <h3 className="truncate font-display text-lg font-semibold uppercase tracking-wide">{player.name}</h3>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-white/40">OVR {player.overall}</span>
          <span className="rounded-md border border-white/15 px-1.5 py-1 text-[10px] font-semibold text-white/60">{player.positions?.[0] ?? player.position}</span>
        </div>
      </div>
    </Link>
    </>
  );
}
