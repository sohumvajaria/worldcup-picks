"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  createUserPicks,
  addTeamPick,
  addPlayerPick,
  getUserPicks,
  swapTeamPick,
  swapPlayerPick,
} from "@/lib/db";
import type { UserPickRow } from "@/lib/db";

const MAX_TEAMS = 3;
const MAX_PLAYERS = 5;

interface Team {
  id: string;
  name: string;
  country_code: string | null;
  tier: number;
  tier_multiplier: number;
  logo_url: string | null;
}

interface Player {
  id: string;
  name: string;
  position: string | null;
  tier: number;
  tier_multiplier: number;
  photo_url: string | null;
  team_name: string | null;
}

interface Tournament {
  id: string;
  name: string;
}

export default function PicksPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
  const [existingPicks, setExistingPicks] = useState<UserPickRow | null>(null);
  const [swappingTeamPickId, setSwappingTeamPickId] = useState<string | null>(null);
  const [swappingPlayerPickId, setSwappingPlayerPickId] = useState<string | null>(null);
  const [swapTarget, setSwapTarget] = useState<string | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      console.log("[picks] user:", user);
      if (!user) {
        router.push("/auth");
        return;
      }
      setUserId(user.id);

      const [
        { data: tournamentData, error: tournamentError },
        { data: teamsData, error: teamsError },
        { data: playersData },
      ] = await Promise.all([
        supabase
          .from("tournaments")
          .select("id, name")
          .in("status", ["active", "upcoming"])
          .order("created_at", { ascending: true })
          .limit(1)
          .single(),
        supabase
          .from("teams")
          .select("id, name, country_code, tier, tier_multiplier, logo_url")
          .order("tier", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("players")
          .select("id, name, position, tier, tier_multiplier, photo_url, teams(name)")
          .order("tier", { ascending: true })
          .order("name", { ascending: true }),
      ]);
      console.log("[picks] tournamentError:", tournamentError, "tournamentData:", tournamentData);
      console.log("[picks] teamsError:", teamsError, "teamsData:", teamsData);

      if (tournamentData) setTournament(tournamentData);
      if (teamsData) setTeams(teamsData);
      if (playersData) {
        setPlayers(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          playersData.map((p: any) => ({ ...p, team_name: p.teams?.name ?? null }))
        );
      }

      if (tournamentData) {
        const picks = await getUserPicks(user.id, tournamentData.id);
        setExistingPicks(picks);
      }

      setLoading(false);
    }

    load();
  }, [router]);

  function toggleTeam(id: string) {
    setSelectedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_TEAMS) {
        next.add(id);
      }
      return next;
    });
  }

  function togglePlayer(id: string) {
    setSelectedPlayers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_PLAYERS) {
        next.add(id);
      }
      return next;
    });
  }

  async function handleSubmit() {
    if (!userId || !tournament) return;
    setError(null);
    setSubmitting(true);

    try {
      const userPick = await createUserPicks(userId, tournament.id);
      await Promise.all([
        ...[...selectedTeams].map((teamId) => addTeamPick(userPick.id, teamId)),
        ...[...selectedPlayers].map((playerId) => addPlayerPick(userPick.id, playerId)),
      ]);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed.");
      setSubmitting(false);
    }
  }

  function startTeamSwap(teamPickId: string) {
    setSwappingTeamPickId(teamPickId);
    setSwappingPlayerPickId(null);
    setSwapTarget(null);
    setError(null);
  }

  function startPlayerSwap(playerPickId: string) {
    setSwappingPlayerPickId(playerPickId);
    setSwappingTeamPickId(null);
    setSwapTarget(null);
    setError(null);
  }

  function cancelSwap() {
    setSwappingTeamPickId(null);
    setSwappingPlayerPickId(null);
    setSwapTarget(null);
    setError(null);
  }

  async function confirmSwap() {
    if (!existingPicks) return;
    setError(null);
    setSwapping(true);
    try {
      if (swappingTeamPickId && swapTarget) {
        await swapTeamPick(swappingTeamPickId, swapTarget);
        setExistingPicks({
          ...existingPicks,
          team_picks: existingPicks.team_picks.map((tp) =>
            tp.id === swappingTeamPickId ? { ...tp, team_id: swapTarget } : tp
          ),
        });
      } else if (swappingPlayerPickId && swapTarget) {
        await swapPlayerPick(swappingPlayerPickId, swapTarget);
        setExistingPicks({
          ...existingPicks,
          player_picks: existingPicks.player_picks.map((pp) =>
            pp.id === swappingPlayerPickId ? { ...pp, player_id: swapTarget } : pp
          ),
        });
      }
      setSwappingTeamPickId(null);
      setSwappingPlayerPickId(null);
      setSwapTarget(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Swap failed.");
    } finally {
      setSwapping(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-foreground/50">Loading…</p>
      </main>
    );
  }

  const teamsByTier = teams.reduce<Record<number, Team[]>>((acc, t) => {
    (acc[t.tier] ??= []).push(t);
    return acc;
  }, {});

  const playersByTier = players.reduce<Record<number, Player[]>>((acc, p) => {
    (acc[p.tier] ??= []).push(p);
    return acc;
  }, {});

  // ── Existing picks: locked view + swap picker ─────────────────────────────────
  if (existingPicks) {
    const pickedTeamIds = new Set(existingPicks.team_picks.map((tp) => tp.team_id));
    const pickedPlayerIds = new Set(existingPicks.player_picks.map((pp) => pp.player_id));

    // ── Swap picker ─────────────────────────────────────────────────────────────
    if (swappingTeamPickId || swappingPlayerPickId) {
      const swappingTeamCurrentId = swappingTeamPickId
        ? (existingPicks.team_picks.find((tp) => tp.id === swappingTeamPickId)?.team_id ?? null)
        : null;
      const swappingPlayerCurrentId = swappingPlayerPickId
        ? (existingPicks.player_picks.find((pp) => pp.id === swappingPlayerPickId)?.player_id ?? null)
        : null;

      const currentName = swappingTeamCurrentId
        ? teams.find((t) => t.id === swappingTeamCurrentId)?.name
        : players.find((p) => p.id === swappingPlayerCurrentId)?.name;
      const targetName = swapTarget
        ? swappingTeamCurrentId
          ? teams.find((t) => t.id === swapTarget)?.name
          : players.find((p) => p.id === swapTarget)?.name
        : null;

      return (
        <main className="min-h-screen bg-background px-4 py-10">
          <div className="mx-auto max-w-3xl">
            <div className="mb-8">
              <h1 className="mb-1 text-2xl font-bold tracking-tight text-foreground">Swap Pick</h1>
              <p className="text-sm text-foreground/50">
                Replacing{" "}
                <span className="font-medium text-foreground/80">{currentName}</span>
                {targetName && (
                  <>
                    {" "}with{" "}
                    <span className="font-medium text-foreground">{targetName}</span>
                  </>
                )}
              </p>
            </div>

            {swappingTeamPickId && (
              <section className="mb-10">
                {Object.entries(teamsByTier).map(([tier, tierTeams]) => (
                  <div key={tier} className="mb-6">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-foreground/40">
                      Tier {tier} &middot; {tierTeams[0].tier_multiplier}x multiplier
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {tierTeams.map((team) => {
                        const isCurrent = team.id === swappingTeamCurrentId;
                        const isOtherPick = !isCurrent && pickedTeamIds.has(team.id);
                        const isTarget = team.id === swapTarget;
                        return (
                          <button
                            key={team.id}
                            type="button"
                            onClick={() => {
                              if (!isCurrent && !isOtherPick)
                                setSwapTarget(isTarget ? null : team.id);
                            }}
                            disabled={isOtherPick}
                            className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                              isCurrent
                                ? "cursor-default border-foreground/30 bg-foreground/10"
                                : isTarget
                                  ? "border-foreground bg-foreground text-background"
                                  : isOtherPick
                                    ? "cursor-not-allowed border-foreground/10 opacity-30"
                                    : "border-foreground/20 hover:border-foreground/40"
                            }`}
                          >
                            {team.logo_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={team.logo_url}
                                alt={team.name}
                                className="h-7 w-7 flex-shrink-0 object-contain"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{team.name}</p>
                              {team.country_code && (
                                <p className="text-xs opacity-60">{team.country_code}</p>
                              )}
                            </div>
                            {isCurrent && (
                              <span className="shrink-0 text-xs text-foreground/40">current</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {swappingPlayerPickId && (
              <section className="mb-10">
                {Object.entries(playersByTier).map(([tier, tierPlayers]) => (
                  <div key={tier} className="mb-6">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-foreground/40">
                      Tier {tier} &middot; {tierPlayers[0].tier_multiplier}x multiplier
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {tierPlayers.map((player) => {
                        const isCurrent = player.id === swappingPlayerCurrentId;
                        const isOtherPick = !isCurrent && pickedPlayerIds.has(player.id);
                        const isTarget = player.id === swapTarget;
                        return (
                          <button
                            key={player.id}
                            type="button"
                            onClick={() => {
                              if (!isCurrent && !isOtherPick)
                                setSwapTarget(isTarget ? null : player.id);
                            }}
                            disabled={isOtherPick}
                            className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                              isCurrent
                                ? "cursor-default border-foreground/30 bg-foreground/10"
                                : isTarget
                                  ? "border-foreground bg-foreground text-background"
                                  : isOtherPick
                                    ? "cursor-not-allowed border-foreground/10 opacity-30"
                                    : "border-foreground/20 hover:border-foreground/40"
                            }`}
                          >
                            {player.photo_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={player.photo_url}
                                alt={player.name}
                                className="h-7 w-7 flex-shrink-0 rounded-full object-cover"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{player.name}</p>
                              <p className="truncate text-xs opacity-60">
                                {[player.position, player.team_name].filter(Boolean).join(" · ")}
                              </p>
                            </div>
                            {isCurrent && (
                              <span className="shrink-0 text-xs text-foreground/40">current</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {error && (
              <p className="mb-4 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={cancelSwap}
                disabled={swapping}
                className="flex-1 rounded-md border border-foreground/20 py-2.5 text-sm font-semibold text-foreground transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSwap}
                disabled={!swapTarget || swapping}
                className="flex-1 rounded-md bg-foreground py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {swapping ? "Saving…" : "Confirm Swap"}
              </button>
            </div>
          </div>
        </main>
      );
    }

    // ── Locked read-only view ───────────────────────────────────────────────────
    const pickedTeams = existingPicks.team_picks
      .map((tp) => ({ pickId: tp.id, team: teams.find((t) => t.id === tp.team_id) }))
      .filter((pt): pt is { pickId: string; team: Team } => !!pt.team);

    const pickedPlayers = existingPicks.player_picks
      .map((pp) => ({ pickId: pp.id, player: players.find((p) => p.id === pp.player_id) }))
      .filter((pp): pp is { pickId: string; player: Player } => !!pp.player);

    return (
      <main className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-foreground">Your Picks</h1>
          <p className="mb-1 text-sm text-foreground/50">{tournament?.name}</p>
          <p className="mb-8 text-sm font-medium text-foreground/70">Your picks are locked in.</p>

          <section className="mb-10">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Teams</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {pickedTeams.map(({ pickId, team }) => (
                <div
                  key={pickId}
                  className="flex items-center gap-3 rounded-lg border border-foreground/20 px-4 py-3"
                >
                  {team.logo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={team.logo_url}
                      alt={team.name}
                      className="h-7 w-7 flex-shrink-0 object-contain"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{team.name}</p>
                    {team.country_code && (
                      <p className="text-xs text-foreground/50">{team.country_code}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => startTeamSwap(pickId)}
                    className="shrink-0 text-xs text-foreground/40 transition-colors hover:text-foreground"
                  >
                    Swap
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-lg font-semibold text-foreground">Players</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {pickedPlayers.map(({ pickId, player }) => (
                <div
                  key={pickId}
                  className="flex items-center gap-3 rounded-lg border border-foreground/20 px-4 py-3"
                >
                  {player.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={player.photo_url}
                      alt={player.name}
                      className="h-7 w-7 flex-shrink-0 rounded-full object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{player.name}</p>
                    <p className="truncate text-xs text-foreground/50">
                      {[player.position, player.team_name].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startPlayerSwap(pickId)}
                    className="shrink-0 text-xs text-foreground/40 transition-colors hover:text-foreground"
                  >
                    Swap
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    );
  }

  // ── Initial selection view ────────────────────────────────────────────────────

  const canSubmit =
    !submitting &&
    !!tournament &&
    selectedTeams.size === MAX_TEAMS &&
    selectedPlayers.size === MAX_PLAYERS;

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-foreground">Make Your Picks</h1>
        <p className="mb-8 text-sm text-foreground/50">
          {tournament ? tournament.name : "No active tournament found."}
        </p>

        {/* Teams */}
        <section className="mb-10">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-foreground">Teams</h2>
            <span className="text-sm text-foreground/50">
              {selectedTeams.size} / {MAX_TEAMS} selected
            </span>
          </div>

          {teams.length === 0 ? (
            <p className="text-sm text-foreground/40">No teams available yet.</p>
          ) : (
            Object.entries(teamsByTier).map(([tier, tierTeams]) => (
              <div key={tier} className="mb-6">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-foreground/40">
                  Tier {tier} &middot; {tierTeams[0].tier_multiplier}x multiplier
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {tierTeams.map((team) => {
                    const selected = selectedTeams.has(team.id);
                    const disabled = !selected && selectedTeams.size >= MAX_TEAMS;
                    return (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => toggleTeam(team.id)}
                        disabled={disabled}
                        className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                          selected
                            ? "border-foreground bg-foreground text-background"
                            : disabled
                              ? "cursor-not-allowed border-foreground/10 opacity-40"
                              : "border-foreground/20 hover:border-foreground/40"
                        }`}
                      >
                        {team.logo_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={team.logo_url}
                            alt={team.name}
                            className="h-7 w-7 flex-shrink-0 object-contain"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{team.name}</p>
                          {team.country_code && (
                            <p className="text-xs opacity-60">{team.country_code}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </section>

        {/* Players */}
        <section className="mb-10">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-foreground">Players</h2>
            <span className="text-sm text-foreground/50">
              {selectedPlayers.size} / {MAX_PLAYERS} selected
            </span>
          </div>

          {players.length === 0 ? (
            <p className="text-sm text-foreground/40">No players available yet.</p>
          ) : (
            Object.entries(playersByTier).map(([tier, tierPlayers]) => (
              <div key={tier} className="mb-6">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-foreground/40">
                  Tier {tier} &middot; {tierPlayers[0].tier_multiplier}x multiplier
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {tierPlayers.map((player) => {
                    const selected = selectedPlayers.has(player.id);
                    const disabled = !selected && selectedPlayers.size >= MAX_PLAYERS;
                    return (
                      <button
                        key={player.id}
                        type="button"
                        onClick={() => togglePlayer(player.id)}
                        disabled={disabled}
                        className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                          selected
                            ? "border-foreground bg-foreground text-background"
                            : disabled
                              ? "cursor-not-allowed border-foreground/10 opacity-40"
                              : "border-foreground/20 hover:border-foreground/40"
                        }`}
                      >
                        {player.photo_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={player.photo_url}
                            alt={player.name}
                            className="h-7 w-7 flex-shrink-0 rounded-full object-cover"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{player.name}</p>
                          <p className="truncate text-xs opacity-60">
                            {[player.position, player.team_name].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </section>

        {error && (
          <p className="mb-4 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full rounded-md bg-foreground py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting
            ? "Submitting…"
            : `Submit Picks${selectedTeams.size < MAX_TEAMS || selectedPlayers.size < MAX_PLAYERS ? ` (${MAX_TEAMS - selectedTeams.size} teams, ${MAX_PLAYERS - selectedPlayers.size} players remaining)` : ""}`}
        </button>
      </div>
    </main>
  );
}
