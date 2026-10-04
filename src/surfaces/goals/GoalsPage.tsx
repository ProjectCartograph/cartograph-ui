import { getRouteApi, useNavigate } from "@tanstack/react-router";

import { useGoalTree } from "./api";
import { GoalsHome } from "./GoalsHome";
import { PlaceGoal } from "./PlaceGoal";

const route = getRouteApi("/goals/");

/** The goals tree, and a goal arriving from the home page with its level
 * and name, placed in it (engine docs/adr/0023). */
export function GoalsPage() {
  const { add, name } = route.useSearch();
  const navigate = useNavigate();
  const tree = useGoalTree();
  return (
    <>
      <GoalsHome />
      {add ? (
        <PlaceGoal
          key={`${add}/${name ?? ""}`}
          level={add}
          name={name ?? ""}
          tree={tree.data}
          onDone={(id) => void (id ? navigate({ to: "/goals/$id", params: { id } }) : navigate({ to: "/goals", search: {} }))}
        />
      ) : null}
    </>
  );
}
