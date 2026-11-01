import { useEffect, useRef, useState } from "react";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { supabase } from "./lib/supabase";
import Players from "./pages/Players";
import PlayerDetail from "./pages/PlayerDetail";
import Scrims from "./pages/Scrims";
import ScrimDetail from "./pages/ScrimDetail";
import Rankings from "./pages/Rankings";
import Highlights from "./pages/Highlights";
import Admin from "./pages/Admin";

const STADIUM_BG = "/images/xvcxvxvx%20copy.jpg";
const BJK_LOGO = "https://commons.wikimedia.org/wiki/Special:FilePath/Logo_of_Beşiktaş_JK.svg";

export default function App() {
  const { isAdmin, profile } = useAuth();
  const [backgroundVideoUrl, setBackgroundVideoUrl] = useState<string | null>(null);
  const [backgroundVideoVolume, setBackgroundVideoVolume] = useState(50);
  const [banned, setBanned] = useState(false);
  const [banReason, setBanReason] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const navLabel = profile ? profile.username : isAdmin ? "Admin" : "Sign In";

  useEffect(() => {
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-ip-ban`, { headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` } })
      .then((res) => res.json())
      .then((result: { banned?: boolean; reason?: string | null }) => {
        if (result.banned) { setBanned(true); setBanReason(result.reason ?? null); }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    supabase.from("site_settings").select("background_video_url, background_video_volume").eq("id", 1).maybeSingle().then(({ data }) => {
      if (!active) return;
      const settings = data as { background_video_url?: string | null; background_video_volume?: number } | null;
      setBackgroundVideoUrl(settings?.background_video_url ?? null);
      setBackgroundVideoVolume(settings?.background_video_volume ?? 50);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = backgroundVideoVolume / 100;
      videoRef.current.muted = backgroundVideoVolume === 0;
    }
  }, [backgroundVideoVolume]);

  if (banned) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
        <div className="max-w-md text-center">
          <h1 className="font-display text-5xl font-bold uppercase tracking-wider text-red-500">Access Denied</h1>
          <p className="mt-4 text-lg text-white/70">Your IP address has been banned by an administrator.</p>
          {banReason && <p className="mt-2 text-sm text-white/50">Reason: {banReason}</p>}
          <p className="mt-6 text-sm text-white/40">If you believe this is a mistake, contact the site administration.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden text-white">
      <div className="fixed inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${STADIUM_BG})` }} />
      {backgroundVideoUrl && <video ref={videoRef} src={backgroundVideoUrl} autoPlay loop playsInline className="pointer-events-none fixed left-1/2 top-1/2 h-[56.25vw] min-h-full w-[177.78vh] min-w-full -translate-x-1/2 -translate-y-1/2 object-cover opacity-20" aria-hidden="true" onLoadedMetadata={() => { if (videoRef.current) { videoRef.current.volume = backgroundVideoVolume / 100; if (backgroundVideoVolume === 0) videoRef.current.muted = true; } }} />}
      <div className="fixed inset-0 bg-black/70" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_center,transparent_15%,rgba(0,0,0,.65)_100%)]" />
      <div className="relative z-10">
        <header className="sticky top-0 z-50 border-b border-white/10 bg-black/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4">
            <div className="flex shrink-0 items-center gap-3"><img src={BJK_LOGO} alt="Beşiktaş JK" className="h-14 w-11 object-contain" /><h1 className="font-display text-xl font-bold tracking-wide">BEŞİKTAŞ</h1></div>
            <nav className="flex min-w-0 flex-1 justify-end gap-1 overflow-x-auto pb-1 sm:gap-2"><NavItem to="/" label="Squad" /><NavItem to="/scrims" label="Scrims" /><NavItem to="/rankings" label="Rankings" /><NavItem to="/highlights" label="Highlights" /><NavItem to="/admin" label={navLabel} /></nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8"><Routes><Route path="/" element={<Players />} /><Route path="/player/:id" element={<PlayerDetail />} /><Route path="/scrims" element={<Scrims />} /><Route path="/scrim/:id" element={<ScrimDetail />} /><Route path="/rankings" element={<Rankings />} /><Route path="/highlights" element={<Highlights />} /><Route path="/admin" element={<Admin />} /></Routes></main>
        <footer className="border-t border-white/10 py-6 text-center text-xs text-white/40">Beşiktaş &middot; Black &amp; White</footer>
      </div>
    </div>
  );
}

function NavItem({ to, label }: { to: string; label: string }) {
  return <NavLink to={to} end={to === "/"} className={({ isActive }) => `shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-all sm:px-4 ${isActive ? "bg-white text-black" : "text-white/60 hover:bg-white/10 hover:text-white"}`}>{label}</NavLink>;
}

export function RootApp() {
  return <BrowserRouter><App /></BrowserRouter>;
}
