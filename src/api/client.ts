import createClient from "openapi-fetch";
import type { paths } from "./gen/schema";

// The SPA is always served by the same binary as the API, at /api/v1.
export const client = createClient<paths>({ baseUrl: "/api/v1" });
