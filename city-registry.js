(function(global) {
    "use strict";

    function labelFor(cityKey, city) {
        if (cityKey === "guangzhou") return "广佛";
        return String(city?.city || cityKey).split("（")[0].replace(/市$/, "");
    }

    function renderTabs(container, cityMap, selectedCity) {
        if (!container) return;
        const fragment = document.createDocumentFragment();
        Object.entries(cityMap || {}).forEach(([cityKey, city]) => {
            const tab = document.createElement("button");
            tab.type = "button";
            tab.className = `city-tab${cityKey === selectedCity ? " active" : ""}`;
            tab.dataset.value = cityKey;
            tab.setAttribute("role", "tab");
            tab.setAttribute("aria-selected", String(cityKey === selectedCity));
            tab.textContent = labelFor(cityKey, city);
            fragment.appendChild(tab);
        });
        container.replaceChildren(fragment);
    }

    global.CityRegistry = { labelFor, renderTabs };
})(window);
