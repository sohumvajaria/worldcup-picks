import { createClient } from "@/utils/supabase/client";

// ── Row types ─────────────────────────────────────────────────────────────────

export interface TeamPickRow {
  id: string;
  user_pick_id: string;
  team_id: string;
  points_earned: number | null;
  created_at: string;
}

export interface PlayerPickRow {
  id: string;
  user_pick_id: string;
  player_id: string;
  points_earned: number | null;
  created_at: string;
}

export interface UserPickRow {
  id: string;
  user_id: string;
  tournament_id: string;
  created_at: string;
  team_picks: TeamPickRow[];
  player_picks: PlayerPickRow[];
}

export interface LeaderboardRow {
  id: string;
  user_id: string;
  tournament_id: string;
  total_points: number;
  updated_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function db() {
  return createClient();
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getUserPicks(
  userId: string,
  tournamentId: string
): Promise<UserPickRow | null> {
  const { data, error } = await db()
    .from("user_picks")
    .select(`
      *,
      team_picks (*),
      player_picks (*)
    `)
    .eq("user_id", userId)
    .eq("tournament_id", tournamentId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // no rows found
    throw new Error(`getUserPicks failed: ${error.message}`);
  }

  return data as UserPickRow;
}

export async function createUserPicks(
  userId: string,
  tournamentId: string
): Promise<UserPickRow> {
  const { data, error } = await db()
    .from("user_picks")
    .insert({ user_id: userId, tournament_id: tournamentId })
    .select()
    .single();

  if (error) throw new Error(`createUserPicks failed: ${error.message}`);

  return data as UserPickRow;
}

export async function addTeamPick(
  userPickId: string,
  teamId: string
): Promise<TeamPickRow> {
  const { data, error } = await db()
    .from("team_picks")
    .insert({ user_pick_id: userPickId, team_id: teamId })
    .select()
    .single();

  if (error) throw new Error(`addTeamPick failed: ${error.message}`);

  return data as TeamPickRow;
}

export async function addPlayerPick(
  userPickId: string,
  playerId: string
): Promise<PlayerPickRow> {
  const { data, error } = await db()
    .from("player_picks")
    .insert({ user_pick_id: userPickId, player_id: playerId })
    .select()
    .single();

  if (error) throw new Error(`addPlayerPick failed: ${error.message}`);

  return data as PlayerPickRow;
}

export async function swapTeamPick(teamPickId: string, newTeamId: string): Promise<void> {
  const { error } = await db()
    .from("team_picks")
    .update({ team_id: newTeamId })
    .eq("id", teamPickId);
  if (error) throw new Error(`swapTeamPick failed: ${error.message}`);
}

export async function swapPlayerPick(playerPickId: string, newPlayerId: string): Promise<void> {
  const { error } = await db()
    .from("player_picks")
    .update({ player_id: newPlayerId })
    .eq("id", playerPickId);
  if (error) throw new Error(`swapPlayerPick failed: ${error.message}`);
}

export async function updateTeamPickPoints(
  teamPickId: string,
  points: number
): Promise<void> {
  const { error } = await db()
    .from("team_picks")
    .update({ points_earned: points })
    .eq("id", teamPickId);

  if (error) throw new Error(`updateTeamPickPoints failed: ${error.message}`);
}

export async function updatePlayerPickPoints(
  playerPickId: string,
  points: number
): Promise<void> {
  const { error } = await db()
    .from("player_picks")
    .update({ points_earned: points })
    .eq("id", playerPickId);

  if (error) throw new Error(`updatePlayerPickPoints failed: ${error.message}`);
}

export async function updateLeaderboard(
  userId: string,
  tournamentId: string,
  totalPoints: number
): Promise<void> {
  const { error } = await db()
    .from("leaderboard")
    .upsert(
      { user_id: userId, tournament_id: tournamentId, total_points: totalPoints, updated_at: new Date().toISOString() },
      { onConflict: "user_id,tournament_id" }
    );

  if (error) throw new Error(`updateLeaderboard failed: ${error.message}`);
}

export async function getLeaderboard(
  tournamentId: string,
  limit: number
): Promise<LeaderboardRow[]> {
  const { data, error } = await db()
    .from("leaderboard")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("total_points", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getLeaderboard failed: ${error.message}`);

  return data as LeaderboardRow[];
}
