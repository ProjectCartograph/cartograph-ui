import { VaultExamplesProvider } from "@/components/examples";
import { Fragment, useState } from "react";
import {
  createRootRoute,
  Link,
  Outlet,
  useMatches,
} from "@tanstack/react-router";
import { Archive, Bot, FolderKanban, Gauge, KeyRound, Layers, Map as MapIcon, PlugZap, Plus, Radio, Settings2, Table2, TriangleAlert, Waypoints, GitPullRequest } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarMenuBadge,
} from "@/components/ui/sidebar";
import { copy, manifestKindLabels } from "@/copy";
import { useProjectManifest } from "@/projects/api";
import { useGoalManifest } from "@/surfaces/goals/api";
import { PeopleHere } from "@/collab/PeopleHere";
import { PresenceOverlay } from "@/collab/PresenceOverlay";
import { PresenceProvider } from "@/collab/presence";
import { FollowProvider, useFollow } from "@/collab/follow";
import { FollowChip, FollowPanel } from "@/collab/FollowPanel";
import { PresenceTracker } from "@/collab/PresenceTracker";
import { screenFor } from "@/collab/screen";
import { useManifestName } from "@/api/names";
import { holds, useSession } from "@/access/access";
import { useClient } from "@/client/context";
import { useQuery } from "@tanstack/react-query";
import { NotListed } from "@/access/NotListed";

const defineItems = [
  {
    title: copy.rail.strategy,
    icon: MapIcon,
    to: "/",
    params: undefined,
  },
  {
    title: copy.rail.projects,
    icon: FolderKanban,
    to: "/projects",
    params: undefined,
  },
  {
    title: copy.rail.programmes,
    icon: Layers,
    to: "/programmes",
    params: undefined,
  },
  {
    title: copy.rail.operations,
    icon: Settings2,
    to: "/operations",
    params: undefined,
  },
  {
    title: copy.rail.gaps,
    icon: TriangleAlert,
    to: "/gaps",
    params: undefined,
  },
  {
    title: copy.rail.kpis,
    icon: Gauge,
    to: "/kpis",
    params: undefined,
  },
] as const;

const workItems: Array<{
  title: string;
  icon: any;
  to: string;
  params?: any;
}> = [
  {
    title: copy.rail.graph,
    icon: Waypoints,
    to: "/graph",
    params: undefined,
  },
  {
    title: copy.rail.sheets,
    icon: Table2,
    to: "/sheets",
    params: undefined,
  },
  {
    title: "Snapshots",
    icon: Archive,
    to: "/snapshots",
    params: undefined,
  },
];

interface Crumb {
  label: string;
  to?: string;
}

/**
 * Every route's breadcrumb trail. The first crumb is never "Cartograph": it is
 * always the current section's own rail label (Goals, Sheets, ...), or, for
 * a still-placeholder "/manifests/$kind" page, that kind's rail label. A
 * second crumb, when there is one, is the specific record: the goal's own
 * name (one line, ellipsis) on the goal editor, or the sheet kind's plural
 * label on a Sheet.
 */
