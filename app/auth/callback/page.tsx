"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { hasSupabaseBrowserConfig } from "@/lib/supabase-browser";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AuthCallback() {
  const configured = hasSupabaseBrowserConfig();
  const [message, setMessage] = useState(configured ? "Completing secure sign-in…" : "Supabase authentication is not configured.");
  const router = useRouter();
  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const code = new URLSearchParams(window.location.search).get("code");
    const complete = async () => {
      if (code) {
        const { error } = await client.auth.exchangeCodeForSession(code);
        if (error) { setMessage(`Sign-in failed: ${error.message}`); return; }
      }
      const { data, error } = await client.auth.getUser();
      if (error || !data.user) { setMessage(error?.message || "Google did not return an authenticated account."); return; }
      router.replace("/profile");
    };
    void complete();
  }, [router]);
  return <main className="auth-callback"><div className="auth-spinner"/><p>{message}</p><Link href="/">Return home</Link></main>;
}
