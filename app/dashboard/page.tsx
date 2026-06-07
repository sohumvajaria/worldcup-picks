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
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="animate-pulse"
              style={{
                display: "block",
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "#333",
                animationDelay: `${i * 150}ms`,
              }}
            />
          ))}
        </div>
      </main>
    );
  }

  const isActive = tournament?.status === "active";

  return (
    <main style={{ minHeight: "100vh", padding: "0 24px" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>

        {/* Jersey nameplate — massive username */}
        <div style={{ paddingTop: 64, paddingBottom: 40, borderBottom: "1px solid var(--border)" }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              color: "var(--accent)",
              marginBottom: 8,
            }}
          >
            Your Dashboard
          </p>
          <h1
            style={{
              fontFamily: "var(--font-bebas)",
              fontSize: "clamp(80px, 18vw, 160px)",
              letterSpacing: "0.03em",
              lineHeight: 0.86,
              color: "white",
              margin: 0,
            }}
          >
            {displayName.toUpperCase()}
          </h1>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>{email}</p>
        </div>

        {/* Points — no card, just section with background tone */}
        <div
          style={{
            background: "var(--surface)",
            margin: "0 -24px",
            padding: "36px 24px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ maxWidth: 600, margin: "0 auto", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)", marginBottom: 8 }}>
                Total Points
              </p>
              <p
                style={{
                  fontFamily: "var(--font-bebas)",
                  fontSize: "clamp(64px, 12vw, 112px)",
                  letterSpacing: "0.02em",
                  lineHeight: 1,
                  color: "var(--accent)",
                  margin: 0,
                }}
              >
                {totalPoints !== null ? totalPoints.toLocaleString() : "—"}
              </p>
            </div>
            <div style={{ textAlign: "right", paddingBottom: 8 }}>
              {tournament && (
                <>
                  <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>{tournament.name}</p>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      color: isActive ? "var(--accent)" : "var(--muted)",
                    }}
                  >
                    {tournament.status}
                  </span>
                </>
              )}
              {totalPoints === null && !picksSummary && tournament && (
                <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                  Submit picks to appear
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Picks summary — plain list, no card */}
        {picksSummary && (
          <div style={{ padding: "36px 0", borderBottom: "1px solid var(--border)" }}>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)", marginBottom: 20 }}>
              Your Picks
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 40px" }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#555", marginBottom: 10 }}>
                  Teams
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {picksSummary.teams.map((team, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {team.logo_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={team.logo_url} alt={team.name} style={{ height: 16, width: 16, objectFit: "contain", flexShrink: 0 }} />
                      )}
                      <span style={{ fontSize: 13, color: "#e8e8ed" }}>{team.name}</span>
                      {team.country_code && (
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>{team.country_code}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#555", marginBottom: 10 }}>
                  Players
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {picksSummary.players.map((player, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontSize: 13, color: "#e8e8ed" }}>{player.name}</span>
                      {player.position && (
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>{player.position}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Nav links — simple, no cards */}
        <div style={{ padding: "36px 0 64px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <Link
              href="/picks"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "20px 0",
                borderBottom: "1px solid var(--border)",
                textDecoration: "none",
              }}
            >
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: "white", margin: 0 }}>
                  {picksSummary ? "My Picks" : "Make Picks"}
                </p>
                <p style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0 0" }}>
                  {picksSummary ? "View or swap your selections" : "Choose your teams and players"}
                </p>
              </div>
              <span style={{ color: "var(--accent)", fontSize: 18, lineHeight: 1 }}>→</span>
            </Link>
            <Link
              href="/leaderboard"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "20px 0",
                borderBottom: "1px solid var(--border)",
                textDecoration: "none",
              }}
            >
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: "white", margin: 0 }}>Leaderboard</p>
                <p style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0 0" }}>See how you rank</p>
              </div>
              <span style={{ color: "var(--accent)", fontSize: 18, lineHeight: 1 }}>→</span>
            </Link>
          </div>
        </div>

      </div>
    </main>
  );
}
