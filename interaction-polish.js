(function (global) {
    'use strict';
    const reduceMotion = () => global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rowTimers = new WeakMap();

    // The real, selectable DOM text always contains the final value; animation is a visual pseudo-element.
    function animateCounts(container) {
        if (!container || reduceMotion() || document.hidden) return;
        container.querySelectorAll('[data-motion-value]').forEach(element => {
            const value = Number(element.dataset.motionValue);
            if (!Number.isFinite(value) || value <= 0) return;
            const decimals = Number(element.dataset.motionDecimals || 0);
            const format = number => number.toLocaleString('zh-CN', {minimumFractionDigits: decimals, maximumFractionDigits: decimals});
            const start = performance.now(), duration = 500;
            element.dataset.counting = 'true';
            element.dataset.countDisplay = format(0);
            function frame(now) {
                if (!element.isConnected) return;
                if (document.hidden || reduceMotion() || now - start >= duration) {
                    delete element.dataset.counting;
                    delete element.dataset.countDisplay;
                    return;
                }
                const progress = Math.min(1, (now - start) / duration);
                element.dataset.countDisplay = format(value * (1 - Math.pow(1 - progress, 3)));
                global.requestAnimationFrame(frame);
            }
            global.requestAnimationFrame(frame);
        });
    }

    function revealRows(container, selector) {
        if (!container || reduceMotion() || document.hidden) return;
        container.querySelectorAll(selector).forEach((row, index) => {
            if (index >= 5) return;
            row.style.setProperty('--row-delay', `${index * 35}ms`);
            row.classList.add('polish-reveal');
            if (rowTimers.has(row)) clearTimeout(rowTimers.get(row));
            rowTimers.set(row, setTimeout(() => row.classList.remove('polish-reveal'), 450));
        });
    }

    function trackSelection(track, selector) {
        if (!track) return;
        const indicator = document.createElement('span');
        indicator.className = 'polish-nav-indicator';
        indicator.setAttribute('aria-hidden', 'true');
        track.append(indicator);
        let pending = false;
        function update() {
            pending = false;
            const active = track.querySelector(selector + '.active');
            if (active && active.offsetWidth) {
                indicator.style.width = `${active.offsetWidth}px`;
                indicator.style.height = `${active.offsetHeight}px`;
                indicator.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
                indicator.hidden = false;
                if (!track.classList.contains('polish-nav-ready')) track.classList.add('polish-nav-ready');
            } else indicator.hidden = true;
            track.dataset.scrollStart = String(track.scrollLeft > 1);
            track.dataset.scrollEnd = String(track.scrollLeft + track.clientWidth < track.scrollWidth - 1);
        }
        function schedule() {
            if (pending) return;
            pending = true; global.requestAnimationFrame(update);
        }
        track.addEventListener('scroll', schedule, {passive:true});
        global.addEventListener('resize', () => {
            const active = track.querySelector(selector + '.active');
            if (active && track.scrollWidth > track.clientWidth) {
                const left = active.offsetLeft, right = left + active.offsetWidth;
                if (left < track.scrollLeft) track.scrollLeft = left;
                else if (right > track.scrollLeft + track.clientWidth) track.scrollLeft = right - track.clientWidth;
            }
            schedule();
        }, {passive:true});
        new MutationObserver(schedule).observe(track, {childList:true, subtree:true, attributes:true, attributeFilter:['class']});
        if (global.ResizeObserver) new ResizeObserver(schedule).observe(track);
        schedule();
    }

    function trackDrawerEdges(drawer) {
        const content = drawer?.querySelector('.drawer-content');
        if (!content) return;
        let pending = false;
        function update() {
            pending = false;
            content.dataset.scrollStart = String(content.scrollTop > 1);
            content.dataset.scrollEnd = String(content.scrollTop + content.clientHeight < content.scrollHeight - 1);
        }
        function schedule() { if (!pending) {pending = true; global.requestAnimationFrame(update);} }
        content.addEventListener('scroll', schedule, {passive:true});
        global.addEventListener('resize', schedule, {passive:true});
        new MutationObserver(schedule).observe(drawer, {childList:true, subtree:true, attributes:true, attributeFilter:['class','style','hidden']});
        if (global.ResizeObserver) new ResizeObserver(schedule).observe(content);
        schedule();
    }

    function init() {
        trackSelection(document.getElementById('city-tab-container'), '.city-tab');
        trackSelection(document.getElementById('bottom-nav-bar'), '.nav-item');
        trackDrawerEdges(document.getElementById('floating-drawer'));
        if (global.matchMedia('(hover: hover) and (pointer: fine)').matches) {
            document.querySelectorAll('.analysis-action').forEach(card => {
                card.addEventListener('pointermove', event => {
                    const rect = card.getBoundingClientRect();
                    card.style.setProperty('--spot-x', `${event.clientX - rect.left}px`);
                    card.style.setProperty('--spot-y', `${event.clientY - rect.top}px`);
                }, {passive:true});
            });
        }
    }
    global.InteractionPolish = {animateCounts, revealRows};
    document.addEventListener('DOMContentLoaded', () => global.requestAnimationFrame(init), {once:true});
})(window);
