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
  updateLeaderboard,
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

function tierStyle(tier: number | string) {
  const t = Number(tier);
  if (t === 1) return { color: "#ffd700", bg: "rgba(255,215,0,0.1)", border: "rgba(255,215,0,0.25)", label: "GOLD" };
  if (t === 2) return { color: "#b8bcc8", bg: "rgba(184,188,200,0.1)", border: "rgba(184,188,200,0.22)", label: "SILVER" };
  if (t === 3) return { color: "#cd7f32", bg: "rgba(205,127,50,0.1)", border: "rgba(205,127,50,0.22)", label: "BRONZE" };
  return { color: "rgba(240,240,245,0.35)", bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.1)", label: `TIER ${tier}` };
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
      await updateLeaderboard(userId, tournament.id, 0);
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
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm" style={{ color: "var(--muted)" }}>Loading…</p>
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

  // ── Existing picks ────────────────────────────────────────────────────────────
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
        <main className="min-h-screen px-4 py-12">
          <div className="mx-auto max-w-3xl">
            <div className="mb-8">
              <button
                onClick={cancelSwap}
                className="mb-6 text-sm transition-opacity hover:opacity-70"
                style={{ color: "var(--muted)" }}
              >
                ← Back to my picks
              </button>
              <h1 className="font-display text-5xl tracking-wide text-white">SWAP PICK</h1>
              <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                Replacing{" "}
                <span className="font-semibold text-white">{currentName}</span>
                {targetName && (
                  <>
                    {" "}→{" "}
                    <span className="font-semibold" style={{ color: "var(--accent)" }}>{targetName}</span>
                  </>
                )}
              </p>
            </div>

            {swappingTeamPickId && (
              <section className="mb-10">
                {Object.entries(teamsByTier).map(([tier, tierTeams]) => {
                  const ts = tierStyle(tier);
                  return (
                    <div key={tier} className="mb-8">
                      <div className="mb-3 flex items-center gap-2">
                        <span
                          className="rounded-full px-3 py-1 text-xs font-bold tracking-widest"
                          style={{ background: ts.bg, color: ts.color, border: `1px solid ${ts.border}` }}
                        >
                          {ts.label}
                        </span>
                        <span className="text-xs" style={{ color: "var(--muted)" }}>
                          {tierTeams[0].tier_multiplier}× multiplier
                        </span>
                      </div>
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
                              className="flex items-center gap-3 rounded-xl px-4 py-3.5 text-left transition-all"
                              style={{
                                background: isCurrent
                                  ? "rgba(255,255,255,0.04)"
                                  : isTarget
                                    ? "rgba(0,255,135,0.1)"
                                    : isOtherPick
                                      ? "rgba(255,255,255,0.02)"
                                      : "var(--surface)",
                                border: isCurrent
                                  ? "1px solid rgba(255,255,255,0.12)"
                                  : isTarget
                                    ? "1px solid rgba(0,255,135,0.4)"
                                    : isOtherPick
                                      ? "1px solid rgba(255,255,255,0.04)"
                                      : "1px solid var(--border)",
                                opacity: isOtherPick ? 0.3 : 1,
                                cursor: isCurrent ? "default" : isOtherPick ? "not-allowed" : "pointer",
                                boxShadow: isTarget ? "0 0 16px rgba(0,255,135,0.1)" : "none",
                              }}
                            >
                              {team.logo_url && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={team.logo_url} alt={team.name} className="h-8 w-8 flex-shrink-0 object-contain" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-white">{team.name}</p>
                                {team.country_code && (
                                  <p className="text-xs" style={{ color: "var(--muted)" }}>{team.country_code}</p>
                                )}
                              </div>
                              {isCurrent && (
                                <span className="shrink-0 text-xs font-semibold" style={{ color: "var(--muted)" }}>current</span>
                              )}
                              {isTarget && (
                                <span className="shrink-0 text-xs font-bold" style={{ color: "var(--accent)" }}>✓</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </section>
            )}

            {swappingPlayerPickId && (
              <section className="mb-10">
                {Object.entries(playersByTier).map(([tier, tierPlayers]) => {
                  const ts = tierStyle(tier);
                  return (
                    <div key={tier} className="mb-8">
                      <div className="mb-3 flex items-center gap-2">
                        <span
                          className="rounded-full px-3 py-1 text-xs font-bold tracking-widest"
                          style={{ background: ts.bg, color: ts.color, border: `1px solid ${ts.border}` }}
                        >
                          {ts.label}
                        </span>
                        <span className="text-xs" style={{ color: "var(--muted)" }}>
                          {tierPlayers[0].tier_multiplier}× multiplier
                        </span>
                      </div>
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
                              className="flex items-center gap-3 rounded-xl px-4 py-3.5 text-left transition-all"
                              style={{
                                background: isCurrent
                                  ? "rgba(255,255,255,0.04)"
                                  : isTarget
                                    ? "rgba(0,255,135,0.1)"
                                    : isOtherPick
                                      ? "rgba(255,255,255,0.02)"
                                      : "var(--surface)",
                                border: isCurrent
                                  ? "1px solid rgba(255,255,255,0.12)"
                                  : isTarget
                                    ? "1px solid rgba(0,255,135,0.4)"
                                    : isOtherPick
                                      ? "1px solid rgba(255,255,255,0.04)"
                                      : "1px solid var(--border)",
                                opacity: isOtherPick ? 0.3 : 1,
                                cursor: isCurrent ? "default" : isOtherPick ? "not-allowed" : "pointer",
                                boxShadow: isTarget ? "0 0 16px rgba(0,255,135,0.1)" : "none",
                              }}
                            >
                              {player.photo_url && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={player.photo_url} alt={player.name} className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-white">{player.name}</p>
                                <p className="truncate text-xs" style={{ color: "var(--muted)" }}>
                                  {[player.position, player.team_name].filter(Boolean).join(" · ")}
                                </p>
                              </div>
                              {isCurrent && (
                                <span className="shrink-0 text-xs font-semibold" style={{ color: "var(--muted)" }}>current</span>
                              )}
                              {isTarget && (
                                <span className="shrink-0 text-xs font-bold" style={{ color: "var(--accent)" }}>✓</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </section>
            )}

            {error && (
              <p
                className="mb-4 rounded-xl px-4 py-3 text-sm"
                style={{ background: "rgba(255,60,60,0.1)", color: "#ff6b6b", border: "1px solid rgba(255,60,60,0.2)" }}
              >
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={cancelSwap}
                disabled={swapping}
                className="flex-1 rounded-xl py-3 text-sm font-bold uppercase tracking-wider transition-all disabled:opacity-40"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--muted)",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSwap}
                disabled={!swapTarget || swapping}
                className="flex-1 rounded-xl py-3 text-sm font-bold uppercase tracking-wider transition-all disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  background: "var(--accent)",
                  color: "#0a0a0f",
                  boxShadow: swapTarget ? "0 4px 24px rgba(0,255,135,0.25)" : "none",
                }}
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
      <main className="min-h-screen px-4 py-12">
        <div className="mx-auto max-w-3xl">
          <div className="mb-2">
            <p
              className="mb-1 text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--accent)" }}
            >
              {tournament?.name}
            </p>
            <h1 className="font-display text-5xl tracking-wide text-white">YOUR PICKS</h1>
          </div>

          <div
            className="mb-10 mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
            style={{
              background: "rgba(0,255,135,0.08)",
              border: "1px solid rgba(0,255,135,0.18)",
              color: "var(--accent)",
            }}
          >
            <span>🔒</span>
            Your picks are locked in
          </div>

          <section className="mb-10">
            <h2 className="mb-4 font-display text-2xl tracking-wide text-white">TEAMS</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {pickedTeams.map(({ pickId, team }) => (
                <div
                  key={pickId}
                  className="flex flex-col gap-3 rounded-xl p-4"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    {team.logo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={team.logo_url} alt={team.name} className="h-10 w-10 flex-shrink-0 object-contain" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white">{team.name}</p>
                      {team.country_code && (
                        <p className="text-xs" style={{ color: "var(--muted)" }}>{team.country_code}</p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => startTeamSwap(pickId)}
                    className="w-full rounded-full py-1.5 text-xs font-bold uppercase tracking-wider transition-all hover:opacity-80"
                    style={{
                      background: "rgba(255,107,53,0.12)",
                      color: "var(--orange)",
                      border: "1px solid rgba(255,107,53,0.25)",
                    }}
                  >
                    Swap
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-4 font-display text-2xl tracking-wide text-white">PLAYERS</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {pickedPlayers.map(({ pickId, player }) => (
                <div
                  key={pickId}
                  className="flex items-center gap-3 rounded-xl p-4"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {player.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={player.photo_url} alt={player.name} className="h-10 w-10 flex-shrink-0 rounded-full object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">{player.name}</p>
                    <p className="truncate text-xs" style={{ color: "var(--muted)" }}>
                      {[player.position, player.team_name].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startPlayerSwap(pickId)}
                    className="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all hover:opacity-80"
                    style={{
                      background: "rgba(255,107,53,0.12)",
                      color: "var(--orange)",
                      border: "1px solid rgba(255,107,53,0.25)",
                    }}
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
    <main className="min-h-screen px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10">
          <p
            className="mb-1 text-xs font-semibold uppercase tracking-widest"
            style={{ color: "var(--accent)" }}
          >
            {tournament ? tournament.name : "No active tournament"}
          </p>
          <h1 className="font-display text-5xl tracking-wide text-white">MAKE YOUR PICKS</h1>
        </div>

        {/* Teams */}
        <section className="mb-12">
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="font-display text-3xl tracking-wide text-white">TEAMS</h2>
            <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--muted)" }}>
              <span style={{ color: selectedTeams.size === MAX_TEAMS ? "var(--accent)" : "inherit" }}>
                {selectedTeams.size}
              </span>{" "}
              / {MAX_TEAMS}
            </span>
          </div>

          {teams.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>No teams available yet.</p>
          ) : (
            Object.entries(teamsByTier).map(([tier, tierTeams]) => {
              const ts = tierStyle(tier);
              return (
                <div key={tier} className="mb-8">
                  <div className="mb-3 flex items-center gap-2">
                    <span
                      className="rounded-full px-3 py-1 text-xs font-bold tracking-widest"
                      style={{ background: ts.bg, color: ts.color, border: `1px solid ${ts.border}` }}
                    >
                      {ts.label}
                    </span>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>
                      {tierTeams[0].tier_multiplier}× multiplier
                    </span>
                  </div>
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
                          className="flex items-center gap-3 rounded-xl px-4 py-3.5 text-left transition-all"
                          style={{
                            background: selected ? "rgba(0,255,135,0.1)" : disabled ? "rgba(255,255,255,0.02)" : "var(--surface)",
                            border: selected
                              ? "1px solid rgba(0,255,135,0.4)"
                              : disabled
                                ? "1px solid rgba(255,255,255,0.04)"
                                : "1px solid var(--border)",
                            opacity: disabled ? 0.35 : 1,
                            cursor: disabled ? "not-allowed" : "pointer",
                            boxShadow: selected ? "0 0 20px rgba(0,255,135,0.08)" : "none",
                          }}
                        >
                          {team.logo_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={team.logo_url} alt={team.name} className="h-8 w-8 flex-shrink-0 object-contain" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p
                              className="truncate text-sm font-semibold"
                              style={{ color: selected ? "var(--accent)" : "white" }}
                            >
                              {team.name}
                            </p>
                            {team.country_code && (
                              <p className="text-xs" style={{ color: "var(--muted)" }}>{team.country_code}</p>
                            )}
                          </div>
                          {selected && (
                            <span className="shrink-0 text-sm font-bold" style={{ color: "var(--accent)" }}>✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </section>

        {/* Players */}
        <section className="mb-10">
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="font-display text-3xl tracking-wide text-white">PLAYERS</h2>
            <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--muted)" }}>
              <span style={{ color: selectedPlayers.size === MAX_PLAYERS ? "var(--accent)" : "inherit" }}>
                {selectedPlayers.size}
              </span>{" "}
              / {MAX_PLAYERS}
            </span>
          </div>

          {players.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>No players available yet.</p>
          ) : (
            Object.entries(playersByTier).map(([tier, tierPlayers]) => {
              const ts = tierStyle(tier);
              return (
                <div key={tier} className="mb-8">
                  <div className="mb-3 flex items-center gap-2">
                    <span
                      className="rounded-full px-3 py-1 text-xs font-bold tracking-widest"
                      style={{ background: ts.bg, color: ts.color, border: `1px solid ${ts.border}` }}
                    >
                      {ts.label}
                    </span>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>
                      {tierPlayers[0].tier_multiplier}× multiplier
                    </span>
                  </div>
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
                          className="flex items-center gap-3 rounded-xl px-4 py-3.5 text-left transition-all"
                          style={{
                            background: selected ? "rgba(0,255,135,0.1)" : disabled ? "rgba(255,255,255,0.02)" : "var(--surface)",
                            border: selected
                              ? "1px solid rgba(0,255,135,0.4)"
                              : disabled
                                ? "1px solid rgba(255,255,255,0.04)"
                                : "1px solid var(--border)",
                            opacity: disabled ? 0.35 : 1,
                            cursor: disabled ? "not-allowed" : "pointer",
                            boxShadow: selected ? "0 0 20px rgba(0,255,135,0.08)" : "none",
                          }}
                        >
                          {player.photo_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={player.photo_url} alt={player.name} className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p
                              className="truncate text-sm font-semibold"
                              style={{ color: selected ? "var(--accent)" : "white" }}
                            >
                              {player.name}
                            </p>
                            <p className="truncate text-xs" style={{ color: "var(--muted)" }}>
                              {[player.position, player.team_name].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          {selected && (
                            <span className="shrink-0 text-sm font-bold" style={{ color: "var(--accent)" }}>✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </section>

        {error && (
          <p
            className="mb-4 rounded-xl px-4 py-3 text-sm"
            style={{ background: "rgba(255,60,60,0.1)", color: "#ff6b6b", border: "1px solid rgba(255,60,60,0.2)" }}
          >
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full rounded-xl py-4 text-sm font-bold uppercase tracking-widest transition-all disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            background: canSubmit ? "var(--accent)" : "rgba(255,255,255,0.06)",
            color: canSubmit ? "#0a0a0f" : "var(--muted)",
            border: canSubmit ? "none" : "1px solid rgba(255,255,255,0.08)",
            boxShadow: canSubmit ? "0 4px 32px rgba(0,255,135,0.25)" : "none",
          }}
        >
          {submitting
            ? "Submitting…"
            : canSubmit
              ? "Submit Picks"
              : `${MAX_TEAMS - selectedTeams.size} team${MAX_TEAMS - selectedTeams.size !== 1 ? "s" : ""} · ${MAX_PLAYERS - selectedPlayers.size} player${MAX_PLAYERS - selectedPlayers.size !== 1 ? "s" : ""} remaining`}
        </button>
      </div>
    </main>
  );
}
