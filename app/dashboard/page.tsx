"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

interface Tournament {
  id: string;
  name: string;
  status: string;
}

interface PickedTeam {
  name: string;
  logo_url: string | null;
  country_code: string | null;
}

interface PickedPlayer {
  name: string;
  position: string | null;
}

interface PicksSummary {
  teams: PickedTeam[];
  players: PickedPlayer[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("Player");
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [totalPoints, setTotalPoints] = useState<number | null>(null);
  const [picksSummary, setPicksSummary] = useState<PicksSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth");
        return;
      }

      setEmail(user.email ?? null);
      setDisplayName(user.email?.split("@")[0] ?? "Player");

      const { data: tourney } = await supabase
        .from("tournaments")
        .select("id, name, status")
        .in("status", ["active", "upcoming"])
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

      if (tourney) {
        setTournament(tourney);

        const [{ data: lb }, { data: picksData }] = await Promise.all([
          supabase
            .from("leaderboard")
            .select("total_points")
            .eq("user_id", user.id)
            .eq("tournament_id", tourney.id)
            .single(),
          supabase
            .from("user_picks")
            .select(`
              id,
              team_picks ( team_id, teams ( name, logo_url, country_code ) ),
              player_picks ( player_id, players ( name, position ) )
            `)
            .eq("user_id", user.id)
            .eq("tournament_id", tourney.id)
            .single(),
        ]);

        setTotalPoints(lb?.total_points ?? null);

        if (picksData) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const teams = (picksData.team_picks as any[]).map((tp: any) => ({
            name: tp.teams?.name ?? "Unknown",
            logo_url: tp.teams?.logo_url ?? null,
            country_code: tp.teams?.country_code ?? null,
          }));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const players = (picksData.player_picks as any[]).map((pp: any) => ({
            name: pp.players?.name ?? "Unknown",
            position: pp.players?.position ?? null,
          }));
          setPicksSummary({ teams, players });
        }
      }

      setLoading(false);
    }

    load();
  }, [router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="block h-1.5 w-1.5 rounded-full animate-pulse"
                style={{ background: "var(--muted)", animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
          <p className="text-xs" style={{ color: "var(--muted)" }}>Loading…</p>
        </div>
      </main>
    );
  }

  const isActive = tournament?.status === "active";

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="mx-auto max-w-xl">

        {/* Header */}
        <div className="mb-10 flex items-start justify-between gap-4">
          <div>
            <p
              className="mb-1 text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--accent)" }}
            >
              Welcome back
            </p>
            <h1 className="font-display text-5xl tracking-wide text-white">
              {displayName.toUpperCase()}
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              {email}
            </p>
          </div>

          {tournament && (
            <div
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-widest"
              style={{
                background: isActive ? "rgba(0,255,135,0.12)" : "rgba(255,255,255,0.05)",
                color: isActive ? "var(--accent)" : "var(--muted)",
                border: `1px solid ${isActive ? "rgba(0,255,135,0.25)" : "rgba(255,255,255,0.08)"}`,
              }}
            >
              {tournament.status}
            </div>
          )}
        </div>

        {/* Points card */}
        <div
          className="mb-6 rounded-2xl px-8 py-8 text-center"
          style={{
            background: "linear-gradient(135deg, rgba(0,255,135,0.07) 0%, rgba(0,255,135,0.02) 100%)",
            border: "1px solid rgba(0,255,135,0.14)",
          }}
        >
          <p
            className="mb-3 text-xs font-semibold uppercase tracking-widest"
            style={{ color: "var(--muted)" }}
          >
            Total Points
          </p>
          <p
            className="font-display text-8xl leading-none tracking-wider"
            style={{ color: "var(--accent)" }}
          >
            {totalPoints !== null ? totalPoints.toLocaleString() : "—"}
          </p>
          {tournament && (
            <p className="mt-4 text-sm" style={{ color: "var(--muted)" }}>
              {tournament.name}
            </p>
          )}
          {totalPoints === null && !picksSummary && tournament && (
            <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
              Submit your picks to get on the board
            </p>
          )}
        </div>

        {/* Picks summary */}
        {picksSummary && (
          <div
            className="mb-6 rounded-2xl p-5"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="mb-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                Teams
              </p>
              <div className="flex flex-col gap-2">
                {picksSummary.teams.map((team, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    {team.logo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={team.logo_url} alt={team.name} className="h-5 w-5 flex-shrink-0 object-contain" />
                    )}
                    <span className="text-sm font-medium text-white">{team.name}</span>
                    {team.country_code && (
                      <span className="text-xs" style={{ color: "var(--muted)" }}>{team.country_code}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div
              className="my-4"
              style={{ borderTop: "1px solid var(--border)" }}
            />

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                Players
              </p>
              <div className="flex flex-col gap-2">
                {picksSummary.players.map((player, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <span className="text-sm font-medium text-white">{player.name}</span>
                    {player.position && (
                      <span className="text-xs" style={{ color: "var(--muted)" }}>{player.position}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Nav cards */}
        <div className="grid grid-cols-2 gap-4">
          <Link
            href="/picks"
            className="rounded-2xl p-6 transition-all duration-200 hover:scale-[1.02]"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="mb-3 text-3xl">⚽</div>
            <p className="mb-1 text-base font-bold text-white">My Picks</p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
              {picksSummary ? "View or swap your selections" : "Make your selections"}
            </p>
          </Link>

          <Link
            href="/leaderboard"
            className="rounded-2xl p-6 transition-all duration-200 hover:scale-[1.02]"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="mb-3 text-3xl">🏆</div>
            <p className="mb-1 text-base font-bold text-white">Leaderboard</p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
              See how you rank
            </p>
          </Link>
        </div>

        <p className="mt-8 text-center text-xs" style={{ color: "var(--muted)" }}>
          Signed in as {email}
        </p>
      </div>
    </main>
  );
}
