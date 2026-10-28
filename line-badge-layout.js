(function () {
    function intersects(a, b) {
        return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    }

    function makeRect(candidate, offsetX, offsetY) {
        return {
            left: candidate.x + offsetX - candidate.width / 2,
            top: candidate.y + offsetY - candidate.height / 2,
            right: candidate.x + offsetX + candidate.width / 2,
            bottom: candidate.y + offsetY + candidate.height / 2
        };
    }

    function place(candidates, blockedRects = [], options = {}) {
        const maxPerLine = options.maxPerLine || 1;
        const occupied = [...blockedRects];
        const placed = [];
        const deferred = [];
        const lineCounts = new Map();
        const sorted = [...candidates].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));

        for (const candidate of sorted) {
            if ((lineCounts.get(candidate.line) || 0) >= maxPerLine) {
                deferred.push(candidate.id);
                continue;
            }

            let didPlace = false;
            for (const [offsetX, offsetY, slot] of candidate.slots) {
                const rect = makeRect(candidate, offsetX, offsetY);
                if (occupied.some(other => intersects(rect, other))) continue;

                occupied.push(rect);
                placed.push({
                    id: candidate.id,
                    line: candidate.line,
                    color: candidate.color,
                    rect,
                    x: rect.left,
                    y: rect.top,
                    slot
                });
                lineCounts.set(candidate.line, (lineCounts.get(candidate.line) || 0) + 1);
                didPlace = true;
                break;
            }
            if (!didPlace) deferred.push(candidate.id);
        }

        return { placed, deferred };
    }

    window.LineBadgeLayout = { place, intersects };
})();
