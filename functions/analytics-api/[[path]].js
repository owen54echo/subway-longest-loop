import { createWorker } from "../../analytics-worker/src/index.mjs";

const worker = createWorker();
const BODYLESS_METHODS = new Set(["GET", "HEAD"]);

export async function onRequest(context) {
    const sourceUrl = new URL(context.request.url);
    const workerPath = sourceUrl.pathname.replace(/^\/analytics-api(?=\/|$)/, "") || "/";
    const workerUrl = new URL(workerPath + sourceUrl.search, sourceUrl.origin);
    const headers = new Headers(context.request.headers);
    // Same-origin fetches may omit Origin. The Worker still uses an explicit
    // allowlist so the Pages adapter supplies the trusted site origin here.
    headers.set("origin", sourceUrl.origin);

    const requestInit = {
        method: context.request.method,
        headers
    };
    if (!BODYLESS_METHODS.has(context.request.method)) {
        requestInit.body = await context.request.clone().arrayBuffer();
    }

    const proxyRequest = new Request(workerUrl, requestInit);
    const env = {
        ...context.env,
        ANALYTICS_ALLOWED_ORIGINS: context.env.ANALYTICS_ALLOWED_ORIGINS || sourceUrl.origin
    };
    return worker.fetch(proxyRequest, env);
}
