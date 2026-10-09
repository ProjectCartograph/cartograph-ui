import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";

import { ClientProvider } from "./client/context";
import { httpClient } from "./client/http";
import { celebrating } from "./components/celebrate";
import { markTouchedOnFirstInput } from "./components/touched";
import { routeTree } from "./routeTree.gen";
import { requestStarted, screenShown, startTrace } from "./trace";
import "./index.css";

const queryClient = new QueryClient();
// The one Client the whole interface works through.
// What commits something, pressed for, ends in confetti from its button.
const client = celebrating(httpClient({ onRequest: requestStarted }));
// Motion answers a person: picks settle only after they have pressed or
// typed something, never as a page opens.
markTouchedOnFirstInput();
const router = createRouter({ routeTree });
// The people's trace (engine docs/adr/0034), only where the deployment
// keeps one: each screen timed from its navigation, named by its route
// pattern, never its address.
// The first screen is timed from the page's own start.
let navigated = 0;
router.subscribe("onBeforeNavigate", () => {
  navigated = performance.now();
});
router.subscribe("onResolved", () => screenShown(navigated));
void startTrace(client, () => (router.state.matches.at(-1)?.routeId ?? "").replace(/^\//, "") || "index");

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClientProvider client={client}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ClientProvider>
  </StrictMode>,
);
