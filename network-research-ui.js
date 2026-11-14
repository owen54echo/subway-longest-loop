(function () {
    'use strict';
    const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    function init(api) {
        const modal = document.createElement('div');
        modal.className = 'matrix-modal research-modal';
        modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true'); modal.setAttribute('aria-labelledby','research-title');
        modal.innerHTML = `<div class="matrix-header"><span class="matrix-title" id="research-title"></span><button class="matrix-close" id="research-close" aria-label="关闭">×</button></div><div class="research-scroll"><div id="research-controls"></div><div id="research-rankings"></div><div id="research-status" role="status" aria-live="polite"></div><progress id="research-progress" max="1" value="0" aria-label="分析进度" hidden></progress><div id="research-chart"></div><div id="research-results"></div></div>`;
        document.body.appendChild(modal);
        const $ = id => modal.querySelector('#research-'+id);
        let worker = null, rankingWorker = null, mode = '', result = null, base = null, changed = null, scenario = '', fault = null, visible = 50, city = '', segmentPaths = [];
        const rankingCache = new Map();
        let detourSortField = 'hops', detourSortAscending = false, focusOrigin = null, groups, rankingScroll = 0, resultScroll = 0, selectedPairIndex = null, selectedRank = null;
        const cancel = () => { if (worker) {worker.terminate(); worker = null;} };
        const stopRanking = () => { if (rankingWorker) {rankingWorker.terminate(); rankingWorker = null;} };
        function close() {
            const wasOpen = modal.style.display === 'flex';
            cancel(); stopRanking(); modal.style.display = 'none';
            if (wasOpen && focusOrigin?.isConnected) focusOrigin.focus();
        }
        modal.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if ($('station-search')?.value) { $('station-search').value = ''; $('station-search').oninput(); $('station-search').focus(); } else close(); return; }
            if (event.key !== 'Tab') return;
            const items = [...modal.querySelectorAll('button, select, input, a[href], summary, [tabindex]:not([tabindex="-1"])')]
                .filter(el => !el.disabled && el.getClientRects().length);
            if (!items.length) { event.preventDefault(); return; }
            if (event.shiftKey && (document.activeElement === items[0] || !modal.contains(document.activeElement))) {
                event.preventDefault(); items.at(-1).focus();
            } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
                event.preventDefault(); items[0].focus();
            }
        });
        function lineGroups() {
            const groups = new Map(), available = new Set(base.nodes.map(n => n.name));
            api.raw().edges.forEach((edge, index) => {
                if (!groups.has(edge.line)) groups.set(edge.line, {stations: new Set(), edges: []});
                const group = groups.get(edge.line);
                [edge.u, edge.v].forEach(name => {
                    const logical = base.normalizeStation(name);
                    if (available.has(logical)) group.stations.add(logical);
                });
                group.edges.push({edge, index});
            });
            return groups;
        }
        function stationOptions(groups) {
            return [...groups].map(([line, group]) => `<optgroup label="${esc(line)}">${[...group.stations].map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('')}</optgroup>`).join('');
        }
        function reset() { cancel(); result = null; selectedPairIndex = null; $('results').innerHTML = ''; $('chart').innerHTML = ''; $('status').textContent = ''; $('progress').hidden = true; if (mode === 'failure') $('rankings').hidden = false; const cancelButton = $('cancel'); if (cancelButton) cancelButton.hidden = true; const retry = $('retry'); if (retry) retry.hidden = true; }
        function open(nextMode) {
            focusOrigin = document.activeElement;
            reset(); stopRanking(); selectedRank = null; mode = nextMode; city = api.city(); $('rankings').innerHTML = ''; $('rankings').hidden = nextMode !== 'failure'; base = api.topology(); changed = null; visible = nextMode === 'detour' ? 10 : 50;
            groups = lineGroups();
            detourSortField = 'hops'; detourSortAscending = false;
            $('title').textContent = (mode === 'detour' ? '绕路之王' : '故障影响模拟') + ' · ' + api.raw().city;
            if (mode === 'detour') {
                $('controls').innerHTML = `<div class="research-intro">发现直线距离 2 公里以内、乘地铁却需要绕远路的站对。</div><div class="research-toolbar"><label>搜索车站 <input id="research-station-search" type="search" placeholder="输入站名" autocomplete="off"></label><label>发现范围 <select id="research-start" class="analysis-select"><option value="">全城站对</option>${stationOptions(groups)}</select></label><button id="research-cancel" type="button" hidden>取消计算</button><button id="research-retry" type="button" hidden>重新计算</button></div><div id="research-search-results" class="research-search-results" hidden></div><details class="research-note research-explainer"><summary>计算口径</summary><p>仅比较两站直线距离不超过 2 公里的站对。同址或距离小于 1 米的站对不计算；距离由站点坐标估算，并非实际轨道里程或乘车时间。最少区间与最短距离分别计算，可能对应不同路线；线路数为最短距离代表路线中不同线路的数量。点击表头可排序。</p></details>`;
                $('start').onchange = run;
            } else {
                $('controls').innerHTML = `<div class="research-intro">选择车站、区间或线路，查看线网连接如何变化。</div><div class="research-toolbar"><label>模拟对象 <select id="research-kind" class="analysis-select"><option value="station">车站停用</option><option value="edge">线路区间中断</option><option value="line">整条线路中断</option></select></label><label>线路 <select id="research-line" class="analysis-select">${[...groups.keys()].map(line => `<option value="${esc(line)}">${esc(line)}</option>`).join('')}</select></label><label id="research-search-label">搜索车站 <input id="research-station-search" type="search" placeholder="输入站名" autocomplete="off"></label><label id="research-target-label">选择车站 <select id="research-target" class="analysis-select"></select></label><label id="research-from-label" hidden>开始中断站 <select id="research-from" class="analysis-select"></select></label><label id="research-to-label" hidden>结束中断站 <select id="research-to" class="analysis-select"></select></label><label id="research-path-label" hidden>选择中断路径 <select id="research-path" class="analysis-select"></select></label><button id="research-run" class="btn-primary" type="button">开始模拟 <span aria-hidden="true">→</span></button><button id="research-cancel" type="button" hidden>取消计算</button><button id="research-retry" type="button" hidden>重新计算</button><button id="research-back-ranking" type="button" hidden>返回影响排行</button></div><div id="research-search-results" class="research-search-results" hidden></div><details class="research-note research-explainer"><summary>计算口径</summary><p>这是线网结构模拟，不代表真实故障、客流或运营安排。车站停用会阻断该站所有线路，作为起终点的站对单独统计。区间或线路中断只阻断所选线路的区间，沿线车站和其他线路仍可使用。</p></details><p id="research-segment-summary" class="research-note research-segment-summary" aria-live="polite" hidden></p><div class="research-filter" hidden><label>查看 <select id="research-filter" class="analysis-select"><option value="all">全部受影响站对</option><option value="disconnected">模拟后不可达</option><option value="longer">仍可达但需要绕行</option></select></label></div>`;
                const clearSelectionResult = () => { reset(); modal.querySelector('.research-filter').hidden = true; startRanking(); };
                const choosePath = () => {
                    const choice = $('path').value;
                    const path = choice === '' ? null : segmentPaths[Number(choice)];
                    $('run').disabled = !path;
                    $('segment-summary').hidden = !path;
                    if (path) $('segment-summary').textContent = `中断 ${path.segmentCount} 个相邻区间：${path.stations.join(' → ')}。中间站保留，是否可达以模拟结果为准。`;
                };
                const updatePaths = () => {
                    clearSelectionResult(); segmentPaths = [];
                    $('path-label').hidden = true; $('segment-summary').hidden = true; $('run').disabled = true;
                    const start = $('from').value, end = $('to').value;
                    if (!start || !end) return;
                    if (start === end) { $('status').textContent = '开始站和结束站不能相同。'; return; }
                    const found = window.NetworkResearchCore.linePaths(groups.get($('line').value).edges, start, end);
                    if (found.truncated) { $('status').textContent = '可选路径过多，请选择更短或更明确的区间。'; return; }
                    if (!found.paths.length) { $('status').textContent = '所选两站之间没有可识别的同线路径，请重新选择。'; return; }
                    const descriptions = found.paths.map(path => JSON.stringify(path.stations));
                    if (new Set(descriptions).size !== descriptions.length) { $('status').textContent = '所选区间存在无法区分的同名平行区间，暂不能模拟，请重新选择。'; return; }
                    segmentPaths = found.paths;
                    if (segmentPaths.length > 1) {
                        $('path-label').hidden = false;
                        $('path').innerHTML = '<option value="">请选择具体路径</option>' + segmentPaths.map((path, i) => `<option value="${i}">${esc(path.stations.join(' → '))}（${path.segmentCount} 个区间）</option>`).join('');
                        $('status').textContent = '所选站点之间有多条路径，请选择实际中断的路径。';
                    } else {
                        $('path').innerHTML = '<option value="0">唯一的线路路径</option>';
                        choosePath();
                    }
                };
                const populate = () => {
                    clearSelectionResult(); segmentPaths = [];
                    const station = $('kind').value === 'station', wholeLine = $('kind').value === 'line', group = groups.get($('line').value);
                    $('target-label').hidden = !station; $('search-label').hidden = wholeLine;
                    $('station-search').value = ''; $('search-results').hidden = true;
                    $('from-label').hidden = station || wholeLine; $('to-label').hidden = station || wholeLine;
                    $('path-label').hidden = true; $('segment-summary').hidden = true;
                    if (station) {
                        $('target').innerHTML = [...group.stations].map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
                        $('run').disabled = !$('target').options.length;
                    } else if (wholeLine) {
                        $('run').disabled = !group.edges.length;
                        $('segment-summary').hidden = false;
                        $('segment-summary').textContent = `将中断 ${$('line').value} 的全部 ${window.NetworkResearchCore.groupLineEdges(group.edges).length} 个区间；沿线车站和其他线路仍可使用；列表中单独列出的支线不包含在内。`;
                    } else {
                        const names = new Set();
                        group.edges.forEach(({edge}) => { names.add(edge.u); names.add(edge.v); });
                        const entries = [...names].map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
                        $('from').innerHTML = '<option value="">请选择开始站</option>' + entries;
                        $('to').innerHTML = '<option value="">请选择结束站</option>' + entries;
                        $('run').disabled = true;
                    }
                };
                $('kind').onchange = populate; $('line').onchange = populate;
                $('target').onchange = clearSelectionResult;
                $('from').onchange = updatePaths; $('to').onchange = updatePaths;
                $('path').onchange = () => { clearSelectionResult(); choosePath(); };
                populate();
                $('filter').onchange = () => { visible = 50; render(); };
                $('run').onclick = run;
            }
            $('station-search').oninput = () => {
                const query = $('station-search').value.trim().toLocaleLowerCase();
                const ids = mode === 'detour' ? ['start'] : ['target', 'from', 'to'];
                ids.forEach(id => {
                    const select = $(id);
                    if (!select) return;
                    [...select.options].forEach(option => { option.hidden = Boolean(query && option.value && option.value !== select.value && !option.textContent.toLocaleLowerCase().includes(query)); });
                    [...select.querySelectorAll('optgroup')].forEach(group => { group.hidden = ![...group.querySelectorAll('option')].some(option => !option.hidden); });
                });
                const box = $('search-results');
                box.hidden = !query;
                if (!query) { box.innerHTML = ''; return; }
                const availableGroups = mode === 'detour' ? [...groups] : [[ $('line').value, groups.get($('line').value) ]];
                const sections = availableGroups.map(([line, group]) => {
                    const names = mode === 'failure' && $('kind').value === 'edge'
                        ? [...$('from').options].map(option => option.value).filter(Boolean)
                        : [...group.stations];
                    const matches = names.filter(name => name.toLocaleLowerCase().includes(query));
                    if (!matches.length) return '';
                    const color = group.edges[0]?.edge.color;
                    const swatch = /^#[0-9a-f]{6}$/i.test(color || '') ? `<span class="research-search-dot" style="background:${color}"></span>` : '';
                    return `<section><strong>${swatch}${esc(line)}</strong><div>${matches.map(name => mode === 'failure' && $('kind').value === 'edge'
                        ? `<span class="research-search-pair">${esc(name)} <button type="button" data-search-target="from" data-search-name="${esc(name)}">设为起点</button><button type="button" data-search-target="to" data-search-name="${esc(name)}">设为终点</button></span>`
                        : `<button type="button" data-search-target="${mode === 'detour' ? 'start' : 'target'}" data-search-name="${esc(name)}">${esc(name)}</button>`).join('')}</div></section>`;
                }).filter(Boolean);
                box.innerHTML = sections.length ? sections.join('') : '<p>没有找到匹配车站，请尝试其他站名。</p>';
                box.querySelectorAll('[data-search-target]').forEach(button => button.onclick = () => {
                    const select = $(button.dataset.searchTarget);
                    select.value = button.dataset.searchName;
                    $('station-search').value = ''; $('station-search').oninput();
                    select.onchange();
                });
            };
            $('retry').onclick = run;
            if (mode === 'failure') $('back-ranking').onclick = () => {
                reset(); modal.querySelector('.research-filter').hidden = true; $('back-ranking').hidden = true;
                startRanking(); modal.querySelector('.research-scroll').scrollTop = rankingScroll;
            };
            $('cancel').onclick = () => { cancel(); $('progress').hidden = true; $('cancel').hidden = true; $('status').textContent = '计算已取消。'; $('retry').hidden = false; if (mode === 'failure') { $('rankings').hidden = false; startRanking(); } };
            modal.style.display = 'flex'; $('close').focus();
            if (mode === 'detour') run(); else startRanking();
        }
        function startRanking() {
            if (mode !== 'failure' || rankingWorker || worker || !base || city !== api.city()) return;
            const cached = rankingCache.get(city);
            if (cached) { renderRankings(cached); return; }
            $('rankings').innerHTML = `<div class="research-rank-panel"><div class="research-section-heading"><div><h3>影响最大的车站和线路</h3></div></div><p class="research-note" role="status" id="research-ranking-progress">正在准备逐一模拟…</p><progress id="research-ranking-bar" max="1" value="0" aria-label="排行计算进度"></progress><button type="button" id="research-ranking-cancel">取消排行计算</button></div>`;
            $('ranking-cancel').onclick = () => { stopRanking(); $('ranking-progress').textContent = '排行计算已取消。'; $('ranking-cancel').textContent = '重新计算排行'; $('ranking-cancel').onclick = startRanking; };
            rankingWorker = new Worker('network-failure-ranking-worker.js');
            const activeRankingWorker = rankingWorker;
            rankingWorker.onmessage = ({data}) => {
                if (rankingWorker !== activeRankingWorker) return;
                if (data.type === 'progress') { $('ranking-progress').textContent = `正在逐一模拟：${data.current} / ${data.total} 个车站和线路`; $('ranking-bar').max = data.total; $('ranking-bar').value = data.current; }
                if (data.type === 'error') { $('ranking-progress').textContent = `排行计算失败：${data.message}`; stopRanking(); $('ranking-cancel').textContent = '重新计算排行'; $('ranking-cancel').onclick = startRanking; }
                if (data.type === 'done') { rankingCache.set(city, data); stopRanking(); renderRankings(data, true); }
            };
            rankingWorker.onerror = () => { if (rankingWorker !== activeRankingWorker) return; if ($('ranking-progress')) $('ranking-progress').textContent = '排行计算失败，请重试。'; stopRanking(); if ($('ranking-cancel')) { $('ranking-cancel').textContent = '重新计算排行'; $('ranking-cancel').onclick = startRanking; } };
            const raw = api.raw();
            rankingWorker.postMessage({city, nodes:raw.nodes, edges:raw.edges});
        }
        function renderRankings(data, reveal = false) {
            const table = (label, entries, station) => `<section class="research-ranking-table"><h4>${label}</h4><div class="research-table-scroll"><table><thead><tr><th>排名</th><th>${station ? '车站' : '线路'}</th><th>新增不可达站对</th><th>绕行站对</th>${station ? '<th>停用站相关站对</th>' : ''}</tr></thead><tbody>${entries.map((item,i) => `<tr${selectedRank?.kind === (station ? 'station' : 'line') && selectedRank.name === item.name ? ' class="research-selected"' : ''}><td>${i+1}</td><td>${esc(item.name)} <button type="button" class="research-rank-action" data-sim-kind="${station ? 'station' : 'line'}" data-sim-name="${esc(item.name)}">模拟</button></td><td>${item.disconnected.toLocaleString()}</td><td>${item.longer.toLocaleString()}</td>${station ? `<td>${item.endpointPairs.toLocaleString()}</td>` : ''}</tr>`).join('')}</tbody></table></div></section>`;
            $('rankings').innerHTML = `<div class="research-rank-panel"><div class="research-section-heading"><div><h3>哪些故障影响最大？</h3></div><span>各前 10 名</span></div><details class="research-note research-explainer"><summary>排行口径</summary><p>分别模拟 ${data.stationTotal} 个车站完全停用和 ${data.lineTotal} 条线路中断。先按新增不可达站对数排序，数量相同时按最少区间增加的站对数排序；相同数值按名称排列。车站排行不把停用站作为起终点的站对计入前两列，该数量单独列出。线路按列表中单独列出的名称分别模拟。结果是当前线网拓扑推演，不代表实际客流或故障概率。</p></details><div class="research-rank-grid">${table('车站 TOP 10',data.station,true)}${table('线路 TOP 10',data.line,false)}</div></div>`;
            $('rankings').querySelectorAll('[data-sim-kind]').forEach(button => button.onclick = () => simulateRanked(button.dataset.simKind, button.dataset.simName));
            if (reveal) window.InteractionPolish?.revealRows($('rankings'), '.research-ranking-table tbody tr');
        }
        function simulateRanked(kind, name) {
            const line = kind === 'station' ? [...groups].find(([, group]) => group.stations.has(name))?.[0] : name;
            if (!line || !groups.has(line)) { $('status').textContent = '无法定位该对象，请手动选择线路。'; return; }
            selectedRank = {kind, name};
            rankingScroll = modal.querySelector('.research-scroll').scrollTop;
            $('kind').value = kind; $('kind').onchange();
            $('line').value = line; $('line').onchange();
            if (kind === 'station') {
                $('target').value = name;
                if ($('target').value !== name) { $('status').textContent = '无法定位该车站，请手动选择。'; return; }
            }
            run();
            modal.querySelector('.research-scroll').scrollTop = 0;
        }
        function renderChart(pairs, total) {
            const bins = [
                {label:'1–5', min:1,max:5}, {label:'6–10',min:6,max:10},
                {label:'11–20',min:11,max:20}, {label:'21–30',min:21,max:30},
                {label:'31+',min:31,max:Infinity}
            ].map(bin => ({...bin, count:pairs.filter(pair => pair.kind === 'disconnected' && pair.old >= bin.min && pair.old <= bin.max).length}));
            if (!total) { $('chart').innerHTML = `<section class="research-chart"><h3>新增不可达站对分布</h3><p class="research-note">本次模拟没有新增不可达站对。</p></section>`; return; }
            const max = Math.max(...bins.map(bin=>bin.count),1);
            const unit = 10 ** Math.floor(Math.log10(max / 4));
            const step = Math.max(1, Math.ceil((max + 1) / 4 / unit) * unit), ceiling = step * 4;
            $('chart').innerHTML = `<section class="research-chart"><div class="research-section-heading"><div><h3>新增不可达站对分布</h3></div><span>共 ${total.toLocaleString()} 对</span></div><p class="research-note">按故障前最少乘行区间分组，统计新增不可达站对；每次模拟独立缩放。停用站作为起终点的站对不计入。</p><div class="research-plot" role="img" aria-label="${bins.map(bin => `${bin.label} 个区间：${bin.count} 对`).join('；')}"><div class="research-y-axis" aria-hidden="true"><span>站对数</span>${[4,3,2,1,0].map(n => `<span>${(n*step).toLocaleString()}</span>`).join('')}</div><div class="research-bars">${bins.map(bin=>`<div class="research-bar-item"><span class="research-bar-value">${bin.count.toLocaleString()}</span><div class="research-bar-track"><span class="research-bar-fill" style="height:${(100*bin.count/ceiling).toFixed(2)}%"></span></div><span class="research-bar-label">${bin.label}</span></div>`).join('')}</div></div><p class="research-chart-axis">故障前最少乘行区间数</p></section>`;
        }
        function run() {
            reset(); if (api.city() !== city) return close();
            const raw = api.raw(), payload = {type:mode, nodes:base.nodes, edges:base.edges, mapNodes:raw.nodes};
            if (mode === 'detour') {
                payload.maximum = 2; payload.start = $('start').value;
                const mapNodes = new Map(raw.nodes.map(node => [node.name, node]));
                const inconsistent = raw.edges.filter(edge => {
                    const stored = edge.straightLengthKm;
                    const calculated = window.NetworkResearchCore.distance(mapNodes.get(edge.u), mapNodes.get(edge.v));
                    return !Number.isFinite(stored) || stored <= 0 || !Number.isFinite(calculated) || Math.abs(stored - calculated) > 0.005;
                });
                if (inconsistent.length) {
                    $('start').disabled = true;
                    $('status').textContent = `当前城市的绕路排行暂不可用，切换车站不会产生结果。原因是 ${inconsistent.length} 个区间的已有距离与站点坐标计算值不一致，需核实：` + inconsistent.map(edge => `${edge.line} ${edge.u}—${edge.v}`).join('；') + '。可关闭此面板并切换到其他城市体验。';
                    return;
                }
            } else {
                const station = $('kind').value === 'station', target = $('target').value;
                let nodes = raw.nodes, edges = raw.edges;
                if (station) {
                    const removed = new Set(base.getMapStationNames(target));
                    nodes = raw.nodes.filter(n => !removed.has(n.name));
                    edges = raw.edges.filter(e => !removed.has(e.u) && !removed.has(e.v));
                    payload.closedStation = target; scenario = `模拟车站停用：${target}${removed.size > 1 ? `（${[...removed].join('、')}）` : ''}`; fault = {type:'station', names:[...removed]};
                } else if ($('kind').value === 'line') {
                    const line = $('line').value;
                    const indices = raw.edges.map((edge,index) => edge.line === line ? index : -1).filter(index => index >= 0);
                    if (!indices.length) { $('status').textContent = '请选择有效线路。'; return; }
                    const blocked = new Set(indices);
                    edges = raw.edges.filter((_,i) => !blocked.has(i));
                    const segmentCount = window.NetworkResearchCore.groupLineEdges(indices.map(index => ({edge:raw.edges[index], index}))).length;
                    scenario = `模拟整条线路中断：${line}（${segmentCount} 个区间）`;
                    fault = {type:'edge', indices};
                } else {
                    const choice = $('path').value;
                    const selectedPath = choice === '' ? null : segmentPaths[Number(choice)];
                    if (!selectedPath || !selectedPath.edges.length) { $('status').textContent = '请选择完整的中断区间及路径。'; return; }
                    const blocked = new Set(selectedPath.edges), line = $('line').value;
                    edges = raw.edges.filter((_,i) => !blocked.has(i));
                    const via = selectedPath.stations.slice(1,-1);
                    scenario = `模拟区间中断：${line} ${selectedPath.stations[0]}—${selectedPath.stations.at(-1)}${via.length ? `（经${via.join('、')}）` : ''}`;
                    fault = {type:'edge', indices:[...selectedPath.edges]};
                }
                changed = window.CalculationTopology.create(city,nodes,edges);
                payload.changedNodes = changed.nodes; payload.changedEdges = changed.edges;
            }
            if (mode === 'failure') { stopRanking(); $('rankings').hidden = true; $('back-ranking').hidden = false; }
            $('status').textContent = '正在准备分析…'; $('cancel').hidden = false; $('progress').hidden = false; $('progress').value = 0;
            worker = new Worker('network-research-worker.js?v=20261102-detour-line-count');
            const activeWorker = worker;
            worker.onmessage = ({data}) => {
                if (worker !== activeWorker) return;
                if (data.type === 'progress') { $('status').textContent = `正在分析：${data.current} / ${data.total} 个起点`; $('progress').max = data.total; $('progress').value = data.current; }
                if (data.type === 'error') { $('status').textContent = `计算失败：${data.message}`; cancel(); $('progress').hidden = true; $('cancel').hidden = true; $('retry').hidden = false; }
                if (data.type === 'done') { result = data; visible = mode === 'detour' ? 10 : 50; cancel(); $('progress').hidden = true; $('cancel').hidden = true; render(true); }
            };
            worker.onerror = () => { if (worker !== activeWorker) return; $('status').textContent = '计算失败，请重试。'; cancel(); $('progress').hidden = true; $('cancel').hidden = true; $('retry').hidden = false; };
            worker.postMessage(payload);
        }
        function render(reveal = false) {
            if (!result) return;
            const s = result.stats;
            if (mode === 'failure') renderChart(result.pairs, s.disconnected);
            $('status').innerHTML = mode === 'detour'
                ? `<p class="research-result-scope">直线距离不超过 2 公里 · 共 ${result.pairs.length.toLocaleString()} 对</p><details class="research-result-detail"><summary>筛选统计</summary><p>${s.tooFar.toLocaleString()} 对超过 2 公里；${s.invalid.toLocaleString()} 对同址、坐标缺失或几何数据异常。</p></details>`
                : `<div class="research-result-title">${esc(scenario)}</div><div class="research-result-scope">基线可达 ${s.baselinePairs.toLocaleString()} 对 · 停用站作为端点的 ${s.endpointPairs.toLocaleString()} 对另计</div><div class="research-summary"><div><span>新增不可达站对</span><strong data-motion-value="${s.disconnected}">${s.disconnected.toLocaleString()}</strong><small>对</small></div><div><span>最少区间增加</span><strong data-motion-value="${s.longer}">${s.longer.toLocaleString()}</strong><small>对</small></div><div><span>未变化</span><strong data-motion-value="${s.unchanged}">${s.unchanged.toLocaleString()}</strong><small>对</small></div></div><div class="research-result-detail">连通分组：${s.beforeComponents.length} → ${s.afterComponents.length}</div>`;
            let view = result.pairs.map((pair,index) => ({pair,index}));
            if (mode === 'detour') { const direction = detourSortAscending ? 1 : -1; view.sort((a,b) => direction * (a.pair[detourSortField] - b.pair[detourSortField]) || b.pair.km-a.pair.km || a.pair.a.localeCompare(b.pair.a,'zh') || a.pair.b.localeCompare(b.pair.b,'zh')); }
            if (mode === 'failure') { modal.querySelector('.research-filter').hidden = false; if ($('filter').value !== 'all') view = view.filter(({pair}) => pair.kind === $('filter').value); }
            const rows = view.slice(0,visible).map(({pair:p,index},i) => `<div class="research-row${index === selectedPairIndex ? ' research-selected' : ''}"><span class="research-rank">${String(i+1).padStart(2,'0')}</span><div class="research-row-main"><b>${esc(p.a)} <span class="research-arrow">↔</span> ${esc(p.b)}</b><div class="research-note">${mode === 'detour' ? `直线 ${Math.round(p.direct * 1000).toLocaleString()} 米 · 地铁估算 ${p.km.toFixed(2)} 公里 · 最少 ${p.hops} 个乘行区间` : p.kind === 'disconnected' ? `模拟后不可达 · 原最少 ${p.old} 个乘行区间` : `最少乘行区间 ${p.old} → ${p.now}（增加 ${p.now-p.old}）`}</div></div>${mode === 'detour' ? `<div class="research-metric"><strong>${p.ratio.toFixed(2)}<small> 倍</small></strong><span>绕行系数</span></div>` : `<div class="research-metric"><strong>${p.kind === 'disconnected' ? '不可达' : `+${p.now-p.old}`}</strong><span>${p.kind === 'disconnected' ? '模拟后' : '增加区间'}</span></div>`}<div class="research-row-actions">${mode === 'detour' ? `<button data-index="${index}" data-route="distance">查看最短距离路线</button><button data-index="${index}" data-route="hops">查看最少站数路线</button>` : `<button data-index="${index}" data-route="before">查看原路线</button>${p.kind !== 'disconnected' ? `<button data-index="${index}" data-route="after">查看模拟后路线</button>` : ''}`}</div></div>`).join('');
            if (mode === 'detour' && view.length) {
                const tableRows = view.slice(0,visible).map(({pair:p,index},i) => `<tr${index === selectedPairIndex ? ' class="research-selected"' : ''}><td class="detour-rank">${i+1}</td><td class="detour-stations">${esc(p.a)} <span class="research-arrow">↔</span> ${esc(p.b)}</td><td data-label="绕行系数"><strong class="detour-ratio">${p.ratio.toFixed(2)} 倍</strong></td><td data-label="直线距离">${Math.round(p.direct * 1000).toLocaleString()} 米</td><td data-label="最短地铁估算">${p.km.toFixed(2)} 公里</td><td data-label="最少区间">${p.hops} 个</td><td data-label="线路数·距离路线">${p.lineCount} 条</td><td><div class="research-row-actions"><button data-index="${index}" data-route="distance">最短距离路线</button><button data-index="${index}" data-route="hops">最少区间路线</button></div></td></tr>`).join('');
                const header = (field, text) => `<th${detourSortField === field ? ` aria-sort="${detourSortAscending ? 'ascending' : 'descending'}"` : ''}><button class="detour-sort" type="button" data-sort="${field}" aria-label="按${text}排序${detourSortField === field ? (detourSortAscending ? '，当前升序' : '，当前降序') : ''}">${text} <span aria-hidden="true">${detourSortField === field ? (detourSortAscending ? '↑' : '↓') : ''}</span></button></th>`;
                const sortLabel = {ratio:'绕行系数', direct:'直线距离', km:'最短地铁估算', hops:'最少区间', lineCount:'线路数（最短距离）'}[detourSortField];
                $('results').innerHTML = `<div class="research-section-heading"><div><h3>绕路排行 ${visible <= 10 && !detourSortAscending && (detourSortField === 'hops' || detourSortField === 'km') ? 'TOP 10' : ''}</h3><p class="research-sort-current">按${sortLabel}${detourSortAscending ? '升序' : '降序'}</p></div><span>共 ${view.length.toLocaleString()} 对</span></div><p class="detour-mobile-hint">左右滑动选择排序指标</p><div class="detour-table-scroll"><table class="detour-table"><thead><tr><th>排名</th><th>站对</th>${header('ratio','绕行系数')}${header('direct','直线距离')}${header('km','最短地铁估算')}${header('hops','最少区间')}${header('lineCount','线路数·距离路线')}<th>查看路线</th></tr></thead><tbody>${tableRows}</tbody></table></div>`;
            } else $('results').innerHTML = rows ? `<div class="research-section-heading"><div><h3>受影响的站对</h3></div><span>${view.length.toLocaleString()} 对</span></div>${rows}` : '<p class="research-empty">没有符合条件的站对。</p>';
            if (reveal) {
                window.InteractionPolish?.animateCounts($('status'));
                window.InteractionPolish?.revealRows($('results'), mode === 'detour' ? '.detour-table tbody tr' : '.research-row');
            }
            if (visible < view.length) $('results').insertAdjacentHTML('beforeend', `<button id="research-more" type="button">显示更多（剩余 ${view.length-visible} 对）</button>`);
            $('results').querySelectorAll('[data-sort]').forEach(button => button.onclick = () => {
                const field = button.dataset.sort;
                detourSortAscending = detourSortField === field ? !detourSortAscending : false;
                detourSortField = field; visible = 10; render();
                $('results').querySelector(`[data-sort="${field}"]`)?.focus();
            });
            $('results').querySelectorAll('[data-route]').forEach(button => button.onclick = () => {
                selectedPairIndex = Number(button.dataset.index);
                resultScroll = modal.querySelector('.research-scroll').scrollTop;
                const pair = result.pairs[selectedPairIndex], routeType = button.dataset.route;
                const topology = routeType === 'after' ? changed : base;
                const graph = window.NetworkResearchCore.graph(topology.nodes,topology.edges,api.raw().nodes);
                const route = window.NetworkResearchCore.path(graph,pair.a,pair.b,routeType === 'distance');
                if (!route) { $('status').textContent = '该路线不可达。'; return; }
                route.researchLabel = mode === 'detour' ? `绕路之王 · ${routeType === 'distance' ? '最短估算距离' : '最少站数'}` : `${scenario} · ${routeType === 'before' ? '模拟前' : '模拟后'}`;
                if (api.showRoute(route, topology.edges, {pair, fault: mode === 'failure' ? fault : null, detour: mode === 'detour'})) modal.style.display = 'none';
            });
            const more = $('more'); if (more) more.onclick = () => {visible += 50; render();};
        }
        $('close').onclick = close;
        document.getElementById('btn-open-detour').onclick = () => open('detour');
        document.getElementById('btn-open-failure').onclick = () => open('failure');
        return {close, showResults: () => { if (result && api.city() === city) { focusOrigin = document.activeElement; modal.style.display = 'flex'; render(); modal.querySelector('.research-scroll').scrollTop = resultScroll; $('close').focus({preventScroll:true}); } }};
    }
    window.NetworkResearchUI = {init};
})();
