import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { stratify, tree } from "d3-hierarchy";
import {
  Copy,
  Mail,
  Maximize,
  MessageCircle,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import {
  discordProfile,
  emailLink,
  type ChartData,
  type Person,
} from "./model";

const WIDTH = 320;
const HEIGHT = 236;
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 3;
const clampZoom = (zoom: number) =>
  Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
type Camera = { x: number; y: number; zoom: number };

export default function Chart({
  data,
  editable,
  selected,
  onSelect,
}: {
  data: ChartData;
  editable: boolean;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState(
    () =>
      new Set(
        data.people
          .filter(
            (person) =>
              person.managerId &&
              data.people.some((child) => child.managerId === person.id),
          )
          .map((person) => person.id),
      ),
  );
  const [viewport, setViewport] = useState({ width: 1000, height: 650 });
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 0.7 });
  const [dragging, setDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef(camera);
  const pointer = useRef<{
    id: number;
    x: number;
    y: number;
    camera: Camera;
    moved: boolean;
  } | null>(null);
  const query = search.trim().toLowerCase();
  const byId = useMemo(
    () => new Map(data.people.map((person) => [person.id, person])),
    [data.people],
  );
  useEffect(() => {
    if (!editable) return;
    setCollapsed((current) => {
      const next = new Set(current);
      let parent = byId.get(selected)?.managerId;
      while (parent) {
        next.delete(parent);
        parent = byId.get(parent)?.managerId;
      }
      if (next.size === current.size) return current;
      return next;
    });
  }, [selected, editable, byId]);
  const matches = useMemo(
    () =>
      new Set(
        data.people
          .filter((person) =>
            [
              person.name,
              person.role,
              person.description,
              person.discordUsername,
            ].some((value) => value.toLowerCase().includes(query)),
          )
          .map((person) => person.id),
      ),
    [data.people, query],
  );

  const visible = useMemo(
    () =>
      data.people.filter((person) => {
        if (query) {
          if (matches.has(person.id)) return true;
          return [...matches].some((id) => {
            let ancestor = byId.get(id)?.managerId;
            while (ancestor) {
              if (ancestor === person.id) return true;
              ancestor = byId.get(ancestor)?.managerId;
            }
            return false;
          });
        }
        let manager = person.managerId;
        while (manager) {
          if (collapsed.has(manager)) return false;
          manager = byId.get(manager)?.managerId;
        }
        return true;
      }),
    [data.people, byId, query, matches, collapsed],
  );

  const layout = useMemo(() => {
    if (!visible.length)
      return {
        nodes: [],
        links: [],
        width: WIDTH,
        height: HEIGHT,
        origin: WIDTH / 2,
      };
    const root = stratify<Person>()
      .id((person) => person.id)
      .parentId((person) => person.managerId)(visible);
    const hierarchy = tree<Person>()
      .nodeSize([WIDTH + 38, HEIGHT + 70])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.12))(root);
    const nodes = hierarchy.descendants();
    const min = Math.min(...nodes.map((node) => node.x));
    const max = Math.max(...nodes.map((node) => node.x));
    return {
      nodes,
      links: hierarchy.links(),
      width: max - min + WIDTH,
      height: Math.max(...nodes.map((node) => node.y)) + HEIGHT,
      origin: WIDTH / 2 - min,
    };
  }, [visible]);

  const moveCamera = useCallback((next: Camera) => {
    cameraRef.current = next;
    setCamera(next);
  }, []);

  const fit = useCallback(
    (readable = false) => {
      const mobile = readable && viewport.width < 600;
      const zoom = mobile
        ? 0.85
        : Math.min(
            1,
            clampZoom(
              Math.min(
                (viewport.width - 56) / layout.width,
                (viewport.height - 64) / layout.height,
              ),
            ),
          );
      moveCamera({
        zoom,
        x: (viewport.width - layout.width * zoom) / 2,
        y: mobile
          ? 28
          : Math.max(28, (viewport.height - layout.height * zoom) / 2),
      });
    },
    [viewport, layout.width, layout.height, moveCamera],
  );

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setViewport({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    fit(true);
  }, [fit]);

  const zoomAt = useCallback(
    (factor: number, x: number, y: number) => {
      const current = cameraRef.current;
      const zoom = clampZoom(current.zoom * factor);
      moveCamera({
        zoom,
        x: x - ((x - current.x) * zoom) / current.zoom,
        y: y - ((y - current.y) * zoom) / current.zoom,
      });
    },
    [moveCamera],
  );

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      zoomAt(
        Math.exp(-event.deltaY * 0.0015),
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [zoomAt]);

  function startPan(event: PointerEvent<HTMLDivElement>) {
    if (
      event.button !== 0 ||
      (event.target as Element).closest("button, a, input")
    )
      return;
    pointer.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      camera: cameraRef.current,
      moved: false,
    };
  }
  function pan(event: PointerEvent<HTMLDivElement>) {
    const state = pointer.current;
    if (!state || state.id !== event.pointerId) return;
    const dx = event.clientX - state.x;
    const dy = event.clientY - state.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) {
      state.moved = true;
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      moveCamera({
        ...state.camera,
        x: state.camera.x + dx,
        y: state.camera.y + dy,
      });
    }
  }
  function endPan(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
    // Keep the moved flag through the click following pointerup.
    window.setTimeout(() => {
      pointer.current = null;
    }, 0);
  }
  function toggle(id: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section className="chart-stage" aria-label="Organizational structure tree">
      <div className="chart-toolbar">
        <label className="search-control">
          <Search size={16} />
          <input
            aria-label="Search by name or role"
            placeholder="Search name or role"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search && (
            <button
              title="Clear search"
              aria-label="Clear search"
              onClick={() => setSearch("")}
            >
              <X size={15} />
            </button>
          )}
        </label>
        <div className="tree-actions">
          <button
            className="icon-button"
            title="Expand all branches"
            aria-label="Expand all branches"
            onClick={() => setCollapsed(new Set())}
          >
            <Plus size={17} />
          </button>
          <button
            className="icon-button"
            title="Collapse branches"
            aria-label="Collapse branches"
            onClick={() =>
              setCollapsed(
                new Set(
                  data.people
                    .filter((person) => person.managerId)
                    .map((person) => person.id),
                ),
              )
            }
          >
            <Minus size={17} />
          </button>
        </div>
        <div className="chart-legend">
          <span className="legend-executive">
            <ShieldCheck size={14} />
            Executive
          </span>
          <span>Department color</span>
        </div>
        <div className="zoom-control">
          <button
            title="Zoom out"
            aria-label="Zoom out"
            onClick={() =>
              zoomAt(1 / 1.2, viewport.width / 2, viewport.height / 2)
            }
          >
            <Minus size={16} />
          </button>
          <span>{Math.round(camera.zoom * 100)}%</span>
          <button
            title="Zoom in"
            aria-label="Zoom in"
            onClick={() => zoomAt(1.2, viewport.width / 2, viewport.height / 2)}
          >
            <Plus size={16} />
          </button>
        </div>
        <button
          className="icon-button"
          title="Fit chart"
          aria-label="Fit chart"
          onClick={() => fit()}
        >
          <Maximize size={17} />
        </button>
      </div>
      <div
        className={`chart-scroll ${dragging ? "is-panning" : ""}`}
        ref={viewportRef}
        onPointerDown={startPan}
        onPointerMove={pan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      >
        {!visible.length && (
          <div className="empty-state" role="status">
            No matching names or roles.
          </div>
        )}
        <svg
          className="org-svg"
          width="100%"
          height="100%"
          aria-label="Org chart"
        >
          <g
            transform={`translate(${camera.x}, ${camera.y}) scale(${camera.zoom}) translate(${layout.origin}, ${HEIGHT / 2})`}
          >
            {layout.links.map(({ source, target }) => {
              const y1 = source.y + HEIGHT / 2;
              const y2 = target.y - HEIGHT / 2;
              return (
                <path
                  key={target.id}
                  className="org-link"
                  d={`M ${source.x} ${y1} C ${source.x} ${(y1 + y2) / 2}, ${target.x} ${(y1 + y2) / 2}, ${target.x} ${y2}`}
                />
              );
            })}
            {layout.nodes.map((node) => {
              const person = node.data;
              const team = data.teams.find(
                (item) => item.id === person.teamId,
              )!;
              const rgb = team.color
                .slice(1)
                .match(/.{2}/g)!
                .map((part) => parseInt(part, 16))
                .join(",");
              const reports = data.people.filter(
                (item) => item.managerId === person.id,
              ).length;
              return (
                <foreignObject
                  key={person.id}
                  x={node.x - WIDTH / 2}
                  y={node.y - HEIGHT / 2}
                  width={WIDTH}
                  height={HEIGHT}
                >
                  <article
                    data-role-id={person.id}
                    className={`person-card ${editable && selected === person.id ? "is-selected" : ""} ${person.seniorLeadership ? "is-senior-leadership" : ""} ${reports ? "has-children" : ""} ${query && matches.has(person.id) ? "is-search-match" : ""}`}
                    style={
                      {
                        "--team-color": team.color,
                        "--team-rgb": rgb,
                      } as CSSProperties
                    }
                  >
                    {editable && (
                      <button
                        className="card-select"
                        aria-label={`Edit ${person.role}${person.name ? `, ${person.name}` : ""}`}
                        onClick={() => {
                          if (!pointer.current?.moved) onSelect(person.id);
                        }}
                      />
                    )}
                    <div className="card-badge-row">
                      <span className="team-pill" title={team.name}>
                        <span />
                        {team.name}
                      </span>
                      {person.seniorLeadership && (
                        <span
                          className="senior-badge"
                          title="Senior leadership"
                        >
                          <ShieldCheck size={12} />
                          Executive
                        </span>
                      )}
                    </div>
                    <div className="person-main">
                      <h3 title={person.role}>{person.role}</h3>
                      <p title={person.description}>{person.description}</p>
                    </div>
                    <div className="person-contact">
                      <UserRound size={16} />
                      <span
                        className={
                          person.name
                            ? "assignee-name"
                            : "assignee-name is-vacant"
                        }
                        title={person.name || "Unassigned"}
                      >
                        {person.name || "Unassigned"}
                      </span>
                      <ContactIcons person={person} />
                    </div>
                    <div className="person-meta">
                      <span className="level-pill">{person.level}</span>
                      <span>{reports} reports</span>
                      {person.hiring && <strong>Hiring</strong>}
                    </div>
                    {reports > 0 && !query && (
                      <button
                        className="expand-toggle"
                        title={`${collapsed.has(person.id) ? "Expand" : "Collapse"} branch`}
                        aria-label={`${collapsed.has(person.id) ? "Expand" : "Collapse"} ${person.role} branch`}
                        onClick={() => toggle(person.id)}
                      >
                        {collapsed.has(person.id) ? (
                          <Plus size={16} />
                        ) : (
                          <Minus size={16} />
                        )}
                      </button>
                    )}
                  </article>
                </foreignObject>
              );
            })}
          </g>
        </svg>
      </div>
    </section>
  );
}

