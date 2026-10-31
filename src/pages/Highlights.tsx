import { useCallback, useEffect, useState } from "react";
import { supabase, type Highlight } from "../lib/supabase";
import { useAuth } from "../lib/auth";

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return match?.[1] ?? null;
}

type HighlightFormProps = {
  heading: string;
  fieldTitle: string;
  videoUrl: string;
  caption: string;
  error: string;
  submitLabel: string;
  onVideoUrl: (value: string) => void;
  onTitle: (value: string) => void;
  onCaption: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel?: () => void;
};

function HighlightForm({ heading, fieldTitle, videoUrl, caption, error, submitLabel, onVideoUrl, onTitle, onCaption, onSubmit, onCancel }: HighlightFormProps) {
  return (
    <form onSubmit={onSubmit} className="mb-8 rounded-xl border border-white/10 bg-bjk-dark p-6 card-enter">
      <h3 className="mb-4 font-display text-lg font-semibold uppercase">{heading}</h3>
      <div className="grid gap-4">
        <label className="block"><span className="mb-1 block text-xs uppercase tracking-wide text-white/50">YouTube URL</span><input required value={videoUrl} onChange={(event) => onVideoUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="w-full rounded-lg border border-white/10 bg-bjk-black px-3 py-2 text-sm" /></label>
        <label className="block"><span className="mb-1 block text-xs uppercase tracking-wide text-white/50">Title</span><input value={fieldTitle} onChange={(event) => onTitle(event.target.value)} maxLength={80} className="w-full rounded-lg border border-white/10 bg-bjk-black px-3 py-2 text-sm" /></label>
        <label className="block"><span className="mb-1 block text-xs uppercase tracking-wide text-white/50">Description</span><textarea value={caption} onChange={(event) => onCaption(event.target.value)} maxLength={200} rows={2} className="w-full rounded-lg border border-white/10 bg-bjk-black px-3 py-2 text-sm" /></label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-3"><button type="submit" className="rounded-lg bg-white px-6 py-2 text-sm font-semibold text-black transition-all-smooth hover:bg-white/90">{submitLabel}</button>{onCancel && <button type="button" onClick={onCancel} className="rounded-lg border border-white/20 px-6 py-2 text-sm transition-all-smooth hover:bg-white/10">Cancel</button>}</div>
      </div>
    </form>
  );
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
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("highlights").select("*").order("created_at", { ascending: false });
    const rows = (data ?? []) as Omit<Highlight, "profiles">[];
    const userIds = [...new Set(rows.map((row) => row.user_id))];
    const { data: profiles } = userIds.length ? await supabase.from("profiles").select("user_id, username").in("user_id", userIds) : { data: [] as { user_id: string; username: string }[] };
    const names = new Map((profiles ?? []).map((item) => [item.user_id, { username: item.username }]));
    setHighlights(rows.map((row) => ({ ...row, profiles: names.get(row.user_id) ?? null })) as Highlight[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setVideoUrl("");
    setTitle("");
    setCaption("");
    setError("");
    setEditingId(null);
  }

  async function addHighlight(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const cleanUrl = videoUrl.trim();
    if (!extractYouTubeId(cleanUrl)) { setError("Enter a valid YouTube URL."); return; }
    const { error: insertError } = await supabase.from("highlights").insert({ video_url: cleanUrl, title: title.trim(), caption: caption.trim() });
    if (insertError) { setError("The video could not be added. Please try again."); return; }
    resetForm(); setShowAdd(false); load();
  }

  function startEdit(highlight: Highlight) {
    setEditingId(highlight.id);
    setVideoUrl(highlight.video_url);
    setTitle(highlight.title);
    setCaption(highlight.caption);
    setError("");
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editingId) return;
    setError("");
    const cleanUrl = videoUrl.trim();
    if (!extractYouTubeId(cleanUrl)) { setError("Enter a valid YouTube URL."); return; }
    const { error: updateError } = await supabase.from("highlights").update({ video_url: cleanUrl, title: title.trim(), caption: caption.trim() }).eq("id", editingId);
    if (updateError) { setError("The video could not be updated. Please try again."); return; }
    resetForm(); load();
  }

  async function deleteHighlight(id: string) {
    if (!confirm("Delete this video?")) return;
    const { error: deleteError } = await supabase.from("highlights").delete().eq("id", id);
    if (deleteError) { setError("The video could not be deleted. Please try again."); return; }
    load();
  }

  if (loading) return <div className="flex h-64 items-center justify-center text-white/40">Loading...</div>;

  return (
    <div className="fade-in">
      <div className="mb-8 flex items-center justify-between">
        <div><h2 className="font-display text-3xl font-bold uppercase tracking-wide">Highlights</h2><p className="mt-1 text-sm text-white/50">{highlights.length} videos shared</p></div>
        {session && <button onClick={() => { if (showAdd) resetForm(); setShowAdd(!showAdd); }} className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium transition-all-smooth hover:bg-white hover:text-black">{showAdd ? "Cancel" : "+ Add Video"}</button>}
      </div>
      {session && showAdd && <HighlightForm heading="New Video" fieldTitle={title} videoUrl={videoUrl} caption={caption} error={error} submitLabel="Share" onVideoUrl={setVideoUrl} onTitle={setTitle} onCaption={setCaption} onSubmit={addHighlight} />}
      {!session && <p className="mb-6 rounded-lg border border-white/10 bg-bjk-dark px-4 py-3 text-sm text-white/50">Sign in to share a video.</p>}
      {error && !editingId && !showAdd && <p className="mb-6 text-sm text-red-400">{error}</p>}
      {highlights.length === 0 ? <div className="rounded-xl border border-white/10 bg-bjk-dark p-12 text-center text-white/40">No videos yet.</div> : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {highlights.map((highlight) => {
            const ytId = extractYouTubeId(highlight.video_url);
            const canManage = isAdmin || highlight.user_id === session?.user.id;
            return (
              <div key={highlight.id} className="overflow-hidden rounded-xl border border-white/10 bg-bjk-dark transition-all-smooth hover:border-white/30 hover:shadow-xl card-enter">
                {editingId === highlight.id ? <div className="p-4"><HighlightForm heading="Edit Video" fieldTitle={title} videoUrl={videoUrl} caption={caption} error={error} submitLabel="Save Changes" onVideoUrl={setVideoUrl} onTitle={setTitle} onCaption={setCaption} onSubmit={saveEdit} onCancel={resetForm} /></div> : <>
                  <div className="relative aspect-video overflow-hidden bg-bjk-black">{ytId ? <iframe src={`https://www.youtube.com/embed/${ytId}?rel=0`} title={highlight.title || "Highlight"} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : <div className="flex h-full items-center justify-center text-white/30">Invalid video</div>}</div>
                  <div className="p-4">{highlight.title && <h3 className="font-display text-base font-semibold uppercase">{highlight.title}</h3>}{highlight.caption && <p className="mt-1 text-sm text-white/50">{highlight.caption}</p>}<a href={highlight.video_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-white/50 underline transition-colors hover:text-white">Open on YouTube</a><div className="mt-3 flex items-center justify-between gap-3"><span className="text-xs text-white/40">by {highlight.profiles?.username ?? "unknown"}</span>{canManage && <div className="flex gap-3"><button onClick={() => startEdit(highlight)} className="text-xs text-white/40 transition-colors hover:text-white">Edit</button><button onClick={() => deleteHighlight(highlight.id)} className="text-xs text-white/30 transition-colors hover:text-red-400">Delete</button></div>}</div></div>
                </>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
