import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getMatchResults, getPlayerStats } from "@/lib/api-football";
import {
  calculateTeamPoints,
  calculatePlayerPoints,
  type Round,
  type TeamTier,
  type PlayerTier,
  type PlayerEvents,
} from "@/lib/scoring";

const LEAGUE_ID = Number(process.env.TOURNAMENT_LEAGUE_ID ?? "1");
const SEASON = Number(process.env.TOURNAMENT_SEASON ?? "2026");

// Priority used to ensure round only ever advances, never regresses
const ROUND_PRIORITY: Record<string, number> = {
  group_stage: 0,
  round_of_32: 1,
  round_of_16: 2,
  quarterfinal: 3,
  semifinal: 4,
  final: 5,
};

// Maps API-Football round label → our DB round key. Returns null for rounds we ignore.
function apiRoundToDbRound(apiRound: string): string | null {
  const r = apiRound.toLowerCase();
  if (r.includes("3rd") || r.includes("third")) return null; // 3rd place play-off not scored
  if (r.includes("group")) return "group_stage";
  if (r.includes("32")) return "round_of_32";
  if (r.includes("16")) return "round_of_16";
  if (r.includes("quarter")) return "quarterfinal";
  if (r.includes("semi")) return "semifinal"; // check before "final"
  if (r.includes("final")) return "final";
  return null;
}

