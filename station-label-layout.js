(function() {
    const slots = [
        [7, -7, "ne"],
        [-7, -7, "nw"],
        [7, 14, "se"],
        [-7, 14, "sw"],
        [12, 4, "e"],
        [-12, 4, "w"],
        [0, -18, "n"],
        [0, 22, "s"]
    ];

    function intersects(a, b) {
        return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    }

    function makeRect(candidate, offsetX, offsetY) {
        return {
            left: candidate.x + offsetX,
            top: candidate.y + offsetY - candidate.height,
            right: candidate.x + offsetX + candidate.width,
            bottom: candidate.y + offsetY
        };
    }

    function place(candidates, blockedRects = []) {
        const occupied = [...blockedRects];
        const placed = [];
        const deferred = [];
        const sorted = [...candidates].sort((a, b) =>
            b.priority - a.priority || a.id.localeCompare(b.id)
        );

        for (const candidate of sorted) {
            let chosen = null;
            for (const [offsetX, offsetY, slot] of slots) {
                const rect = makeRect(candidate, offsetX, offsetY);
                if (!occupied.some(other => intersects(rect, other))) {
                    chosen = {
                        rect,
                        x: rect.left,
                        y: rect.bottom,
                        slot,
                        leader: slot
                    };
                    break;
                }
            }

            if (!chosen) {
                deferred.push(candidate.id);
                continue;
            }

            occupied.push(chosen.rect);
            placed.push({ id: candidate.id, ...chosen });
        }

        return { placed, deferred };
    }

    window.StationLabelLayout = { place, intersects };
})();
