(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var NS = 'http://www.w3.org/2000/svg';
  var table = null;          // 붙여넣은 글을 읽은 결과
  var pendingConfig = null;  // "논문 데이터로 해보기"가 정해 둔 설정 (한 번만 쓴다)
  var lastResult = null;

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function showError(msg) { var e = $('err'); if (msg) { e.textContent = msg; e.hidden = false; } else { e.hidden = true; e.textContent = ''; } }
  function option(sel, value, label, selected) { var o = el('option', { value: value }, label); if (selected) o.selected = true; sel.appendChild(o); }

  /* 붙여넣기 → 읽기 → 설정 칸 채우기 */
  function onData() {
    var text = $('data').value;
    if (!text.trim()) { table = null; showError(''); $('setup').hidden = true; $('result').hidden = true; return; }
    var t = Judge.parseTable(text);
    if (!t.ok) { table = null; showError(t.error); $('setup').hidden = true; $('result').hidden = true; return; }
    showError('');
    table = t;
    buildSetup(pendingConfig);
    pendingConfig = null;
    run();
  }

  function buildSetup(cfg) {
    var cols = table.columns;
    var prim = $('sel-primary'), ctrl = $('sel-control'), obs = $('sel-obs'), sec = $('secondary');
    clear(prim); clear(ctrl); clear(obs); clear(sec);
    cols.forEach(function (c, i) { option(prim, String(i), c, cfg ? i === cfg.primary : i === 0); });
    option(ctrl, '-1', '(쓰지 않음)', !cfg || cfg.control == null);
    cols.forEach(function (c, i) { option(ctrl, String(i), c, !!cfg && cfg.control === i); });
    var defObs = cfg ? cfg.obsStart : table.rows[Math.max(0, table.rows.length - 3)].date;
    table.rows.forEach(function (r) { option(obs, r.date, r.date, r.date === defObs); });
    cols.forEach(function (c, i) {
      var lab = el('label'), cb = el('input', { type: 'checkbox', value: String(i) });
      cb.checked = cfg ? cfg.secondary.indexOf(i) >= 0 : i !== 0;
      cb.addEventListener('change', run);
      lab.appendChild(cb); lab.appendChild(document.createTextNode(c)); sec.appendChild(lab);
    });
    $('chk-incomplete').checked = !!(cfg && cfg.lastIncomplete);
    $('setup').hidden = false;
  }

  function readConfig() {
    var sec = [];
    Array.prototype.forEach.call($('secondary').querySelectorAll('input'), function (cb) { if (cb.checked) sec.push(Number(cb.value)); });
    var c = Number($('sel-control').value);
    return {
      primary: Number($('sel-primary').value), secondary: sec, control: c >= 0 ? c : null,
      obsStart: $('sel-obs').value, lastIncomplete: $('chk-incomplete').checked
    };
  }

  /* 주·비교로 고른 열은 보조로 고를 수 없게 한다 */
  function syncSecondary() {
    var p = $('sel-primary').value, c = $('sel-control').value;
    Array.prototype.forEach.call($('secondary').querySelectorAll('input'), function (cb) {
      var dis = cb.value === p || cb.value === c;
      if (dis) cb.checked = false;
      cb.disabled = dis;
      cb.parentNode.style.opacity = dis ? '0.5' : '1';
    });
  }

  function run() {
    if (!table) return;
    syncSecondary();
    var res = Judge.judge(table, readConfig());
    if (!res.ok) { showError(res.error); $('result').hidden = true; lastResult = null; return; }
    showError('');
    lastResult = res;
    render(res);
  }

  function render(res) {
    var v = $('verdict'); clear(v);
    v.className = 'verdict' + (res.verdict === '부분 지지' ? ' partial' : (res.verdict === '불지지' ? ' none' : ''));
    v.appendChild(el('p', { 'class': 'lab' }, '판정 (논문의 사전 기준)'));
    v.appendChild(el('p', { 'class': 'v' }, res.verdict));
    v.appendChild(el('p', null, res.detail));
    v.appendChild(el('p', { 'class': 'small' }, '기준선 ' + res.counts.base + '주 (' + res.range.baseFrom + ' ~ ' + res.range.baseTo + ') · 관측 ' + res.counts.obs + '주 (' + res.range.obsFrom + ' ~ ' + res.range.obsTo + ')'));

    var t = $('tbl'); clear(t);
    var head = el('tr'); ['역할', '키워드', '기준선 최댓값', '기준선 평균', '관측 값', '기준선 최댓값 돌파?'].forEach(function (h) { head.appendChild(el('th', { scope: 'col' }, h)); });
    var thead = el('thead'); thead.appendChild(head); t.appendChild(thead);
    var tb = el('tbody');
    res.keywords.forEach(function (p) {
      var tr = el('tr');
      var tdRole = el('td'); tdRole.appendChild(el('span', { 'class': 'tag' }, p.role)); tr.appendChild(tdRole);
      tr.appendChild(el('td', null, p.name));
      tr.appendChild(el('td', null, String(p.baseMax)));
      tr.appendChild(el('td', null, p.baseMean.toFixed(2)));
      tr.appendChild(el('td', null, p.obs.join(', ')));
      tr.appendChild(el('td', null, p.breach ? '돌파 (' + p.obsMax + ' > ' + p.baseMax + ')' : '못 넘음 (' + p.obsMax + ' ≤ ' + p.baseMax + ')'));
      tb.appendChild(tr);
    });
    t.appendChild(tb);

    var ch = $('charts'); clear(ch);
    res.keywords.forEach(function (p) { ch.appendChild(chart(p)); });

    var w = $('warnings'); clear(w);
    if (!res.warnings.length) w.appendChild(el('li', null, '이 자료에서는 추가로 걸리는 점이 없습니다. 그래도 아래 "말하지 못하는 것"은 항상 적용됩니다.'));
    res.warnings.forEach(function (x) { w.appendChild(el('li', { 'class': 'warn' }, (x.kind === 'app' ? '[앱 안내] ' : '') + x.text)); });
    var l = $('limits'); clear(l);
    res.limits.forEach(function (x) { l.appendChild(el('li', null, x)); });

    $('result').hidden = false;
    $('copied').textContent = '';
  }

  function chart(p) {
    var box = el('div', { 'class': 'chart' });
    box.appendChild(el('h3', null, p.name + ' · ' + p.role + ' 키워드'));
    var W = 600, H = 110, top = 6, n = p.series.length, bw = W / n;
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + (H + 4));
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', p.name + ': 기준선 최댓값 ' + p.baseMax + ', 관측 값 ' + p.obs.join(', '));
    p.series.forEach(function (s, i) {
      var h = Math.max(s.value > 0 ? 1.5 : 0, (s.value / 100) * (H - top));
      var r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', (i * bw + 0.6).toFixed(2)); r.setAttribute('width', Math.max(1, bw - 1.2).toFixed(2));
      r.setAttribute('y', (H - h).toFixed(2)); r.setAttribute('height', h.toFixed(2));
      r.setAttribute('fill', s.phase === 'obs' ? 'var(--obs)' : 'var(--bar)');
      var tt = document.createElementNS(NS, 'title'); tt.textContent = s.date + ' · ' + s.value + (s.phase === 'obs' ? ' (관측)' : ' (기준선)');
      r.appendChild(tt); svg.appendChild(r);
    });
    var y = H - (p.baseMax / 100) * (H - top);
    var line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', 0); line.setAttribute('x2', W); line.setAttribute('y1', y.toFixed(2)); line.setAttribute('y2', y.toFixed(2));
    line.setAttribute('stroke', 'var(--accent)'); line.setAttribute('stroke-width', 1.5); line.setAttribute('stroke-dasharray', '5 4');
    svg.appendChild(line);
    box.appendChild(svg);
    return box;
  }

  function copySummary() {
    if (!lastResult) return;
    var text = Judge.summaryText(lastResult, table), msg = $('copied');
    var done = function (ok) { msg.textContent = ok ? '복사했습니다.' : '복사하지 못했습니다. 결과를 직접 선택해서 복사해 주세요.'; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    else {
      var ta = el('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta); done(ok);
    }
  }

  function loadExample() {
    pendingConfig = EXAMPLE_CONFIG;
    $('data').value = EXAMPLE_CSV;
    onData();
    var r = $('result'); if (!r.hidden && r.scrollIntoView) r.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  var timer = null;
  $('data').addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(onData, 250); });
  ['sel-primary', 'sel-control', 'sel-obs', 'chk-incomplete'].forEach(function (id) { $(id).addEventListener('change', run); });
  $('btn-example').addEventListener('click', loadExample);
  $('btn-clear').addEventListener('click', function () { $('data').value = ''; onData(); $('data').focus(); });
  $('btn-copy').addEventListener('click', copySummary);
  if (location.hash === '#example') loadExample();
})();
