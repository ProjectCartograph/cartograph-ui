import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";

import { ClientProvider } from "./client/context";
import { httpClient } from "./client/http";
import { routeTree } from "./routeTree.gen";
import "./index.css";

const queryClient = new QueryClient();
// The one Client the whole interface works through.
const client = httpClient();
const router = createRouter({ routeTree });

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
