import { VaultExamplesProvider } from "@/components/examples";
import { Fragment, useState } from "react";
import {
  createRootRoute,
  Link,
  Outlet,
  useMatches,
} from "@tanstack/react-router";
import { Archive, BookOpen, Bot, House, FolderKanban, Gauge, KeyRound, Layers, Map as MapIcon, PlugZap, Plus, Radio, Settings2, Table2, TriangleAlert, Waypoints, GitPullRequest, BriefcaseBusiness } from "lucide-react";

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
import { stageOfSection } from "@/projects/types";
import { useProjectManifest } from "@/projects/api";
import { useGoalManifest } from "@/surfaces/goals/api";
import { PeopleHere } from "@/collab/PeopleHere";
import { WorkingIn } from "@/changesets/WorkingIn";
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
import { useSettings } from "@/surfaces/goals/api";
import { useLeftToDo } from "@/surfaces/home/leftToDo";
import { TourProvider } from "@/tour/TourProvider";
import { TourEntry } from "@/tour/TourEntry";
import { useActiveChangeSet } from "@/changesets/useActive";
import { MergeBar } from "@/changesets/MergeBar";

const defineItems = [
  {
    title: copy.rail.strategy,
    icon: MapIcon,
    to: "/strategy",
    params: undefined,
  },
  {
    title: copy.rail.projects,
    icon: FolderKanban,
    to: "/projects",
    params: undefined,
  },
  {
    title: copy.rail.portfolios,
    icon: BriefcaseBusiness,
    to: "/portfolios",
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
  },  {
    title: copy.rail.glossary,
    icon: BookOpen,
    to: "/glossary",
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

  const portfolioId = routeId?.startsWith("/portfolios/$id") ? params.id : undefined;
  const portfolioName = useManifestName("Portfolio", portfolioId).data;

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

  if (routeId === "/projects/start") {
    return [{ label: copy.rail.projects, to: "/projects" }, { label: copy.projects.newProject?.title ?? copy.start.readyQuestion }];
  }
  if (routeId === "/projects/prepare") {
    return [{ label: copy.rail.projects, to: "/projects" }, { label: copy.prepare.title }];
  }
  if (routeId === "/programmes/prepare") {
    return [{ label: copy.rail.programmes, to: "/programmes" }, { label: copy.prepare.title }];
  }
  if (routeId === "/portfolios/prepare") {
    return [{ label: copy.rail.portfolios, to: "/portfolios" }, { label: copy.prepare.title }];
  }
  if (routeId?.startsWith("/projects/$id")) {
    const crumbs: Crumb[] = [
      { label: copy.rail.projects, to: "/projects" },
      { label: projectName ?? projectId ?? "", to: routeId === "/projects/$id/" ? undefined : `/projects/${projectId}` },
    ];
    // The project's layout alone: the address below it is not a page.
    if (routeId === "/projects/$id") crumbs.push({ label: copy.notFound.title });
    else if (routeId !== "/projects/$id/") {
      const section = routeId?.split("/").pop() ?? "";
      // A step of the walk is shown as its stage, as its page is headed
      // (TAXONOMY.md D33).
      const sectionLabel =
        (routeId?.includes("/initiation/") ? copy.projects.stages[stageOfSection(section)] : undefined) ??
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
  if (routeId?.startsWith("/portfolios/$id")) {
    const label = copy.portfolios.sections[routeId.split("/").pop() ?? ""]?.heading;
    const crumbs: Crumb[] = [{ label: copy.rail.portfolios, to: "/portfolios" }];
    crumbs.push({ label: portfolioName ?? params.id ?? "", to: label ? "/portfolios" : undefined });
    if (label) crumbs.push({ label });
    return crumbs;
  }
  if (routeId === "/portfolios/") {
    return [{ label: copy.rail.portfolios }];
  }
  if (routeId === "/portfolios/new") {
    return [
      { label: copy.rail.portfolios, to: "/portfolios" },
      { label: copy.portfolios.newLink },
    ];
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
  if (routeId === "/glossary") {
    return [{ label: copy.glossary.title }];
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
      { label: copy.rail.strategy, to: "/strategy" },
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
    return [{ label: copy.rail.strategy, to: "/strategy" }, { label: copy.strategy.edit }];
  }
  if (routeId === "/strategy") {
    return [{ label: copy.rail.strategy }];
  }
  // "/" (Home) and anything unmatched.
  return [{ label: copy.rail.home }];
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
  const workingIn = useActiveChangeSet();
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
  const organisation = useSettings().data?.purpose?.organisation ?? "";
  const leftCount = useLeftToDo().length;
  // Opening a new workspace is a page of its own, with no rail and no
  // header: nothing to wander off to before there is anything to see.
  const bare = route === "/welcome";

  if (bare) {
    return (
      <VaultExamplesProvider>
        <TooltipProvider>
          {/* Joined, so others see this person opening the workspace;
              nothing of the walk itself is shared (collab/walkers). */}
          <FollowProvider>
            <PresenceProvider screen={null} route={route}>
              <main className="min-h-svh min-w-0 bg-background p-6" data-cartograph-region="main">
                <Outlet />
              </main>
            </PresenceProvider>
          </FollowProvider>
        </TooltipProvider>
      </VaultExamplesProvider>
    );
  }

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
      <TourProvider>
        <Sidebar variant="inset" collapsible="icon" data-cartograph-region="rail">
          <SidebarHeader>
            {/* Opening and closing the rail belongs to the rail: its first
                thing, at the top left, open or folded to its icons. */}
            <SidebarTrigger className="size-8" data-cartograph-region="rail-toggle" />
            <div className="flex items-center gap-2 px-2 py-1.5">
              {/* The organisation the workspace is about, once named
                  (engine TAXONOMY.md D37); the product's name until then. */}
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
                {(organisation || copy.appName).slice(0, 1).toUpperCase()}
              </div>
              <div className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate text-sm font-semibold">{organisation || copy.appName}</span>
                <span className="truncate text-xs text-muted-foreground">{organisation ? copy.appName : copy.appLine}</span>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>{copy.rail.define}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip={copy.rail.home}>
                      <Link to="/" activeOptions={{ exact: true }}>
                        <House />
                        <span>{copy.rail.home}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip={copy.rail.new}>
                      <Link to="/new">
                        <Plus />
                        <span>{copy.rail.new}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {defineItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild tooltip={item.title}>
                        <Link to={item.to} params={item.params}>
                          {/* Something in the strategy started and not
                              finished: a quiet dot, never a count. */}
                          <span className="relative flex">
                            <item.icon />
                            {item.to === "/strategy" && leftCount > 0 ? (
                              <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-warning ring-2 ring-sidebar" role="img" aria-label={copy.home.left.rail} data-slot="left-to-do" />
                            ) : null}
                          </span>
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
              <TourEntry />
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="min-w-0">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4" data-cartograph-region="header">
            {/* On a phone the rail slides in over the page, so its
                toggle is here too. */}
            <SidebarTrigger className="-ml-1 md:hidden" />
            <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
            <Breadcrumb className="min-w-0 flex-1">
              <BreadcrumbList className="flex-nowrap">
                {crumbs.map((crumb, i) => {
                  return (
                    <Fragment key={`${crumb.label}-${i}`}>
                      {i > 0 ? <BreadcrumbSeparator /> : null}
                      {/* Every crumb shortens before the row overflows, the
                          ones before the page most. */}
                      <BreadcrumbItem className="min-w-0">
                        {crumb.to ? (
                          <BreadcrumbLink asChild>
                            <Link to={crumb.to} className="block max-w-28 truncate sm:max-w-48">
                              {crumb.label}
                            </Link>
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
            <WorkingIn />
            <PeopleHere />
          </header>
          <main className="min-w-0 flex-1 p-6" data-cartograph-region="main" data-working-in={workingIn ? "" : undefined}>
            {unlisted ? <NotListed email={session?.email} /> : <Outlet />}
            {unlisted ? null : <MergeBar />}
          </main>
        </SidebarInset>
      </TourProvider>
      </SidebarProvider>
    </PresenceProvider>
    </FollowProvider>
    </TooltipProvider>
    </VaultExamplesProvider>
  );
}

/** An address that is not a page: said plainly, with the way home. */
function PageNotFound() {
  return (
    <div className="flex flex-col items-start gap-3" data-cartograph-region="not-found">
      <h1 className="text-2xl font-semibold tracking-tight">{copy.notFound.title}</h1>
      <p className="text-muted-foreground">{copy.notFound.body}</p>
      <Link to="/" className="text-sm underline">
        {copy.notFound.home}
      </Link>
    </div>
  );
}

export const Route = createRootRoute({ component: RootLayout, notFoundComponent: PageNotFound });
