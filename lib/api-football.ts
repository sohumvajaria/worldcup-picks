import axios from "axios";

const client = axios.create({
  baseURL: "https://v3.api-sports.io/football",
  headers: {
    "x-apisports-key": process.env.API_FOOTBALL_KEY,
  },
});

// ── Shared ────────────────────────────────────────────────────────────────────

interface ApiResponse<T> {
  get: string;
  parameters: Record<string, string | number>;
  errors: string[] | Record<string, string>;
  results: number;
  paging: { current: number; total: number };
  response: T[];
}

// ── Teams ─────────────────────────────────────────────────────────────────────

export interface Team {
  team: {
    id: number;
    name: string;
    code: string;
    country: string;
    founded: number;
    national: boolean;
    logo: string;
  };
  venue: {
    id: number;
    name: string;
    address: string;
    city: string;
    capacity: number;
    surface: string;
    image: string;
  };
}

export async function getTournamentTeams(leagueId: number, season: number): Promise<Team[]> {
  const { data } = await client.get<ApiResponse<Team>>("/teams", {
    params: { league: leagueId, season },
  });
  return data.response;
}

// ── Live Matches ──────────────────────────────────────────────────────────────

export interface MatchScore {
  halftime: { home: number | null; away: number | null };
  fulltime: { home: number | null; away: number | null };
  extratime: { home: number | null; away: number | null };
  penalty: { home: number | null; away: number | null };
}

export interface MatchTeams {
  home: { id: number; name: string; logo: string; winner: boolean | null };
  away: { id: number; name: string; logo: string; winner: boolean | null };
}

export interface Fixture {
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string;
    timestamp: number;
    status: { long: string; short: string; elapsed: number | null };
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
    round: string;
  };
  teams: MatchTeams;
  goals: { home: number | null; away: number | null };
  score: MatchScore;
}

export async function getLiveMatches(leagueId: number): Promise<Fixture[]> {
  const { data } = await client.get<ApiResponse<Fixture>>("/fixtures", {
    params: { live: "all", league: leagueId },
  });
  return data.response;
}

// ── Match Results ─────────────────────────────────────────────────────────────

export async function getMatchResults(leagueId: number, season: number): Promise<Fixture[]> {
  const { data } = await client.get<ApiResponse<Fixture>>("/fixtures", {
    params: { league: leagueId, season, status: "FT-AET-PEN" },
  });
  return data.response;
}

// ── Player Stats ──────────────────────────────────────────────────────────────

export interface PlayerStats {
  player: {
    id: number;
    name: string;
    firstname: string;
    lastname: string;
    age: number;
    nationality: string;
    photo: string;
  };
  statistics: Array<{
    team: { id: number; name: string; logo: string };
    league: { id: number; name: string; country: string; logo: string; season: number };
    games: {
      appearences: number;
      lineups: number;
      minutes: number;
      rating: string | null;
    };
    goals: {
      total: number | null;
      assists: number | null;
      saves: number | null;
    };
    shots: { total: number | null; on: number | null };
    passes: { total: number | null; key: number | null; accuracy: number | null };
    cards: { yellow: number; yellowred: number; red: number };
  }>;
}

export async function getPlayerStats(leagueId: number, season: number): Promise<PlayerStats[]> {
  const results: PlayerStats[] = [];
  let page = 1;

  while (true) {
    const { data } = await client.get<ApiResponse<PlayerStats>>("/players", {
      params: { league: leagueId, season, page },
    });
    results.push(...data.response);
    if (data.paging.current >= data.paging.total) break;
    page++;
  }

  return results;
}
