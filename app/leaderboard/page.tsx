import { cookies } from "next/headers";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

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

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="mx-auto max-w-2xl">

        {/* Header */}
        <div className="mb-10 flex items-start justify-between gap-4">
          <div>
            <p
              className="mb-1 text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--accent)" }}
            >
              {tournament ?? "No tournament"}
            </p>
            <h1 className="font-display text-5xl tracking-wide text-white">LEADERBOARD</h1>
          </div>
          <Link
            href="/dashboard"
            className="shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-all"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--muted)",
            }}
          >
            ← Dashboard
          </Link>
        </div>

        {!tournament ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            No active tournament found.
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            No entries yet. Be the first to submit picks!
          </p>
        ) : (
          <>
            {/* Desktop table */}
            <div
              className="hidden overflow-hidden rounded-2xl sm:block"
              style={{ border: "1px solid var(--border)" }}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
                    <th
                      className="w-16 px-5 py-4 text-left text-xs font-semibold uppercase tracking-widest"
                      style={{ color: "var(--muted)" }}
                    >
                      Rank
                    </th>
                    <th
                      className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-widest"
                      style={{ color: "var(--muted)" }}
                    >
                      Player
                    </th>
                    <th
                      className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-widest"
                      style={{ color: "var(--muted)" }}
                    >
                      Points
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((entry, index) => {
                    const rank = index + 1;
                    const isMe = entry.user_id === currentUserId;
                    const isEven = index % 2 === 0;
                    return (
                      <tr
                        key={entry.id}
                        style={{
                          borderBottom: index < rows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                          background: isMe
                            ? "rgba(0,255,135,0.06)"
                            : isEven
                              ? "rgba(255,255,255,0.01)"
                              : "transparent",
                        }}
                      >
                        <td className="px-5 py-4">
                          <RankBadge rank={rank} />
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className="font-medium"
                            style={{ color: isMe ? "var(--accent)" : "var(--foreground)" }}
                          >
                            {entry.email}
                          </span>
                          {isMe && (
                            <span
                              className="ml-2 rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wider"
                              style={{
                                background: "rgba(0,255,135,0.12)",
                                color: "var(--accent)",
                                border: "1px solid rgba(0,255,135,0.2)",
                              }}
                            >
                              You
                            </span>
                          )}
                        </td>
                        <td
                          className="px-5 py-4 text-right font-display text-xl tracking-wide tabular-nums"
                          style={{ color: isMe ? "var(--accent)" : "var(--foreground)" }}
                        >
                          {entry.total_points.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile list */}
            <div className="space-y-2 sm:hidden">
              {rows.map((entry, index) => {
                const rank = index + 1;
                const isMe = entry.user_id === currentUserId;
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 rounded-xl px-4 py-3.5"
                    style={{
                      background: isMe ? "rgba(0,255,135,0.06)" : "var(--surface)",
                      border: `1px solid ${isMe ? "rgba(0,255,135,0.2)" : "var(--border)"}`,
                    }}
                  >
                    <div className="w-8 shrink-0">
                      <RankBadge rank={rank} />
                    </div>
                    <p
                      className="min-w-0 flex-1 truncate text-sm font-medium"
                      style={{ color: isMe ? "var(--accent)" : "var(--foreground)" }}
                    >
                      {entry.email}
                      {isMe && <span className="ml-1.5 text-xs opacity-60">(you)</span>}
                    </p>
                    <p
                      className="shrink-0 font-display text-xl tabular-nums"
                      style={{ color: isMe ? "var(--accent)" : "var(--foreground)" }}
                    >
                      {entry.total_points.toLocaleString()}
                    </p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-full font-display text-base font-bold"
        style={{ background: "rgba(255,215,0,0.15)", color: "var(--gold)", border: "1px solid rgba(255,215,0,0.3)" }}
        title="1st place"
      >
        1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-full font-display text-base font-bold"
        style={{ background: "rgba(184,188,200,0.12)", color: "var(--silver)", border: "1px solid rgba(184,188,200,0.25)" }}
        title="2nd place"
      >
        2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-full font-display text-base font-bold"
        style={{ background: "rgba(205,127,50,0.12)", color: "var(--bronze)", border: "1px solid rgba(205,127,50,0.25)" }}
        title="3rd place"
      >
        3
      </span>
    );
  }
  return (
    <span
      className="font-display text-base tabular-nums"
      style={{ color: "var(--muted)" }}
    >
      {rank}
    </span>
  );
}
