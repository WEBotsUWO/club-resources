export type Club = "webots" | "chrc";
export type Level = "L1" | "L2" | "L3" | "L4" | "L5" | "L6";
export type Team = { id: string; name: string; color: string };
export type Person = {
  id: string;
  name: string;
  role: string;
  description: string;
  discordUsername: string;
  discordId: string;
  email: string;
  teamId: string;
  level: Level;
  managerId?: string;
  hiring: boolean;
  seniorLeadership: boolean;
};
export type ChartData = { version: 1; teams: Team[]; people: Person[] };
export const LEVELS: Level[] = ["L6", "L5", "L4", "L3", "L2", "L1"];
export const levelValue = (level: Level) => Number(level.slice(1));
export const CLUB_LABELS = { webots: "WeBots", chrc: "CHRC" };
export const REPOSITORY = "WEBotsUWO/club-resources";
export const chartPath = (club: Club) => `${club}/org-structure/chart.json`;

export function clubFromPath(path: string): Club {
  return /\/chrc(?:\/|$)/i.test(path) ? "chrc" : "webots";
}

export function siteRoot(path: string) {
  const match = path.match(/^(.*\/)(?:webots|chrc)\/org-structure(?:\/.*)?$/);
  return match
    ? match[1]
    : path.replace(/index\.html$/, "").replace(/\/?$/, "/");
}

export function descendants(people: Person[], id: string): Set<string> {
  const result = new Set<string>();
  const pending = [id];
  while (pending.length) {
    const parent = pending.pop();
    for (const person of people) {
      if (person.managerId === parent && !result.has(person.id)) {
        result.add(person.id);
        pending.push(person.id);
      }
    }
  }
  return result;
}

export function discordProfile(id: string) {
  return /^\d{17,20}$/.test(id) ? `https://discord.com/users/${id}` : undefined;
}

export function emailLink(email: string) {
  return /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(email)
    ? `mailto:${encodeURIComponent(email)}`
    : undefined;
}

// Validate both network data and edits before they can become a published tree.
export function validateChart(value: unknown): asserts value is ChartData {
  if (!value || typeof value !== "object")
    throw new Error("The chart must be an object.");
  const data = value as ChartData;
  if (
    data.version !== 1 ||
    !Array.isArray(data.teams) ||
    !Array.isArray(data.people)
  )
    throw new Error("Unsupported chart format.");
  if (!data.teams.length || !data.people.length || data.people.length > 500)
    throw new Error("A chart needs teams and 1 to 500 roles.");
  const teamIds = new Set<string>();
  for (const team of data.teams) {
    if (
      !team ||
      typeof team.id !== "string" ||
      !team.id ||
      teamIds.has(team.id) ||
      typeof team.name !== "string" ||
      !team.name.trim() ||
      team.name.length > 60 ||
      typeof team.color !== "string" ||
      !/^#[0-9a-f]{6}$/i.test(team.color)
    )
      throw new Error(
        "Each team needs a unique ID, a name (up to 60 characters), and a valid color.",
      );
    teamIds.add(team.id);
  }
  const byId = new Map<string, Person>();
  for (const person of data.people) {
    if (
      !person ||
      typeof person.id !== "string" ||
      !person.id ||
      byId.has(person.id)
    )
      throw new Error("Role IDs must be unique.");
    for (const key of [
      "name",
      "role",
      "description",
      "discordUsername",
      "discordId",
      "email",
    ] as const) {
      if (typeof person[key] !== "string")
        throw new Error(`Missing ${key} for a role.`);
    }
    if (
      !person.role.trim() ||
      person.role.length > 100 ||
      person.name.length > 80 ||
      person.description.length > 240 ||
      person.discordUsername.length > 80
    )
      throw new Error(
        "Use a role title up to 100 characters, a name up to 80, and a description up to 240.",
      );
    if (!LEVELS.includes(person.level) || !teamIds.has(person.teamId))
      throw new Error(`Invalid level or team for ${person.role}.`);
    if (
      typeof person.hiring !== "boolean" ||
      typeof person.seniorLeadership !== "boolean"
    )
      throw new Error("Role tags must be yes or no.");
    if (person.discordId && !discordProfile(person.discordId))
      throw new Error(
        `Discord user ID for ${person.role} must contain 17 to 20 digits.`,
      );
    if (person.email && !emailLink(person.email))
      throw new Error(`Enter a valid email for ${person.role}.`);
    if (
      person.managerId !== undefined &&
      (typeof person.managerId !== "string" || !person.managerId)
    )
      throw new Error("Invalid reporting role.");
    byId.set(person.id, person);
  }
  const roots = data.people.filter((person) => !person.managerId);
  if (roots.length !== 1 || roots[0].level !== "L6")
    throw new Error("The chart needs exactly one L6 president.");
  for (const person of data.people) {
    if (!person.managerId) continue;
    const manager = byId.get(person.managerId);
    if (!manager || levelValue(manager.level) <= levelValue(person.level))
      throw new Error(
        `${person.role} must report to an existing role at a higher level.`,
      );
  }
}
