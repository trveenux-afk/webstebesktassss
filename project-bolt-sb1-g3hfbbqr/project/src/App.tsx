import { Routes, Route, NavLink } from "react-router-dom";
import Players from "./pages/Players";
import PlayerDetail from "./pages/PlayerDetail";
import Scrims from "./pages/Scrims";
import ScrimDetail from "./pages/ScrimDetail";
import Rankings from "./pages/Rankings";
import Highlights from "./pages/Highlights";
import Admin from "./pages/Admin";
import { useAuth } from "./lib/auth";

const STADIUM_BG = "/images/xvcxvxvx%20copy.jpg";
const BJK_LOGO = "https://commons.wikimedia.org/wiki/Special:FilePath/Logo_of_Beşiktaş_JK.svg";
const YOUTUBE_VIDEO_ID = "cuF3Zhb6GNg";

function App() {
  const { isAdmin, profile } = useAuth();
  const navLabel = profile ? profile.username : isAdmin ? "Admin" : "Sign In";
  return <div className="relative min-h-screen overflow-hidden text-white"><div className="fixed inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${STADIUM_BG})` }} /><div className="fixed inset-0 bg-black/70" /><iframe title="Beşiktaş background video" src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&mute=1&loop=1&playlist=${YOUTUBE_VIDEO_ID}&controls=0&playsinline=1&rel=0`} className="pointer-events-none fixed left-1/2 top-1/2 h-[56.25vw] min-h-full w-[177.78vh] min-w-full -translate-x-1/2 -translate-y-1/2 opacity-20" allow="autoplay; encrypted-media" aria-hidden="true" /><div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_center,transparent_15%,rgba(0,0,0,.65)_100%)]" /><div className="relative z-10"><header className="sticky top-0 z-50 border-b border-white/10 bg-black/85 backdrop-blur-md"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4"><div className="flex items-center gap-3"><img src={BJK_LOGO} alt="Beşiktaş JK" className="h-14 w-11 object-contain" /><h1 className="font-display text-xl font-bold tracking-wide">BEŞİKTAŞ</h1></div><nav className="flex items-center gap-1 sm:gap-2"><NavItem to="/" label="Squad" /><NavItem to="/scrims" label="Scrims" /><NavItem to="/rankings" label="Rankings" /><NavItem to="/highlights" label="Highlights" /><NavItem to="/admin" label={navLabel} /></nav></div></header><main className="mx-auto max-w-6xl px-4 py-8"><Routes><Route path="/" element={<Players />} /><Route path="/player/:id" element={<PlayerDetail />} /><Route path="/scrims" element={<Scrims />} /><Route path="/scrim/:id" element={<ScrimDetail />} /><Route path="/rankings" element={<Rankings />} /><Route path="/highlights" element={<Highlights />} /><Route path="/admin" element={<Admin />} /></Routes></main><footer className="border-t border-white/10 py-6 text-center text-xs text-white/40">Beşiktaş &middot; Black &amp; White</footer></div></div>;
}
function NavItem({ to, label }: { to: string; label: string }) { return <NavLink to={to} end={to === "/"} className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium transition-all sm:px-4 ${isActive ? "bg-white text-black" : "text-white/60 hover:bg-white/10 hover:text-white"}`}>{label}</NavLink>; }
export default App;
