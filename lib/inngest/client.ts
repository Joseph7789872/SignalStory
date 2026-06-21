import { Inngest } from "inngest";

/**
 * Inngest client. Local dev needs no keys — run `npx inngest-cli@latest dev`
 * alongside `npm run dev`. In production, INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY
 * are read from the environment automatically.
 */
export const inngest = new Inngest({ id: "signalstory" });

/** Event payloads the app emits. */
export type Events = {
  "signal/submitted": { data: { signalId: string } };
};
