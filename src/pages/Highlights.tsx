import { useEffect, useState, useCallback } from "react";
import { supabase, type Highlight } from "../lib/supabase";
import { useAuth } from "../lib/auth";

function extractYouTubeId(url: string): string | null {
  const patterns = [/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/];
  for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
  return null;
}

export default function Highlights() {
  const { session, isAdmin } = useAuth();
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase.from("highlights").select("*").order("created_at", { ascending: false });
    const rows = (data ?? []) as Omit<Highlight, "profiles">[];
    const userIds = [...new Set(rows.map((row) => row.user_id))];
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select("user_id, username").in("user_id", userIds)
      : { data: [] as { user_id: string; username: string }[] };
    const names = new Map((profiles ?? []).map((item) => [item.user_id, { username: item.username }]));
    setHighlights(rows.map((row) => ({ ...row, profiles: names.get(row.user_id) ?? null })) as Highlight[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addHighlight(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!videoUrl.trim()) { setError("A video URL is required."); return; }
    if (!extractYouTubeId(videoUrl.trim())) { setError("Enter a valid YouTube URL."); return; }
    const { error: err } = await supabase.from("highlights").insert({
      video_url: videoUrl.trim(), title: title.trim(), caption: caption.trim(),
    });
    if (err) { setError("The video could not be added. Please try again."); return; }
    setVideoUrl(""); setTitle(""); setCaption(""); setShowAdd(false); load();
  }

  async function deleteHighlight(id: string) {
    if (!confirm("Delete this video?")) return;
    await supabase.from("highlights").delete().eq("id", id);
    load();
  }

  if (loading) return <div className="flex h-64 items-center justify-center text-white/40">Loading...</div>;

  return (
    <div className="fade-in">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold uppercase tracking-wide">Highlights</h2>
          <p className="mt-1 text-sm text-white/50">{highlights.length} videos shared</p>
        </div>
        {session && (
          <button onClick={() => setShowAdd(!showAdd)} className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium transition-all-smooth hover:bg-white hover:text-black">
            {showAdd ? "Cancel" : "+ Add Video"}
          </button>
        )}
      </div>

      {session && showAdd && (
        <form onSubmit={addHighlight} className="mb-8 rounded-xl border border-white/10 bg-bjk-dark p-6 card-enter">
          <h3 className="mb-4 font-display text-lg font-semibold uppercase">New Video</h3>
          <div className="grid gap-4">
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wide text-white/50">YouTube URL</span>
              <input required value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="w-full rounded-lg border border-white/10 bg-bjk-black px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wide text-white/50">Title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className="w-full rounded-lg border border-white/10 bg-bjk-black px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wide text-white/50">Description</span>
              <textarea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={200} rows={2} className="w-full rounded-lg border border-white/10 bg-bjk-black px-3 py-2 text-sm" />
            </label>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button type="submit" className="rounded-lg bg-white px-6 py-2 text-sm font-semibold text-black transition-all-smooth hover:bg-white/90">Share</button>
          </div>
        </form>
      )}

      {!session && (
        <p className="mb-6 rounded-lg border border-white/10 bg-bjk-dark px-4 py-3 text-sm text-white/50">Sign in to share a video.</p>
      )}

      {highlights.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-bjk-dark p-12 text-center text-white/40">No videos yet.</div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {highlights.map((hl) => {
            const ytId = extractYouTubeId(hl.video_url);
            return (
              <div key={hl.id} className="overflow-hidden rounded-xl border border-white/10 bg-bjk-dark transition-all-smooth hover:border-white/30 hover:shadow-xl card-enter">
                <div className="relative aspect-video overflow-hidden bg-bjk-black">
                  {ytId ? (
                    <iframe src={`https://www.youtube.com/embed/${ytId}`} title={hl.title || "Highlight"} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                  ) : (
                    <div className="flex h-full items-center justify-center text-white/30">Invalid video</div>
                  )}
                </div>
                <div className="p-4">
                  {hl.title && <h3 className="font-display text-base font-semibold uppercase">{hl.title}</h3>}
                  {hl.caption && <p className="mt-1 text-sm text-white/50">{hl.caption}</p>}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-white/40">by {hl.profiles?.username ?? "unknown"}</span>
                    {(isAdmin || hl.user_id === session?.user.id) && (
                      <button onClick={() => deleteHighlight(hl.id)} className="text-xs text-white/30 transition-colors hover:text-red-400">Delete</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
