import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "../lib/auth";
import { supabase, type Profile, type Player, PLAYER_POSITIONS, type PlayerPosition } from "../lib/supabase";

export default function Admin() {
  const { session, profile, isAdmin, isOwner, loading, authError, signIn, signUp, signOut } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [tab, setTab] = useState<"users" | "squad" | "photos" | "card">("users");
  const [users, setUsers] = useState<Profile[]>([]);
  const [squadPlayers, setSquadPlayers] = useState<Player[]>([]);
  const [editDesc, setEditDesc] = useState("");

  const loadUsers = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: true });
    setUsers((data ?? []) as Profile[]);
  }, []);

  const loadSquad = useCallback(async () => {
    const { data } = await supabase.from("players").select("*").order("overall", { ascending: false });
    setSquadPlayers((data ?? []) as Player[]);
  }, []);

  useEffect(() => {
    if (isAdmin) { loadUsers(); loadSquad(); }
    if (profile) setEditDesc(profile.description ?? "");
  }, [isAdmin, profile, loadUsers, loadSquad]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const result = mode === "signin" ? await signIn(username, password) : await signUp(username, password);
    if (result) setMessage(result);
    else if (mode === "signup") setMessage("Account created. You can now sign in.");
    setBusy(false);
  }

  async function changeRole(user: Profile, role: "member" | "admin" | "scrim_hoster") {
    const { error } = await supabase.rpc("set_user_role", { p_user_id: user.user_id, p_role: role });
    setMessage(error ? "Could not change the role." : `${user.username} → ${role}`);
    if (!error) loadUsers();
  }

  async function removeUser(user: Profile) {
    if (!confirm(`Delete ${user.username} permanently?`)) return;
    const { error } = await supabase.rpc("delete_user", { p_user_id: user.user_id });
    setMessage(error ? "Could not delete the user." : `${user.username} was deleted.`);
    if (!error) loadUsers();
  }

  async function saveDescription() {
    if (!profile) return;
    const { error } = await supabase.rpc("update_card_description", { p_description: editDesc.trim() });
    if (error) {
      const detail = error.message.toLowerCase();
      if (detail.includes("not in squad") || detail.includes("squad")) setMessage("You are not in the squad, so your card description cannot be saved.");
      else setMessage("Description could not be saved.");
    } else {
      setMessage("Description updated.");
    }
  }

  if (loading) return <div className="flex h-64 items-center justify-center text-white/40">Loading...</div>;
  if (authError) return <div className="mx-auto max-w-md rounded-xl border border-red-400/30 bg-red-400/10 p-6 text-center text-red-300">{authError}</div>;

  if (!session) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-bjk-dark p-8 fade-in">
        <h2 className="font-display text-3xl font-bold uppercase">{mode === "signin" ? "Sign In" : "Create Account"}</h2>
        <p className="mt-2 text-sm text-white/60">Sign in with your username and password. Visitors can view the data but cannot edit it.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-white/50">Username</span>
            <input required autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full rounded-lg border border-white/10 bg-bjk-black px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-white/50">Password</span>
            <input type="password" required autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-white/10 bg-bjk-black px-3 py-2 text-sm" />
          </label>
          {message && <p className="text-sm text-white/70">{message}</p>}
          <button disabled={busy} className="w-full rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition-all-smooth disabled:opacity-50 hover:bg-white/90">
            {busy ? "Please wait..." : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>
        <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }} className="mt-4 text-sm text-white/50 underline hover:text-white transition-colors">
          {mode === "signin" ? "Create an account" : "Back to sign in"}
        </button>
      </div>
    );
  }

  if (session && !profile) {
    return <div className="mx-auto max-w-md rounded-xl border border-white/10 bg-bjk-dark p-6 text-center fade-in"><p className="text-sm text-white/70">Loading user information...</p>{authError && <p className="mt-3 text-sm text-red-300">{authError}</p>}<button onClick={signOut} className="mt-5 rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white hover:text-black">Sign Out</button></div>;
  }

  // Non-admin: show own card description editor only
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md fade-in">
        <YourCard profile={profile!} description={editDesc} onDesc={setEditDesc} onSave={saveDescription} message={message} onSignOut={signOut} />
      </div>
    );
  }

  const squadUserIds = new Set<string>(squadPlayers.flatMap((p) => p.user_id ? [p.user_id] : []));

  return (
    <div className="mx-auto max-w-3xl fade-in">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-3xl font-bold uppercase">Admin Panel</h2>
        <button onClick={signOut} className="rounded-lg border border-white/20 px-4 py-2 text-sm transition-all-smooth hover:bg-white hover:text-black">Sign Out</button>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <TabButton active={tab === "users"} onClick={() => setTab("users")} label="Users" />
        <TabButton active={tab === "squad"} onClick={() => setTab("squad")} label="Squad" />
        <TabButton active={tab === "photos"} onClick={() => setTab("photos")} label="Player Photos" />
        <TabButton active={tab === "card"} onClick={() => setTab("card")} label="My Card" />
      </div>

      {message && <div className="mb-4 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 fade-in">{message}</div>}

      {tab === "users" && (
        <div className="space-y-3">
          <p className="text-sm text-white/50">{users.length} users total.</p>
          {users.map((user) => (
            <div key={user.user_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-bjk-dark p-4 card-enter">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/20 bg-bjk-black font-display font-bold uppercase">{user.username.charAt(0)}</div>
                <div>
                  <p className="font-display text-sm font-semibold uppercase">{user.username}</p>
                  <p className="text-xs text-white/40">{user.is_owner ? "Super Admin" : user.role === "admin" ? "Admin" : user.role === "scrim_hoster" ? "Scrim Hoster" : "Member"}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {isOwner && !user.is_owner && (
                  <>
                    {user.role !== "admin" && <RoleButton label="Make Admin" onClick={() => changeRole(user, "admin")} />}
                    {user.role === "admin" && <RoleButton label="Remove Admin" onClick={() => changeRole(user, "member")} danger />}
                    {user.role !== "scrim_hoster" && <RoleButton label="Make Scrim Hoster" onClick={() => changeRole(user, "scrim_hoster")} />}
                    {user.role === "scrim_hoster" && <RoleButton label="Remove Hoster" onClick={() => changeRole(user, "member")} danger />}
                    <RoleButton label="Delete" onClick={() => removeUser(user)} danger />
                  </>
                )}
                {user.is_owner && <span className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-400">SUPER ADMIN</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "squad" && (
        <SquadManager users={users} squadPlayers={squadPlayers} squadUserIds={squadUserIds} onRefresh={loadSquad} />
      )}

      {tab === "photos" && <PlayerPhotoEditor squadPlayers={squadPlayers} onRefresh={loadSquad} />}

      {tab === "card" && profile && (
        <YourCard profile={profile} description={editDesc} onDesc={setEditDesc} onSave={saveDescription} message={undefined} onSignOut={undefined} />
      )}
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return <button onClick={onClick} className={`rounded-lg px-4 py-2 text-sm font-medium transition-all-smooth ${active ? "bg-white text-black" : "border border-white/10 text-white/60 hover:bg-white/10 hover:text-white"}`}>{label}</button>;
}
function RoleButton({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return <button onClick={onClick} className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all-smooth ${danger ? "border-red-400/30 text-red-400 hover:bg-red-400/10" : "border-white/20 text-white/80 hover:bg-white hover:text-black"}`}>{label}</button>;
}

function SquadManager({ users, squadPlayers, squadUserIds, onRefresh }: { users: Profile[]; squadPlayers: Player[]; squadUserIds: Set<string>; onRefresh: () => void }) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [positions, setPositions] = useState<PlayerPosition[]>(["CM"]);
  const [overall, setOverall] = useState(75);
  const [photoUrl, setPhotoUrl] = useState("");
  const [cardUrl, setCardUrl] = useState("");
  const [msg, setMsg] = useState("");

  const availableUsers = users.filter((u) => !squadUserIds.has(u.user_id));

  function togglePos(pos: PlayerPosition) { setPositions((c) => c.includes(pos) ? c.filter((p) => p !== pos) : [...c, pos]); }

  async function addToSquad(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId) { setMsg("Select a user."); return; }
    const { error } = await supabase.rpc("add_to_squad", {
      p_user_id: selectedUserId, p_positions: positions, p_overall: overall,
      p_photo_url: photoUrl.trim() || null, p_card_url: cardUrl.trim() || null,
    });
    if (error) { setMsg("Could not add to squad: " + error.message); return; }
    setMsg("Added to squad.");
    setSelectedUserId(""); setPositions(["CM"]); setOverall(75); setPhotoUrl(""); setCardUrl("");
    onRefresh();
  }

  async function removeFromSquad(playerId: string, name: string) {
    if (!confirm(`Remove ${name} from the squad?`)) return;
    const { error } = await supabase.rpc("remove_from_squad", { p_player_id: playerId });
    setMsg(error ? "Could not remove." : `${name} was removed from the squad.`);
    if (!error) onRefresh();
  }

  return (
    <div className="space-y-6">
      {availableUsers.length > 0 && (
        <form onSubmit={addToSquad} className="rounded-xl border border-white/10 bg-bjk-dark p-6">
          <h3 className="mb-4 font-display text-lg font-semibold uppercase">Add User to Squad</h3>
          <label className="block mb-4">
            <span className="mb-1 block text-xs uppercase tracking-wide text-white/50">Select User</span>
            <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="w-full rounded-lg border border-white/10 bg-bjk-black px-3 py-2 text-sm">
              <option value="">Select a user...</option>
              {availableUsers.map((u) => <option key={u.user_id} value={u.user_id}>{u.username}</option>)}
            </select>
          </label>
          <div className="mb-4">
            <span className="mb-2 block text-xs uppercase tracking-wide text-white/50">Positions</span>
            <div className="flex flex-wrap gap-2">
              {PLAYER_POSITIONS.map((pos) => <button type="button" key={pos} onClick={() => togglePos(pos)} className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${positions.includes(pos) ? "border-white bg-white text-black" : "border-white/15 text-white/60 hover:border-white/40"}`}>{pos}</button>)}
            </div>
          </div>
          <label className="block mb-4">
            <span className="mb-1 block text-xs uppercase tracking-wide text-white/50">OVR (0-100)</span>
            <input type="number" min={0} max={100} value={overall} onChange={(e) => setOverall(Math.min(100, Math.max(0, Number(e.target.value))))} className="w-full rounded-lg border border-white/10 bg-bjk-black px-3 py-2 text-sm" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2 mb-4">
            <label className="block"><span className="mb-1 block text-xs uppercase tracking-wide text-white/50">Photo URL</span><input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} className="w-full rounded-lg border border-white/10 bg-bjk-black px-3 py-2 text-sm" placeholder="https://..." /></label>
            <label className="block"><span className="mb-1 block text-xs uppercase tracking-wide text-white/50">Card URL</span><input value={cardUrl} onChange={(e) => setCardUrl(e.target.value)} className="w-full rounded-lg border border-white/10 bg-bjk-black px-3 py-2 text-sm" placeholder="https://..." /></label>
          </div>
          {msg && <p className="mb-3 text-sm text-white/70">{msg}</p>}
          <button type="submit" className="rounded-lg bg-white px-6 py-2 text-sm font-semibold text-black transition-all-smooth hover:bg-white/90">Add to Squad</button>
        </form>
      )}

      <div>
        <h3 className="mb-3 font-display text-lg font-semibold uppercase">Squad Members ({squadPlayers.length})</h3>
        {squadPlayers.length === 0 ? <p className="text-sm text-white/40">The squad is empty.</p> : (
          <div className="space-y-2">
            {squadPlayers.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-bjk-dark p-3 card-enter">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-bjk-black">
                    {p.photo_url ? <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover" /> : <span className="text-sm font-bold text-white/40">{p.name.charAt(0).toUpperCase()}</span>}
                  </div>
                  <div>
                    <p className="text-sm font-semibold uppercase">{p.name}</p>
                    <p className="text-xs text-white/40">OVR {p.overall} · {(p.positions?.length ? p.positions : [p.position]).join(", ")}</p>
                  </div>
                </div>
                <button onClick={() => removeFromSquad(p.id, p.name)} className="rounded-lg border border-red-400/30 px-3 py-1.5 text-xs text-red-400 transition-all-smooth hover:bg-red-400/10">Remove from Squad</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerPhotoEditor({ squadPlayers, onRefresh }: { squadPlayers: Player[]; onRefresh: () => void }) {
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [cardUrl, setCardUrl] = useState("");
  const [photoPositionX, setPhotoPositionX] = useState(50);
  const [photoPositionY, setPhotoPositionY] = useState(50);
  const [photoZoom, setPhotoZoom] = useState(100);
  const [msg, setMsg] = useState("");
  const lastPointer = useRef<{ x: number; y: number } | null>(null);

  function startEdit(player: Player) {
    setEditingPlayer(player);
    setPhotoUrl(player.photo_url ?? "");
    setCardUrl(player.card_url ?? "");
    setPhotoPositionX(player.photo_position_x ?? 50);
    setPhotoPositionY(player.photo_position_y ?? 50);
    setPhotoZoom(player.photo_zoom || 100);
    setMsg("");
  }
  async function savePhoto() {
    if (!editingPlayer) return;
    const { error } = await supabase.rpc("update_player_photo_crop_drag", {
      p_player_id: editingPlayer.id,
      p_photo_url: photoUrl.trim() || null,
      p_card_url: cardUrl.trim() || null,
      p_photo_zoom: photoZoom,
      p_photo_position_x: photoPositionX,
      p_photo_position_y: photoPositionY,
    });
    if (error) { setMsg("Could not save."); return; }
    setMsg("Photo updated.");
    setEditingPlayer(null);
    onRefresh();
  }

  function startCropDrag(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    lastPointer.current = { x: event.clientX, y: event.clientY };
  }

  function moveCrop(event: React.PointerEvent<HTMLDivElement>) {
    const previous = lastPointer.current;
    if (!previous) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const deltaX = ((event.clientX - previous.x) / bounds.width) * 100;
    const deltaY = ((event.clientY - previous.y) / bounds.height) * 100;
    setPhotoPositionX((value) => Math.max(0, Math.min(100, Math.round(value - deltaX))));
    setPhotoPositionY((value) => Math.max(0, Math.min(100, Math.round(value - deltaY))));
    lastPointer.current = { x: event.clientX, y: event.clientY };
  }

  function stopCropDrag(event: React.PointerEvent<HTMLDivElement>) {
    lastPointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <div className="rounded-xl border border-white/10 bg-bjk-dark p-6">
      <h3 className="mb-2 font-display text-lg font-semibold uppercase">Squad Photo Editor</h3>
      <p className="mb-4 text-sm text-white/50">Choose a player, add their image, then use the crop preview to center and resize it for their card.</p>
      {editingPlayer ? (
        <div className="space-y-4 card-enter">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-white/20 bg-bjk-black">
              {photoUrl ? <img src={photoUrl} alt={editingPlayer.name} className="h-full w-full object-cover" /> : <span className="font-bold text-white/30">{editingPlayer.name.charAt(0).toUpperCase()}</span>}
            </div>
            <p className="text-sm font-semibold uppercase">{editingPlayer.name}</p>
          </div>
          <label className="block"><span className="mb-1 block text-xs uppercase tracking-wide text-white/50">Photo URL</span><input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} className="w-full rounded-lg border border-white/10 bg-bjk-black px-3 py-2 text-sm" placeholder="https://..." /></label>
          <label className="block"><span className="mb-1 block text-xs uppercase tracking-wide text-white/50">Card URL</span><input value={cardUrl} onChange={(e) => setCardUrl(e.target.value)} className="w-full rounded-lg border border-white/10 bg-bjk-black px-3 py-2 text-sm" placeholder="https://..." /></label>
          {photoUrl && (
            <div className="rounded-xl border border-white/10 bg-bjk-black p-4">
              <div className="mb-3 flex items-center justify-between">
                <div><p className="text-sm font-semibold">Crop and position</p><p className="text-xs text-white/40">Drag the image to place it inside the card.</p></div>
                <span className="text-xs text-white/50">{photoZoom}%</span>
              </div>
              <div onDragStart={(event) => event.preventDefault()} onPointerDown={startCropDrag} onPointerMove={moveCrop} onPointerUp={stopCropDrag} onPointerCancel={stopCropDrag} className="mx-auto mb-4 aspect-[4/3] max-w-sm touch-none cursor-grab overflow-hidden rounded-lg border border-white/15 bg-black active:cursor-grabbing">
                <img src={photoUrl} alt={`${editingPlayer.name} preview`} draggable={false} onDragStart={(event) => event.preventDefault()} style={{ objectFit: "cover", objectPosition: `${photoPositionX}% ${photoPositionY}%`, transform: `scale(${photoZoom / 100})` }} className="pointer-events-none h-full w-full select-none" />
              </div>
              <p className="mb-4 text-center text-xs text-white/40">Click or drag anywhere in the preview to move the image focus.</p>
              <label className="block"><span className="mb-2 block text-xs uppercase tracking-wide text-white/50">Zoom</span><input type="range" min={50} max={200} step={5} value={photoZoom} onChange={(e) => setPhotoZoom(Number(e.target.value))} className="w-full" /></label>
            </div>
          )}
          {msg && <p className="text-sm text-white/70">{msg}</p>}
          <div className="flex gap-2">
            <button onClick={savePhoto} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition-all-smooth hover:bg-white/90">Save</button>
            <button onClick={() => setEditingPlayer(null)} className="rounded-lg border border-white/20 px-4 py-2 text-sm transition-all-smooth hover:bg-white/10">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {squadPlayers.length === 0 ? <p className="text-sm text-white/40">The squad is empty.</p> : squadPlayers.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-bjk-black p-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-bjk-black">
                  {p.photo_url ? <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover" /> : <span className="text-xs font-bold text-white/40">{p.name.charAt(0).toUpperCase()}</span>}
                </div>
                <span className="text-sm font-medium uppercase">{p.name}</span>
              </div>
              <button onClick={() => startEdit(p)} className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white/80 transition-all-smooth hover:bg-white hover:text-black">Edit Photo</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function YourCard({ profile, description, onDesc, onSave, message, onSignOut }: {
  profile: Pick<Profile, "username" | "description" | "photo_url" | "role" | "is_owner">; description: string; onDesc: (v: string) => void; onSave: () => void; message?: string; onSignOut?: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-blue-500/40 bg-gradient-to-br from-blue-950 via-blue-900 to-bjk-dark p-6 shadow-2xl card-enter">
        <div className="mb-3 flex items-center justify-between">
          <span className="rounded-full border border-blue-400/40 bg-blue-500/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-300">Your Card</span>
          <span className="text-xs uppercase tracking-wide text-white/50">{profile.is_owner ? "Super Admin" : profile.role}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border-2 border-blue-400/40 bg-bjk-black">
            {profile.photo_url ? <img src={profile.photo_url} alt={profile.username} className="h-full w-full object-cover" /> : <span className="text-3xl font-bold text-white/30">{profile.username.charAt(0).toUpperCase()}</span>}
          </div>
          <div>
            <h3 className="font-display text-2xl font-bold uppercase">{profile.username}</h3>
            <p className="mt-1 text-sm text-white/60">{description || "No description yet."}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-bjk-dark p-6">
        <h3 className="mb-4 font-display text-lg font-semibold uppercase">Edit Description</h3>
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wide text-white/50">Description</span>
          <textarea value={description} onChange={(e) => onDesc(e.target.value)} maxLength={200} rows={3} className="w-full rounded-lg border border-white/10 bg-bjk-black px-3 py-2 text-sm" placeholder="Text shown on your card..." />
          <span className="mt-1 block text-right text-xs text-white/30">{description.length}/200</span>
        </label>
        {message && <p className="mt-2 text-sm text-white/70">{message}</p>}
        <button onClick={onSave} className="mt-4 rounded-lg bg-white px-6 py-2 text-sm font-semibold text-black transition-all-smooth hover:bg-white/90">Save</button>
      </div>

      {onSignOut && <button onClick={onSignOut} className="rounded-lg border border-white/20 px-4 py-2 text-sm transition-all-smooth hover:bg-white hover:text-black">Sign Out</button>}
    </div>
  );
}
