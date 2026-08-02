(function (global) {
    function createDeferredRefresh(refresh, options = {}) {
        const delay = options.delay ?? 120;
        const setTimer = options.setTimeout || window.setTimeout.bind(window);
        const clearTimer = options.clearTimeout || window.clearTimeout.bind(window);
        let timerId = null;

        function run() {
            timerId = null;
            refresh();
        }

        return {
            schedule() {
                if (timerId !== null) clearTimer(timerId);
                timerId = setTimer(run, delay);
            },
            flush() {
                if (timerId !== null) clearTimer(timerId);
                if (timerId !== null) {
                    timerId = null;
                    refresh();
                }
            },
            cancel() {
                if (timerId !== null) clearTimer(timerId);
                timerId = null;
            }
        };
    }

    function shouldUseCompactCustomDrawer(isCustomRouteMode, viewportWidth) {
        return Boolean(isCustomRouteMode && viewportWidth <= 1024);
    }

    global.MobileMapInteraction = { createDeferredRefresh, shouldUseCompactCustomDrawer };
})(window);