function ContactIcons({ person }: { person: Person }) {
  const [copyStatus, setCopyStatus] = useState("");
  const discord = discordProfile(person.discordId);
  const email = emailLink(person.email);
  async function copyUsername() {
    try {
      await navigator.clipboard.writeText(person.discordUsername);
      setCopyStatus("Username copied");
    } catch {
      setCopyStatus(person.discordUsername);
    }
    window.setTimeout(() => setCopyStatus(""), 3500);
  }
  return (
    <div className="contact-icons">
      {discord ? (
        <a
          href={discord}
          target="_blank"
          rel="noopener noreferrer"
          title={`Discord: ${person.discordUsername || person.name || person.role}`}
          aria-label={`Discord profile for ${person.name || person.role}`}
        >
          <MessageCircle size={16} />
        </a>
      ) : person.discordUsername ? (
        <button
          onClick={copyUsername}
          title={`Copy Discord username: ${person.discordUsername}`}
          aria-label={`Copy Discord username: ${person.discordUsername}`}
        >
          <Copy size={16} />
        </button>
      ) : (
        <span className="contact-unavailable" title="Discord not added">
          <MessageCircle size={16} />
        </span>
      )}
      {email ? (
        <a
          href={email}
          title={person.email}
          aria-label={`Email ${person.name || person.role}`}
        >
          <Mail size={16} />
        </a>
      ) : (
        <span className="contact-unavailable" title="Email not added">
          <Mail size={16} />
        </span>
      )}
      {copyStatus && (
        <span className="copy-status" role="status">
          {copyStatus}
        </span>
      )}
    </div>
  );
}
