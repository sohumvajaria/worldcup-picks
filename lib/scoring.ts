export type Round =
  | "group_stage_exit"
  | "round_of_32"
  | "round_of_16"
  | "quarterfinal"
  | "semifinal"
  | "final"
  | "winner";

export type TeamTier = 1 | 2 | 3 | 4 | 5;
export type PlayerTier = 1 | 2 | 3 | 4;

export interface PlayerEvents {
  goals: number;
  assists: number;
  cleanSheet: boolean;
  manOfTheMatch: boolean;
  goldenBoot: boolean;
  bestPlayer: boolean;
}

export interface TeamPick {
  tier: TeamTier;
  round: Round;
}

export interface PlayerPick {
  tier: PlayerTier;
  events: PlayerEvents;
}

const ROUND_POINTS: Record<Round, number> = {
  group_stage_exit: 0,
  round_of_32: 10,
  round_of_16: 25,
  quarterfinal: 50,
  semifinal: 100,
  final: 175,
  winner: 300,
};

const TEAM_TIER_MULTIPLIERS: Record<TeamTier, number> = {
  1: 1,
  2: 2,
  3: 4,
  4: 8,
  5: 15,
};

const EVENT_POINTS = {
  goal: 20,
  assist: 10,
  clean_sheet: 15,
  man_of_the_match: 25,
  golden_boot: 100,
  best_player: 100,
} as const;

const PLAYER_TIER_MULTIPLIERS: Record<PlayerTier, number> = {
  1: 1,
  2: 2,
  3: 4,
  4: 8,
};

export function calculateTeamPoints(tier: TeamTier, round: Round): number {
  return ROUND_POINTS[round] * TEAM_TIER_MULTIPLIERS[tier];
}

export function calculatePlayerPoints(tier: PlayerTier, events: PlayerEvents): number {
  const base =
    events.goals * EVENT_POINTS.goal +
    events.assists * EVENT_POINTS.assist +
    (events.cleanSheet ? EVENT_POINTS.clean_sheet : 0) +
    (events.manOfTheMatch ? EVENT_POINTS.man_of_the_match : 0) +
    (events.goldenBoot ? EVENT_POINTS.golden_boot : 0) +
    (events.bestPlayer ? EVENT_POINTS.best_player : 0);

  return base * PLAYER_TIER_MULTIPLIERS[tier];
}

export function calculateTotalUserPoints(
  teamPicks: TeamPick[],
  playerPicks: PlayerPick[]
): number {
  const teamTotal = teamPicks.reduce(
    (sum, pick) => sum + calculateTeamPoints(pick.tier, pick.round),
    0
  );
  const playerTotal = playerPicks.reduce(
    (sum, pick) => sum + calculatePlayerPoints(pick.tier, pick.events),
    0
  );
  return teamTotal + playerTotal;
}
