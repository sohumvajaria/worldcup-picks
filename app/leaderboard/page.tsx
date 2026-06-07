import { cookies } from "next/headers";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import ConfettiEffect from "@/components/ConfettiEffect";

interface LeaderboardEntry {
  id: string;
  user_id: string;
  total_points: number;
  last_updated: string;
  email: string;
}

async function fetchLeaderboard(): Promise<{ tournament: string | null; rows: LeaderboardEntry[] }> {
  const supabase = createClient(await cookies());

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name")
    .in("status", ["active", "upcoming"])
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (!tournament) return { tournament: null, rows: [] };

  const { data, error } = await supabase.rpc("get_leaderboard_with_emails", {
    p_tournament_id: tournament.id,
    p_limit: 50,
  });

  if (error) throw new Error(`Leaderboard fetch failed: ${error.message}`);

  return { tournament: tournament.name, rows: (data ?? []) as LeaderboardEntry[] };
}

export default async function LeaderboardPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  const currentUserId = user?.id ?? null;

  const { tournament, rows } = await fetchLeaderboard();

  const currentUserRank = currentUserId
    ? rows.findIndex((r) => r.user_id === currentUserId) + 1
    : 0;

  return (
    <main style={{ minHeight: "100vh", padding: "0 24px" }}>
      {currentUserRank >= 1 && currentUserRank <= 3 && (
        <ConfettiEffect rank={currentUserRank} />
      )}

      <div style={{ maxWidth: 640, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ paddingTop: 64, paddingBottom: 40, borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div>
              {tournament && (
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--accent)", marginBottom: 8 }}>
                  {tournament}
                </p>
              )}
              <h1
                style={{
                  fontFamily: "var(--font-bebas)",
                  fontSize: "clamp(56px, 12vw, 96px)",
                  letterSpacing: "0.04em",
                  lineHeight: 0.9,
                  color: "white",
                  margin: 0,
                }}
              >
                LEADERBOARD
              </h1>
              {/* Green rule */}
              <div style={{ width: 36, height: 2, background: "var(--accent)", marginTop: 14 }} />
            </div>
            <Link
              href="/dashboard"
              style={{
                fontSize: 12,
                color: "var(--muted)",
                textDecoration: "none",
                paddingTop: 8,
                whiteSpace: "nowrap",
              }}
            >
              ← Dashboard
            </Link>
          </div>
        </div>

        {!tournament ? (
          <p style={{ fontSize: 13, color: "var(--muted)", padding: "40px 0" }}>
            No active tournament found.
          </p>
        ) : rows.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--muted)", padding: "40px 0" }}>
            No entries yet. Be the first to submit picks!
          </p>
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden sm:table" style={{ width: "100%", borderCollapse: "collapse", marginTop: 32 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ width: 56, padding: "0 16px 14px 0", textAlign: "left", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#555" }}>
                    #
                  </th>
                  <th style={{ padding: "0 16px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#555" }}>
                    Player
                  </th>
                  <th style={{ padding: "0 0 14px", textAlign: "right", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#555" }}>
                    Points
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry, index) => {
                  const rank = index + 1;
                  const isMe = entry.user_id === currentUserId;
                  return (
                    <tr
                      key={entry.id}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        background: isMe ? "rgba(0,212,106,0.04)" : "transparent",
                      }}
                    >
                      <td style={{ padding: "14px 16px 14px 0", verticalAlign: "middle" }}>
                        <RankLabel rank={rank} />
                      </td>
                      <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                        <span style={{ fontSize: 14, color: isMe ? "var(--accent)" : "#e8e8ed" }}>
                          {entry.email}
                        </span>
                        {isMe && (
                          <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--accent)", marginLeft: 10 }}>
                            you
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "14px 0", textAlign: "right", verticalAlign: "middle" }}>
                        <span
                          style={{
                            fontFamily: "var(--font-bebas)",
                            fontSize: 22,
                            letterSpacing: "0.04em",
                            color: isMe ? "var(--accent)" : "#e8e8ed",
                          }}
                        >
                          {entry.total_points.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile list */}
            <div className="sm:hidden" style={{ marginTop: 32 }}>
              {rows.map((entry, index) => {
                const rank = index + 1;
                const isMe = entry.user_id === currentUserId;
                return (
                  <div
                    key={entry.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "14px 0",
                      borderBottom: "1px solid var(--border)",
                      background: isMe ? "rgba(0,212,106,0.04)" : "transparent",
                    }}
                  >
                    <div style={{ width: 28, flexShrink: 0 }}>
                      <RankLabel rank={rank} />
                    </div>
                    <p style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, color: isMe ? "var(--accent)" : "#e8e8ed", margin: 0 }}>
                      {entry.email}
                      {isMe && <span style={{ fontSize: 10, color: "var(--accent)", marginLeft: 8, opacity: 0.7 }}>(you)</span>}
                    </p>
                    <span
                      style={{
                        fontFamily: "var(--font-bebas)",
                        fontSize: 20,
                        letterSpacing: "0.04em",
                        flexShrink: 0,
                        color: isMe ? "var(--accent)" : "#e8e8ed",
                      }}
                    >
                      {entry.total_points.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div style={{ height: 64 }} />
      </div>
    </main>
  );
}

function RankLabel({ rank }: { rank: number }) {
  const color =
    rank === 1 ? "var(--gold)"
    : rank === 2 ? "var(--silver)"
    : rank === 3 ? "var(--bronze)"
    : "var(--muted)";
  return (
    <span
      style={{
        fontFamily: "var(--font-bebas)",
        fontSize: rank <= 3 ? 18 : 15,
        letterSpacing: "0.04em",
        color,
      }}
    >
      {rank}
    </span>
  );
}
