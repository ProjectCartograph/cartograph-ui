import { useNavigate } from "@tanstack/react-router";
import { BriefcaseBusiness, ChevronDown, FolderKanban, Gauge, Layers, Mountain, Plus, Settings2, TriangleAlert, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { copy } from "@/copy";

const cc = copy.createMenu;

// What can be created, and where its own start is: the same doors New
// and each register open, from wherever the person is.
// Each with the icon its register has on the rail.
const WORK: Entry[] = [
  { kind: "Project", to: "/projects/start", icon: FolderKanban },
  { kind: "Programme", to: "/programmes/prepare", icon: Layers },
  { kind: "Portfolio", to: "/portfolios/prepare", icon: BriefcaseBusiness },
  { kind: "Operation", to: "/operations/new", icon: Settings2 },
];
const STRATEGY: Entry[] = [
  { kind: "Goal", to: "/goals", search: { add: "goal" }, icon: Mountain },
  { kind: "Gap", to: "/gaps/new", icon: TriangleAlert },
  { kind: "KPI", to: "/kpis", search: { add: "1" }, icon: Gauge },
];

interface Entry {
  kind: string;
  to: string;
  search?: Record<string, string>;
  icon: LucideIcon;
}

/**
 * Create, at the top right of every screen, as a file store has it: a
 * project, programme, portfolio or service, or a goal, gap or indicator,
 * started from wherever the person is, without going back to the rail.
 */
export function CreateMenu() {
  const navigate = useNavigate();
  const item = (e: Entry) => {
    const Icon = e.icon;
    return (
      <DropdownMenuItem key={e.kind} onSelect={() => void navigate({ to: e.to, search: (e.search ?? {}) as never } as never)} data-create={e.kind}>
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        {cc.kinds[e.kind] ?? e.kind}
      </DropdownMenuItem>
    );
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="shrink-0 gap-1.5" aria-label={cc.label} title={cc.label} data-cartograph-region="create">
          <Plus />
          <span className="hidden sm:inline">{cc.button}</span>
          <ChevronDown className="size-3.5 opacity-70" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{cc.work}</DropdownMenuLabel>
        {WORK.map(item)}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{cc.strategy}</DropdownMenuLabel>
        {STRATEGY.map(item)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
