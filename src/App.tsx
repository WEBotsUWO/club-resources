import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Briefcase,
  Download,
  ExternalLink,
  Github,
  LockKeyhole,
  LogOut,
  Palette,
  Plus,
  Redo2,
  RefreshCw,
  Save,
  Trash2,
  Undo2,
  Users,
  X,
} from "lucide-react";
import Chart from "./Chart";
import {
  connectEditor,
  loadSnapshot,
  publishChart,
  type EditorSession,
} from "./github";
import {
  CLUB_LABELS,
  LEVELS,
  REPOSITORY,
  chartPath,
  clubFromPath,
  descendants,
  levelValue,
  siteRoot,
  validateChart,
  type ChartData,
  type Level,
  type Person,
} from "./model";

const club = clubFromPath(window.location.pathname);
const label = CLUB_LABELS[club];
const root = siteRoot(window.location.pathname);
const embed = new URLSearchParams(window.location.search).get("embed") === "1";
const draftKey = `club-resources:${club}:draft-v1`;
type Draft = { data: ChartData; baseSha: string };

function exportData(data: ChartData) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${club}-org-structure.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const [data, setData] = useState<ChartData | null>(null);
  const [baseline, setBaseline] = useState("");
  const [sha, setSha] = useState("");
  const [session, setSession] = useState<EditorSession | null>(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [savedDraft, setSavedDraft] = useState<Draft | null>(null);
  const [history, setHistory] = useState<ChartData[]>([]);
  const [future, setFuture] = useState<ChartData[]>([]);
  const [chartVersion, setChartVersion] = useState(0);
  const generation = useRef(0);
  const dirty = Boolean(session && data && JSON.stringify(data) !== baseline);

  function acceptData(next: ChartData, nextSha: string) {
    setData(next);
    setBaseline(JSON.stringify(next));
    setSha(nextSha);
    setSelected(next.people.find((person) => !person.managerId)!.id);
    setHistory([]);
    setFuture([]);
    setChartVersion((current) => current + 1);
  }

  async function loadPublic() {
    const current = ++generation.current;
    setError("");
    setNotice("");
    let fallback = false;
    try {
      const response = await fetch(`${root}${chartPath(club)}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok)
        throw new Error("The published chart could not be loaded.");
      const next: unknown = await response.json();
      validateChart(next);
      if (generation.current !== current) return;
      acceptData(next, "");
      fallback = true;
    } catch {
      /* The repository can still serve the current chart. */
    }
    try {
      const snapshot = await loadSnapshot(club);
      if (generation.current !== current) return;
      acceptData(snapshot.data, snapshot.sha);
    } catch {
      if (generation.current !== current) return;
      if (!fallback)
        setError(
          "The chart could not be loaded. Check your connection and try again.",
        );
      else
        setNotice(
          "Published copy loaded. Live updates are temporarily unavailable.",
        );
    }
  }

  useEffect(() => {
    void loadPublic();
    return () => {
      generation.current++;
    };
  }, []);

  useEffect(() => {
    if (!session || !data) return;
    try {
      if (dirty)
        localStorage.setItem(draftKey, JSON.stringify({ data, baseSha: sha }));
      else if (!savedDraft) localStorage.removeItem(draftKey);
    } catch {
      setNotice(
        "Browser draft storage is unavailable. Export a backup before leaving.",
      );
    }
  }, [data, session, dirty, sha, savedDraft]);

  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  async function login(token: string) {
    setBusy(true);
    setError("");
    ++generation.current;
    try {
      const connected = await connectEditor(club, token.trim());
      let draft: Draft | null = null;
      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) {
          const parsed = JSON.parse(raw) as Draft;
          validateChart(parsed.data);
          if (typeof parsed.baseSha === "string") draft = parsed;
        }
      } catch {
        /* An invalid saved draft cannot replace a validated tree. */
      }
      setSavedDraft(draft);
      acceptData(connected.snapshot.data, connected.snapshot.sha);
      setSession(connected.session);
      setLoginOpen(false);
      setNotice("");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function change(next: ChartData) {
    if (!data || !session || busy) return;
    setHistory((current) => [...current.slice(-79), data]);
    setFuture([]);
    setData(next);
    setError("");
    setNotice("");
  }

  async function publish() {
    if (!session || !data || busy) return;
    setBusy(true);
    setError("");
    try {
      const nextSha = await publishChart(club, data, sha, session.token);
      setSha(nextSha);
      setBaseline(JSON.stringify(data));
      setSavedDraft(null);
      setNotice(
        "Published. The shared chart is updated; the hosted backup will follow shortly.",
      );
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function reload() {
    if (
      dirty &&
      !window.confirm(
        "Discard the current draft and reload the published chart?",
      )
    )
      return;
    if (!session) {
      void loadPublic();
      return;
    }
    setBusy(true);
    setError("");
    try {
      const snapshot = await loadSnapshot(club, session.token);
      setSavedDraft(null);
      acceptData(snapshot.data, snapshot.sha);
      setNotice("Latest published chart loaded.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function disconnect() {
    if (
      dirty &&
      !window.confirm(
        "Disconnect? Your unpublished draft will stay in this browser.",
      )
    )
      return;
    setSession(null);
    setSavedDraft(null);
    setHistory([]);
    setFuture([]);
    if (baseline) setData(JSON.parse(baseline));
    void loadPublic();
  }

  const person =
    data?.people.find((item) => item.id === selected) ?? data?.people[0];
  const editable = Boolean(session) && !embed;

  return (
    <main
      className={`app-shell ${embed ? "is-embed" : ""} ${editable ? "" : "is-public-view"}`}
    >
      {!embed && (
        <header className="topbar">
          <div className="brand-lockup">
            <div className="brand-mark">
              <Users size={22} />
            </div>
            <div>
              <p className="eyebrow">Club Resources</p>
              <h1>{label} Organization</h1>
            </div>
          </div>
          <nav className="club-links" aria-label="Club resources">
            <a
              aria-current={club === "webots" ? "page" : undefined}
              href={`${root}webots/org-structure/`}
            >
              WeBots
            </a>
            <a
              aria-current={club === "chrc" ? "page" : undefined}
              href={`${root}chrc/org-structure/`}
            >
              CHRC
            </a>
          </nav>
          <div className="topbar-actions">
            {editable ? (
              <>
                <button
                  className="primary-action"
                  disabled={busy || !dirty}
                  onClick={publish}
                >
                  <Save size={16} />
                  {busy ? "Working..." : "Publish"}
                </button>
                <button
                  className="icon-button"
                  aria-label="Disconnect editor"
                  title={`Disconnect ${session?.login}`}
                  disabled={busy}
                  onClick={disconnect}
                >
                  <LogOut size={17} />
                </button>
              </>
            ) : (
              <button
                className="edit-action"
                onClick={() => {
                  setError("");
                  setLoginOpen(true);
                }}
              >
                <LockKeyhole size={16} />
                Edit chart
              </button>
            )}
          </div>
        </header>
      )}
      {(error || notice) && !loginOpen && (
        <div
          className={`status-banner ${error ? "is-error" : ""}`}
          role={error ? "alert" : "status"}
        >
          <span>{error || notice}</span>
          <button
            className="icon-button"
            title="Dismiss message"
            aria-label="Dismiss message"
            onClick={() => {
              setError("");
              setNotice("");
            }}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {savedDraft && editable && (
        <div className="draft-banner">
          <span>
            {savedDraft.baseSha === sha
              ? "An unpublished draft is available."
              : "A saved draft is older than the published chart. Export it to recover your changes."}
          </span>
          <button
            className="edit-action"
            disabled={savedDraft.baseSha !== sha}
            onClick={() => {
              change(savedDraft.data);
              setSavedDraft(null);
            }}
          >
            Restore draft
          </button>
          <button
            className="icon-button"
            title="Export saved draft"
            aria-label="Export saved draft"
            onClick={() => exportData(savedDraft.data)}
          >
            <Download size={16} />
          </button>
          <button
            className="icon-button"
            title="Discard saved draft"
            aria-label="Discard saved draft"
            onClick={() => setSavedDraft(null)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
      {data ? (
        <>
          {!embed && (
            <div className="organization-summary">
              <span>
                <strong>{data.people.length}</strong> roles
              </span>
              <span>
                <strong>
                  {data.people.filter((item) => item.name.trim()).length}
                </strong>{" "}
                assigned
              </span>
              <span>
                <strong>
                  {data.people.filter((item) => item.hiring).length}
                </strong>{" "}
                hiring
              </span>
              {editable && (
                <span className="save-state">
                  {session?.login} ·{" "}
                  {dirty ? "Unpublished changes" : "Up to date"}
                </span>
              )}
            </div>
          )}
          <section className="workspace">
            <Chart
              key={`${club}-${chartVersion}`}
              data={data}
              editable={editable}
              selected={selected}
              onSelect={setSelected}
            />
            {editable && person && (
              <aside className="inspector" aria-label="Org chart editor">
                <div className="editor-actions">
                  <button
                    className="icon-button"
                    title="Undo"
                    aria-label="Undo"
                    disabled={!history.length || busy}
                    onClick={() => {
                      setFuture((current) => [...current, data]);
                      setData(history[history.length - 1]);
                      setHistory((current) => current.slice(0, -1));
                    }}
                  >
                    <Undo2 size={17} />
                  </button>
                  <button
                    className="icon-button"
                    title="Redo"
                    aria-label="Redo"
                    disabled={!future.length || busy}
                    onClick={() => {
                      setHistory((current) => [...current, data]);
                      setData(future[future.length - 1]);
                      setFuture((current) => current.slice(0, -1));
                    }}
                  >
                    <Redo2 size={17} />
                  </button>
                  <button
                    className="icon-button"
                    title="Export chart"
                    aria-label="Export chart"
                    onClick={() => exportData(data)}
                  >
                    <Download size={17} />
                  </button>
                  <button
                    className="icon-button"
                    title="Reload published chart"
                    aria-label="Reload published chart"
                    disabled={busy}
                    onClick={reload}
                  >
                    <RefreshCw size={17} />
                  </button>
                </div>
                <fieldset disabled={busy}>
                  <Editor
                    data={data}
                    person={person}
                    change={change}
                    select={setSelected}
                  />
                </fieldset>
              </aside>
            )}
          </section>
        </>
      ) : (
        <div className="loading-state">
          {error ? (
            <button className="edit-action" onClick={reload}>
              <RefreshCw size={16} />
              Retry loading chart
            </button>
          ) : (
            "Loading organization..."
          )}
        </div>
      )}
      {loginOpen && (
        <LoginDialog
          busy={busy}
          error={error}
          onConnect={login}
          onClose={() => {
            if (!busy) {
              setLoginOpen(false);
              setError("");
            }
          }}
        />
      )}
    </main>
  );
}

function Editor({
  data,
  person,
  change,
  select,
}: {
  data: ChartData;
  person: Person;
  change: (data: ChartData) => void;
  select: (id: string) => void;
}) {
  const children = data.people.filter((item) => item.managerId === person.id);
  const manager = data.people.find((item) => item.id === person.managerId);
  const childIds = descendants(data.people, person.id);
  const managers = data.people.filter(
    (item) =>
      item.id !== person.id &&
      !childIds.has(item.id) &&
      levelValue(item.level) > levelValue(person.level),
  );
  const levels = LEVELS.filter(
    (level) =>
      (!manager
        ? level === "L6"
        : levelValue(level) < levelValue(manager.level)) &&
      children.every((child) => levelValue(child.level) < levelValue(level)),
  );
  const update = (patch: Partial<Person>) =>
    change({
      ...data,
      people: data.people.map((item) =>
        item.id === person.id ? { ...item, ...patch } : item,
      ),
    });
  const add = () => {
    if (person.level === "L1") return;
    const id = crypto.randomUUID();
    change({
      ...data,
      people: [
        ...data.people,
        {
          id,
          name: "",
          role: "New role",
          description: "",
          discordUsername: "",
          discordId: "",
          email: "",
          teamId: person.teamId,
          level: `L${levelValue(person.level) - 1}` as Level,
          managerId: person.id,
          hiring: true,
          seniorLeadership: false,
        },
      ],
    });
    select(id);
  };
  return (
    <>
      <section className="inspector-section">
        <div className="section-heading">
          <Briefcase size={17} />
          <h2>Role & Person</h2>
        </div>
        <label>
          <span>Role title</span>
          <input
            maxLength={100}
            value={person.role}
            onChange={(event) => update({ role: event.target.value })}
          />
        </label>
        <label>
          <span>Person's name</span>
          <input
            maxLength={80}
            value={person.name}
            placeholder="Unassigned"
            onChange={(event) => update({ name: event.target.value })}
          />
        </label>
        <label>
          <span>Responsibilities</span>
          <textarea
            maxLength={240}
            rows={2}
            value={person.description}
            onChange={(event) => update({ description: event.target.value })}
          />
        </label>
        <label>
          <span>Discord username</span>
          <input
            maxLength={80}
            value={person.discordUsername}
            placeholder="username"
            onChange={(event) =>
              update({ discordUsername: event.target.value })
            }
          />
        </label>
        <label>
          <span>Discord user ID</span>
          <input
            inputMode="numeric"
            maxLength={20}
            value={person.discordId}
            placeholder="Optional profile link ID"
            onChange={(event) =>
              update({ discordId: event.target.value.trim() })
            }
          />
        </label>
        <label>
          <span>Email</span>
          <input
            type="email"
            maxLength={254}
            value={person.email}
            onChange={(event) => update({ email: event.target.value.trim() })}
          />
        </label>
        <div className="two-column-fields">
          <label>
            <span>Team</span>
            <select
              value={person.teamId}
              onChange={(event) => update({ teamId: event.target.value })}
            >
              {data.teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Level</span>
            <select
              value={person.level}
              disabled={!person.managerId}
              onChange={(event) =>
                update({ level: event.target.value as Level })
              }
            >
              {levels.map((level) => (
                <option key={level}>{level}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          <span>Reports to</span>
          <select
            disabled={!person.managerId}
            value={person.managerId || ""}
            onChange={(event) => update({ managerId: event.target.value })}
          >
            {!person.managerId && <option value="">None - President</option>}
            {managers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.role} ({item.level})
              </option>
            ))}
          </select>
        </label>
        <div className="toggle-grid">
          <label className="switch-row">
            <input
              type="checkbox"
              checked={person.hiring}
              onChange={(event) => update({ hiring: event.target.checked })}
            />
            <span>Hiring</span>
          </label>
          <label className="switch-row">
            <input
              type="checkbox"
              checked={person.seniorLeadership}
              onChange={(event) =>
                update({ seniorLeadership: event.target.checked })
              }
            />
            <span>Senior leadership</span>
          </label>
        </div>
        <div className="button-row">
          <button
            className="primary-action"
            disabled={person.level === "L1"}
            onClick={add}
          >
            <Plus size={16} />
            Add report
          </button>
          <button
            className="danger-action"
            disabled={!person.managerId}
            onClick={() => {
              change({
                ...data,
                people: data.people
                  .filter((item) => item.id !== person.id)
                  .map((item) =>
                    item.managerId === person.id
                      ? { ...item, managerId: person.managerId }
                      : item,
                  ),
              });
              select(person.managerId!);
            }}
          >
            <Trash2 size={16} />
            Remove
          </button>
        </div>
      </section>
      <section className="inspector-section">
        <div className="section-heading">
          <Palette size={17} />
          <h2>Departments</h2>
        </div>
        <div className="team-list">
          {data.teams.map((team) => (
            <div key={team.id} className="team-row">
              <input
                maxLength={60}
                className="team-name-input"
                aria-label={`${team.name} name`}
                value={team.name}
                onChange={(event) =>
                  change({
                    ...data,
                    teams: data.teams.map((item) =>
                      item.id === team.id
                        ? { ...item, name: event.target.value }
                        : item,
                    ),
                  })
                }
              />
              <input
                className="color-input"
                type="color"
                aria-label={`${team.name} color`}
                value={team.color}
                onChange={(event) =>
                  change({
                    ...data,
                    teams: data.teams.map((item) =>
                      item.id === team.id
                        ? { ...item, color: event.target.value }
                        : item,
                    ),
                  })
                }
              />
            </div>
          ))}
        </div>
        <button
          className="secondary-action"
          onClick={() =>
            change({
              ...data,
              teams: [
                ...data.teams,
                {
                  id: crypto.randomUUID(),
                  name: "New department",
                  color: "#67e8d1",
                },
              ],
            })
          }
        >
          <Plus size={16} />
          Add department
        </button>
      </section>
    </>
  );
}

function LoginDialog({
  busy,
  error,
  onConnect,
  onClose,
}: {
  busy: boolean;
  error: string;
  onConnect: (token: string) => Promise<void>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [token, setToken] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = token;
    setToken("");
    await onConnect(value);
  }
  return (
    <dialog
      ref={dialog}
      className="login-dialog"
      aria-labelledby="login-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="dialog-heading">
        <Github size={22} />
        <h2 id="login-title">Editor access</h2>
        <button
          className="icon-button"
          disabled={busy}
          title="Close"
          aria-label="Close"
          onClick={onClose}
        >
          <X size={17} />
        </button>
      </div>
      <p>
        Connect a GitHub account with write access to{" "}
        <strong>{REPOSITORY}</strong>.
      </p>
      <p>
        Create a fine-grained token for this repository with{" "}
        <strong>Contents: Read and write</strong>. Organization approval may be
        required. Your token stays in memory until you disconnect or close this
        page.
      </p>
      <a
        className="help-link"
        href={`https://github.com/settings/personal-access-tokens/new?name=Club%20Resources%20Editor&target_name=WEBotsUWO&contents=write`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Create editor token <ExternalLink size={14} />
      </a>
      <form onSubmit={submit}>
        <label>
          <span>GitHub token</span>
          <input
            autoFocus
            type="password"
            autoComplete="off"
            spellCheck={false}
            required
            value={token}
            disabled={busy}
            onChange={(event) => setToken(event.target.value)}
          />
        </label>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary-action" disabled={busy || !token.trim()}>
          <LockKeyhole size={16} />
          {busy ? "Connecting..." : "Connect editor"}
        </button>
      </form>
      <a
        className="help-link"
        href={`https://github.com/${REPOSITORY}/blob/main/EDITING.md`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Editing & permissions guide <ExternalLink size={14} />
      </a>
    </dialog>
  );
}
