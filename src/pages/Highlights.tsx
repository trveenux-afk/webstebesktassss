import { useCallback, useEffect, useState } from "react";
import { supabase, type Highlight } from "../lib/supabase";
import { useAuth } from "../lib/auth";

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return match?.[1] ?? null;
}

function isMp4(url: string): boolean {
  return url.split("?")[0].toLowerCase().endsWith(".mp4");
}

type HighlightFormProps = {
  heading: string;
  fieldTitle: string;
  videoUrl: string;
  caption: string;
  file: File | null;
  error: string;
  submitLabel: string;
  onVideoUrl: (value: string) => void;
  onTitle: (value: string) => void;
  onCaption: (value: string) => void;
  onFile: (value: File | null) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel?: () => void;
};

function HighlightForm({ heading, fieldTitle, videoUrl, caption, file, error, submitLabel, onVideoUrl, onTitle, onCaption, onFile, onSubmit, onCancel }: HighlightFormProps) {
  return (
    <form onSubmit={onSubmit} className="mb-8 rounded-xl border border-white/10 bg-bjk-dark p-6 card-enter">
      <h3 className="mb-4 font-display text-lg font-semibold uppercase">{heading}</h3>
      <div className="grid gap-4">
        <label className="block"><span className="mb-1 block text-xs uppercase tracking-wide text-white/50">YouTube URL</span><input value={videoUrl} onChange={(event) => onVideoUrl(event.target.value)} placeholder="Optional when uploading an MP4" className="w-full rounded-lg border border-white/10 bg-bjk-black px-3 py-2 text-sm" /></label>
        <label className="block"><span className="mb-1 block text-xs uppercase tracking-wide text-white/50">MP4 file</span><input type="file" accept="video/mp4" onChange={(event) => onFile(event.target.files?.[0] ?? null)} className="block w-full text-sm text-white/60 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-black" />{file && <span className="mt-1 block text-xs text-white/40">{file.name}</span>}</label>
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
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    setVideoUrl(""); setFile(null); setTitle(""); setCaption(""); setError(""); setEditingId(null);
  }

  async function resolveVideoUrl(): Promise<string | null> {
    const cleanUrl = videoUrl.trim();
    if (file) {
      if (file.type !== "video/mp4" || file.size > 200 * 1024 * 1024 || !session) return null;
      const path = `${session.user.id}/${crypto.randomUUID()}.mp4`;
      const { error: uploadError } = await supabase.storage.from("highlights").upload(path, file, { contentType: "video/mp4", upsert: false });
      if (uploadError) return null;
      return supabase.storage.from("highlights").getPublicUrl(path).data.publicUrl;
    }
    return extractYouTubeId(cleanUrl) ? cleanUrl : null;
  }

  async function addHighlight(event: React.FormEvent) {
    event.preventDefault();
    if (!isAdmin) return;
    setBusy(true); setError("");
    const resolvedUrl = await resolveVideoUrl();
    if (!resolvedUrl) { setError("Add a valid YouTube URL or an MP4 file up to 200 MB."); setBusy(false); return; }
    const { error: insertError } = await supabase.from("highlights").insert({ video_url: resolvedUrl, title: title.trim(), caption: caption.trim() });
    if (insertError) { setError("The video could not be added. Please try again."); setBusy(false); return; }
    resetForm(); setShowAdd(false); setBusy(false); load();
  }

  function startEdit(highlight: Highlight) {
    setEditingId(highlight.id); setVideoUrl(highlight.video_url); setTitle(highlight.title); setCaption(highlight.caption); setFile(null); setError("");
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editingId || !isAdmin) return;
    setBusy(true); setError("");
    const resolvedUrl = file ? await resolveVideoUrl() : (extractYouTubeId(videoUrl) || (isMp4(videoUrl) ? videoUrl : null));
    if (!resolvedUrl) { setError("Use a valid YouTube URL or MP4 file."); setBusy(false); return; }
    const { error: updateError } = await supabase.from("highlights").update({ video_url: resolvedUrl, title: title.trim(), caption: caption.trim() }).eq("id", editingId);
    if (updateError) { setError("The video could not be updated. Please try again."); setBusy(false); return; }
    resetForm(); setBusy(false); load();
  }

  async function deleteHighlight(id: string) {
    if (!isAdmin || !confirm("Delete this video?")) return;
    const { error: deleteError } = await supabase.from("highlights").delete().eq("id", id);
    if (deleteError) { setError("The video could not be deleted. Please try again."); return; }
    load();
  }

  if (loading) return <div className="flex h-64 items-center justify-center text-white/40">Loading...</div>;

  return (
    <div className="fade-in">
      <div className="mb-8 flex items-center justify-between gap-4"><div><h2 className="font-display text-3xl font-bold uppercase tracking-wide">Highlights</h2><p className="mt-1 text-sm text-white/50">{highlights.length} videos shared</p></div>{isAdmin && <button onClick={() => { if (showAdd) resetForm(); setShowAdd(!showAdd); }} className="shrink-0 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium transition-all-smooth hover:bg-white hover:text-black">{showAdd ? "Cancel" : "+ Add Video"}</button>}</div>
      {isAdmin && showAdd && <HighlightForm heading="New Video" fieldTitle={title} videoUrl={videoUrl} caption={caption} file={file} error={error} submitLabel={busy ? "Uploading..." : "Share"} onVideoUrl={setVideoUrl} onTitle={setTitle} onCaption={setCaption} onFile={setFile} onSubmit={addHighlight} />}
      {!isAdmin && <p className="mb-6 rounded-lg border border-white/10 bg-bjk-dark px-4 py-3 text-sm text-white/50">Only admins can add or manage videos.</p>}
      {error && !editingId && !showAdd && <p className="mb-6 text-sm text-red-400">{error}</p>}
      {highlights.length === 0 ? <div className="rounded-xl border border-white/10 bg-bjk-dark p-12 text-center text-white/40">No videos yet.</div> : <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{highlights.map((highlight) => { const ytId = extractYouTubeId(highlight.video_url); return <div key={highlight.id} className="overflow-hidden rounded-xl border border-white/10 bg-bjk-dark transition-all-smooth hover:border-white/30 hover:shadow-xl card-enter">{editingId === highlight.id ? <div className="p-4"><HighlightForm heading="Edit Video" fieldTitle={title} videoUrl={videoUrl} caption={caption} file={file} error={error} submitLabel={busy ? "Saving..." : "Save Changes"} onVideoUrl={setVideoUrl} onTitle={setTitle} onCaption={setCaption} onFile={setFile} onSubmit={saveEdit} onCancel={resetForm} /></div> : <><div className="relative aspect-video overflow-hidden bg-bjk-black">{ytId ? <iframe src={`https://www.youtube.com/embed/${ytId}?rel=0`} title={highlight.title || "Highlight"} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : isMp4(highlight.video_url) ? <video src={highlight.video_url} controls preload="metadata" className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-white/30">Invalid video</div>}</div><div className="p-4">{highlight.title && <h3 className="font-display text-base font-semibold uppercase">{highlight.title}</h3>}{highlight.caption && <p className="mt-1 text-sm text-white/50">{highlight.caption}</p>}<a href={highlight.video_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-white/50 underline transition-colors hover:text-white">Open video</a><div className="mt-3 flex items-center justify-between gap-3"><span className="text-xs text-white/40">by {highlight.profiles?.username ?? "unknown"}</span>{isAdmin && <div className="flex gap-3"><button onClick={() => startEdit(highlight)} className="text-xs text-white/40 transition-colors hover:text-white">Edit</button><button onClick={() => deleteHighlight(highlight.id)} className="text-xs text-white/30 transition-colors hover:text-red-400">Delete</button></div>}</div></div></>}</div>; })}</div>}
    </div>
  );
}
