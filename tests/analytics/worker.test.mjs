import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { createWorker } from "../../analytics-worker/src/index.mjs";

class TestResponse {
    constructor(body = null, init = {}) {
        this.body = body;
        this.status = init.status || 200;
        this.headers = init.headers || {};
    }

    async json() {
        return this.body ? JSON.parse(this.body) : null;
    }
}

class D1Stub {
    constructor() {
        this.writes = [];
        this.loginAttempts = new Map();
    }

    prepare(sql) {
        const run = async () => {
            this.writes.push({ sql, args: [] });
            return { meta: { changes: 1 } };
        };
        return {
            bind: (...args) => ({
                run: async () => {
                    this.writes.push({ sql, args });
                    if (sql.includes("INSERT INTO login_attempts")) {
                        this.loginAttempts.set(args[0], { failure_count: args[1], locked_until: args[2] });
                    }
                    if (sql.includes("DELETE FROM login_attempts")) this.loginAttempts.delete(args[0]);
                    return { meta: { changes: sql.includes("daily_visitors") ? 1 : 1 } };
                },
                all: async () => ({ results: [] }),
                first: async () => {
                    if (sql.includes("FROM login_attempts")) return this.loginAttempts.get(args[0]) || null;
                    if (sql.includes("FROM daily_metrics")) {
                        return { page_views: 12, approx_unique_visitors: 7, route_generations: 3, mobile_page_views: 8, desktop_page_views: 4 };
                    }
                    return null;
                }
            }),
            run
        };
    }
}

function request({ method = "POST", path = "/events", origin = "https://public.example", body = {}, visitor = "browser-id", country = "CN", userAgent = "Mozilla/5.0 (iPhone)" } = {}) {
    const headers = new Map([
        ["origin", origin],
        ["content-type", "application/json"],
        ["x-subway-visitor", visitor],
        ["user-agent", userAgent],
        ["cf-connecting-ip", "192.0.2.1"]
    ]);
    return {
        method,
        url: `https://collector.example${path}`,
        cf: { country },
        headers: { get: key => headers.get(key.toLowerCase()) || null },
        text: async () => JSON.stringify(body)
    };
}

const db = new D1Stub();
const env = {
    DB: db,
    ANALYTICS_ALLOWED_ORIGINS: "https://public.example",
    ANALYTICS_VISITOR_HMAC_KEY: "test-hash-key",
    ANALYTICS_ADMIN_PASSWORD: "test-password",
    ANALYTICS_TOKEN_SECRET: "test-token-key"
};
const worker = createWorker({
    now: () => new Date("2026-08-11T16:00:00.000Z"),
    crypto: webcrypto,
    Response: TestResponse,
    randomUUID: () => "event-1"
});

const accepted = await worker.fetch(request({ body: { event_type: "route_generated", tab_id: null } }), env);
assert.equal(accepted.status, 204);
assert.equal((await worker.fetch(request({ body: { event_type: "page_view", tab_id: null } }), env)).status, 204);
assert.ok(db.writes.some(write => write.args.includes("route_generated")));
assert.ok(!db.writes.some(write => write.args.includes("browser-id")));
assert.ok(db.writes.some(write => write.args.includes("mobile")));
assert.ok(db.writes.some(write => write.args.includes("CN")));
assert.ok(db.writes.some(write => write.sql.includes("daily_hour_metrics")));

assert.equal((await worker.fetch(request({ origin: "https://attacker.example", body: { event_type: "page_view", tab_id: null } }), env)).status, 403);
assert.equal((await worker.fetch(request({ body: { event_type: "route_generated", tab_id: null, route: "station-a->station-b" } }), env)).status, 400);
assert.equal((await worker.fetch(request({ body: { event_type: "tab_open", tab_id: "not-a-tab" } }), env)).status, 400);

await worker.scheduled({}, env);
assert.ok(db.writes.some(write => write.sql.includes("-90 days")));

async function login(password) {
    return worker.fetch(request({ path: "/admin/login", body: { password } }), env);
}

const loginResponse = await login("test-password");
assert.equal(loginResponse.status, 200);
const { token } = await loginResponse.json();
assert.ok(token);

const stats = await worker.fetch({
    ...request({ method: "GET", path: "/admin/stats?from=2026-08-01&to=2026-08-11" }),
    headers: {
        get(key) {
            if (key.toLowerCase() === "authorization") return `Bearer ${token}`;
            if (key.toLowerCase() === "origin") return "https://public.example";
            return null;
        }
    }
}, env);
assert.equal(stats.status, 200);
assert.deepEqual(Object.keys(await stats.json()).sort(), ["countries", "daily", "devices", "hours", "tabs", "totals"]);
assert.equal((await worker.fetch(request({ method: "GET", path: "/admin/stats?from=2026-08-01&to=2026-08-11" }), env)).status, 401);
assert.equal((await worker.fetch({
    ...request({ method: "GET", path: "/admin/stats?from=bad&to=2026-08-11" }),
    headers: { get: key => key.toLowerCase() === "authorization" ? `Bearer ${token}` : key.toLowerCase() === "origin" ? "https://public.example" : null }
}, env)).status, 400);
assert.ok(!db.writes.some(write => /^SELECT[\s\S]*FROM events/i.test(write.sql)));

const expiredWorker = createWorker({
    now: () => new Date("2026-08-11T16:31:00.000Z"),
    crypto: webcrypto,
    Response: TestResponse,
    randomUUID: () => "event-2"
});
assert.equal((await expiredWorker.fetch({
    ...request({ method: "GET", path: "/admin/stats?from=2026-08-01&to=2026-08-11" }),
    headers: { get: key => key.toLowerCase() === "authorization" ? `Bearer ${token}` : key.toLowerCase() === "origin" ? "https://public.example" : null }
}, env)).status, 401);

for (let attempt = 0; attempt < 5; attempt++) assert.equal((await login("wrong-password")).status, 401);
assert.equal((await login("test-password")).status, 429);

console.log("analytics worker collector tests passed");