function useBreadcrumbCrumbs(): Crumb[] {
  const matches = useMatches();
  const last = matches[matches.length - 1];
  const routeId = last?.routeId;
  const params = (last?.params ?? {}) as Record<string, string>;

  const goalId = routeId === "/goals/$id" ? params.id : undefined;
  const goalQuery = useGoalManifest(goalId);
  const goalName = goalQuery.data?.manifest.metadata.name;

  const programmeId = routeId?.startsWith("/programmes/$id") ? params.id : undefined;
  const programmeQuery = useManifestName("Programme", programmeId);
  const programmeName = programmeQuery.data;

  const operationId = routeId?.startsWith("/operations/$id") ? params.id : undefined;
  const operationName = useManifestName("Operation", operationId).data;

  const gapId = routeId?.startsWith("/gaps/$id") ? params.id : undefined;
  const gapName = useManifestName("Gap", gapId).data;

  const kpiId = routeId?.startsWith("/kpis/$id") ? params.id : undefined;
  const kpiName = useManifestName("KPI", kpiId).data;

  const projectId = routeId?.startsWith("/projects/$id") ? params.id : undefined;
  const projectQuery = useProjectManifest(projectId);
  const projectName = projectQuery.data?.manifest.metadata.name;

  if (routeId === "/access") return [{ label: copy.rail.access }];

  if (routeId?.startsWith("/projects/$id")) {
    const crumbs: Crumb[] = [
      { label: copy.rail.projects, to: "/projects" },
      { label: projectName ?? projectId ?? "", to: routeId === "/projects/$id/" ? undefined : `/projects/${projectId}` },
    ];
    if (routeId !== "/projects/$id/") {
      const section = routeId?.split("/").pop() ?? "";
      const sectionLabel =
        copy.projects.sections[section] ??
        copy.projects.stepper[section as "closing" | "landing"] ??
        // Not steps of the walk: views read off the definition.
        (section === "framework"
          ? copy.framework.title
          : section === "charter"
            ? copy.charter.title
            : section);
      crumbs.push({ label: sectionLabel });
    }
    return crumbs;
  }
  if (routeId?.startsWith("/programmes/$id")) {
    const crumbs: Crumb[] = [{ label: copy.rail.programmes, to: "/programmes" }];
    const section = routeId.split("/").pop() ?? "";
    const label =
      copy.programmes.sections[section]?.heading ??
      (section === "framework"
        ? copy.framework.title
        : section === "charter"
          ? copy.charter.title
          : undefined);
    crumbs.push({ label: programmeName ?? params.id ?? "", to: label ? "/programmes" : undefined });
    if (label) crumbs.push({ label });
    return crumbs;
  }
  if (routeId === "/programmes/") {
    return [{ label: copy.rail.programmes }];
  }
  if (routeId?.startsWith("/operations/$id")) {
    const crumbs: Crumb[] = [{ label: copy.rail.operations, to: "/operations" }];
    const section = routeId.split("/").pop() ?? "";
    const label = copy.operations.sections[section]?.heading;
    crumbs.push({ label: operationName ?? params.id ?? "", to: label ? "/operations" : undefined });
    if (label) crumbs.push({ label });
    return crumbs;
  }
  if (routeId === "/operations/") {
    return [{ label: copy.rail.operations }];
  }
  if (routeId?.startsWith("/gaps/$id")) {
    const crumbs: Crumb[] = [{ label: copy.rail.gaps, to: "/gaps" }];
    const section = routeId.split("/").pop() ?? "";
    const label = copy.gaps.sections[section]?.heading;
    crumbs.push({ label: gapName ?? params.id ?? "", to: label ? "/gaps" : undefined });
    if (label) crumbs.push({ label });
    return crumbs;
  }
  if (routeId === "/gaps/") {
    return [{ label: copy.rail.gaps }];
  }
  if (routeId === "/gaps/new") {
    return [
      { label: copy.rail.gaps, to: "/gaps" },
      { label: copy.gaps.newLink },
    ];
  }
  if (routeId === "/kpis/") {
    return [{ label: copy.rail.kpis }];
  }
  if (routeId?.startsWith("/kpis/$id")) {
    const crumbs: Crumb[] = [{ label: copy.rail.kpis, to: "/kpis" }];
    const section = routeId.split("/").pop() ?? "";
    const label = copy.kpis.sections[section]?.heading;
    crumbs.push({ label: kpiName ?? params.id ?? "", to: label ? "/kpis" : undefined });
    if (label) crumbs.push({ label });
    return crumbs;
  }
  if (routeId === "/new") {
    return [{ label: copy.newWork.title }];
  }
  if (routeId === "/programmes/new") {
    return [
      { label: copy.rail.programmes, to: "/programmes" },
      { label: copy.programmes.newLink },
    ];
  }
  if (routeId === "/operations/new") {
    return [
      { label: copy.rail.operations, to: "/operations" },
      { label: copy.operations.newLink },
    ];
  }
  if (routeId === "/projects/") {
    return [{ label: copy.rail.projects }];
  }
  if (routeId === "/projects/new") {
    return [
      { label: copy.rail.projects, to: "/projects" },
      { label: copy.projects.list.newProject },
    ];
  }
  if (routeId === "/goals/$id") {
    return [
      { label: copy.rail.strategy, to: "/" },
      { label: goalName ?? goalId ?? "" },
    ];
  }
  if (routeId === "/sheets/$kind") {
    const kind = params.kind;
    return [
      { label: copy.rail.sheets, to: "/sheets" },
      { label: copy.sheets.kinds[kind] ?? kind },
    ];
  }
  if (routeId === "/sheets/") {
    return [{ label: copy.rail.sheets }];
  }
  if (routeId?.startsWith("/snapshots")) {
    return [{ label: "Snapshots" }];
  }
  if (routeId === "/manifests/$kind") {
    const kind = params.kind;
    return [{ label: manifestKindLabels[kind] ?? kind }];
  }
  if (routeId === "/goals/") {
    return [{ label: copy.rail.strategy, to: "/" }, { label: copy.strategy.edit }];
  }
  // "/" (Strategy) and anything unmatched.
  return [{ label: copy.rail.strategy }];
}

