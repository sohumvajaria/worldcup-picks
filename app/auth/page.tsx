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
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
      }}
    >
      {/* Heading — full bleed, no card */}
      <div style={{ textAlign: "center", marginBottom: 56 }}>
        <h1
          style={{
            fontFamily: "var(--font-bebas)",
            fontSize: "clamp(72px, 16vw, 152px)",
            letterSpacing: "0.04em",
            lineHeight: 0.88,
            color: "white",
            margin: 0,
          }}
        >
          WORLDCUP
          <br />
          <span style={{ color: "var(--accent)" }}>PICKS</span>{" "}
          <span style={{ color: "white" }}>2026</span>
        </h1>
        <p
          style={{
            color: "var(--muted)",
            fontSize: 13,
            marginTop: 20,
            letterSpacing: "0.04em",
          }}
        >
          Pick your champions. Win glory.
        </p>
      </div>

      {/* Mode tabs */}
      <div style={{ display: "flex", gap: 28, marginBottom: 40 }}>
        {(["signin", "signup"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            style={{
              background: "none",
              border: "none",
              padding: "0 0 6px",
              borderBottom: `2px solid ${mode === m ? "var(--accent)" : "transparent"}`,
              color: mode === m ? "white" : "var(--muted)",
              fontSize: 13,
              fontWeight: mode === m ? 600 : 400,
              letterSpacing: "0.03em",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      {/* Form — floating in open space, no card */}
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 340,
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label
            htmlFor="email"
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--muted)",
            }}
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
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "12px 16px",
              fontSize: 14,
              color: "white",
              outline: "none",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label
            htmlFor="password"
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--muted)",
            }}
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
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "12px 16px",
              fontSize: 14,
              color: "white",
              outline: "none",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
          />
        </div>

        {error && (
          <p style={{ fontSize: 13, color: "#e05555", margin: 0 }}>{error}</p>
        )}
        {notice && (
          <p style={{ fontSize: 13, color: "var(--accent)", margin: 0 }}>{notice}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 4,
            background: "var(--accent)",
            color: "#0a0a0f",
            border: "none",
            borderRadius: 999,
            padding: "13px 24px",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            transition: "opacity 0.15s",
            opacity: loading ? 0.55 : 1,
          }}
        >
          {loading
            ? mode === "signin" ? "Signing in…" : "Creating account…"
            : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>
    </main>
  );
}
