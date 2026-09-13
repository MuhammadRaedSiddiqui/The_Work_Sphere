import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ProjectPanel from "./ProjectPanel";
import { projects } from "../data/projects";
import type { Project } from "../types";
import {
  BACKGROUND_COLOR,
  CARD_ASPECT,
  CARD_FILL_COLOR,
  CONNECTOR_LINE_OPACITY,
  DISPLAY_FONT_FAMILY,
  IDLE_STROKE_OPACITY,
  LABEL_FONT_FAMILY,
  LANE_DISPLAY_NAMES,
  WORK_INDEX_PAGE_SIZE,
  WORK_RAIL_CROSSFADE_SWAP_MS,
  WORK_RAIL_STACK_BREAKPOINT_PX,
  WORK_RAIL_WIDTH_PX,
  WORK_STACK_FILTERS,
  WORK_STATUS_FILTERS,
} from "../constants";
import { animateFlipFromDelta, captureFlipRects, type FlipRectMap } from "../utils/flip";
import { SceneLifecycleManager } from "../scene/SceneLifecycleManager";
import { SpecimenScene } from "../scene/SpecimenScene";
import { readWorkRoute, workRouteHref, type WorkRoute } from "../workRoute";
import { isLowTierDevice } from "../utils/gates";

type WorkView = "index" | "specimen";
type SortKey = "index" | "title" | "stack" | "lane" | "year" | "status";
type SortDirection = "asc" | "desc";
type WorkStack = (typeof WORK_STACK_FILTERS)[number];
type WorkStatus = (typeof WORK_STATUS_FILTERS)[number];

type WorkState = {
  view: WorkView;
  sort: SortKey;
  dir: SortDirection;
  cur: string;
  filters: { status: WorkStatus[]; stack: WorkStack[] };
};

type IndexedProject = Project & { stableIndex: number };

const allProjects: IndexedProject[] = projects.flatMap((project, stableIndex) => project ? [{ ...project, stableIndex }] : []);
// Only expose stack filters that can produce a result. Keep the full shared list for
// route parsing, so an old URL remains safely understood and can still be cleared.
const availableWorkStackFilters = WORK_STACK_FILTERS.filter((stack) =>
  allProjects.some((project) => project.techStack?.includes(stack)),
);
const GROUPED_SORTS = new Set<SortKey>(["year", "status", "lane"]);
const mono = LABEL_FONT_FAMILY;
const grotesk = DISPLAY_FONT_FAMILY;
const rowColumns = 6;
const background = `#${BACKGROUND_COLOR.toString(16).padStart(6, "0")}`;
const cardFill = `#${CARD_FILL_COLOR.toString(16).padStart(6, "0")}`;

function matchesFilters(project: Project, filters: WorkState["filters"]) {
  const statusMatch = filters.status.length === 0 || filters.status.includes(project.status);
  const stackMatch = filters.stack.length === 0 || filters.stack.some((stack) => project.techStack?.includes(stack));
  return statusMatch && stackMatch;
}

function sortProjects(records: IndexedProject[], sort: SortKey, dir: SortDirection) {
  const sign = dir === "asc" ? 1 : -1;
  const valueFor = (project: IndexedProject) => {
    switch (sort) {
      case "index": return project.stableIndex;
      case "title": return project.title;
      case "stack": return project.techStack?.join(" ") ?? "";
      case "lane": return project.lane;
      case "year": return project.year ?? "";
      case "status": return project.status;
    }
  };
  return [...records].sort((a, b) => {
    const left = valueFor(a);
    const right = valueFor(b);
    const comparison = typeof left === "number" && typeof right === "number"
      ? left - right
      : String(left).localeCompare(String(right));
    return comparison === 0 ? a.stableIndex - b.stableIndex : comparison * sign;
  });
}

function statusMark(status: Project["status"]) {
  if (status === "shipped") return "●";
  if (status === "in-progress") return "◌";
  return "○";
}

function groupLabel(project: IndexedProject, sort: SortKey) {
  if (sort === "lane") return LANE_DISPLAY_NAMES[project.lane];
  if (sort === "year") return project.year ?? "Undated";
  return project.status;
}

