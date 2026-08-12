(function initSiteAnalytics(window) {
    "use strict";

    const eventTypes = new Set(["page_view", "route_generated", "tab_open"]);
    const tabIds = new Set(["rules", "constraints", "roadbook", "analysis", "custom-route"]);
    const visitorStorageKey = "subway_analytics_visitor_id";
    const adminModeStorageKey = "subway_analytics_admin_mode";
    const privateEntryClicks = [];
    let visitorId = null;

    function getEndpoint() {
        const endpoint = window.SUBWAY_ANALYTICS_CONFIG?.endpoint;
        return typeof endpoint === "string" ? endpoint.replace(/\/$/, "") : "";
    }

    function createVisitorId() {
        if (window.crypto?.randomUUID) return window.crypto.randomUUID();
        return `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    function getVisitorId() {
        if (visitorId) return visitorId;
        try {
            visitorId = window.localStorage.getItem(visitorStorageKey) || createVisitorId();
            window.localStorage.setItem(visitorStorageKey, visitorId);
        } catch (_) {
            visitorId = createVisitorId();
        }
        return visitorId;
    }

    function isAdminMode() {
        try {
            return window.sessionStorage.getItem(adminModeStorageKey) === "1";
        } catch (_) {
            return false;
        }
    }

    function sendEvent(eventType, tabId = null) {
        const endpoint = getEndpoint();
        if (!endpoint || isAdminMode() || !eventTypes.has(eventType)) return;
        if (eventType === "tab_open" && !tabIds.has(tabId)) return;
        if (eventType !== "tab_open") tabId = null;
        if (typeof window.fetch !== "function") return;

        window.fetch(`${endpoint}/events`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-subway-visitor": getVisitorId()
            },
            body: JSON.stringify({ event_type: eventType, tab_id: tabId }),
            keepalive: true
        }).catch(() => {});
    }

    function bindPrivateEntry(button) {
        if (!button) return;
        button.addEventListener("click", () => {
            const now = Date.now();
            privateEntryClicks.push(now);
            while (privateEntryClicks.length && now - privateEntryClicks[0] > 10_000) {
                privateEntryClicks.shift();
            }
            if (privateEntryClicks.length < 7) return;
            privateEntryClicks.length = 0;
            window.location.assign("analytics-dashboard.html");
        });
    }

    window.SiteAnalytics = {
        trackPageView() { sendEvent("page_view"); },
        trackRouteGenerated() { sendEvent("route_generated"); },
        trackTabOpen(tabId) { sendEvent("tab_open", tabId); },
        bindPrivateEntry,
        setAdminMode(enabled) {
            try {
                if (enabled) window.sessionStorage.setItem(adminModeStorageKey, "1");
                else window.sessionStorage.removeItem(adminModeStorageKey);
            } catch (_) {}
        }
    };
})(window);
