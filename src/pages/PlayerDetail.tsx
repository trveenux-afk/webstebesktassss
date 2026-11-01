import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { PLAYER_POSITIONS, supabase, type Player, type PlayerPosition, type Profile, type Scrim, type ScrimStat, type SiteSettings } from "../lib/supabase";
import { useAuth } from "../lib/auth";

type StatWithScrim = ScrimStat & { scrims: Scrim };
export default function PlayerDetail() {
  const { isAdmin } = useAuth();
  const { id } = useParams<{ id: string }>();
  const [player, setPlayer] = useState<Player | null>(null);
  const [linkedProfile, setLinkedProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<StatWithScrim[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [positions, setPositions] = useState<PlayerPosition[]>(["CM"]);
  const [overall, setOverall] = useState(75);
  const [photoUrl, setPhotoUrl] = useState("");
  const [cardUrl, setCardUrl] = useState("");
  const [msg, setMsg] = useState("");
  const [expandedPhoto, setExpandedPhoto] = useState(false);

  useEffect(() => { if (id) loadAll(id); }, [id]);

  async function loadAll(playerId: string) {
    const [p, s, settingsRes] = await Promise.all([
      supabase.from("players").select("*").eq("id", playerId).maybeSingle(),
      supabase.from("scrim_stats").select("*, scrims(*)").eq("player_id", playerId).order("created_at", { ascending: false }),
      supabase.from("site_settings").select("*").eq("id", 1).maybeSingle(),
    ]);
    const nextPlayer = p.data as Player | null;
    setPlayer(nextPlayer);
    if (nextPlayer?.user_id) {
      const { data: profileData } = await supabase.from("profiles").select("*").eq("user_id", nextPlayer.user_id).maybeSingle();
      setLinkedProfile(profileData as Profile | null);
    } else {
      setLinkedProfile(null);
    }
    if (p.data) {
      setPositions(((p.data as Player).positions?.length ? (p.data as Player).positions : [(p.data as Player).position]) as PlayerPosition[]);
      setOverall((p.data as Player).overall);
      setPhotoUrl((p.data as Player).photo_url ?? "");
      setCardUrl((p.data as Player).card_url ?? "");
    }
    setStats((s.data ?? []) as StatWithScrim[]);
    setSettings(settingsRes.data as SiteSettings | null);
    setLoading(false);
  }

  function togglePosition(position: PlayerPosition) {
    setPositions((current) => current.includes(position) ? current.filter((item) => item !== position) : [...current, position]);
  }

  async function savePlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!id || positions.length === 0) return;
    const { error } = await supabase.rpc("update_player_photo", { p_player_id: id, p_photo_url: photoUrl.trim() || null, p_card_url: cardUrl.trim() || null });
    if (error) { setMsg("Could not save changes."); return; }
    await supabase.from("players").update({ position: positions[0], positions, overall }).eq("id", id);
    setMsg("Changes saved.");
    setEditing(false);
    loadAll(id);
  }

  if (loading) return <div className="flex h-64 items-center justify-center text-white/40">Loading...</div>;
  if (!player) return <div className="rounded-xl border border-white/10 bg-bjk-dark p-12 text-center"><p className="text-white/50">Player not found.</p><Link to="/" className="mt-4 inline-block text-sm text-white underline">Back to Squad</Link></div>;

  const totals = { goals: stats.reduce((a, x) => a + x.goals, 0), assists: stats.reduce((a, x) => a + x.assists, 0), tackles: stats.reduce((a, x) => a + x.tackles, 0), saves: stats.reduce((a, x) => a + x.saves, 0) };
  const px = player.photo_position_x ?? 50;
  const py = player.photo_position_y ?? 50;
  const zoom = player.photo_zoom || settings?.zoom || 100;
  const displayPhoto = player.card_url || player.photo_url;

  return (
    <div className="fade-in">
      <Link to="/" className="mb-6 inline-block text-sm text-white/50 hover:text-white">&larr; Back to Squad</Link>
      <div className="mb-8 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-bjk-gray to-bjk-black">
        <div className="flex flex-col items-center p-8 sm:flex-row sm:items-start sm:gap-8">
          <div className="relative aspect-[4/3] w-52 shrink-0 overflow-hidden rounded-xl border-2 border-white/20 bg-bjk-black">
            {displayPhoto ? <img src={displayPhoto} alt={player.name} onClick={() => setExpandedPhoto(true)} style={{ objectFit: "contain", objectPosition: "50% 50%", transform: `translate(${(px - 50) / 2}%, ${(py - 50) / 2}%) scale(${zoom / 100})` }} className="h-full w-full cursor-zoom-in" /> : <div className="flex h-full items-center justify-center text-7xl font-bold text-white/20">{player.name.charAt(0)}</div>}
            <div className="absolute left-2 top-2 rounded-full border-2 border-white bg-black/70 px-3 py-2 font-display text-lg font-bold">{player.overall}</div>
          </div>
          <div className="mt-4 flex-1 text-center sm:mt-0 sm:text-left">
            <div className="flex flex-wrap items-baseline gap-3"><h2 className="font-display text-4xl font-bold uppercase tracking-wide">{player.name}</h2>{linkedProfile?.description && <p className="max-w-xl text-sm text-white/60">{linkedProfile.description}</p>}</div>
            <p className="mt-1 text-sm uppercase tracking-[0.2em] text-white/50">{(player.positions?.length ? player.positions : [player.position]).join(" · ")}</p>
            {isAdmin && <button onClick={() => setEditing(!editing)} className="mt-4 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm transition-all-smooth hover:bg-white hover:text-black">{editing ? "Cancel" : "Edit Player"}</button>}
          </div>
        </div>
        {isAdmin && editing && (
          <form onSubmit={savePlayer} className="border-t border-white/10 p-6">
            <p className="mb-3 text-xs text-white/40">The name comes from the username and cannot be changed here.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Normal OVR (0-100)" type="number" value={String(overall)} onChange={(value) => setOverall(Math.min(100, Math.max(0, Number(value))))} />
              <Field label="Photo URL" value={photoUrl} onChange={setPhotoUrl} />
              <Field label="GFX Card URL" value={cardUrl} onChange={setCardUrl} />
              <div className="sm:col-span-2">
                <span className="mb-2 block text-xs uppercase tracking-wide text-white/50">Positions</span>
                <div className="flex flex-wrap gap-2">{PLAYER_POSITIONS.map((position) => <button type="button" key={position} onClick={() => togglePosition(position)} className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${positions.includes(position) ? "border-white bg-white text-black" : "border-white/15 text-white/60"}`}>{position}</button>)}</div>
              </div>
            </div>
            {msg && <p className="mt-2 text-sm text-white/70">{msg}</p>}
            <button type="submit" className="mt-4 rounded-lg bg-white px-6 py-2 text-sm font-semibold text-black">Save Changes</button>
          </form>
        )}
      </div>
      {expandedPhoto && displayPhoto && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-6" onClick={() => setExpandedPhoto(false)}><div className="relative max-h-[90vh] max-w-5xl" onClick={(event) => event.stopPropagation()}><button type="button" aria-label="Close image" onClick={() => setExpandedPhoto(false)} className="absolute -right-3 -top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white text-xl text-black">×</button><img src={displayPhoto} alt={player.name} className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl" /></div></div>}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4"><StatBox label="Goals" value={String(totals.goals)} /><StatBox label="Assists" value={String(totals.assists)} /><StatBox label="Tackles" value={String(totals.tackles)} /><StatBox label="Saves" value={String(totals.saves)} /></div>
      <h3 className="mb-4 font-display text-xl font-bold uppercase">Scrim History</h3>
      {stats.length === 0 ? <div className="rounded-xl border border-white/10 bg-bjk-dark p-8 text-center text-white/40">No scrim stats recorded yet.</div> : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/10 bg-bjk-dark text-left text-xs uppercase tracking-wide text-white/50"><th className="px-4 py-3">Opponent</th><th className="px-4 py-3">G</th><th className="px-4 py-3">A</th><th className="px-4 py-3">T</th><th className="px-4 py-3">S</th></tr></thead>
            <tbody>{stats.map((stat) => <tr key={stat.id} className="border-b border-white/5"><td className="px-4 py-3"><Link to={`/scrim/${stat.scrims?.id}`} className="hover:underline">{stat.scrims?.opponent}</Link></td><td className="px-4 py-3">{stat.goals}</td><td className="px-4 py-3">{stat.assists}</td><td className="px-4 py-3">{stat.tackles}</td><td className="px-4 py-3">{stat.saves}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
function StatBox({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/10 bg-bjk-dark p-4 text-center"><div className="font-display text-3xl font-bold">{value}</div><div className="mt-1 text-xs uppercase tracking-wide text-white/50">{label}</div></div>; }
function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label><span className="mb-1 block text-xs uppercase tracking-wide text-white/50">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-white/10 bg-bjk-black px-3 py-2 text-sm" /></label>; }
