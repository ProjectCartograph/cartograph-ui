import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, FileText } from "lucide-react";

import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import { useProjectChecks, useProjectState } from "@/projects/api";
import { ProjectHeaderBar } from "@/projects/Chrome";
import { useProjectStore, type Problem } from "@/projects/store";

export const Route = createFileRoute("/projects/$id/handoff")({ component: HandoffPage });

const rc = copy.projects.record;

const CHARTER_SECTIONS = [
  { letter: "A", title: "Document control and version" },
  { letter: "B", title: "Project canvas: goals, aim, key results" },
  { letter: "C", title: "Mandate and alignment" },
  { letter: "D", title: "Scope, In and Out, funding envelope" },
  { letter: "E", title: "Deliverables and acceptance" },
  { letter: "F", title: "Beneficiaries" },
  { letter: "G", title: "Timeline: phases and months" },
  { letter: "H", title: "Roles, by role" },
  { letter: "I", title: "Data consumed and produced" },
  { letter: "J", title: "Risks, issues, dependencies, assumptions, constraints" },
  { letter: "K", title: "Closing test and landing test" },
];

const HELD_ELSEWHERE = [
  { letter: "L", title: "Work breakdown and schedule", location: "delivery tool" },
  { letter: "M", title: "Budget lines by activity and year", location: "delivery board; accounting records" },
  { letter: "N", title: "Communications plan", location: "delivery tool" },
  { letter: "O", title: "Approvals and sign-off", location: "delivery tool" },
];

function HandoffPage() {
  const { id } = Route.useParams();
  const store = useProjectStore();
  const stateQuery = useProjectState(id);
  const checksQuery = useProjectChecks(id, true);
  const [isHandingOff, setIsHandingOff] = useState(false);
  const [handoffProblems, setHandoffProblems] = useState<Problem[]>([]);
  const [handoffBundle, setHandoffBundle] = useState<string>("");
  const [chartPath, setChartPath] = useState<string>("");

  const state = stateQuery.data?.state ?? "draft";
  const snapshot = stateQuery.data?.history?.[stateQuery.data.history.length - 1]?.snapshot ?? 0;

  const blocking = checksQuery.data?.blocking ?? 0;

  async function handleHandoff() {
    setIsHandingOff(true);
    setHandoffProblems([]);
    setHandoffBundle("");
    setChartPath("");
    try {
      const result = await store.handoff();
      if (result.ok) {
        setHandoffBundle(result.bundle);
        const parts = result.bundle.split("/");
        const projectID = parts[2];
        const version = parts[3];
        if (projectID && version) {
          setChartPath(`${projectID}-${version}`);
        }
        stateQuery.refetch?.();
      } else {
        setHandoffProblems(result.problems);
      }
    } finally {
      setIsHandingOff(false);
    }
  }

  if (!store.loaded) {
    return <p className="text-sm text-muted-foreground">{rc.loading}</p>;
  }
  if (store.loadError) {
    return <p className="text-sm text-destructive">{rc.error}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <ProjectHeaderBar />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hand off {store.name}</h1>
          {snapshot > 0 && (
            <p className="text-sm text-muted-foreground mt-2">Renders snapshot {snapshot}. Same inputs, same bytes. The bundle is what the delivery tool receives.</p>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="secondary">{state}</Badge>
          {state === "draft" && (
            <>
              <span className="text-muted-foreground text-xs">→</span>
              <Badge variant="secondary">defined</Badge>
              <span className="text-muted-foreground text-xs">→</span>
              <Badge variant="outline">handed off</Badge>
              <span className="text-muted-foreground text-xs">→</span>
              <Badge variant="outline">cancelled</Badge>
            </>
          )}
        </div>
      </div>

      {handoffProblems.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Handoff refused</AlertTitle>
          <AlertDescription className="mt-2 space-y-1">
            {handoffProblems.map((p, i) => (
              <div key={i} className="text-sm">
                {p.message}
                {p.message.includes("custodian") && (
                  <Link
                    to="/projects/$id/initiation/data"
                    params={{ id }}
                    className="ml-2 font-medium underline hover:no-underline"
                  >
                    Fix in Data
                  </Link>
                )}
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 min-w-0 space-y-6">
          <div className="border rounded-lg overflow-hidden">
            <div className="p-4 border-b bg-card">
              <h2 className="text-lg font-semibold">Charter sections</h2>
              <p className="text-xs text-muted-foreground mt-1">11 from data · 4 name the tool that holds them</p>
            </div>
            <div className="divide-y">
              {CHARTER_SECTIONS.map(({ letter, title }) => (
                <div key={letter} className="p-3 grid grid-cols-[1.5rem_1fr_auto] gap-4 items-center text-sm">
                  <div className="text-muted-foreground font-mono">{letter}</div>
                  <div>{title}</div>
                  <Badge variant="secondary">from data</Badge>
                </div>
              ))}
              {HELD_ELSEWHERE.map(({ letter, title, location }) => (
                <div key={letter} className="p-3 grid grid-cols-[1.5rem_1fr_auto] gap-4 items-center text-sm">
                  <div className="text-muted-foreground font-mono">{letter}</div>
                  <div>{title}</div>
                  <Badge variant="outline">not held in Cartograph · {location}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {handoffBundle && (
            <div className="border rounded-lg overflow-hidden bg-muted/50">
              <div className="p-4 border-b">
                <h3 className="font-semibold">Bundle</h3>
              </div>
              <div className="p-4 space-y-3">
                {chartPath && (
                  <>
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-xs">charter-{chartPath}.html</span>
                      <span className="text-xs text-muted-foreground ml-auto">84 KB</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-xs">charter-{chartPath}.json</span>
                      <span className="text-xs text-muted-foreground ml-auto">41 KB</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-xs">charter-{chartPath}.pdf</span>
                      <span className="text-xs text-muted-foreground ml-auto">212 KB</span>
                    </div>
                  </>
                )}
                <p className="text-xs text-muted-foreground mt-3">Written to the vault at .cartograph/handoff/{chartPath?.split('-')[0]}/{chartPath?.split('-')[1]}/. Upload it to the delivery tool; approvals happen there.</p>
              </div>
            </div>
          )}

          <div className="border rounded-lg p-4">
            <h3 className="font-semibold text-sm mb-3">Checks</h3>
            <div className="space-y-2 text-sm">
              {blocking > 0 && (
                <div className="flex gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-destructive">{blocking} blocks:</span> Blocking checks prevent handoff
                  </div>
                </div>
              )}
              {blocking === 0 && (
                <div className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div>All checks pass</div>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-3">Checks never stop a save or a snapshot. They stop a handoff.</p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
            >
              Preview charter
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={handleHandoff}
              disabled={isHandingOff || state === "handed off" || state === "cancelled"}
            >
              {isHandingOff ? "Handing off..." : "Hand off"}
            </Button>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">A formal change after handoff returns here: edit the file, save as version, hand off again. The delivery tool keeps the approval trail.</p>
    </div>
  );
}
