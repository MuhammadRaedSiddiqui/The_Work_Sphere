import { WORK_STACK_FILTERS, WORK_STATUS_FILTERS } from "./constants";

export type WorkRouteView = "index" | "specimen";
export type WorkRouteSort = "index" | "title" | "stack" | "lane" | "year" | "status";
export type WorkRouteDirection = "asc" | "desc";

export type WorkRoute = {
  projectId: string | null;
  view: WorkRouteView;
  sort: WorkRouteSort;
  dir: WorkRouteDirection;
  filters: {
    status: (typeof WORK_STATUS_FILTERS)[number][];
    stack: (typeof WORK_STACK_FILTERS)[number][];
  };
};

const sortKeys = new Set<WorkRouteSort>(["index", "title", "stack", "lane", "year", "status"]);

function valuesFor<T extends readonly string[]>(raw: string | null, choices: T): T[number][] {
  if (!raw) return [];
  const bySlug = new Map(choices.map((choice) => [choice.toLowerCase(), choice]));
  return raw.split(",").flatMap((value) => {
    const match = bySlug.get(value.trim().toLowerCase());
    return match ? [match] : [];
  });
}

export function readWorkRoute(location = window.location): WorkRoute {
  const params = new URLSearchParams(location.search);
  const suffix = location.pathname.replace(/^\/work\/?/, "").split("/")[0];
  const [sortCandidate, directionCandidate] = (params.get("sort") ?? "index:asc").split(":");
  const sort = sortKeys.has(sortCandidate as WorkRouteSort) ? sortCandidate as WorkRouteSort : "index";
  const dir: WorkRouteDirection = directionCandidate === "desc" ? "desc" : "asc";
  return {
    projectId: suffix ? decodeURIComponent(suffix) : null,
    view: params.get("view") === "specimen" ? "specimen" : "index",
    sort,
    dir,
    filters: {
      status: valuesFor(params.get("status"), WORK_STATUS_FILTERS),
      stack: valuesFor(params.get("stack"), WORK_STACK_FILTERS),
    },
  };
}

export function workRouteHref(route: WorkRoute) {
  const params = new URLSearchParams();
  if (route.view === "specimen") params.set("view", route.view);
  if (route.filters.status.length) params.set("status", route.filters.status.join(","));
  if (route.filters.stack.length) params.set("stack", route.filters.stack.map((stack) => stack.toLowerCase()).join(","));
  if (route.sort !== "index" || route.dir !== "asc") params.set("sort", `${route.sort}:${route.dir}`);
  const path = route.projectId ? `/work/${encodeURIComponent(route.projectId)}` : "/work";
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function isWorkRoute(pathname = window.location.pathname) {
  return pathname === "/work" || pathname.startsWith("/work/");
}
