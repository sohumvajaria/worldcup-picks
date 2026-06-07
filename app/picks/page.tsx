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
import GoalAnimation from "@/components/GoalAnimation";

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

function tierLabel(tier: number | string) {
  const t = Number(tier);
  if (t === 1) return { label: "GOLD", color: "var(--gold)" };
  if (t === 2) return { label: "SILVER", color: "var(--silver)" };
  if (t === 3) return { label: "BRONZE", color: "var(--bronze)" };
  return { label: `TIER ${tier}`, color: "var(--muted)" };
}

/* Shared heading component used in all three views */
function PageHeading({ eyebrow, title, back }: { eyebrow?: string; title: string; back?: { label: string; onClick: () => void } }) {
  return (
    <div style={{ paddingTop: 64, paddingBottom: 40, borderBottom: "1px solid var(--border)", marginBottom: 48 }}>
      {back && (
        <button
          onClick={back.onClick}
          style={{ background: "none", border: "none", padding: 0, fontSize: 12, color: "var(--muted)", marginBottom: 20, display: "block" }}
        >
          ← {back.label}
        </button>
      )}
      {eyebrow && (
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--accent)", marginBottom: 8 }}>
          {eyebrow}
        </p>
      )}
      <h1
        style={{
          fontFamily: "var(--font-bebas)",
          fontSize: "clamp(56px, 11vw, 96px)",
          letterSpacing: "0.04em",
          lineHeight: 0.9,
          color: "white",
          margin: 0,
        }}
      >
        {title}
      </h1>
      <div style={{ width: 36, height: 2, background: "var(--accent)", marginTop: 14 }} />
    </div>
  );
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
  const [showGoalAnimation, setShowGoalAnimation] = useState(false);
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
      if (next.has(id)) { next.delete(id); }
      else if (next.size < MAX_TEAMS) { next.add(id); }
      return next;
    });
  }

  function togglePlayer(id: string) {
    setSelectedPlayers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); }
      else if (next.size < MAX_PLAYERS) { next.add(id); }
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
      setShowGoalAnimation(true);
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
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} className="animate-pulse" style={{ display: "block", width: 5, height: 5, borderRadius: "50%", background: "#333", animationDelay: `${i * 150}ms` }} />
          ))}
        </div>
      </main>
    );
  }

  if (showGoalAnimation) {
    return <GoalAnimation onComplete={() => router.push("/dashboard")} />;
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
        ? (swappingTeamCurrentId
            ? teams.find((t) => t.id === swapTarget)?.name
            : players.find((p) => p.id === swapTarget)?.name)
        : null;

      return (
        <main style={{ minHeight: "100vh", padding: "0 24px" }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <PageHeading
              eyebrow="Swapping pick"
              title="CHOOSE REPLACEMENT"
              back={{ label: "Back to my picks", onClick: cancelSwap }}
            />

            <p style={{ fontSize: 13, color: "var(--muted)", marginTop: -32, marginBottom: 40 }}>
              Replacing <span style={{ color: "white" }}>{currentName}</span>
              {targetName && <> → <span style={{ color: "var(--accent)" }}>{targetName}</span></>}
            </p>

            {swappingTeamPickId && (
              <section style={{ marginBottom: 56 }}>
                {Object.entries(teamsByTier).map(([tier, tierTeams]) => {
                  const { label, color } = tierLabel(tier);
                  return (
                    <div key={tier} style={{ marginBottom: 40 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color }}>{label}</span>
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>{tierTeams[0].tier_multiplier}× multiplier</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
                        {tierTeams.map((team) => {
                          const isCurrent = team.id === swappingTeamCurrentId;
                          const isOtherPick = !isCurrent && pickedTeamIds.has(team.id);
                          const isTarget = team.id === swapTarget;
                          return (
                            <button
                              key={team.id}
                              className="pick-card"
                              data-current={isCurrent ? "true" : undefined}
                              data-target={isTarget ? "true" : undefined}
                              disabled={isOtherPick}
                              onClick={() => {
                                if (!isCurrent && !isOtherPick) setSwapTarget(isTarget ? null : team.id);
                              }}
                              style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}
                            >
                              {team.logo_url && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={team.logo_url} alt={team.name} style={{ height: 28, width: 28, objectFit: "contain", flexShrink: 0 }} />
                              )}
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <p style={{ fontSize: 13, fontWeight: 600, color: isTarget ? "var(--accent)" : "white", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {team.name}
                                </p>
                                {team.country_code && <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>{team.country_code}</p>}
                              </div>
                              {isCurrent && <span style={{ fontSize: 10, color: "var(--muted)", flexShrink: 0 }}>current</span>}
                              {isTarget && <span style={{ fontSize: 13, color: "var(--accent)", flexShrink: 0 }}>✓</span>}
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
              <section style={{ marginBottom: 56 }}>
                {Object.entries(playersByTier).map(([tier, tierPlayers]) => {
                  const { label, color } = tierLabel(tier);
                  return (
                    <div key={tier} style={{ marginBottom: 40 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color }}>{label}</span>
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>{tierPlayers[0].tier_multiplier}× multiplier</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
                        {tierPlayers.map((player) => {
                          const isCurrent = player.id === swappingPlayerCurrentId;
                          const isOtherPick = !isCurrent && pickedPlayerIds.has(player.id);
                          const isTarget = player.id === swapTarget;
                          return (
                            <button
                              key={player.id}
                              className="pick-card"
                              data-current={isCurrent ? "true" : undefined}
                              data-target={isTarget ? "true" : undefined}
                              disabled={isOtherPick}
                              onClick={() => {
                                if (!isCurrent && !isOtherPick) setSwapTarget(isTarget ? null : player.id);
                              }}
                              style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}
                            >
                              {player.photo_url && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={player.photo_url} alt={player.name} style={{ height: 28, width: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                              )}
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <p style={{ fontSize: 13, fontWeight: 600, color: isTarget ? "var(--accent)" : "white", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {player.name}
                                </p>
                                <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>
                                  {[player.position, player.team_name].filter(Boolean).join(" · ")}
                                </p>
                              </div>
                              {isCurrent && <span style={{ fontSize: 10, color: "var(--muted)", flexShrink: 0 }}>current</span>}
                              {isTarget && <span style={{ fontSize: 13, color: "var(--accent)", flexShrink: 0 }}>✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </section>
            )}

            {error && <p style={{ fontSize: 13, color: "#e05555", marginBottom: 16 }}>{error}</p>}

            <div style={{ display: "flex", gap: 10, paddingBottom: 64 }}>
              <button
                onClick={cancelSwap}
                disabled={swapping}
                style={{
                  flex: 1,
                  background: "none",
                  border: "1px solid var(--border)",
                  borderRadius: 999,
                  padding: "12px 24px",
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  opacity: swapping ? 0.4 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmSwap}
                disabled={!swapTarget || swapping}
                style={{
                  flex: 1,
                  background: swapTarget ? "var(--accent)" : "transparent",
                  border: `1px solid ${swapTarget ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: 999,
                  padding: "12px 24px",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: swapTarget ? "#0a0a0f" : "var(--muted)",
                  opacity: !swapTarget || swapping ? 0.4 : 1,
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
      <main style={{ minHeight: "100vh", padding: "0 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <PageHeading eyebrow={tournament?.name} title="YOUR PICKS" />

          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: -32, marginBottom: 48 }}>
            Picks locked in — use Swap to change a selection.
          </p>

          {/* Teams */}
          <section style={{ marginBottom: 56 }}>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)", marginBottom: 16 }}>
              Teams
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 0, borderTop: "1px solid var(--border)" }}>
              {pickedTeams.map(({ pickId, team }) => (
                <div
                  key={pickId}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 0", borderBottom: "1px solid var(--border)" }}
                >
                  {team.logo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={team.logo_url} alt={team.name} style={{ height: 32, width: 32, objectFit: "contain", flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "white", margin: 0 }}>{team.name}</p>
                    {team.country_code && <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>{team.country_code}</p>}
                  </div>
                  <button
                    onClick={() => startTeamSwap(pickId)}
                    style={{
                      background: "none",
                      border: "1px solid var(--border)",
                      borderRadius: 999,
                      padding: "4px 12px",
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--muted)",
                      flexShrink: 0,
                    }}
                  >
                    Swap
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Players */}
          <section style={{ marginBottom: 64 }}>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)", marginBottom: 16 }}>
              Players
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 0, borderTop: "1px solid var(--border)" }}>
              {pickedPlayers.map(({ pickId, player }) => (
                <div
                  key={pickId}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 0", borderBottom: "1px solid var(--border)" }}
                >
                  {player.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={player.photo_url} alt={player.name} style={{ height: 32, width: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "white", margin: 0 }}>{player.name}</p>
                    <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>
                      {[player.position, player.team_name].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <button
                    onClick={() => startPlayerSwap(pickId)}
                    style={{
                      background: "none",
                      border: "1px solid var(--border)",
                      borderRadius: 999,
                      padding: "4px 12px",
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--muted)",
                      flexShrink: 0,
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
  const canSubmit = !submitting && !!tournament && selectedTeams.size === MAX_TEAMS && selectedPlayers.size === MAX_PLAYERS;

  return (
    <main style={{ minHeight: "100vh", padding: "0 24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <PageHeading eyebrow={tournament?.name ?? "No active tournament"} title="MAKE YOUR PICKS" />

        {/* Teams */}
        <section style={{ marginBottom: 64 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 32 }}>
            <h2 style={{ fontFamily: "var(--font-bebas)", fontSize: 32, letterSpacing: "0.06em", color: "white", margin: 0 }}>
              TEAMS
            </h2>
            <span style={{ fontSize: 12, color: selectedTeams.size === MAX_TEAMS ? "var(--accent)" : "var(--muted)" }}>
              {selectedTeams.size} / {MAX_TEAMS}
            </span>
          </div>

          {teams.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>No teams available yet.</p>
          ) : (
            Object.entries(teamsByTier).map(([tier, tierTeams]) => {
              const { label, color } = tierLabel(tier);
              return (
                <div key={tier} style={{ marginBottom: 40 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color }}>{label}</span>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{tierTeams[0].tier_multiplier}× multiplier</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
                    {tierTeams.map((team) => {
                      const selected = selectedTeams.has(team.id);
                      const disabled = !selected && selectedTeams.size >= MAX_TEAMS;
                      return (
                        <button
                          key={team.id}
                          className="pick-card"
                          data-selected={selected ? "true" : undefined}
                          disabled={disabled}
                          onClick={() => toggleTeam(team.id)}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}
                        >
                          {team.logo_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={team.logo_url} alt={team.name} style={{ height: 28, width: 28, objectFit: "contain", flexShrink: 0 }} />
                          )}
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: selected ? "var(--accent)" : "white", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {team.name}
                            </p>
                            {team.country_code && <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>{team.country_code}</p>}
                          </div>
                          {selected && <span style={{ fontSize: 13, color: "var(--accent)", flexShrink: 0 }}>✓</span>}
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
        <section style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 32 }}>
            <h2 style={{ fontFamily: "var(--font-bebas)", fontSize: 32, letterSpacing: "0.06em", color: "white", margin: 0 }}>
              PLAYERS
            </h2>
            <span style={{ fontSize: 12, color: selectedPlayers.size === MAX_PLAYERS ? "var(--accent)" : "var(--muted)" }}>
              {selectedPlayers.size} / {MAX_PLAYERS}
            </span>
          </div>

          {players.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>No players available yet.</p>
          ) : (
            Object.entries(playersByTier).map(([tier, tierPlayers]) => {
              const { label, color } = tierLabel(tier);
              return (
                <div key={tier} style={{ marginBottom: 40 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color }}>{label}</span>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{tierPlayers[0].tier_multiplier}× multiplier</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
                    {tierPlayers.map((player) => {
                      const selected = selectedPlayers.has(player.id);
                      const disabled = !selected && selectedPlayers.size >= MAX_PLAYERS;
                      return (
                        <button
                          key={player.id}
                          className="pick-card"
                          data-selected={selected ? "true" : undefined}
                          disabled={disabled}
                          onClick={() => togglePlayer(player.id)}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}
                        >
                          {player.photo_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={player.photo_url} alt={player.name} style={{ height: 28, width: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                          )}
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: selected ? "var(--accent)" : "white", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {player.name}
                            </p>
                            <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>
                              {[player.position, player.team_name].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          {selected && <span style={{ fontSize: 13, color: "var(--accent)", flexShrink: 0 }}>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </section>

        {error && <p style={{ fontSize: 13, color: "#e05555", marginBottom: 16 }}>{error}</p>}

        <div style={{ paddingBottom: 64 }}>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              width: "100%",
              background: canSubmit ? "var(--accent)" : "transparent",
              border: `1px solid ${canSubmit ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 999,
              padding: "14px 24px",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: canSubmit ? "#0a0a0f" : "var(--muted)",
              opacity: canSubmit ? 1 : 0.5,
              transition: "opacity 0.15s",
            }}
          >
            {submitting
              ? "Submitting…"
              : canSubmit
                ? "Submit Picks"
                : `${MAX_TEAMS - selectedTeams.size} team${MAX_TEAMS - selectedTeams.size !== 1 ? "s" : ""} · ${MAX_PLAYERS - selectedPlayers.size} player${MAX_PLAYERS - selectedPlayers.size !== 1 ? "s" : ""} remaining`}
          </button>
        </div>
      </div>
    </main>
  );
}
