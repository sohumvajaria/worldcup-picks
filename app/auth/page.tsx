"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type Mode = "signin" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    const supabase = createClient();

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          setNotice("Check your email for a confirmation link.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }

      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Heading */}
        <div className="mb-10 text-center">
          <h1
            className="font-display text-6xl tracking-widest"
            style={{ color: "var(--accent)", letterSpacing: "0.12em" }}
          >
            WORLDCUP
          </h1>
          <h2
            className="font-display text-4xl tracking-widest text-white"
            style={{ letterSpacing: "0.08em" }}
          >
            PICKS 2026
          </h2>
          <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
            Pick your champions. Win glory.
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: "rgba(18, 18, 26, 0.75)",
            backdropFilter: "blur(24px)",
            border: "1px solid rgba(255, 255, 255, 0.07)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          {/* Mode toggle */}
          <div
            className="mb-7 flex rounded-xl p-1"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            {(["signin", "signup"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className="flex-1 rounded-lg py-2 text-sm font-semibold transition-all"
                style={
                  mode === m
                    ? { background: "var(--accent)", color: "#0a0a0f" }
                    : { color: "var(--muted)" }
                }
              >
                {m === "signin" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "var(--muted)" }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="rounded-xl px-4 py-3 text-sm text-white outline-none transition-all placeholder:opacity-30"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.border = "1px solid rgba(0,255,135,0.4)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,255,135,0.08)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border = "1px solid rgba(255,255,255,0.08)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "var(--muted)" }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="rounded-xl px-4 py-3 text-sm text-white outline-none transition-all placeholder:opacity-30"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.border = "1px solid rgba(0,255,135,0.4)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,255,135,0.08)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border = "1px solid rgba(255,255,255,0.08)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            {error && (
              <p
                className="rounded-xl px-4 py-3 text-sm"
                style={{ background: "rgba(255,60,60,0.1)", color: "#ff6b6b", border: "1px solid rgba(255,60,60,0.2)" }}
              >
                {error}
              </p>
            )}

            {notice && (
              <p
                className="rounded-xl px-4 py-3 text-sm"
                style={{ background: "rgba(0,255,135,0.08)", color: "var(--accent)", border: "1px solid rgba(0,255,135,0.2)" }}
              >
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 rounded-xl py-3 text-sm font-bold uppercase tracking-widest transition-all disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: "var(--accent)",
                color: "#0a0a0f",
                boxShadow: "0 4px 24px rgba(0,255,135,0.25)",
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.boxShadow = "0 4px 32px rgba(0,255,135,0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "0 4px 24px rgba(0,255,135,0.25)";
              }}
            >
              {loading
                ? mode === "signin" ? "Signing in…" : "Creating account…"
                : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
