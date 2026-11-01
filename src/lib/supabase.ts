import { createClient } from "@supabase/supabase-js";
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const PLAYER_POSITIONS = ["CF", "LF", "RF", "CM", "LB", "CB", "RB", "GK", "All Rounder"] as const;
export type PlayerPosition = (typeof PLAYER_POSITIONS)[number];
export type Player = { id: string; name: string; position: string; positions: string[]; photo_url: string | null; card_url: string | null; photo_object_position: string; photo_zoom: number; photo_position_x: number; photo_position_y: number; overall: number; user_id: string | null; created_at: string };
export type Scrim = { id: string; opponent: string; result: string; team_score: number; opponent_score: number; scrim_date: string; created_at: string };
export type ScrimStat = { id: string; scrim_id: string; player_id: string; goals: number; assists: number; tackles: number; saves: number; rating: number; created_at: string };
export const LINEUP_POSITIONS = ["CF", "LF", "RF", "CM", "LB", "RB", "GK"] as const;
export const BENCH_POSITIONS = ["BENCH_1", "BENCH_2", "BENCH_3", "BENCH_4", "BENCH_5"] as const;
export type LineupPosition = (typeof LINEUP_POSITIONS)[number] | (typeof BENCH_POSITIONS)[number];
export function formatLineupPosition(position: LineupPosition): string {
  const benchNumber = position.startsWith("BENCH_") ? Number(position.replace("BENCH_", "")) : 0;
  if (benchNumber > 0) return ["First Bench", "Second Bench", "Third Bench", "Fourth Bench", "Fifth Bench"][benchNumber - 1] ?? position;
  return position;
}
export type ScrimLineup = { id: string; scrim_id: string; player_id: string; position: LineupPosition; created_at: string };
export type ScrimWithStats = Scrim & { scrim_stats: (ScrimStat & { players: Player })[]; scrim_lineups: (ScrimLineup & { players: Player })[] };
export type PlayerWithStats = Player & { total_goals: number; total_assists: number; total_tackles: number; total_saves: number; scrim_count: number; avg_rating: number };
export type Profile = { user_id: string; username: string; description: string; photo_url: string | null; role: string; is_owner: boolean; is_banned: boolean; created_at?: string };
export type Highlight = { id: string; user_id: string; video_url: string; title: string; caption: string; created_at: string; profiles: { username: string } | null };
export type SiteSettings = { id: number; object_fit: "cover" | "contain"; object_position: string; zoom: number; card_size: "small" | "medium" | "large"; background_video_url: string | null; background_video_volume: number; background_video_opacity: number; updated_at: string };