export default function WorkSection({ lifecycle, urlMode = false }: { lifecycle: SceneLifecycleManager; urlMode?: boolean }) {
  const [specimenAllowed, setSpecimenAllowed] = useState(() => !isLowTierDevice());
  const initialRouteRef = useRef<WorkRoute | null>(urlMode ? readWorkRoute() : null);
  const initialRoute = initialRouteRef.current;
  const initialProject = initialRoute?.projectId ? allProjects.find((project) => project.id === initialRoute.projectId) : undefined;
  const [work, setWork] = useState<WorkState>(() => ({
    view: initialRoute?.view === "specimen" && !isLowTierDevice() ? "specimen" : "index",
    sort: initialRoute?.sort ?? "index",
    dir: initialRoute?.dir ?? "asc",
    cur: initialProject?.id ?? allProjects[0]?.id ?? "",
    filters: initialRoute?.filters ?? { status: [], stack: [] },
  }));
  const workRef = useRef(work);
  const historyReadyRef = useRef(!urlMode);
  const [panelProjectId, setPanelProjectId] = useState<string | null>(() => initialProject?.id ?? null);
  const [panelEnterFrom, setPanelEnterFrom] = useState<DOMRect | undefined>();
  const [displayedProjectId, setDisplayedProjectId] = useState(work.cur);
  const [railVisible, setRailVisible] = useState(true);
  const [visibleRowCount, setVisibleRowCount] = useState(WORK_INDEX_PAGE_SIZE);
  const tableRef = useRef<HTMLTableElement>(null);
  const pendingFlip = useRef<FlipRectMap | null>(null);
  const pendingSpecimenReturnFlip = useRef<FlipRectMap | null>(null);
  const specimenHostRef = useRef<HTMLDivElement>(null);
  const specimenSceneRef = useRef<SpecimenScene | null>(null);
  const specimenEnabledRef = useRef(false);
  const specimenCaptionRef = useRef<HTMLDivElement>(null);
  const specimenTileRefs = useRef(new Map<number, HTMLButtonElement>());
  const [detachedStableIndex, setDetachedStableIndex] = useState<number | null>(null);

  const filtered = useMemo(
    () => allProjects.filter((project) => matchesFilters(project, work.filters)),
    [work.filters],
  );
  const ordered = useMemo(() => sortProjects(filtered, work.sort, work.dir), [filtered, work.sort, work.dir]);
  const visibleOrdered = useMemo(() => ordered.slice(0, visibleRowCount), [ordered, visibleRowCount]);
  const currentProject = filtered.find((project) => project.id === work.cur) ?? filtered[0];
  const displayedProject = allProjects.find((project) => project.id === displayedProjectId) ?? currentProject;
  const activeFilters = work.filters.status.length > 0 || work.filters.stack.length > 0;

  useEffect(() => {
    const refreshDeviceGate = () => setSpecimenAllowed(!isLowTierDevice());
    window.addEventListener("resize", refreshDeviceGate);
    window.addEventListener("orientationchange", refreshDeviceGate);
    return () => {
      window.removeEventListener("resize", refreshDeviceGate);
      window.removeEventListener("orientationchange", refreshDeviceGate);
    };
  }, []);

  useEffect(() => {
    if (specimenAllowed || work.view === "index") return;
    setWork((previous) => ({ ...previous, view: "index" }));
  }, [specimenAllowed, work.view]);

  useEffect(() => {
    workRef.current = work;
  }, [work]);

  const routeFor = useCallback((projectId: string | null): WorkRoute => ({
    projectId,
    view: workRef.current.view,
    sort: workRef.current.sort,
    dir: workRef.current.dir,
    filters: workRef.current.filters,
  }), []);

  const pushPanelRoute = useCallback((projectId: string) => {
    if (!urlMode) return;
    window.history.pushState({ portfolioWork: true, panel: true }, "", workRouteHref(routeFor(projectId)));
  }, [routeFor, urlMode]);

  useEffect(() => {
    if (!urlMode) return;
    const route = readWorkRoute();
    const syncFromLocation = () => {
      const next = readWorkRoute();
      const project = next.projectId ? allProjects.find((item) => item.id === next.projectId) : undefined;
      setWork((previous) => ({ ...previous, view: next.view, sort: next.sort, dir: next.dir, filters: next.filters, cur: project?.id ?? previous.cur }));
      setPanelProjectId(project?.id ?? null);
    };
    const existingState = window.history.state as { portfolioWork?: boolean; panel?: boolean } | null;
    if (route.projectId && !existingState?.portfolioWork) {
      window.history.replaceState({ portfolioWork: true, panel: false }, "", workRouteHref({ ...route, projectId: null }));
      window.history.pushState({ portfolioWork: true, panel: true }, "", workRouteHref(route));
    } else if (!existingState?.portfolioWork) {
      window.history.replaceState({ portfolioWork: true, panel: false }, "", workRouteHref(route));
    }
    historyReadyRef.current = true;
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, [urlMode]);

  useEffect(() => {
    if (!urlMode || !historyReadyRef.current) return;
    window.history.replaceState(
      { portfolioWork: true, panel: Boolean(panelProjectId) },
      "",
      workRouteHref({ projectId: panelProjectId, view: work.view, sort: work.sort, dir: work.dir, filters: work.filters }),
    );
  }, [panelProjectId, urlMode, work.dir, work.filters, work.sort, work.view]);

  useEffect(() => {
    if (currentProject && currentProject.id !== work.cur) {
      setWork((previous) => ({ ...previous, cur: currentProject.id }));
    }
  }, [currentProject, work.cur]);

  useEffect(() => {
    if (!currentProject) return;
    if (currentProject.id === displayedProjectId) {
      setRailVisible(true);
      return;
    }
    setRailVisible(false);
    const timer = window.setTimeout(() => {
      setDisplayedProjectId(currentProject.id);
      setRailVisible(true);
    }, WORK_RAIL_CROSSFADE_SWAP_MS);
    return () => window.clearTimeout(timer);
  }, [currentProject, displayedProjectId]);

  useLayoutEffect(() => {
    if (pendingSpecimenReturnFlip.current && tableRef.current) {
      animateFlipFromDelta(pendingSpecimenReturnFlip.current, tableRef.current.querySelectorAll("[data-flip-key]"), {
        duration: 300,
        stagger: 6,
        maxStagger: 300,
        fromScale: 1.4,
        fromOpacity: 0,
        reduceMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      });
      pendingSpecimenReturnFlip.current = null;
    }
    if (!pendingFlip.current || !tableRef.current) return;
    animateFlipFromDelta(pendingFlip.current, tableRef.current.querySelectorAll("[data-flip-key]"), {
      reduceMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
    pendingFlip.current = null;
  }, [ordered, work.view]);

  const updateSelection = useCallback((id: string) => {
    setWork((previous) => previous.cur === id ? previous : { ...previous, cur: id });
  }, []);

  useEffect(() => {
    if (!specimenAllowed) return;
    const host = specimenHostRef.current;
    if (!host) return;
    const scene = new SpecimenScene(host, lifecycle.renderer.domElement, {
      onHover: (stableIndex) => {
        const project = allProjects.find((item) => item.stableIndex === stableIndex);
        if (project) updateSelection(project.id);
      },
      onDetach: setDetachedStableIndex,
      onDetachFrame: (frame) => {
        const caption = specimenCaptionRef.current;
        if (!caption) return;
        if (!frame) { caption.style.opacity = "0"; return; }
        caption.style.left = `${frame.left + frame.width / 2}px`;
        caption.style.top = `${frame.top + frame.height + 10}px`;
        caption.style.opacity = String(frame.opacity);
      },
      onOpen: (stableIndex, enterFrom) => {
        const project = allProjects.find((item) => item.stableIndex === stableIndex);
        if (!project) return;
        if (!urlMode) {
          window.location.assign(workRouteHref(routeFor(project.id)));
          return;
        }
        updateSelection(project.id);
        setPanelEnterFrom(enterFrom);
        pushPanelRoute(project.id);
        setPanelProjectId(project.id);
      },
      onTileFrames: (frames) => {
        const framesByStableIndex = new Map(frames.map((frame) => [frame.stableIndex, frame]));
        specimenTileRefs.current.forEach((button, stableIndex) => {
          const frame = framesByStableIndex.get(stableIndex);
          if (!frame) { button.style.display = "none"; return; }
          button.style.display = "block";
          button.style.left = `${frame.left}px`;
          button.style.top = `${frame.top}px`;
          button.style.width = `${frame.width}px`;
          button.style.height = `${frame.height}px`;
        });
      },
    });
    specimenSceneRef.current = scene;
    const unregister = lifecycle.register({
      id: "work-specimen",
      scene: scene.getRenderScene(),
      camera: scene.getRenderCamera(),
      element: host,
      isUpdateEnabled: () => specimenEnabledRef.current,
      update: (deltaSeconds) => scene.update(deltaSeconds),
      resize: ({ width, height }) => scene.resize(width, height),
    });
    return () => {
      unregister();
      scene.dispose();
      specimenSceneRef.current = null;
    };
  }, [lifecycle, pushPanelRoute, routeFor, specimenAllowed, updateSelection, urlMode]);

  useEffect(() => {
    const specimenVisible = work.view === "specimen";
    const specimenWasVisible = specimenEnabledRef.current;
    specimenEnabledRef.current = specimenVisible;
    if (specimenVisible) lifecycle.setActive("work-specimen");
    else if (specimenWasVisible) lifecycle.setActive(null);
  }, [lifecycle, work.view]);

  useEffect(() => {
    const filteredOut = new Set(allProjects.filter((project) => !matchesFilters(project, work.filters)).map((project) => project.stableIndex));
    specimenSceneRef.current?.setFilteredStableIndices(filteredOut);
  }, [work.filters]);

  useEffect(() => {
    if (work.view !== "specimen") return;
    const stableIndex = allProjects.find((project) => project.id === work.cur)?.stableIndex;
    if (stableIndex !== undefined) specimenSceneRef.current?.selectStableIndex(stableIndex);
  }, [work.cur, work.view]);

  const captureRows = useCallback(() => {
    if (tableRef.current) pendingFlip.current = captureFlipRects(tableRef.current.querySelectorAll("[data-flip-key]"));
  }, []);

  const switchView = useCallback((view: WorkView) => {
    if (view === "specimen" && !specimenAllowed) return;
    if (view === work.view) return;
    const scene = specimenSceneRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (view === "specimen") {
      const rowRects = tableRef.current ? captureFlipRects(tableRef.current.querySelectorAll("[data-flip-key]")) : new Map<string, DOMRect>();
      scene?.reattach();
      if (!reduceMotion) scene?.beginIntro(rowRects);
      const stableIndex = allProjects.find((project) => project.id === work.cur)?.stableIndex;
      if (stableIndex !== undefined) scene?.selectStableIndex(stableIndex);
    } else {
      if (!reduceMotion && scene) pendingSpecimenReturnFlip.current = scene.getProjectedCardRects();
      scene?.reattach();
    }
    setWork((previous) => ({ ...previous, view }));
  }, [specimenAllowed, work.cur, work.view]);

  const changeSort = useCallback((sort: SortKey) => {
    captureRows();
    setVisibleRowCount(WORK_INDEX_PAGE_SIZE);
    setWork((previous) => ({
      ...previous,
      sort,
      dir: previous.sort === sort && previous.dir === "asc" ? "desc" : "asc",
    }));
  }, [captureRows]);

  const toggleFilter = useCallback(<Facet extends "status" | "stack">(facet: Facet, value: WorkState["filters"][Facet][number]) => {
    setVisibleRowCount(WORK_INDEX_PAGE_SIZE);
    setWork((previous) => {
      const selected = previous.filters[facet] as string[];
      const next = selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value];
      return { ...previous, filters: { ...previous.filters, [facet]: next } as WorkState["filters"] };
    });
  }, []);

  const prospectiveCount = useCallback(<Facet extends "status" | "stack">(facet: Facet, value: WorkState["filters"][Facet][number]) => {
    const selected = work.filters[facet] as string[];
    const next = selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value];
    const prospective = { ...work.filters, [facet]: next } as WorkState["filters"];
    return allProjects.filter((project) => matchesFilters(project, prospective)).length;
  }, [work.filters]);

  const clearFilters = useCallback(() => {
    setVisibleRowCount(WORK_INDEX_PAGE_SIZE);
    setWork((previous) => ({ ...previous, filters: { status: [], stack: [] } }));
  }, []);

  const openProject = useCallback((project: IndexedProject, enterFrom?: DOMRect) => {
    if (!urlMode) {
      window.location.assign(workRouteHref(routeFor(project.id)));
      return;
    }
    updateSelection(project.id);
    setPanelEnterFrom(enterFrom);
    pushPanelRoute(project.id);
    setPanelProjectId(project.id);
  }, [pushPanelRoute, routeFor, updateSelection, urlMode]);

  const closeProject = useCallback(() => {
    if (!urlMode) {
      setPanelProjectId(null);
      return;
    }
    const state = window.history.state as { portfolioWork?: boolean; panel?: boolean } | null;
    if (state?.portfolioWork && state.panel) {
      window.history.back();
      return;
    }
    setPanelProjectId(null);
    window.history.replaceState({ portfolioWork: true, panel: false }, "", workRouteHref(routeFor(null)));
  }, [routeFor, urlMode]);

  const navigate = useCallback((direction: -1 | 1) => {
    if (work.view === "specimen") {
      const stableIndex = allProjects.find((project) => project.id === work.cur)?.stableIndex;
      if (stableIndex === undefined) return;
      const nextStableIndex = specimenSceneRef.current?.moveSelection(stableIndex, direction < 0 ? "previous-ring" : "next-ring");
      const next = nextStableIndex === null || nextStableIndex === undefined ? undefined : allProjects.find((project) => project.stableIndex === nextStableIndex);
      if (next) updateSelection(next.id);
      return;
    }
    if (!ordered.length) return;
    const index = Math.max(0, ordered.findIndex((project) => project.id === work.cur));
    const nextIndex = (index + direction + ordered.length) % ordered.length;
    const next = ordered[nextIndex];
    const requiredRows = Math.min(ordered.length, Math.ceil((nextIndex + 1) / WORK_INDEX_PAGE_SIZE) * WORK_INDEX_PAGE_SIZE);
    setVisibleRowCount((previous) => Math.max(previous, requiredRows));
    updateSelection(next.id);
    if (panelProjectId) setPanelProjectId(next.id);
  }, [ordered, panelProjectId, updateSelection, work.cur, work.view]);

  const showMoreRows = useCallback(() => {
    setVisibleRowCount((previous) => Math.min(previous + WORK_INDEX_PAGE_SIZE, ordered.length));
  }, [ordered.length]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    const onSpecimenTile = event.target instanceof HTMLElement && Boolean(event.target.closest(".work-specimen-tile"));
    if (event.key === "Escape" && !panelProjectId && work.view === "specimen" && specimenSceneRef.current?.hasDetachedCard()) {
      event.preventDefault();
      specimenSceneRef.current.reattach();
      return;
    }
    if (event.key === "v") { event.preventDefault(); switchView(work.view === "index" ? "specimen" : "index"); return; }
    if (!onSpecimenTile && event.target instanceof HTMLElement && event.target.closest("button, a, input")) return;
    if (event.key === "ArrowUp" || event.key === "k") { event.preventDefault(); navigate(-1); }
    if (event.key === "ArrowDown" || event.key === "j") { event.preventDefault(); navigate(1); }
    if (work.view === "specimen" && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      const stableIndex = allProjects.find((project) => project.id === work.cur)?.stableIndex;
      const direction = event.key === "ArrowLeft" ? "previous-card" : "next-card";
      const nextStableIndex = stableIndex === undefined ? null : specimenSceneRef.current?.moveSelection(stableIndex, direction);
      const next = nextStableIndex === null || nextStableIndex === undefined ? undefined : allProjects.find((project) => project.stableIndex === nextStableIndex);
      if (next) updateSelection(next.id);
    }
    if (event.key === "Enter" && currentProject) {
      event.preventDefault();
      openProject(currentProject);
    }
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, view: WorkView) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const nextView = view === "index" ? "specimen" : "index";
    switchView(nextView);
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(`.work-section #work-${nextView}-tab`)?.focus();
    });
  };

  const renderStage = () => {
    if (work.view === "specimen") {
      return null;
    }
    return (
      <div className="work-table-wrap" role="tabpanel" id="work-index-panel" aria-labelledby="work-index-tab">
        <table ref={tableRef} className="work-table">
          <thead>
            <tr>
              {([
                ["index", "#"], ["title", "Project"], ["stack", "Stack"],
                ["lane", "Lane"], ["year", "Year"], ["status", "Status"],
              ] as const).map(([key, label]) => (
                <th key={key} aria-sort={work.sort === key ? (work.dir === "asc" ? "ascending" : "descending") : "none"}>
                  <button type="button" onClick={() => changeSort(key)}>{label}<span aria-hidden="true"> {work.sort === key ? (work.dir === "asc" ? "↑" : "↓") : "↕"}</span></button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleOrdered.map((project, index) => {
              const startsGroup = GROUPED_SORTS.has(work.sort) && (index === 0 || groupLabel(project, work.sort) !== groupLabel(visibleOrdered[index - 1], work.sort));
              return (
                <FragmentRows
                  key={project.id}
                  project={project}
                  startsGroup={startsGroup}
                  group={groupLabel(project, work.sort)}
                  selected={project.id === work.cur}
                  onSelect={updateSelection}
                  onOpen={openProject}
                />
              );
            })}
          </tbody>
        </table>
        {ordered.length === 0 && <p className="work-empty">No projects match these filters.</p>}
        {visibleOrdered.length < ordered.length && (
          <button type="button" className="work-more" onClick={showMoreRows}>
            View {Math.min(WORK_INDEX_PAGE_SIZE, ordered.length - visibleOrdered.length)} more projects
          </button>
        )}
      </div>
    );
  };

  const panelProject = panelProjectId ? allProjects.find((project) => project.id === panelProjectId) : undefined;
  const detachedProject = detachedStableIndex === null ? undefined : allProjects.find((project) => project.stableIndex === detachedStableIndex);

  return (
    <section id="work" className="work-section" aria-labelledby="work-heading" onKeyDown={handleKeyDown} tabIndex={-1}>
      <style>{workStyles}</style>
      <a className="work-skip" href="#work-heading">Skip to Work</a>
      <p className="work-eyebrow">02 — Selected work</p>
      <h2 id="work-heading" className="work-heading">Work index</h2>
      <div className="work-toolbar">
        <div className="work-tabs" role="tablist" aria-label="Work view">
          <button id="work-index-tab" type="button" role="tab" aria-selected={work.view === "index"} aria-controls="work-index-panel" tabIndex={work.view === "index" ? 0 : -1} onKeyDown={(event) => handleTabKeyDown(event, "index")} onClick={() => switchView("index")}>Index</button>
          {specimenAllowed && <button id="work-specimen-tab" type="button" role="tab" aria-selected={work.view === "specimen"} aria-controls="work-specimen-panel" tabIndex={work.view === "specimen" ? 0 : -1} onKeyDown={(event) => handleTabKeyDown(event, "specimen")} onClick={() => switchView("specimen")}>Specimen</button>}
        </div>
        <div className="work-filters" aria-label="Filter projects">
          {WORK_STATUS_FILTERS.map((status) => <FilterChip key={status} active={work.filters.status.includes(status)} label={status} count={prospectiveCount("status", status)} onClick={() => toggleFilter("status", status)} />)}
          {availableWorkStackFilters.map((stack) => <FilterChip key={stack} active={work.filters.stack.includes(stack)} label={stack} count={prospectiveCount("stack", stack)} onClick={() => toggleFilter("stack", stack)} />)}
          {activeFilters && <button type="button" className="work-clear" onClick={clearFilters}>Clear</button>}
        </div>
      </div>
      <p className="work-live" aria-live="polite" aria-atomic="true">{filtered.length} of {allProjects.length} projects</p>
      <div className="work-layout">
        <main className="work-stage">
          {renderStage()}
          {specimenAllowed && <div className={`work-specimen-wrap${work.view === "specimen" ? " is-visible" : ""}`}>
            <div ref={specimenHostRef} className="work-specimen-stage" role="tabpanel" id="work-specimen-panel" aria-labelledby="work-specimen-tab" aria-hidden={work.view !== "specimen"} tabIndex={0} />
            <div className="work-specimen-tiles" aria-label="Project tiles">
              {allProjects.map((project) => (
                <button
                  key={project.id}
                  ref={(element) => { if (element) specimenTileRefs.current.set(project.stableIndex, element); else specimenTileRefs.current.delete(project.stableIndex); }}
                  className="work-specimen-tile"
                  type="button"
                  tabIndex={filtered.some((item) => item.id === project.id) ? 0 : -1}
                  aria-label={`${project.title}, ${project.year ?? "year unknown"}`}
                  onFocus={() => {
                    updateSelection(project.id);
                    specimenSceneRef.current?.selectStableIndex(project.stableIndex);
                  }}
                  onClick={() => specimenSceneRef.current?.activateStableIndex(project.stableIndex)}
                />
              ))}
            </div>
            <div ref={specimenCaptionRef} className="work-specimen-caption" aria-live="polite">
              {detachedProject && <><strong>{detachedProject.title}</strong><span>{detachedProject.techStack?.join(" · ") ?? "—"} · {detachedProject.year ?? "—"}</span></>}
            </div>
          </div>}
        </main>
        <aside className="work-rail">
          {displayedProject && <Rail
            project={displayedProject}
            visible={railVisible}
            onOpen={(button) => openProject(displayedProject, button.getBoundingClientRect())}
            onPrevious={() => navigate(-1)}
            onNext={() => navigate(1)}
            showThumbnail={work.view === "index"}
            view={work.view}
          />}
        </aside>
      </div>
      {panelProject && <ProjectPanel project={panelProject} enterFrom={panelEnterFrom} showTeaser={false} onClose={closeProject} onPrev={() => navigate(-1)} onNext={() => navigate(1)} />}
    </section>
  );
}

function FragmentRows({ project, startsGroup, group, selected, onSelect, onOpen }: {
  project: IndexedProject; startsGroup: boolean; group: string; selected: boolean;
  onSelect: (id: string) => void; onOpen: (project: IndexedProject, enterFrom: DOMRect) => void;
}) {
  return <>
    {startsGroup && <tr className="work-group"><th colSpan={rowColumns}>{group}</th></tr>}
    <tr
      data-flip-key={project.id}
      className={selected ? "is-selected" : undefined}
      onMouseEnter={() => onSelect(project.id)}
      onFocus={() => onSelect(project.id)}
      onClick={(event) => onOpen(project, event.currentTarget.getBoundingClientRect())}
      tabIndex={0}
      aria-label={`Open ${project.title}`}
    >
      <td>{String(project.stableIndex + 1).padStart(2, "0")}</td>
      <td className="work-title">{project.title}</td>
      <td>{project.techStack?.join(", ") ?? "—"}</td>
      <td>{LANE_DISPLAY_NAMES[project.lane]}</td>
      <td>{project.year ?? "—"}</td>
      <td><span className={`work-status work-status-${project.status}`} aria-label={project.status}><i aria-hidden="true">{statusMark(project.status)}</i>{project.status}</span></td>
    </tr>
  </>;
}

function FilterChip({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return <button type="button" className={`work-chip${active ? " is-active" : ""}`} aria-pressed={active} aria-label={`${label}, ${count} projects if toggled`} onClick={onClick}>{label} <span>{count}</span></button>;
}

function Rail({ project, visible, onOpen, onPrevious, onNext, showThumbnail, view }: { project: IndexedProject; visible: boolean; onOpen: (button: HTMLButtonElement) => void; onPrevious: () => void; onNext: () => void; showThumbnail: boolean; view: WorkView }) {
  return <div className={`work-rail-content${visible ? "" : " is-hidden"}`}>
    {showThumbnail && <div className="work-thumb"><picture><source srcSet={project.thumbnail.replace(/\.jpg$/, ".avif")} type="image/avif" /><source srcSet={project.thumbnail.replace(/\.jpg$/, ".webp")} type="image/webp" /><img src={project.thumbnail} alt="" /></picture></div>}
    <div className="work-rail-title-row"><h3>{project.title}</h3><div><button type="button" aria-label="Previous project" onClick={onPrevious}>←</button><button type="button" aria-label="Next project" onClick={onNext}>→</button></div></div>
    <p>{project.summary ?? "—"}</p>
    <dl>
      <div><dt>Year</dt><dd>{project.year ?? "—"}</dd></div>
      <div><dt>Lane</dt><dd>{LANE_DISPLAY_NAMES[project.lane]}</dd></div>
      <div><dt>Stack</dt><dd>{project.techStack?.join(", ") ?? "—"}</dd></div>
      <div><dt>Status</dt><dd><span className={`work-status work-status-${project.status}`}><i aria-hidden="true">{statusMark(project.status)}</i>{project.status}</span></dd></div>
    </dl>
    <button type="button" className="work-open" onClick={(event) => onOpen(event.currentTarget)}>Open case study</button>
    <p className="work-hints">{view === "index" ? <><kbd>↑</kbd><kbd>↓</kbd> select &nbsp; <kbd>Enter</kbd> open</> : <>Drag to orbit &nbsp; <kbd>v</kbd> switch view</>}</p>
  </div>;
}

const workStyles = `
  .work-section { --hair: rgba(255,255,255,.09); --faint: rgba(255,255,255,${CONNECTOR_LINE_OPACITY}); background:${background}; color:#ededf0; padding:72px clamp(20px, 4vw, 64px) 100px; font-family:${grotesk}; }
  .work-eyebrow { margin:0 0 10px; color:rgba(255,255,255,.52); font:600 11px ${mono}; letter-spacing:.14em; text-transform:uppercase; }
  .work-heading { margin:0 0 28px; font-size:clamp(28px, 4vw, 50px); letter-spacing:-.04em; font-weight:700; }
  .work-skip { position:absolute; left:-9999px; } .work-skip:focus { left:20px; top:20px; z-index:4; background:#000; color:#fff; padding:8px; }
  .work-toolbar { position:sticky; top:0; z-index:3; min-height:52px; display:flex; justify-content:space-between; align-items:center; gap:18px; padding:8px 0; background:#000; border-bottom:1px solid var(--faint); }
  .work-tabs,.work-filters { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
  .work-tabs button,.work-chip,.work-clear,.work-open,.work-rail-title-row button { appearance:none; border:1px solid var(--faint); background:transparent; color:rgba(255,255,255,.72); font:500 12px ${mono}; letter-spacing:.025em; cursor:pointer; }
  .work-tabs button { padding:7px 10px; } .work-tabs button[aria-selected=true],.work-chip.is-active { color:#ededf0; background:rgba(255,255,255,.09); border-color:rgba(255,255,255,${IDLE_STROKE_OPACITY}); }
  .work-tabs button:disabled { cursor:not-allowed; opacity:.35; }
  .work-chip { padding:6px 8px; } .work-chip span { opacity:.55; } .work-clear { border:0; text-decoration:underline; padding:6px; }
  .work-live { margin:10px 0 16px; min-height:15px; color:rgba(255,255,255,.48); font:11px ${mono}; }
  .work-layout { display:grid; grid-template-columns:minmax(0, 1fr) ${WORK_RAIL_WIDTH_PX}px; gap:clamp(24px,4vw,56px); align-items:start; }
  .work-stage { min-width:0; } .work-rail { position:sticky; top:68px; }
  .work-table-wrap { overflow-x:auto; } .work-table { width:100%; border-collapse:collapse; table-layout:auto; }
  .work-table th { text-align:left; border-bottom:1px solid var(--faint); padding:0 8px 10px; white-space:nowrap; }
  .work-table thead button { appearance:none; border:0; padding:0; background:transparent; color:rgba(255,255,255,.55); font:11px ${mono}; letter-spacing:.06em; text-transform:uppercase; cursor:pointer; }
  .work-table td { padding:13px 8px; border-bottom:1px solid var(--hair); color:rgba(255,255,255,.62); font:12px ${mono}; vertical-align:middle; }
  .work-table td:first-child { width:30px; color:rgba(255,255,255,.38); }.work-table .work-title { color:#ededf0; font:500 14px ${grotesk}; letter-spacing:-.01em; min-width:155px; }
  .work-table tbody tr:not(.work-group) { cursor:pointer; outline:none; }.work-table tbody tr:not(.work-group):hover,.work-table tbody tr:not(.work-group):focus,.work-table tbody tr.is-selected { background:rgba(255,255,255,.055); }
  .work-table tbody tr.is-selected td:first-child { box-shadow:inset 2px 0 #ededf0; }.work-group th { padding:17px 8px 7px; border-bottom:1px solid var(--hair); color:rgba(255,255,255,.42); font:11px ${mono}; text-align:left; text-transform:uppercase; letter-spacing:.08em; }
  .work-more { display:block; width:100%; margin-top:16px; padding:11px; appearance:none; border:1px solid rgba(255,255,255,${IDLE_STROKE_OPACITY}); background:transparent; color:#ededf0; font:500 12px ${mono}; letter-spacing:.025em; cursor:pointer; }.work-more:hover { background:rgba(255,255,255,.07); }
  .work-status { display:inline-flex; gap:6px; align-items:center; text-transform:uppercase; font:11px ${mono}; white-space:nowrap; }.work-status i { font-style:normal; }.work-status-planned { opacity:.5; }.work-status-in-progress i { animation:work-status-pulse 1.6s ease-in-out infinite; } @keyframes work-status-pulse { 50% { opacity:.35; } }
  .work-empty { color:rgba(255,255,255,.5); font:13px ${mono}; }.work-specimen-wrap { display:none; position:relative; }.work-specimen-wrap.is-visible { display:block; }.work-specimen-stage { position:relative; height:clamp(420px, 62vw, 700px); overflow:hidden; outline:none; -webkit-mask-image:radial-gradient(ellipse at center, #000 92%, transparent 100%); mask-image:radial-gradient(ellipse at center, #000 92%, transparent 100%); }.work-specimen-stage canvas { display:block; width:100%; height:100%; touch-action:none; }.work-specimen-tiles { position:absolute; inset:0; z-index:1; pointer-events:none; }.work-specimen-tile { display:none; position:absolute; padding:0; margin:0; border:0; background:transparent; pointer-events:none; }.work-specimen-tile:focus-visible { display:block; outline:2px solid rgba(255,255,255,.9); outline-offset:2px; }.work-specimen-caption { position:absolute; z-index:2; width:min(280px, 46%); pointer-events:none; transform:translateX(-50%); opacity:0; transition:opacity 100ms ease; color:#ededf0; text-align:center; font:11px ${mono}; line-height:1.45; }.work-specimen-caption strong,.work-specimen-caption span { display:block; }.work-specimen-caption strong { color:#ededf0; font:600 13px ${grotesk}; letter-spacing:-.01em; }.work-specimen-caption span { color:rgba(255,255,255,.56); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .work-rail-content { transition:opacity ${WORK_RAIL_CROSSFADE_SWAP_MS}ms ease; }.work-rail-content.is-hidden { opacity:0; }.work-thumb { aspect-ratio:${CARD_ASPECT}; background:${cardFill}; border:1px solid rgba(255,255,255,${IDLE_STROKE_OPACITY}); overflow:hidden; }.work-thumb picture,.work-thumb img { display:block; width:100%; height:100%; }.work-thumb img { object-fit:cover; filter:grayscale(1); }
  .work-rail-title-row { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:16px; }.work-rail-title-row h3 { margin:0; font-size:20px; letter-spacing:-.025em; }.work-rail-title-row div { display:flex; gap:4px; }.work-rail-title-row button { width:28px; height:28px; padding:0; }
  .work-rail-content > p:not(.work-hints) { min-height:2.8em; margin:8px 0 18px; color:rgba(255,255,255,.58); font-size:13px; line-height:1.4; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
  .work-rail dl { margin:0; padding:14px 0; border-top:1px solid var(--hair); border-bottom:1px solid var(--hair); font:11px ${mono}; }.work-rail dl div { display:grid; grid-template-columns:64px 1fr; gap:10px; padding:4px 0; }.work-rail dt { color:rgba(255,255,255,.4); }.work-rail dd { margin:0; color:rgba(255,255,255,.72); }
  .work-open { width:100%; margin-top:14px; padding:11px; border-color:rgba(255,255,255,${IDLE_STROKE_OPACITY}); color:#ededf0; }.work-open:hover { background:rgba(255,255,255,.07); }.work-hints { margin:14px 0 0; color:rgba(255,255,255,.4); font:10px ${mono}; } kbd { border:1px solid var(--hair); padding:1px 3px; font:inherit; }
  @media (max-width:${WORK_RAIL_STACK_BREAKPOINT_PX}px) { .work-layout { grid-template-columns:1fr; }.work-rail { position:relative; top:auto; order:-1; max-width:${WORK_RAIL_WIDTH_PX}px; }.work-toolbar { align-items:flex-start; flex-direction:column; }.work-filters { gap:5px; } }
  @media (prefers-reduced-motion:reduce) { .work-rail-content { transition:none; }.work-status-in-progress i { animation:none; } }
`;
