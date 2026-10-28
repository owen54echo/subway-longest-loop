(function () {
    function intersects(a, b) {
        return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    }

    function orientation(a, b, c) {
        const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
        if (Math.abs(value) < 0.0001) return 0;
        return value > 0 ? 1 : 2;
    }

    function onSegment(a, b, c) {
        return b.x <= Math.max(a.x, c.x) && b.x >= Math.min(a.x, c.x)
            && b.y <= Math.max(a.y, c.y) && b.y >= Math.min(a.y, c.y);
    }

    function segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd) {
        const first = orientation(firstStart, firstEnd, secondStart);
        const second = orientation(firstStart, firstEnd, secondEnd);
        const third = orientation(secondStart, secondEnd, firstStart);
        const fourth = orientation(secondStart, secondEnd, firstEnd);
        if (first !== second && third !== fourth) return true;
        if (first === 0 && onSegment(firstStart, secondStart, firstEnd)) return true;
        if (second === 0 && onSegment(firstStart, secondEnd, firstEnd)) return true;
        if (third === 0 && onSegment(secondStart, firstStart, secondEnd)) return true;
        return fourth === 0 && onSegment(secondStart, firstEnd, secondEnd);
    }

    function intersectsSegmentRect(rect, segment) {
        const padding = segment.padding || 0;
        const expanded = {
            left: rect.left - padding,
            top: rect.top - padding,
            right: rect.right + padding,
            bottom: rect.bottom + padding
        };
        const start = { x: segment.x1, y: segment.y1 };
        const end = { x: segment.x2, y: segment.y2 };
        if (start.x >= expanded.left && start.x <= expanded.right && start.y >= expanded.top && start.y <= expanded.bottom) return true;
        if (end.x >= expanded.left && end.x <= expanded.right && end.y >= expanded.top && end.y <= expanded.bottom) return true;
        const topLeft = { x: expanded.left, y: expanded.top };
        const topRight = { x: expanded.right, y: expanded.top };
        const bottomRight = { x: expanded.right, y: expanded.bottom };
        const bottomLeft = { x: expanded.left, y: expanded.bottom };
        return segmentsIntersect(start, end, topLeft, topRight)
            || segmentsIntersect(start, end, topRight, bottomRight)
            || segmentsIntersect(start, end, bottomRight, bottomLeft)
            || segmentsIntersect(start, end, bottomLeft, topLeft);
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
                if ((options.blockedSegments || []).some(segment => intersectsSegmentRect(rect, segment))) continue;

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

    window.LineBadgeLayout = { place, intersects, intersectsSegmentRect };
})();
