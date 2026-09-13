import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validateChart,
  clubFromPath,
  siteRoot,
  emailLink,
  discordProfile,
  type ChartData,
} from "../src/model";
import {
  connectEditor,
  decodeContent,
  encodeContent,
  publishChart,
} from "../src/github";

const read = (club: string): ChartData =>
  JSON.parse(readFileSync(`${club}/org-structure/chart.json`, "utf8"));

test("revised structures retain valid reporting relationships", () => {
  const webots = read("webots");
  const chrc = read("chrc");
  validateChart(webots);
  validateChart(chrc);
  assert.equal(webots.people.length, 19);
  assert(
    !webots.people.some((person) =>
      /systems integration|strategy.*integration|shared engineering operations|engineering & programs/i.test(
        person.role,
      ),
    ),
  );
  assert(
    !webots.people.some((person) =>
      /safety & lab process|parts & fabrication/i.test(person.role),
    ),
  );
  const directors = webots.people.filter((person) =>
    person.role.startsWith("Director of Engineering"),
  );
  assert.equal(directors.length, 2);
  for (const director of directors) {
    assert.equal(director.managerId, "webots-president");
    assert.equal(director.level, "L5");
  }
  assert.equal(chrc.people.length, 6);
  assert.equal(chrc.people[0].role, "CHRC President");
  assert.deepEqual(
    chrc.people.slice(1).map((person) => person.role),
    [
      "VP Comp",
      "VP Logistics",
      "VP Logistics",
      "VP Social Media",
      "VP Outreach",
    ],
  );
  assert(
    chrc.people
      .slice(1)
      .every((person) => person.managerId === "chrc-president"),
  );
  assert(webots.people.every((person) => person.name === ""));
});

test("invalid reporting graphs and unsafe contact values are rejected", () => {
  for (const mutate of [
    (data: ChartData) => {
      data.people[1].managerId = "missing";
    },
    (data: ChartData) => {
      data.people[0].managerId = data.people[1].id;
    },
    (data: ChartData) => {
      data.people[1].level = "L6";
    },
    (data: ChartData) => {
      data.people[1].id = data.people[0].id;
    },
    (data: ChartData) => {
      data.people[1].email = "a@example.org?bcc=other@example.org";
    },
    (data: ChartData) => {
      data.people[1].discordId = "javascript:alert(1)";
    },
    (data: ChartData) => {
      data.teams[0].color = "red; background:url(x)";
    },
  ]) {
    const data = read("chrc");
    mutate(data);
    assert.throws(() => validateChart(data));
  }
  assert.equal(
    discordProfile("123456789012345678"),
    "https://discord.com/users/123456789012345678",
  );
  assert.equal(emailLink("jane@example.org"), "mailto:jane%40example.org");
});

test("standalone and subdirectory paths stay separate", () => {
  assert.equal(clubFromPath("/club-resources/chrc/org-structure/"), "chrc");
  assert.equal(clubFromPath("/club-resources/webots/org-structure/"), "webots");
  assert.equal(
    siteRoot("/club-resources/chrc/org-structure/"),
    "/club-resources/",
  );
  assert.equal(siteRoot("/webots/org-structure/"), "/");
  assert.equal(siteRoot("/club-resources/index.html"), "/club-resources/");
  assert.equal(decodeContent(encodeContent("Renée 李")), "Renée 李");
});

test("publishing uses the right club, expected SHA, and authenticated GitHub request", async () => {
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(
        url,
        "https://api.github.com/repos/WEBotsUWO/club-resources/contents/chrc/org-structure/chart.json",
      );
      assert.equal(options?.method, "PUT");
      assert.equal(
        (options?.headers as Record<string, string>).Authorization,
        "Bearer example-test-token",
      );
      const body = JSON.parse(options?.body as string);
      assert.equal(body.sha, "expected-sha");
      assert.equal(body.branch, "main");
      assert.deepEqual(JSON.parse(decodeContent(body.content)), read("chrc"));
      return Response.json({ content: { sha: "new-sha" } });
    };
    assert.equal(
      await publishChart(
        "chrc",
        read("chrc"),
        "expected-sha",
        "example-test-token",
      ),
      "new-sha",
    );
    globalThis.fetch = async () => new Response("Conflict", { status: 409 });
    await assert.rejects(
      publishChart("chrc", read("chrc"), "old", "example-test-token"),
      /chart changed/,
    );
  } finally {
    globalThis.fetch = previous;
  }
});

test("accounts without repository write permission cannot enter editor mode", async () => {
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = async (url) =>
      Response.json(
        String(url).endsWith("/user")
          ? { login: "reader" }
          : { permissions: { push: false } },
      );
    await assert.rejects(
      connectEditor("webots", "example-test-token"),
      /needs Write/,
    );
  } finally {
    globalThis.fetch = previous;
  }
});
