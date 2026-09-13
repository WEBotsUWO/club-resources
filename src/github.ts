import {
  chartPath,
  REPOSITORY,
  validateChart,
  type ChartData,
  type Club,
} from "./model";

const API = `https://api.github.com/repos/${REPOSITORY}`;
export type Snapshot = { data: ChartData; sha: string };
export type EditorSession = { token: string; login: string };

async function request(url: string, token: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    if (response.status === 409 || response.status === 422)
      throw new Error(
        "This chart changed, or the update was rejected. Export your draft, then reload the latest chart before publishing again.",
      );
    if ([401, 403, 404].includes(response.status))
      throw new Error(
        "GitHub denied access. Check repository access, token expiry, organization approval, and Contents read/write permission.",
      );
    throw new Error(
      `GitHub could not complete the request (${response.status}). Your draft has not been discarded.`,
    );
  }
  return response.json();
}

export function decodeContent(content: string) {
  return new TextDecoder().decode(
    Uint8Array.from(atob(content.replace(/\s/g, "")), (char) =>
      char.charCodeAt(0),
    ),
  );
}

export function encodeContent(content: string) {
  const bytes = new TextEncoder().encode(content);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function loadSnapshot(club: Club, token = ""): Promise<Snapshot> {
  const file = await request(
    `${API}/contents/${chartPath(club)}?ref=main`,
    token,
  );
  if (
    file.encoding !== "base64" ||
    typeof file.content !== "string" ||
    typeof file.sha !== "string"
  )
    throw new Error("GitHub returned an unsupported chart file.");
  const data: unknown = JSON.parse(decodeContent(file.content));
  validateChart(data);
  return { data, sha: file.sha };
}

export async function connectEditor(
  club: Club,
  token: string,
): Promise<{ session: EditorSession; snapshot: Snapshot }> {
  const user = await request("https://api.github.com/user", token);
  const repository = await request(API, token);
  if (!repository.permissions?.push)
    throw new Error(
      "Your GitHub account needs Write, Maintain, or Admin access to club-resources.",
    );
  const snapshot = await loadSnapshot(club, token);
  return { session: { token, login: user.login }, snapshot };
}

export async function publishChart(
  club: Club,
  data: ChartData,
  sha: string,
  token: string,
): Promise<string> {
  validateChart(data);
  if (!token || !sha)
    throw new Error(
      "Connect an editor account and reload the chart before publishing.",
    );
  const result = await request(`${API}/contents/${chartPath(club)}`, token, {
    method: "PUT",
    body: JSON.stringify({
      message: `Update ${club === "chrc" ? "CHRC" : "WeBots"} organizational structure`,
      content: encodeContent(`${JSON.stringify(data, null, 2)}\n`),
      sha,
      branch: "main",
    }),
  });
  if (!result.content?.sha)
    throw new Error(
      "GitHub did not confirm the update. Check the repository before retrying.",
    );
  return result.content.sha;
}
