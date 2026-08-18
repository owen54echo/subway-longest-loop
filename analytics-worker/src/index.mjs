const EVENT_TYPES = new Set(["page_view", "route_generated", "tab_open"]);
const TAB_IDS = new Set(["rules", "constraints", "roadbook", "analysis", "custom-route"]);
const encoder = new TextEncoder();

function responseJson(ResponseImpl, value, status, origin) {
    return new ResponseImpl(JSON.stringify(value), {
        status,
        headers: {
            "content-type": "application/json; charset=utf-8",
            ...corsHeaders(origin)
        }
    });
}

function corsHeaders(origin) {
    return origin ? {
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "POST, GET, OPTIONS",
        "access-control-allow-headers": "content-type, x-subway-visitor",
        "vary": "Origin"
    } : {};
}

function allowedOrigins(env) {
    return new Set((env.ANALYTICS_ALLOWED_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean));
}

function getOrigin(request) {
    return request.headers.get("origin") || "";
}

function isAllowedOrigin(request, env) {
    return allowedOrigins(env).has(getOrigin(request));
}

function shanghaiDate(date) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(date);
    const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

function shanghaiHour(date) {
    const part = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Shanghai",
        hour: "2-digit",
        hourCycle: "h23"
    }).formatToParts(date).find(item => item.type === "hour");
    return Number(part?.value || 0);
}

function classifyDevice(userAgent) {
    return /(android|iphone|ipad|ipod|mobile)/i.test(userAgent || "") ? "mobile" : "desktop";
}

function normalizeCountry(country) {
    return /^[A-Z]{2}$/.test(country || "") ? country : "ZZ";
}

async function hmacHex(cryptoImpl, secret, value) {
    const key = await cryptoImpl.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = await cryptoImpl.subtle.sign("HMAC", key, encoder.encode(value));
    return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function parseEvent(request) {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 1024) return null;
    const raw = await request.text();
    if (!raw || raw.length > 1024) return null;
    let body;
    try {
        body = JSON.parse(raw);
    } catch (_) {
        return null;
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    const keys = Object.keys(body).sort();
    if (keys.length !== 2 || keys[0] !== "event_type" || keys[1] !== "tab_id") return null;
    if (!EVENT_TYPES.has(body.event_type)) return null;
    if (body.event_type === "tab_open") return TAB_IDS.has(body.tab_id) ? body : null;
    return body.tab_id === null ? body : null;
}

function databaseFor(env) {
    return env.DB && typeof env.DB.prepare === "function" ? env.DB : null;
}

function parseDateRange(url) {
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(from) || !datePattern.test(to)) return null;
    const fromTime = Date.parse(`${from}T00:00:00.000Z`);
    const toTime = Date.parse(`${to}T00:00:00.000Z`);
    if (!Number.isFinite(fromTime) || !Number.isFinite(toTime) || fromTime > toTime || toTime - fromTime > 365 * 24 * 60 * 60 * 1000) return null;
    return { from, to };
}

async function readStats(db, range) {
    const totals = await db.prepare(
        "SELECT COALESCE(SUM(page_views), 0) AS page_views, COALESCE(SUM(approx_unique_visitors), 0) AS approx_unique_visitors, COALESCE(SUM(route_generations), 0) AS route_generations, COALESCE(SUM(mobile_page_views), 0) AS mobile_page_views, COALESCE(SUM(desktop_page_views), 0) AS desktop_page_views FROM daily_metrics WHERE report_date BETWEEN ? AND ?"
    ).bind(range.from, range.to).first() || {};
    const daily = await db.prepare(
        "SELECT report_date, page_views, approx_unique_visitors, route_generations, mobile_page_views, desktop_page_views FROM daily_metrics WHERE report_date BETWEEN ? AND ? ORDER BY report_date ASC"
    ).bind(range.from, range.to).all();
    const countries = await db.prepare(
        "SELECT country_code, SUM(page_views) AS page_views, SUM(approx_unique_visitors) AS approx_unique_visitors FROM daily_country_metrics WHERE report_date BETWEEN ? AND ? GROUP BY country_code ORDER BY page_views DESC"
    ).bind(range.from, range.to).all();
    const tabs = await db.prepare(
        "SELECT tab_id, SUM(open_count) AS open_count FROM daily_tab_metrics WHERE report_date BETWEEN ? AND ? GROUP BY tab_id ORDER BY open_count DESC"
    ).bind(range.from, range.to).all();
    const hours = await db.prepare(
        "SELECT hour_shanghai, SUM(page_views) AS page_views FROM daily_hour_metrics WHERE report_date BETWEEN ? AND ? GROUP BY hour_shanghai ORDER BY hour_shanghai ASC"
    ).bind(range.from, range.to).all();
    return {
        totals: {
            page_views: Number(totals.page_views || 0),
            approx_unique_visitors: Number(totals.approx_unique_visitors || 0),
            route_generations: Number(totals.route_generations || 0),
            mobile_page_views: Number(totals.mobile_page_views || 0),
            desktop_page_views: Number(totals.desktop_page_views || 0)
        },
        daily: daily.results || [],
        devices: {
            mobile: Number(totals.mobile_page_views || 0),
            desktop: Number(totals.desktop_page_views || 0)
        },
        countries: (countries.results || []).map(row => ({ ...row, country_code: row.country_code === "ZZ" ? "未知地区" : row.country_code })),
        tabs: tabs.results || [],
        hours: hours.results || []
    };
}

