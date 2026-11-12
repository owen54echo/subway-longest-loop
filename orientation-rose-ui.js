(function() {
    'use strict';
    const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const color = value => /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#9aa1a7';
    const km = value => value.toLocaleString('zh-CN', {minimumFractionDigits:1,maximumFractionDigits:1});
    const directions=['南北','东北偏北—西南偏南','东北—西南','东北偏东—西南偏西','东西','东南偏东—西北偏西','东南—西北','东南偏南—西北偏北'];
    function wedge(cx,cy,inner,outer,start,end) {
        const point=(r,a)=>[cx+r*Math.sin(a),cy-r*Math.cos(a)];
        const a=point(outer,start),b=point(outer,end),c=point(inner,end),d=point(inner,start);
        return `M${a[0].toFixed(2)} ${a[1].toFixed(2)} A${outer.toFixed(2)} ${outer.toFixed(2)} 0 0 1 ${b[0].toFixed(2)} ${b[1].toFixed(2)} L${c[0].toFixed(2)} ${c[1].toFixed(2)} A${inner.toFixed(2)} ${inner.toFixed(2)} 0 0 0 ${d[0].toFixed(2)} ${d[1].toFixed(2)} Z`;
    }
    function chart(lines) {
        const totals=Array.from({length:16},(_,i)=>lines.reduce((sum,l)=>sum+l.bins[i],0)), max=Math.max(...totals,0);
        const parts=[]; const step=2*Math.PI/16, innerRadius=27, outerRadius=130;
        const radius=value=>Math.sqrt(innerRadius**2+(outerRadius**2-innerRadius**2)*value/max);
        const ordered=[...lines].sort((a,b)=>b.km-a.km || a.name.localeCompare(b.name,'zh-CN'));
        for(let i=0;i<16;i++) {
            let previous=0;
            for (const l of ordered) {
                const value=l.bins[i]; if(value<=0) continue;
                const next=previous+value;
                const inner=radius(previous), outer=radius(next);
                parts.push(`<path d="${wedge(180,180,inner,outer,(i-.47)*step,(i+.47)*step)}" fill="${color(l.color)}" data-rose-line="${esc(l.name)}"><title>${esc(l.name)} · ${esc(directions[i%8])} · 单侧 ${km(value)} 公里</title></path>`);
                previous=next;
            }
        }
        return `<svg class="rose-svg" viewBox="0 0 360 360" role="img" aria-label="方向玫瑰图：各方向的扇形面积表示线路长度，颜色代表线路">`+
            `<g class="rose-grid"><circle cx="180" cy="180" r="65"/><circle cx="180" cy="180" r="98"/><circle cx="180" cy="180" r="130"/><path d="M180 42V318 M42 180H318 M82.4 82.4L277.6 277.6 M277.6 82.4L82.4 277.6"/></g>`+
            `<g class="rose-petals">${parts.join('')}</g><g class="rose-center"><circle cx="180" cy="180" r="22"/><path d="M180 167V193 M167 180H193"/><circle cx="180" cy="180" r="2"/></g>`+
            `<g class="rose-labels"><text x="180" y="27" text-anchor="middle">北</text><text x="180" y="348" text-anchor="middle">南</text><text x="338" y="185" text-anchor="middle">东</text><text x="22" y="185" text-anchor="middle">西</text></g></svg>`;
    }
    function init(getCurrentCity) {
        const modal=document.createElement('div');
        modal.className='matrix-modal research-modal rose-modal';
        modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true'); modal.setAttribute('aria-labelledby','rose-title');
        modal.innerHTML=`<div class="matrix-header"><span class="matrix-title" id="rose-title">方向玫瑰图</span><button class="matrix-close" id="rose-close" aria-label="关闭">×</button></div>
          <div class="rose-scroll"><div class="rose-toolbar"><label>城市 <select id="rose-city" class="analysis-select" aria-label="选择方向玫瑰图城市"></select></label><label>线路 <select id="rose-line" class="analysis-select" aria-label="选择线路"><option value="">全部线路</option></select></label></div>
          <div id="rose-status" class="rose-status" role="status" aria-live="polite"></div><div id="rose-content" hidden><div class="rose-overview"><div><span class="rose-eyebrow">线网走向分布</span><h2 id="rose-city-title"></h2></div></div>
          <div class="rose-body"><div class="rose-figure"><div class="rose-figure-heading"><span>方位分布</span><span>16 个方向</span></div><div id="rose-chart"></div><p class="rose-caption">扇形面积表示长度 · 相反方向各分配一半</p></div><div class="rose-details"><div class="rose-section-head"><div><h3>线路构成 <small class="rose-distance-note">距离为估算值</small></h3><p id="rose-insight"></p></div><button id="rose-all" type="button">显示全部</button></div><div id="rose-legend" class="rose-legend"></div></div></div>
          <details class="rose-method"><summary>统计口径</summary><p>按线路折线的每一段计算方向，以长度加权；共划分 16 个方位。线路视作双向，长度均分至相反方向，合计不会重复计算。相同区间若属于不同线路，分别计入对应线路。估算区间按站间直线纳入；长度用于观察方向，不是运营里程。OSM 走向已进行自动匹配检查，未逐段人工核实。</p></details></div></div>`;
        document.body.appendChild(modal);
        const $=id=>modal.querySelector('#rose-'+id), cache=new Map();
        let activeCity='',geometry=null,requestId=0,focusOrigin=null;
        const select=$('city'), lineSelect=$('line');
        for(const tab of document.querySelectorAll('.city-tab[data-value]')) {
            const option=document.createElement('option'); option.value=tab.dataset.value; option.textContent=tab.textContent.trim(); select.append(option);
        }
        function render() {
            if(!geometry) return;
            const result=window.OrientationRose.analyze(window.subwayDataMap[activeCity],geometry,{includeEstimated:true});
            const old=lineSelect.value;
            lineSelect.innerHTML='<option value="">全部线路</option>'+result.lines.map(l=>`<option value="${esc(l.name)}">${esc(l.name)}</option>`).join('');
            lineSelect.value=result.lines.some(l=>l.name===old)?old:'';
            const chosen=lineSelect.value, visible=chosen?result.lines.filter(l=>l.name===chosen):result.lines;
            const total=visible.reduce((sum,l)=>sum+l.km,0);
            $('city-title').textContent=`${select.selectedOptions[0].textContent} · ${chosen||'全部线路'}`;
            $('chart').innerHTML=total>0?chart(visible):'<div class="rose-empty">当前线路暂无可用走向</div>';
            const sums=Array.from({length:8},(_,i)=>visible.reduce((sum,l)=>sum+l.bins[i]+l.bins[i+8],0));
            const peak=sums.indexOf(Math.max(...sums));
            $('insight').textContent=total>0?`主要走向：${directions[peak]} · 占 ${Math.round(sums[peak]/total*100)}%`:'暂无方向数据';
            $('legend').innerHTML=[...result.lines].sort((a,b)=>b.km-a.km || a.name.localeCompare(b.name,'zh-CN')).map(l=>`<button type="button" class="rose-line${l.name===chosen?' is-selected':''}" data-line="${esc(l.name)}" aria-pressed="${l.name===chosen}"><span class="rose-swatch" style="background:${color(l.color)}"></span><span class="rose-line-name">${esc(l.name)}</span><span class="rose-line-km">${km(l.km)} km</span></button>`).join('') || '<p class="rose-empty">暂无可用线路数据</p>';
            $('all').hidden=!chosen;
            $('status').textContent=''; $('content').hidden=false;
        }
        async function load(city) {
            activeCity=city; geometry=null; const current=++requestId; $('content').hidden=true; $('status').textContent='正在加载方向数据…';
            try {
                if(!cache.has(city)) {
                    const file=city==='guangzhou'?'guangfo':city;
                    cache.set(city,fetch(`data/geometry/${file}.json?v=20261112-lujia-v1`).then(r=>{if(!r.ok) throw new Error('数据加载失败');return r.json();}));
                }
                const data=await cache.get(city); if(current!==requestId) return;
                geometry=data; lineSelect.value=''; render();
            } catch(err) {
                cache.delete(city); if(current!==requestId) return;
                $('status').textContent='方向数据加载失败，请重新选择城市后重试。';
            }
        }
        function close() { if(modal.style.display!=='flex') return; ++requestId; modal.style.display='none'; if(focusOrigin?.isConnected) focusOrigin.focus(); }
        document.getElementById('btn-open-rose').addEventListener('click',()=>{focusOrigin=document.activeElement;select.value=getCurrentCity();modal.style.display='flex';$('close').focus();load(select.value);});
        $('close').addEventListener('click',close);
        select.addEventListener('change',()=>load(select.value));
        lineSelect.addEventListener('change',render);
        $('all').addEventListener('click',()=>{lineSelect.value='';render();});
        $('legend').addEventListener('click',e=>{const btn=e.target.closest('button[data-line]');if(!btn)return;lineSelect.value=lineSelect.value===btn.dataset.line?'':btn.dataset.line;render();lineSelect.focus();});
        modal.addEventListener('keydown',e=>{
            if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();return;}
            if(e.key!=='Tab')return;
            const items=[...modal.querySelectorAll('button,select,input,summary')].filter(x=>!x.disabled&&x.getClientRects().length);
            if(!items.length)return;
            if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1).focus();}
            else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0].focus();}
        });
    }
    window.OrientationRoseUI={init};
})();
