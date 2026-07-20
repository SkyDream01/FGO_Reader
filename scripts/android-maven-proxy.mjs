import http from "node:http";
import { Readable } from "node:stream";

const port = Number.parseInt(process.env.FGO_MAVEN_PROXY_PORT || "4873", 10);
const upstreams = new Map([
  ["google", "https://dl.google.com/dl/android/maven2/"],
  ["central", "https://repo1.maven.org/maven2/"],
]);

const maxConcurrentRequests = 4;
let activeRequests = 0;
const pendingRequests = [];

async function acquireRequestSlot() {
  if (activeRequests < maxConcurrentRequests) {
    activeRequests += 1;
    return;
  }
  await new Promise((resolve) => pendingRequests.push(resolve));
  activeRequests += 1;
}

function releaseRequestSlot() {
  activeRequests -= 1;
  pendingRequests.shift()?.();
}

async function fetchWithRetry(url, options) {
  let lastError;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(120_000),
      });
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 300 * (2 ** attempt)));
    }
  }
  throw lastError;
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
    const [, repository, ...segments] = requestUrl.pathname.split("/");
    const upstreamRoot = upstreams.get(repository);
    if (!upstreamRoot || segments.length === 0) {
      response.writeHead(404).end();
      return;
    }

    const relativePath = segments.map(encodeURIComponent).join("/");
    const upstreamUrl = new URL(relativePath, upstreamRoot);
    upstreamUrl.search = requestUrl.search;
    await acquireRequestSlot();
    let slotHeld = true;
    const releaseSlot = () => {
      if (!slotHeld) return;
      slotHeld = false;
      releaseRequestSlot();
    };
    let upstreamResponse;
    try {
      upstreamResponse = await fetchWithRetry(upstreamUrl, {
        method: request.method === "HEAD" ? "HEAD" : "GET",
        headers: { "accept-encoding": "identity" },
        redirect: "follow",
      });
    } catch (error) {
      releaseSlot();
      throw error;
    }

    const headers = {};
    for (const name of ["content-length", "content-type", "etag", "last-modified"]) {
      const value = upstreamResponse.headers.get(name);
      if (value) headers[name] = value;
    }
    response.writeHead(upstreamResponse.status, headers);
    if (request.method === "HEAD" || !upstreamResponse.body) {
      releaseSlot();
      response.end();
      return;
    }
    const body = Readable.fromWeb(upstreamResponse.body);
    body.once("end", releaseSlot);
    body.once("error", releaseSlot);
    response.once("close", () => {
      body.destroy();
      releaseSlot();
    });
    body.pipe(response);
  } catch (error) {
    response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    response.end(error instanceof Error ? error.message : String(error));
  }
});

server.listen(port, "127.0.0.1", () => {
  const address = server.address();
  const listeningPort = typeof address === "object" && address ? address.port : port;
  console.log(`FGO_MAVEN_PROXY_READY=http://127.0.0.1:${listeningPort}`);
});
