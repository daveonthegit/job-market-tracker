import { fixture } from "../helpers.ts";

// Preloaded only in CLI integration subprocesses. No request can escape to the network.
globalThis.fetch = async (input) => {
  const url = String(input);
  let body: unknown;
  if (url === "https://boards-api.greenhouse.io/v1/boards/acme/jobs") {
    body = fixture("greenhouse.json");
  } else if (url.startsWith("https://remotive.com/api/remote-jobs?")) {
    if (process.env.JMT_TEST_FEED === "error") return new Response("unavailable", { status: 403 });
    body = process.env.JMT_TEST_FEED === "empty" ? { jobs: [] } : fixture("remotive.json");
  } else {
    throw new Error(`Unexpected offline request: ${url}`);
  }
  return Response.json(body);
};
