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
  const { tournament, rows } = await fetchLeaderboard();

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Leaderboard</h1>
            {tournament && (
              <p className="mt-1 text-sm text-foreground/50">{tournament}</p>
            )}
          </div>
          <Link
            href="/dashboard"
            className="shrink-0 rounded-md border border-foreground/20 px-3 py-1.5 text-sm text-foreground/70 transition-colors hover:border-foreground/50 hover:text-foreground"
          >
            Dashboard
          </Link>
        </div>

        {!tournament ? (
          <p className="text-sm text-foreground/40">No active tournament found.</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-foreground/40">No entries yet. Be the first to submit picks!</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-hidden rounded-lg border border-foreground/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-foreground/10 bg-foreground/[0.03]">
                    <th className="w-14 px-4 py-3 text-left font-medium text-foreground/50">Rank</th>
                    <th className="px-4 py-3 text-left font-medium text-foreground/50">User</th>
                    <th className="px-4 py-3 text-right font-medium text-foreground/50">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((entry, index) => {
                    const rank = index + 1;
                    return (
                      <tr
                        key={entry.id}
                        className="border-b border-foreground/10 last:border-0 transition-colors hover:bg-foreground/[0.02]"
                      >
                        <td className="px-4 py-3">
                          <RankBadge rank={rank} />
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          {entry.email}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
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
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 rounded-lg border border-foreground/10 px-4 py-3"
                  >
                    <RankBadge rank={rank} />
                    <p className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {entry.email}
                    </p>
                    <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                      {entry.total_points.toLocaleString()}
                      <span className="ml-1 font-normal text-foreground/40">pts</span>
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
    return <span className="text-base">🥇</span>;
  }
  if (rank === 2) {
    return <span className="text-base">🥈</span>;
  }
  if (rank === 3) {
    return <span className="text-base">🥉</span>;
  }
  return (
    <span className="text-sm font-medium tabular-nums text-foreground/40">
      {rank}
    </span>
  );
}
