import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type ProfileData = { user_id: string; username: string; description: string; photo_url: string | null; role: string; is_owner: boolean; is_banned: boolean };

type AuthContextValue = {
  session: Session | null;
  profile: ProfileData | null;
  isAdmin: boolean;
  isOwner: boolean;
  isScrimHoster: boolean;
  loading: boolean;
  authError: string | null;
  signIn: (username: string, password: string) => Promise<string | null>;
  signUp: (username: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const emailFor = (username: string) => `${username.trim().toLowerCase()}@member.local`;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const profileRequest = useRef(0);

  async function refreshProfile(nextSession: Session | null) {
    const requestId = ++profileRequest.current;
    if (!nextSession) { setProfile(null); setAuthError(null); return; }
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, username, description, photo_url, role, is_owner, is_banned")
        .eq("user_id", nextSession.user.id)
        .maybeSingle();
      if (requestId !== profileRequest.current) return;
      if (error) { console.error("Profile load error:", error.message); setAuthError("User information could not be loaded. Please sign in again."); setProfile(null); return; }
      if (!data) {
        // Profile doesn't exist yet — create it via RPC
        const username = nextSession.user.email?.replace(/@member\.local$/, "") ?? "";
        if (username) {
          const { error: rpcError } = await supabase.rpc("register_profile", { p_username: username });
          if (rpcError) { console.error("Profile creation failed:", rpcError.message); setAuthError("Your profile could not be created. Please sign out and sign in again."); setProfile(null); return; }
          const { data: retryData } = await supabase
            .from("profiles")
            .select("user_id, username, description, photo_url, role, is_owner, is_banned")
            .eq("user_id", nextSession.user.id)
            .maybeSingle();
          if (!retryData) setAuthError("Your profile was not found. Please sign in again.");
          setProfile(retryData as ProfileData | null);
        }
        return;
      }
      setAuthError(null);
      const profileData = data as ProfileData | null;
      if (profileData?.is_banned) {
        await supabase.auth.signOut();
        setProfile(null);
        setAuthError("Your account has been banned by an administrator.");
        return;
      }
      setProfile(profileData);
    } catch (err) {
      console.error("Profile refresh error:", err);
      setProfile(null);
    }
  }

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        return refreshProfile(data.session);
      })
      .catch((err) => { console.error("Session load error:", err); setAuthError("Your session could not be loaded."); })
      .finally(() => { if (mounted) setLoading(false); });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      (async () => {
        setAuthError(null);
        setSession(nextSession);
        await refreshProfile(nextSession);
      })();
    });

    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  async function signIn(username: string, password: string) {
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: emailFor(username), password });
      if (error) return "Sign in failed. Check your username and password.";
      return null;
    } catch {
      return "Connection error. Please try again.";
    }
  }

  async function signUp(username: string, password: string) {
    setAuthError(null);
    const clean = username.trim().toLowerCase();
    if (!/^[a-z0-9._-]{1,24}$/.test(clean)) return "Username can use letters, numbers, dots, dashes, or underscores.";
    try {
      const { data, error } = await supabase.auth.signUp({ email: emailFor(clean), password });
      if (error) {
        const detail = error.message.toLowerCase();
        if (detail.includes("already registered") || detail.includes("already been registered") || detail.includes("user already exists")) return "That username is already in use.";
        if (detail.includes("email")) return "That username was not accepted. Please choose another one.";
        console.error("Signup failed:", error.message);
        return "Account creation failed. Please try again.";
      }
      if (data.session) {
        const { error: profileError } = await supabase.rpc("register_profile", { p_username: clean });
        if (profileError) {
          console.error("Profile creation failed:", profileError.message);
          await supabase.auth.signOut();
          return "The account was created, but the profile could not be prepared. Please sign in again.";
        }
        await refreshProfile(data.session);
        return null;
      }
      return "Account created. You can now sign in.";
    } catch {
      return "Connection error. Please try again.";
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }

  const value = useMemo<AuthContextValue>(() => ({
    session,
    profile,
    isAdmin: profile?.is_owner === true || profile?.role === "admin",
    isOwner: profile?.is_owner === true,
    isScrimHoster: profile?.is_owner === true || profile?.role === "admin" || profile?.role === "scrim_hoster",
    loading,
    authError,
    signIn,
    signUp,
    signOut,
  }), [session, profile, loading, authError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is missing");
  return value;
}