// Maps DB round + elimination state → scoring Round
function dbRoundToScoringRound(dbRound: string, eliminated: boolean): Round {
  if (dbRound === "group_stage") return "group_stage_exit";
  if (dbRound === "final" && !eliminated) return "winner";
  const map: Record<string, Round> = {
    round_of_32: "round_of_32",
    round_of_16: "round_of_16",
    quarterfinal: "quarterfinal",
    semifinal: "semifinal",
    final: "final",
  };
  return map[dbRound] ?? "group_stage_exit";
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Service-role client — bypasses RLS for cron job writes across all users
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // ── 1. Active tournament ──────────────────────────────────────────────────
    const { data: tournament, error: tErr } = await admin
      .from("tournaments")
      .select("id, name")
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (tErr || !tournament) {
      return NextResponse.json({ error: "No active tournament" }, { status: 404 });
    }

    // ── 2. Fetch external + DB data in parallel ───────────────────────────────
    const [
      fixtures,
      playerStatsList,
      { data: dbTeams },
      { data: dbPlayers },
      { data: tournamentTeams },
      { data: userPicks },
    ] = await Promise.all([
      getMatchResults(LEAGUE_ID, SEASON),
      getPlayerStats(LEAGUE_ID, SEASON),
      admin.from("teams").select("id, name, tier"),
      admin.from("players").select("id, name, tier, team_id"),
      admin
        .from("tournament_teams")
        .select("team_id, current_round, eliminated")
        .eq("tournament_id", tournament.id),
      admin
        .from("user_picks")
        .select("id, user_id, team_picks(id, team_id), player_picks(id, player_id)")
        .eq("tournament_id", tournament.id),
    ]);

    if (!dbTeams || !dbPlayers || !tournamentTeams || !userPicks) {
      return NextResponse.json({ error: "Failed to load DB data" }, { status: 500 });
    }

    // ── 3. Build lookup maps ──────────────────────────────────────────────────
    const teamById = new Map(dbTeams.map((t) => [t.id, t]));
    // name-based lookup for matching API data to our DB rows
    const teamIdByName = new Map(dbTeams.map((t) => [t.name.toLowerCase(), t.id]));
    const playerById = new Map(dbPlayers.map((p) => [p.id, p]));
    const statsByPlayerName = new Map(
      playerStatsList.map((ps) => [ps.player.name.toLowerCase(), ps])
    );

    // Current tournament_teams state keyed by team uuid
    const ttState = new Map(
      tournamentTeams.map((tt) => [
        tt.team_id,
        {
          current_round: tt.current_round ?? "group_stage",
          eliminated: tt.eliminated ?? false,
        },
      ])
    );

    // ── 4. Derive updated round state from completed fixtures ─────────────────
    // Only advance a team's round; never go backward. Only mark eliminated in knockout rounds.
    const roundUpdates = new Map<string, { current_round: string; eliminated: boolean }>();

    for (const fixture of fixtures) {
      const dbRound = apiRoundToDbRound(fixture.league.round);
      if (!dbRound) continue;

      const isKnockout = dbRound !== "group_stage";

      for (const [side, opponent] of [
        [fixture.teams.home, fixture.teams.away],
        [fixture.teams.away, fixture.teams.home],
      ] as const) {
        const teamId = teamIdByName.get(side.name.toLowerCase());
        if (!teamId) continue;

        const prev = roundUpdates.get(teamId) ?? ttState.get(teamId) ?? {
          current_round: "group_stage",
          eliminated: false,
        };

        const newPriority = ROUND_PRIORITY[dbRound] ?? 0;
        const prevPriority = ROUND_PRIORITY[prev.current_round] ?? 0;
        const current_round = newPriority > prevPriority ? dbRound : prev.current_round;

        // In knockout rounds, the team that didn't win is eliminated
        const lostKnockout = isKnockout && opponent.winner === true;
        const eliminated = prev.eliminated || lostKnockout;

        roundUpdates.set(teamId, { current_round, eliminated });
      }
    }

    // Persist round state updates to tournament_teams
    await Promise.all(
      Array.from(roundUpdates.entries()).map(([teamId, update]) =>
        admin
          .from("tournament_teams")
          .update(update)
          .eq("tournament_id", tournament.id)
          .eq("team_id", teamId)
      )
    );

    // Merge updates into our in-memory state for scoring below
    for (const [teamId, update] of roundUpdates) {
      ttState.set(teamId, update);
    }

    // ── 5. Determine clean sheets: teams that conceded 0 in any match ─────────
    const teamHasCleanSheet = new Map<string, boolean>();
    for (const fixture of fixtures) {
      const homeId = teamIdByName.get(fixture.teams.home.name.toLowerCase());
      const awayId = teamIdByName.get(fixture.teams.away.name.toLowerCase());
      if (homeId && (fixture.goals.away ?? 0) === 0) teamHasCleanSheet.set(homeId, true);
      if (awayId && (fixture.goals.home ?? 0) === 0) teamHasCleanSheet.set(awayId, true);
    }

    // ── 6. Determine golden boot: most goals among players in our DB ──────────
    let goldenBootPlayerId: string | null = null;
    let maxGoals = 0;
    for (const player of dbPlayers) {
      const goals = statsByPlayerName.get(player.name.toLowerCase())?.statistics[0]?.goals.total ?? 0;
      if (goals > maxGoals) {
        maxGoals = goals;
        goldenBootPlayerId = player.id;
      }
    }

    // ── 7. Score each user's picks ────────────────────────────────────────────
    // Accumulate per-user totals in memory to avoid re-querying after updates.
    const userTotals = new Map<string, number>();
    let teamPicksUpdated = 0;
    let playerPicksUpdated = 0;

    for (const up of userPicks) {
      let total = 0;
      const teamPickRows = up.team_picks as { id: string; team_id: string }[];
      const playerPickRows = up.player_picks as { id: string; player_id: string }[];

      // Score team picks
      const teamPickUpdates = teamPickRows.flatMap((tp) => {
        const team = teamById.get(tp.team_id);
        const tt = ttState.get(tp.team_id);
        if (!team || !tt) return [];

        const round = dbRoundToScoringRound(tt.current_round, tt.eliminated);
        const points = calculateTeamPoints(team.tier as TeamTier, round);
        total += points;
        teamPicksUpdated++;
        return [admin.from("team_picks").update({ points_earned: points }).eq("id", tp.id)];
      });

      // Score player picks
      const playerPickUpdates = playerPickRows.flatMap((pp) => {
        const player = playerById.get(pp.player_id);
        if (!player) return [];

        const statLine = statsByPlayerName.get(player.name.toLowerCase())?.statistics[0];
        const events: PlayerEvents = {
          goals: statLine?.goals.total ?? 0,
          assists: statLine?.goals.assists ?? 0,
          cleanSheet: teamHasCleanSheet.get(player.team_id ?? "") ?? false,
          manOfTheMatch: false, // not available from season-stats endpoint
          goldenBoot: pp.player_id === goldenBootPlayerId && maxGoals > 0,
          bestPlayer: false, // awarded manually, not derivable from API
        };

        const points = calculatePlayerPoints(player.tier as PlayerTier, events);
        total += points;
        playerPicksUpdated++;
        return [admin.from("player_picks").update({ points_earned: points }).eq("id", pp.id)];
      });

      await Promise.all([...teamPickUpdates, ...playerPickUpdates]);
      userTotals.set(up.user_id, (userTotals.get(up.user_id) ?? 0) + total);
    }

    // ── 8. Update leaderboard ─────────────────────────────────────────────────
    await Promise.all(
      Array.from(userTotals.entries()).map(([userId, totalPoints]) =>
        admin.from("leaderboard").upsert(
          {
            user_id: userId,
            tournament_id: tournament.id,
            total_points: totalPoints,
            last_updated: new Date().toISOString(),
          },
          { onConflict: "user_id,tournament_id" }
        )
      )
    );

    return NextResponse.json({
      ok: true,
      tournament: tournament.name,
      teamPicksUpdated,
      playerPicksUpdated,
      leaderboardUpdated: userTotals.size,
    });
  } catch (err: unknown) {
    console.error("[update-scores]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