// Matches SidebarProvider's own SIDEBAR_COOKIE_NAME (components/ui/sidebar.tsx,
// stock, not exported). SidebarProvider writes this cookie itself on every
// toggle; a server-rendered app reads it back on the server, but this SPA has
// no server render, so the initial state has to be read from document.cookie
// here and handed to SidebarProvider as a controlled `open`, or the write
// half of "persist across a reload" never has a read half.
const SIDEBAR_COOKIE_NAME = "sidebar_state";

function readSidebarOpenCookie(): boolean {
  const match = document.cookie.match(new RegExp(`(?:^|; )${SIDEBAR_COOKIE_NAME}=([^;]*)`));
  return match ? match[1] === "true" : true;
}

/** The screen presence travels on: the manifest the route is about, or
 * none. */
function usePresenceScreen() {
  const matches = useMatches();
  const last = matches[matches.length - 1];
  const params = (last?.params ?? {}) as Record<string, string>;
  return { screen: screenFor(last?.routeId, params), route: last?.pathname ?? "" };
}

/** The rail's way into following: the agents working now, with a live
 * dot, opening the panel (engine docs/adr/0018). */
function AgentsAtWork() {
  const f = useFollow();
  const working = f.lanes.filter((l) => l.active && !f.hidden.has(l.session)).length;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton tooltip={copy.follow.rail} onClick={() => f.setPanelOpen(!f.panelOpen)} isActive={f.panelOpen} data-cartograph-follow>
        <span className="relative flex">
          <Radio />
          {working > 0 ? <span className="absolute -right-0.5 -top-0.5 size-2 animate-pulse rounded-full bg-violet-500" /> : null}
        </span>
        <span>{copy.follow.rail}</span>
      </SidebarMenuButton>
      {working > 0 ? <SidebarMenuBadge>{working}</SidebarMenuBadge> : null}
    </SidebarMenuItem>
  );
}

