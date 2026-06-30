import { Inngest } from "inngest";

/**
 * Inngest client. Local dev needs no keys — set INNGEST_DEV=1 and run
 * `npx inngest-cli@latest dev` alongside `npm run dev`. In production INNGEST_DEV
 * is unset → cloud mode, and INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY are read
 * from the environment automatically. `isDev` is pinned explicitly (rather than
 * left to NODE_ENV auto-detection) so the deployed endpoint never falls back to
 * trying to reach a local dev server.
 */
export const inngest = new Inngest({
  id: "signalstory",
  isDev: process.env.INNGEST_DEV === "1",
});

/** Event payloads the app emits. */
export type Events = {
  "signal/submitted": { data: { signalId: string } };
};
