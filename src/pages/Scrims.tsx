import { useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { Link } from "react-router-dom";
import { BENCH_POSITIONS, LINEUP_POSITIONS, supabase, type LineupPosition, type Player, type Scrim, type ScrimLineup, type ScrimStat } from "../lib/supabase";
import { useAuth } from "../lib/auth";

type StatInput = { goals: number; assists: number; tackles: number; saves: number; rating: number };
type LineupInput = Record<LineupPosition, string>;
type ScrimWithData = Scrim & { scrim_stats: (ScrimStat & { players: Player })[]; scrim_lineups: (ScrimLineup & { players: Player })[] };
const ALL_POSITIONS: LineupPosition[] = [...LINEUP_POSITIONS, ...BENCH_POSITIONS];
const emptyLineup = (): LineupInput => Object.fromEntries(ALL_POSITIONS.map((position) => [position, ""])) as LineupInput;

export default function Scrims() {
  const { isAdmin, isScrimHoster } = useAuth();
  const [scrims, setScrims] = useState<ScrimWithData[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [opponent, setOpponent] = useState("");
  const [result, setResult] = useState("Win");
  const [teamScore, setTeamScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [scrimDate, setScrimDate] = useState(new Date().toISOString().split("T")[0]);
  const [statInputs, setStatInputs] = useState<Record<string, StatInput>>({});
  const [lineup, setLineup] = useState<LineupInput>(emptyLineup());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ opponent: "", result: "Win", teamScore: 0, oppScore: 0, date: "" });
  const [editStats, setEditStats] = useState<Record<string, StatInput>>({});
  const [editLineup, setEditLineup] = useState<LineupInput>(emptyLineup());
  const [message, setMessage] = useState("");

  useEffect(() => { void loadAll(); }, []);

  async function loadAll() {
    const [scrimsRes, playersRes] = await Promise.all([
      supabase.from("scrims").select("*, scrim_stats(*, players(*)), scrim_lineups(*, players(*))").order("scrim_date", { ascending: false }),
      supabase.from("players").select("*").order("overall", { ascending: false }),
    ]);
    setScrims((scrimsRes.data ?? []) as ScrimWithData[]);
    setPlayers(playersRes.data ?? []);
    setLoading(false);
  }

  async function addScrim(event: FormEvent) {
    event.preventDefault();
    if (!opponent.trim()) return;
    setMessage("");
    const { data: scrim, error } = await supabase.from("scrims").insert({ opponent: opponent.trim(), result, team_score: teamScore, opponent_score: oppScore, scrim_date: scrimDate }).select().maybeSingle();
    if (error || !scrim) { setMessage("The scrim could not be saved."); return; }
    const saveError = await saveRelatedData(scrim.id, statInputs, lineup);
    if (saveError) { setMessage(saveError); return; }
    setOpponent(""); setResult("Win"); setTeamScore(0); setOppScore(0); setStatInputs({}); setLineup(emptyLineup()); setShowAdd(false); await loadAll();
  }

  async function saveRelatedData(scrimId: string, stats: Record<string, StatInput>, selectedLineup: LineupInput): Promise<string | null> {
    const selectedPlayerIds = new Set(Object.values(selectedLineup).filter(Boolean));
    const statRows = players
      .filter((player) => selectedPlayerIds.has(player.id))
      .map((player) => {
        const value = stats[player.id];
        if (!value || (value.goals === 0 && value.assists === 0 && value.tackles === 0 && value.saves === 0)) return null;
        return { scrim_id: scrimId, player_id: player.id, goals: value.goals, assists: value.assists, tackles: value.tackles, saves: value.saves, rating: value.rating };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
    const lineupRows = ALL_POSITIONS.map((position) => selectedLineup[position] ? { scrim_id: scrimId, player_id: selectedLineup[position], position } : null).filter((row): row is NonNullable<typeof row> => row !== null);
    if (statRows.length) {
      const { error } = await supabase.from("scrim_stats").upsert(statRows, { onConflict: "scrim_id,player_id" });
      if (error) return "The player stats could not be saved.";
    }
    if (lineupRows.length) {
      const { error } = await supabase.from("scrim_lineups").upsert(lineupRows, { onConflict: "scrim_id,position" });
      if (error) return "The lineup could not be saved.";
    }
    const emptyPositions = ALL_POSITIONS.filter((position) => !selectedLineup[position]);
    if (emptyPositions.length) {
      const { error } = await supabase.from("scrim_lineups").delete().eq("scrim_id", scrimId).in("position", emptyPositions);
      if (error) return "The removed lineup positions could not be updated.";
    }
    return null;
  }

  async function deleteScrim(id: string) {
    if (!confirm("Delete this scrim and all its data?")) return;
    await supabase.from("scrims").delete().eq("id", id);
    await loadAll();
  }

  function startEdit(scrim: ScrimWithData) {
    const nextStats: Record<string, StatInput> = {};
    for (const stat of scrim.scrim_stats) nextStats[stat.player_id] = { goals: stat.goals, assists: stat.assists, tackles: stat.tackles, saves: stat.saves, rating: stat.rating };
    const nextLineup = emptyLineup();
    for (const entry of scrim.scrim_lineups) if (entry.position in nextLineup) nextLineup[entry.position] = entry.player_id;
    setMessage(""); setEditingId(scrim.id); setEditForm({ opponent: scrim.opponent, result: scrim.result, teamScore: scrim.team_score, oppScore: scrim.opponent_score, date: scrim.scrim_date }); setEditStats(nextStats); setEditLineup(nextLineup);
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingId || !editForm.opponent.trim()) return;
    setMessage("");
    const { error } = await supabase.from("scrims").update({ opponent: editForm.opponent.trim(), result: editForm.result, team_score: editForm.teamScore, opponent_score: editForm.oppScore, scrim_date: editForm.date }).eq("id", editingId);
    if (error) { setMessage("The scrim could not be updated."); return; }
    await supabase.from("scrim_stats").delete().eq("scrim_id", editingId);
    const saveError = await saveRelatedData(editingId, editStats, editLineup);
    if (saveError) { setMessage(saveError); return; }
    setEditingId(null); await loadAll();
  }

  function updateStat(setter: Dispatch<SetStateAction<Record<string, StatInput>>>, playerId: string, field: keyof StatInput, value: number) {
    setter((current) => ({ ...current, [playerId]: { ...(current[playerId] ?? { goals: 0, assists: 0, tackles: 0, saves: 0, rating: 7 }), [field]: field === "rating" ? Math.min(10, Math.max(1, value)) : Math.max(0, value) } }));
  }

  if (loading) return <div className="flex h-64 items-center justify-center text-white/40">Loading...</div>;
  const wins = scrims.filter((scrim) => scrim.result === "Win").length;
  const draws = scrims.filter((scrim) => scrim.result === "Draw").length;
  const losses = scrims.filter((scrim) => scrim.result === "Loss").length;

  return <div className="fade-in"><div className="mb-8 flex items-center justify-between"><div><h2 className="font-display text-3xl font-bold uppercase tracking-wide">Scrims</h2><p className="mt-1 text-sm text-white/50">{scrims.length} scrim matches recorded</p></div>{isScrimHoster && <button onClick={() => setShowAdd(!showAdd)} className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium transition-all-smooth hover:bg-white hover:text-black">{showAdd ? "Cancel" : "+ Add Scrim"}</button>}</div>
    <div className="mb-6 flex items-center justify-center gap-6 rounded-xl border border-white/10 bg-bjk-dark py-4"><div className="text-center"><span className="font-display text-3xl font-bold text-green-400">{wins}</span><span className="ml-1 text-sm uppercase tracking-wide text-white/50">W</span></div><span className="text-2xl text-white/20">-</span><div className="text-center"><span className="font-display text-3xl font-bold text-white/60">{draws}</span><span className="ml-1 text-sm uppercase tracking-wide text-white/50">D</span></div><span className="text-2xl text-white/20">-</span><div className="text-center"><span className="font-display text-3xl font-bold text-red-400">{losses}</span><span className="ml-1 text-sm uppercase tracking-wide text-white/50">L</span></div></div>
    {message && <p className="mb-4 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{message}</p>}
    {isScrimHoster && showAdd && <ScrimForm title="New Scrim" match={{ opponent, result, teamScore, oppScore, date: scrimDate }} onMatch={(field, value) => { if (field === "opponent") setOpponent(value as string); if (field === "result") setResult(value as string); if (field === "teamScore") setTeamScore(value as number); if (field === "oppScore") setOppScore(value as number); if (field === "date") setScrimDate(value as string); }} players={players} lineup={lineup} onLineup={(position, id) => setLineup((current) => ({ ...current, [position]: id }))} stats={statInputs} onStat={(id, field, value) => updateStat(setStatInputs, id, field, value)} onSubmit={addScrim} submitLabel="Add Scrim" />}
    {scrims.length === 0 ? <div className="rounded-xl border border-white/10 bg-bjk-dark p-12 text-center text-white/40">No scrims recorded yet.</div> : <div className="space-y-4">{scrims.map((scrim) => editingId === scrim.id && isAdmin ? <ScrimForm key={scrim.id} title="Edit Scrim" match={editForm} onMatch={(field, value) => setEditForm((current) => ({ ...current, [field]: value }))} players={players} lineup={editLineup} onLineup={(position, id) => setEditLineup((current) => ({ ...current, [position]: id }))} stats={editStats} onStat={(id, field, value) => updateStat(setEditStats, id, field, value)} onSubmit={saveEdit} submitLabel="Save Changes" onCancel={() => setEditingId(null)} /> : <ScrimCard key={scrim.id} scrim={scrim} isAdmin={isAdmin} onEdit={() => startEdit(scrim)} onDelete={() => deleteScrim(scrim.id)} />)}</div>}
  </div>;
}

type Match = { opponent: string; result: string; teamScore: number; oppScore: number; date: string };
type MatchField = keyof Match;
function ScrimForm({ title, match, onMatch, players, lineup, onLineup, stats, onStat, onSubmit, submitLabel, onCancel }: { title: string; match: Match; onMatch: (field: MatchField, value: string | number) => void; players: Player[]; lineup: LineupInput; onLineup: (position: LineupPosition, id: string) => void; stats: Record<string, StatInput>; onStat: (id: string, field: keyof StatInput, value: number) => void; onSubmit: (event: FormEvent) => void; submitLabel: string; onCancel?: () => void }) {
  const selectedPlayers = players.filter((player) => Object.values(lineup).includes(player.id));
  return <form onSubmit={onSubmit} className="rounded-xl border border-white/20 bg-bjk-dark p-6"><h3 className="mb-4 font-display text-lg font-semibold uppercase">{title}</h3><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><Input label="Opponent" value={match.opponent} onChange={(value) => onMatch("opponent", value)} /><Input label="Date" type="date" value={match.date} onChange={(value) => onMatch("date", value)} /><label><span className="mb-1 block text-xs uppercase tracking-wide text-white/50">Result</span><select value={match.result} onChange={(event) => onMatch("result", event.target.value)} className="w-full rounded-lg border border-white/10 bg-bjk-black px-3 py-2 text-sm"><option>Win</option><option>Loss</option><option>Draw</option></select></label><Input label="Our Score" type="number" value={String(match.teamScore)} onChange={(value) => onMatch("teamScore", Number(value))} /><Input label="Opp Score" type="number" value={String(match.oppScore)} onChange={(value) => onMatch("oppScore", Number(value))} /></div><LineupEditor players={players} lineup={lineup} onChange={onLineup} /><PlayerStatEditor players={selectedPlayers} stats={stats} onStat={onStat} /><div className="mt-6 flex gap-3"><button type="submit" className="rounded-lg bg-white px-6 py-2 text-sm font-semibold text-black">{submitLabel}</button>{onCancel && <button type="button" onClick={onCancel} className="rounded-lg border border-white/20 px-6 py-2 text-sm">Cancel</button>}</div></form>;
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label><span className="mb-1 block text-xs uppercase tracking-wide text-white/50">{label}</span><input type={type} min={type === "number" ? 0 : undefined} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-white/10 bg-bjk-black px-3 py-2 text-sm" /></label>; }

function LineupEditor({ players, lineup, onChange }: { players: Player[]; lineup: LineupInput; onChange: (position: LineupPosition, id: string) => void }) {
  const [search, setSearch] = useState("");
  const selected = new Set(Object.values(lineup).filter(Boolean));
  const visiblePlayers = players.filter((player) => player.name.toLowerCase().includes(search.toLowerCase()) || selected.has(player.id));
  const benchLabel = (position: LineupPosition) => position.startsWith("BENCH_") ? `Sub ${position.replace("BENCH_", "")}` : position;
  return <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="font-display text-lg font-semibold uppercase">Starting Lineup</h4><p className="text-xs text-white/50">Choose unique players for each position.</p></div><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search players..." aria-label="Search players" className="w-full rounded-lg border border-white/10 bg-bjk-black px-3 py-2 text-sm sm:w-56" /></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">{LINEUP_POSITIONS.map((position) => <PlayerSelect key={position} position={position} label={position} players={visiblePlayers} lineup={lineup} selected={selected} onChange={onChange} />)}</div><h4 className="mb-2 mt-5 font-display text-base font-semibold uppercase text-white/60">Bench / Substitutes (up to 5)</h4><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{BENCH_POSITIONS.map((position) => <PlayerSelect key={position} position={position} label={benchLabel(position)} players={visiblePlayers} lineup={lineup} selected={selected} onChange={onChange} />)}</div></div>;
}

function PlayerSelect({ position, label, players, lineup, selected, onChange }: { position: LineupPosition; label: string; players: Player[]; lineup: LineupInput; selected: Set<string>; onChange: (position: LineupPosition, id: string) => void }) { return <label><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/50">{label}</span><select value={lineup[position]} onChange={(event) => onChange(position, event.target.value)} className="w-full rounded-lg border border-white/10 bg-bjk-black px-2 py-2 text-sm"><option value="">Select player</option>{players.map((player) => <option key={player.id} value={player.id} disabled={selected.has(player.id) && lineup[position] !== player.id}>{player.name}</option>)}</select></label>; }

function PlayerStatEditor({ players, stats, onStat }: { players: Player[]; stats: Record<string, StatInput>; onStat: (id: string, field: keyof StatInput, value: number) => void }) { return <div className="mt-6"><h4 className="mb-3 text-xs uppercase tracking-wide text-white/50">Player Stats</h4>{players.length === 0 ? <p className="rounded-lg border border-white/5 bg-bjk-black p-4 text-sm text-white/40">Select players above to enter their stats.</p> : <div className="space-y-2">{players.map((player) => { const stat = stats[player.id]; return <div key={player.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-white/5 bg-bjk-black p-3"><Link to={`/player/${player.id}`} className="w-32 shrink-0 text-sm font-medium hover:underline">{player.name}</Link>{(["goals", "assists", "tackles", "saves"] as const).map((field) => <StatNum key={field} label={field === "goals" ? "G" : field === "assists" ? "A" : field === "tackles" ? "T" : "S"} value={stat?.[field] ?? 0} onChange={(value) => onStat(player.id, field, value)} />)}</div>; })}</div>}</div>; }
function ScrimCard({ scrim, isAdmin, onEdit, onDelete }: { scrim: ScrimWithData; isAdmin: boolean; onEdit: () => void; onDelete: () => void }) { return <div className="overflow-hidden rounded-xl border border-white/10 bg-bjk-dark"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-bjk-black p-4"><Link to={`/scrim/${scrim.id}`} className="flex items-center gap-4 hover:opacity-80"><div className={`flex h-12 w-12 items-center justify-center rounded-full border-2 font-display text-sm font-bold ${scrim.result === "Win" ? "border-green-400 text-green-400" : scrim.result === "Loss" ? "border-red-400 text-red-400" : "border-white/40 text-white"}`}>{scrim.result.charAt(0)}</div><div><h3 className="font-display text-lg font-semibold uppercase">vs {scrim.opponent}</h3><p className="text-xs text-white/50">{new Date(scrim.scrim_date).toLocaleDateString("en-US")}</p></div></Link><div className="flex items-center gap-4"><div className="font-display text-2xl font-bold">{scrim.team_score} <span className="text-white/30">-</span> {scrim.opponent_score}</div>{isAdmin && <><button onClick={onEdit} className="text-xs text-white/40 hover:text-white">Edit</button><button onClick={onDelete} className="text-xs text-white/30 hover:text-red-400">Delete</button></>}</div></div><div className="flex flex-wrap gap-2 p-4">{scrim.scrim_lineups.map((entry) => <span key={entry.id} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs"><b>{entry.position}</b> {entry.players?.name}</span>)}</div></div>; }
function StatNum({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="flex items-center gap-1.5"><span className="text-xs uppercase text-white/40">{label}</span><input type="number" min={0} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-14 rounded-md border border-white/10 bg-bjk-black px-2 py-1 text-center text-sm" /></label>; }