function RootLayout() {
  const crumbs = useBreadcrumbCrumbs();
  const { data: session } = useSession();
  // What agents proposed for this person: the rail shows the count, and
  // the entry wherever agents are allowed or something waits.
  const client = useClient();
  const proposals = useQuery({ queryKey: ["proposals"], queryFn: () => client.proposals(), retry: false });
  // Change sets waiting for this person to review.
  const changeSets = useQuery({ queryKey: ["changesets"], queryFn: () => client.changeSets(), retry: false, refetchInterval: 15_000 });
  const waiting = (changeSets.data ?? []).filter((c) => c.status === "proposed").length;
  const agentsHere = session?.access?.agents === true;
  // Signed in through the proxy, but not on the access list: nothing here
  // is theirs to see, and the engine would refuse every request.
  const unlisted = session?.access && !session.access.listed;
  const [sidebarOpen, setSidebarOpen] = useState(readSidebarOpenCookie);
  const { screen, route } = usePresenceScreen();

  return (
    <VaultExamplesProvider>
    <TooltipProvider>
    <FollowProvider>
    <PresenceProvider screen={screen} route={route}>
      <PresenceTracker />
      <PresenceOverlay />
      <FollowPanel />
      <FollowChip />
      <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <Sidebar variant="inset" collapsible="icon" data-cartograph-region="rail">
          <SidebarHeader>
            <div className="flex items-center gap-2 px-2 py-1.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
                A
              </div>
              <div className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate text-sm font-semibold">{copy.appName}</span>
                <span className="truncate text-xs text-muted-foreground">{copy.appLine}</span>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>{copy.rail.define}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip={copy.rail.new}>
                      <Link to="/new" className="font-medium text-primary">
                        <Plus />
                        <span>{copy.rail.new}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {defineItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild tooltip={item.title}>
                        <Link to={item.to} params={item.params} activeOptions={{ exact: item.to === "/" }}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>{copy.rail.work}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {workItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild tooltip={item.title}>
                        <Link to={item.to} params={item.params}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            {session?.agents === true || agentsHere || waiting > 0 || (proposals.data?.length ?? 0) > 0 ? (
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild tooltip={copy.changeSets.rail}>
                        <Link to="/changesets">
                          <GitPullRequest />
                          <span>{copy.changeSets.rail}</span>
                        </Link>
                      </SidebarMenuButton>
                      {waiting > 0 ? <SidebarMenuBadge>{waiting}</SidebarMenuBadge> : null}
                    </SidebarMenuItem>
                    {/* What agents proposed before change sets, while any is open. */}
                    {(proposals.data?.length ?? 0) > 0 ? (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild tooltip={copy.rail.proposals}>
                          <Link to="/proposals">
                            <Bot />
                            <span>{copy.rail.proposals}</span>
                          </Link>
                        </SidebarMenuButton>
                        <SidebarMenuBadge>{proposals.data?.length}</SidebarMenuBadge>
                      </SidebarMenuItem>
                    ) : null}
                    <AgentsAtWork />
                    {agentsHere ? (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild tooltip={copy.rail.agents}>
                          <Link to="/agents">
                            <PlugZap />
                            <span>{copy.rail.agents}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ) : null}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ) : null}
            {holds(session, "administrator") ? (
              <SidebarGroup>
                <SidebarGroupLabel>{copy.rail.administration}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild tooltip={copy.rail.access}>
                        <Link to="/access">
                          <KeyRound />
                          <span>{copy.rail.access}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ) : null}
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="min-w-0">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4" data-cartograph-region="header">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb className="min-w-0 flex-1">
              <BreadcrumbList className="flex-nowrap">
                {crumbs.map((crumb, i) => {
                  const isLast = i === crumbs.length - 1;
                  return (
                    <Fragment key={`${crumb.label}-${i}`}>
                      {i > 0 ? <BreadcrumbSeparator /> : null}
                      <BreadcrumbItem className={isLast ? "min-w-0" : "shrink-0"}>
                        {crumb.to ? (
                          <BreadcrumbLink asChild>
                            <Link to={crumb.to}>{crumb.label}</Link>
                          </BreadcrumbLink>
                        ) : (
                          <BreadcrumbPage className="block max-w-64 truncate">{crumb.label}</BreadcrumbPage>
                        )}
                      </BreadcrumbItem>
                    </Fragment>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>
            <PeopleHere />
          </header>
          <main className="min-w-0 flex-1 p-6" data-cartograph-region="main">
            {unlisted ? <NotListed email={session?.email} /> : <Outlet />}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </PresenceProvider>
    </FollowProvider>
    </TooltipProvider>
    </VaultExamplesProvider>
  );
}

export const Route = createRootRoute({ component: RootLayout });
