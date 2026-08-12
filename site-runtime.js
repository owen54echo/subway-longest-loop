// The public dashboard is hosted on GitHub Pages, while the protected data
// service runs on Cloudflare Workers.
window.SUBWAY_ANALYTICS_CONFIG = window.SUBWAY_ANALYTICS_CONFIG || {
    endpoint: "https://subway-longest-loop.290573525.workers.dev"
};
