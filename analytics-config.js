// Pages hosts the dashboard and the collector under one origin. Keeping this
// relative avoids exposing a provider-specific Worker URL in the public app.
window.SUBWAY_ANALYTICS_CONFIG = window.SUBWAY_ANALYTICS_CONFIG || {
    endpoint: "/analytics-api"
};
