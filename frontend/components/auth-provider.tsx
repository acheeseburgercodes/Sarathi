"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, hasSupabaseBrowserConfig } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

export type SarathiProfile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "user" | "admin";
  created_at: string;
  updated_at: string;
};

type AuthState = {
  configured: boolean;
  loading: boolean;
  user: User | null;
  profile: SarathiProfile | null;
  error: string;
  signInWithPassword: (email: string, password: string, captchaToken: string, destination?: "/profile" | "/admin") => Promise<{ ok: boolean; error?: string }>;
  signUpWithPassword: (name: string, email: string, password: string, captchaToken: string) => Promise<{ ok: boolean; confirmationRequired?: boolean; error?: string }>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  updateName: (fullName: string) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const configured = hasSupabaseBrowserConfig();
  const [loading, setLoading] = useState(configured);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<SarathiProfile | null>(null);
  const [error, setError] = useState("");

  const loadProfile = useCallback(async (activeUser: User | null) => {
    setUser(activeUser);
    if (!activeUser) { setProfile(null); return; }
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const { data, error: profileError } = await client.from("profiles").select("*").eq("id", activeUser.id).maybeSingle();
    if (profileError) setError("Your account is signed in, but the profile table is not ready. Run the auth migration in Supabase.");
    else { setProfile(data as SarathiProfile | null); setError(""); }
  }, []);

  useEffect(() => {
    if (!configured) return;
    const client = getSupabaseBrowserClient();
    if (!client) return;
    let active = true;
    client.auth.getUser().then(({ data, error: authError }) => {
      if (!active) return;
      if (authError && authError.name !== "AuthSessionMissingError") setError(authError.message);
      void loadProfile(data.user).finally(() => active && setLoading(false));
    });
    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      void loadProfile(session?.user ?? null).finally(() => setLoading(false));
    });
    return () => { active = false; subscription.subscription.unsubscribe(); };
  }, [configured, loadProfile]);

  const signInWithPassword = useCallback(async (email: string, password: string, captchaToken: string, destination: "/profile" | "/admin" = "/profile") => {
    const client = getSupabaseBrowserClient();
    if (!client) return { ok: false, error: "Add the public Supabase URL and publishable key to enable sign-in." };
    setError("");
    const { data, error: authError } = await client.auth.signInWithPassword({
      email: email.trim(), password, options: { captchaToken },
    });
    if (authError || !data.user) {
      const message = authError?.message || "Sign-in failed.";
      setError(message); return { ok: false, error: message };
    }
    await loadProfile(data.user);
    router.push(destination);
    return { ok: true };
  }, [loadProfile, router]);

  const signUpWithPassword = useCallback(async (name: string, email: string, password: string, captchaToken: string) => {
    const client = getSupabaseBrowserClient();
    if (!client) return { ok: false, error: "Add the public Supabase URL and publishable key to enable signup." };
    setError("");
    const { data, error: signUpError } = await client.auth.signUp({
      email: email.trim(), password,
      options: {
        captchaToken,
        data: { full_name: name.trim().slice(0, 100) },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/profile")}`,
      },
    });
    if (signUpError || !data.user) {
      const message = signUpError?.message || "Signup failed.";
      setError(message); return { ok: false, error: message };
    }
    if (data.session) { await loadProfile(data.user); router.push("/profile"); }
    return { ok: true, confirmationRequired: !data.session };
  }, [loadProfile, router]);

  const signOut = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const { error: signOutError } = await client.auth.signOut();
    if (signOutError) setError(signOutError.message);
    else { setUser(null); setProfile(null); router.replace("/"); }
  }, [router]);

  const updateName = useCallback(async (fullName: string) => {
    const client = getSupabaseBrowserClient();
    if (!client || !user) return false;
    const cleanName = fullName.trim().slice(0, 100);
    if (!cleanName) { setError("Enter a name before saving."); return false; }
    const { data, error: updateError } = await client.from("profiles").update({ full_name: cleanName }).eq("id", user.id).select("*").single();
    if (updateError) { setError(updateError.message); return false; }
    setProfile(data as SarathiProfile); setError(""); return true;
  }, [user]);

  const getAccessToken = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client) return null;
    const { data } = await client.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const value = useMemo<AuthState>(() => ({ configured, loading, user, profile, error, signInWithPassword, signUpWithPassword, signOut, getAccessToken, updateName, refreshProfile: () => loadProfile(user) }), [configured, loading, user, profile, error, signInWithPassword, signUpWithPassword, signOut, getAccessToken, updateName, loadProfile]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
