(function() {
    function formatElapsed(milliseconds) {
        const totalSeconds = Math.max(0, Math.floor(Number(milliseconds || 0) / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    function createPromptScheduler({
        now = () => Date.now(),
        setIntervalFn = setInterval,
        clearIntervalFn = clearInterval,
        onTick = () => {},
        onPrompt = () => {}
    } = {}) {
        let startedAt = 0;
        let nextPromptAt = 180000;
        let intervalId = null;
        let promptOpen = false;

        function tick() {
            const elapsed = Math.max(0, now() - startedAt);
            onTick(elapsed);
            if (!promptOpen && elapsed >= nextPromptAt) {
                promptOpen = true;
                onPrompt(elapsed);
            }
        }

        return {
            start() {
                if (intervalId !== null) clearIntervalFn(intervalId);
                startedAt = now();
                nextPromptAt = 180000;
                promptOpen = false;
                intervalId = setIntervalFn(tick, 1000);
                tick();
            },
            continueWaiting() {
                promptOpen = false;
                nextPromptAt = Math.max(0, now() - startedAt) + 60000;
            },
            stop() {
                if (intervalId !== null) clearIntervalFn(intervalId);
                intervalId = null;
                promptOpen = false;
            }
        };
    }

    window.SolverProgress = { formatElapsed, createPromptScheduler };
})();