async function recordEvent(db, event) {
    await db.prepare(
        "INSERT INTO events (id, received_at, report_date, event_type, visitor_hash, device_type, country_code, tab_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(event.id, event.receivedAt, event.reportDate, event.type, event.visitorHash, event.device, event.country, event.tabId).run();

    if (event.type === "page_view") {
        await db.prepare(
            "INSERT INTO daily_metrics (report_date, page_views, mobile_page_views, desktop_page_views) VALUES (?, 1, ?, ?) ON CONFLICT(report_date) DO UPDATE SET page_views = page_views + 1, mobile_page_views = mobile_page_views + excluded.mobile_page_views, desktop_page_views = desktop_page_views + excluded.desktop_page_views"
        ).bind(event.reportDate, event.device === "mobile" ? 1 : 0, event.device === "desktop" ? 1 : 0).run();
        const uniqueResult = await db.prepare("INSERT OR IGNORE INTO daily_visitors (report_date, visitor_hash) VALUES (?, ?)").bind(event.reportDate, event.visitorHash).run();
        if (uniqueResult.meta?.changes) {
            await db.prepare("UPDATE daily_metrics SET approx_unique_visitors = approx_unique_visitors + 1 WHERE report_date = ?").bind(event.reportDate).run();
        }
        await db.prepare(
            "INSERT INTO daily_country_metrics (report_date, country_code, page_views) VALUES (?, ?, 1) ON CONFLICT(report_date, country_code) DO UPDATE SET page_views = page_views + 1"
        ).bind(event.reportDate, event.country).run();
        await db.prepare(
            "INSERT INTO daily_hour_metrics (report_date, hour_shanghai, page_views) VALUES (?, ?, 1) ON CONFLICT(report_date, hour_shanghai) DO UPDATE SET page_views = page_views + 1"
        ).bind(event.reportDate, event.hourShanghai).run();
        const countryUnique = await db.prepare("INSERT OR IGNORE INTO daily_country_visitors (report_date, country_code, visitor_hash) VALUES (?, ?, ?)").bind(event.reportDate, event.country, event.visitorHash).run();
        if (countryUnique.meta?.changes) {
            await db.prepare("UPDATE daily_country_metrics SET approx_unique_visitors = approx_unique_visitors + 1 WHERE report_date = ? AND country_code = ?").bind(event.reportDate, event.country).run();
        }
        return;
    }

    if (event.type === "route_generated") {
        await db.prepare(
            "INSERT INTO daily_metrics (report_date, route_generations) VALUES (?, 1) ON CONFLICT(report_date) DO UPDATE SET route_generations = route_generations + 1"
        ).bind(event.reportDate).run();
        return;
    }

    await db.prepare(
        "INSERT INTO daily_tab_metrics (report_date, tab_id, open_count) VALUES (?, ?, 1) ON CONFLICT(report_date, tab_id) DO UPDATE SET open_count = open_count + 1"
    ).bind(event.reportDate, event.tabId).run();
}

export function createWorker(dependencies = {}) {
    const now = dependencies.now || (() => new Date());
    const cryptoImpl = dependencies.crypto || globalThis.crypto;
    const ResponseImpl = dependencies.Response || globalThis.Response;
    const randomUUID = dependencies.randomUUID || (() => cryptoImpl.randomUUID());

    return {
        async fetch(request, env) {
            const origin = getOrigin(request);
            if (request.method === "OPTIONS") {
                return isAllowedOrigin(request, env)
                    ? new ResponseImpl(null, { status: 204, headers: corsHeaders(origin) })
                    : responseJson(ResponseImpl, { error: "forbidden" }, 403, null);
            }
            const url = new URL(request.url);
            if (!isAllowedOrigin(request, env)) return responseJson(ResponseImpl, { error: "forbidden" }, 403, null);

            if (url.pathname === "/stats" && request.method === "GET") {
                const range = parseDateRange(url);
                if (!range) return responseJson(ResponseImpl, { error: "invalid_range" }, 400, origin);
                const db = databaseFor(env);
                if (!db) return responseJson(ResponseImpl, { error: "service_unavailable" }, 503, origin);
                return responseJson(ResponseImpl, await readStats(db, range), 200, origin);
            }

            if (url.pathname !== "/events" || request.method !== "POST") {
                return responseJson(ResponseImpl, { error: "not_found" }, 404, isAllowedOrigin(request, env) ? origin : null);
            }

            const body = await parseEvent(request);
            const browserIdentifier = request.headers.get("x-subway-visitor") || "";
            if (!body || !browserIdentifier || browserIdentifier.length > 128) {
                return responseJson(ResponseImpl, { error: "invalid_event" }, 400, origin);
            }

            const db = databaseFor(env);
            if (!db) return responseJson(ResponseImpl, { error: "service_unavailable" }, 503, origin);

            const receivedAt = now();
            await recordEvent(db, {
                id: randomUUID(),
                receivedAt: receivedAt.toISOString(),
                reportDate: shanghaiDate(receivedAt),
                hourShanghai: shanghaiHour(receivedAt),
                type: body.event_type,
                tabId: body.tab_id,
                visitorHash: await hmacHex(cryptoImpl, env.ANALYTICS_VISITOR_HMAC_KEY, browserIdentifier),
                device: classifyDevice(request.headers.get("user-agent")),
                country: normalizeCountry(request.cf?.country)
            });
            return new ResponseImpl(null, { status: 204, headers: corsHeaders(origin) });
        },

        async scheduled(_event, env) {
            const db = databaseFor(env);
            if (!db) return;
            await db.prepare("DELETE FROM events WHERE received_at < datetime('now', '-90 days')").run();
        }
    };
}

const worker = createWorker();

export default {
    fetch(request, env) {
        return worker.fetch(request, env);
    },
    scheduled(event, env) {
        return worker.scheduled(event, env);
    }
};
