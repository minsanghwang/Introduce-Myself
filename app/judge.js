/*
 * 판정 로직. 논문 「해외 정부의 가정 비축 권고 보도와 한국의 비상 대비 검색 관심」
 * 2절(방법)의 사전 등록 기준을 그대로 옮겼다.
 *
 * 논문의 규칙
 *  - 기준선 = 관측 시작일 이전 주, 관측 = 시작일 이후 주.
 *  - "돌파" = 관측 주 중 하나라도 기준선 주간 최댓값을 넘는다 (같으면 넘은 것이 아니다).
 *  - 지지 = 주 키워드가 돌파하고 보조 키워드 하나 이상도 돌파.
 *    부분 지지 = 둘 중 하나만 충족. 불지지 = 아무것도 충족하지 못함.
 *  - 비교 키워드도 돌파하면 계절·일반 요인으로 보고 "보도 효과"라고 쓰지 않는다.
 *  - 강한 기준(일간 평균 + 표준편차 3배, 3일 연속)은 일간 자료가 필요해서 판정하지 않는다.
 *
 * 앱이 덧붙인 안내(논문이 숫자를 정하지 않은 부분)는 kind:"app" 으로 표시한다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Judge = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LOW_BASELINE_MAX = 20; // 앱의 안내 기준: 논문의 비상식량 기준선 최댓값 18을 "낮다"고 본 데서 가져옴
  var MIN_BASELINE_WEEKS = 4;
  var SHORT_BASELINE_WEEKS = 26;
  var SHORT_OBS_WEEKS = 4;

  function parseDate(s) {
    var m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/.exec(String(s).trim());
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    var t = new Date(Date.UTC(y, mo - 1, d));
    if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
    return y + '-' + (mo < 10 ? '0' : '') + mo + '-' + (d < 10 ? '0' : '') + d;
  }

  function splitLine(line) {
    var cells = line.indexOf('\t') >= 0 ? line.split('\t') : line.split(',');
    return cells.map(function (c) { return c.trim().replace(/^"|"$/g, '').trim(); });
  }

  function cleanName(n) {
    return n.replace(/:\s*\(.*\)\s*$/, '').trim();
  }

  /* 붙여넣은 글을 표로 바꾼다. 실패해도 예외를 던지지 않고 {ok:false,error}를 돌려준다. */
  function parseTable(text) {
    try {
      if (typeof text !== 'string' || !text.trim()) return { ok: false, error: '붙여넣은 내용이 없습니다. 주간 값을 붙여넣거나 "논문 데이터로 해보기"를 눌러 보세요.' };
      var lines = text.replace(/\r/g, '').replace(/^﻿/, '').split('\n');
      var items = [];
      for (var i = 0; i < lines.length; i++) if (lines[i].trim()) items.push({ no: i + 1, cells: splitLine(lines[i]) });
      if (items.length < 2) return { ok: false, error: '줄이 너무 적습니다. 첫 줄은 제목, 이어서 "날짜, 값, 값…" 줄이 필요합니다.' };

      var h = -1;
      for (var k = 0; k < items.length - 1; k++) {
        if (items[k].cells.length >= 2 && parseDate(items[k].cells[0]) === null && parseDate(items[k + 1].cells[0]) !== null) { h = k; break; }
      }
      var names, start;
      if (h >= 0) { names = items[h].cells.slice(1).map(cleanName); start = h + 1; }
      else if (parseDate(items[0].cells[0]) !== null) {
        names = []; for (var c = 1; c < items[0].cells.length; c++) names.push('키워드' + c); start = 0;
      } else return { ok: false, error: '날짜로 시작하는 줄을 찾지 못했습니다. 날짜는 2026-10-18 처럼 적어 주세요.' };
      if (names.length < 1) return { ok: false, error: '값 열이 없습니다. "날짜, 값" 두 열 이상이 필요합니다.' };
      for (var n = 0; n < names.length; n++) if (!names[n]) names[n] = '키워드' + (n + 1);

      var rows = [], seen = {};
      for (var r = start; r < items.length; r++) {
        var it = items[r], date = parseDate(it.cells[0]);
        if (date === null) return { ok: false, error: it.no + '번째 줄: 날짜를 읽을 수 없습니다 ("' + it.cells[0].slice(0, 20) + '"). 2026-10-18 형식으로 적어 주세요.' };
        if (seen[date]) return { ok: false, error: it.no + '번째 줄: 날짜 ' + date + '가 두 번 나옵니다.' };
        seen[date] = true;
        if (it.cells.length - 1 < names.length) return { ok: false, error: it.no + '번째 줄: 값이 ' + (it.cells.length - 1) + '개뿐입니다 (열은 ' + names.length + '개).' };
        var vals = [];
        for (var v = 0; v < names.length; v++) {
          var raw = it.cells[v + 1];
          var num = /^<\s*1$/.test(raw) ? 0 : (raw === '' ? NaN : Number(raw));
          if (!isFinite(num)) return { ok: false, error: it.no + '번째 줄, "' + names[v] + '" 값 "' + raw.slice(0, 12) + '"을 숫자로 읽을 수 없습니다.' };
          if (num < 0 || num > 100) return { ok: false, error: it.no + '번째 줄, "' + names[v] + '" 값 ' + num + '은 0~100 범위를 벗어났습니다 (Google 트렌드 상대 지수).' };
          vals.push(num);
        }
        rows.push({ date: date, values: vals });
      }
      rows.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      if (rows.length < MIN_BASELINE_WEEKS + 1) return { ok: false, error: '주가 ' + rows.length + '개뿐입니다. 기준선과 관측을 나누려면 최소 ' + (MIN_BASELINE_WEEKS + 1) + '주가 필요합니다 (논문은 53주).' };
      return { ok: true, columns: names, rows: rows };
    } catch (e) {
      return { ok: false, error: '자료를 읽는 중 문제가 생겼습니다. 형식을 확인해 주세요.' };
    }
  }

  function stats(arr) {
    var mx = -Infinity, sum = 0, nz = 0;
    arr.forEach(function (x) { if (x > mx) mx = x; sum += x; if (x > 0) nz++; });
    var mean = sum / arr.length, ss = 0;
    arr.forEach(function (x) { ss += (x - mean) * (x - mean); });
    return { max: mx, mean: mean, sd: Math.sqrt(ss / arr.length), nonzero: nz };
  }

  /* cfg: {primary:열번호, secondary:[열번호], control:열번호|null, obsStart:"YYYY-MM-DD", lastIncomplete:bool} */
  function judge(table, cfg) {
    try {
      if (!table || !table.ok) return { ok: false, error: '먼저 자료를 올바르게 붙여넣어 주세요.' };
      var ncol = table.columns.length;
      var okIdx = function (i) { return typeof i === 'number' && i >= 0 && i < ncol && Math.floor(i) === i; };
      if (!okIdx(cfg.primary)) return { ok: false, error: '주 키워드를 하나 골라 주세요.' };
      var secondary = (cfg.secondary || []).filter(function (i) { return okIdx(i) && i !== cfg.primary; });
      var control = okIdx(cfg.control) && cfg.control !== cfg.primary && secondary.indexOf(cfg.control) < 0 ? cfg.control : null;
      var obsStart = parseDate(cfg.obsStart || '');
      if (!obsStart) return { ok: false, error: '관측 시작일을 골라 주세요.' };

      var baseRows = table.rows.filter(function (r) { return r.date < obsStart; });
      var obsRows = table.rows.filter(function (r) { return r.date >= obsStart; });
      if (baseRows.length < MIN_BASELINE_WEEKS) return { ok: false, error: '기준선이 ' + baseRows.length + '주뿐입니다. 관측 시작일 앞에 최소 ' + MIN_BASELINE_WEEKS + '주가 있어야 합니다.' };
      if (obsRows.length < 1) return { ok: false, error: '관측 주가 없습니다. 관측 시작일을 더 앞으로 옮겨 주세요.' };

      var roles = {};
      roles[cfg.primary] = '주';
      secondary.forEach(function (i) { roles[i] = '보조'; });
      if (control !== null) roles[control] = '비교';
      var keys = Object.keys(roles).map(Number).sort(function (a, b) { return a - b; });

      var per = keys.map(function (i) {
        var b = baseRows.map(function (r) { return r.values[i]; });
        var o = obsRows.map(function (r) { return r.values[i]; });
        var bs = stats(b), os = stats(o);
        return {
          index: i, name: table.columns[i], role: roles[i],
          baseMax: bs.max, baseMean: bs.mean, baseSd: bs.sd, baseNonzero: bs.nonzero,
          obs: o, obsMax: os.max, breach: os.max > bs.max,
          series: table.rows.map(function (r) { return { date: r.date, value: r.values[i], phase: r.date < obsStart ? 'base' : 'obs' }; })
        };
      });
      var get = function (role) { return per.filter(function (p) { return p.role === role; }); };
      var prim = get('주')[0], secs = get('보조'), ctrl = get('비교')[0] || null;
      var secBreached = secs.filter(function (p) { return p.breach; });

      var verdict, detail;
      if (prim.breach && secBreached.length) { verdict = '지지(약한 기준, 잠정)'; detail = '주 키워드와 보조 키워드 하나 이상이 기준선 최댓값을 넘었습니다.'; }
      else if (prim.breach || secBreached.length) {
        verdict = '부분 지지';
        detail = prim.breach
          ? (secs.length ? '주 키워드는 넘었지만 보조 키워드는 하나도 넘지 못했습니다.' : '주 키워드는 넘었습니다. 보조 키워드를 지정하지 않아 "지지"는 판정할 수 없습니다.')
          : '보조 키워드는 넘었지만 주 키워드가 넘지 못했습니다.';
      } else { verdict = '불지지'; detail = '주 키워드도 보조 키워드도 기준선 최댓값을 넘지 못했습니다.'; }

      var warnings = [];
      if (ctrl && ctrl.breach) warnings.push({ kind: 'paper', text: '비교 키워드 "' + ctrl.name + '"도 기준선 최댓값을 넘었습니다. 계절·일반 요인 가능성이 있어 "보도 효과"라고 쓰지 않습니다.' });
      per.forEach(function (p) {
        if (p.role === '비교') return;
        if (p.baseMax <= LOW_BASELINE_MAX) warnings.push({ kind: 'paper', text: '"' + p.name + '"의 기준선 최댓값이 ' + p.baseMax + '으로 낮습니다. 작은 움직임도 "돌파"가 되므로 돌파 여부는 맞히지만 증가의 크기는 알려 주지 않습니다. (낮다고 보는 선 ' + LOW_BASELINE_MAX + '은 앱의 안내 기준입니다.)' });
        else if (p.baseMax > 0 && p.baseNonzero === 1) warnings.push({ kind: 'paper', text: '"' + p.name + '"은 기준선에서 0이 아닌 주가 한 주뿐이라 문턱(' + p.baseMax + ')이 한 번의 스파이크로 정해져 있습니다.' });
      });
      var lastZero = per.filter(function (p) { return p.obs[p.obs.length - 1] === 0; });
      if (lastZero.length) warnings.push({ kind: 'paper', text: '마지막 관측 주 값이 0인 키워드(' + lastZero.map(function (p) { return p.name; }).join(', ') + ')가 있습니다. Google 트렌드의 0은 "검색이 없음"이 아니라 "표시 기준 미만"일 수 있습니다.' });
      if (cfg.lastIncomplete) warnings.push({ kind: 'paper', text: '마지막 관측 주가 미완성이라 값이 바뀔 수 있습니다. 그 주의 감소나 증가를 추세로 읽지 마세요.' });
      if (obsRows.length < SHORT_OBS_WEEKS) warnings.push({ kind: 'paper', text: '관측이 ' + obsRows.length + '주뿐입니다. 추세가 지속되는지 일시적인지는 이 자료로 알 수 없습니다.' });
      if (baseRows.length < SHORT_BASELINE_WEEKS) warnings.push({ kind: 'app', text: '기준선이 ' + baseRows.length + '주입니다. 논문은 50주를 썼고, 반년 미만이면 계절 변화를 거르기 어렵습니다.' });

      return {
        ok: true, verdict: verdict, detail: detail,
        counts: { weeks: table.rows.length, base: baseRows.length, obs: obsRows.length, keywords: ncol },
        range: { baseFrom: baseRows[0].date, baseTo: baseRows[baseRows.length - 1].date, obsFrom: obsRows[0].date, obsTo: obsRows[obsRows.length - 1].date },
        keywords: per, secondaryBreached: secBreached.map(function (p) { return p.name; }),
        controlBreached: !!(ctrl && ctrl.breach), warnings: warnings,
        limits: [
          '이 판정은 검색 관심이 기준선을 넘었는가만 말합니다. 보도가 원인이라는 증거가 아닙니다 (시기가 겹쳤다는 뜻).',
          '같은 시기의 다른 사건은 통제하지 못합니다. 비교 키워드는 계절·일반 요인 하나만 거릅니다.',
          '일간 자료가 필요한 강한 기준(일간 평균 + 표준편차 3배, 3일 연속)은 판정하지 않습니다.',
          '검색이 실제 구매나 비축으로 이어졌는지는 알 수 없습니다.'
        ]
      };
    } catch (e) {
      return { ok: false, error: '판정 중 문제가 생겼습니다. 설정을 확인해 주세요.' };
    }
  }

  function summaryText(res, table) {
    if (!res || !res.ok) return '';
    var L = [];
    L.push('판정(사전 기준): ' + res.verdict + ' — ' + res.detail);
    L.push('기준선 ' + res.counts.base + '주 (' + res.range.baseFrom + ' ~ ' + res.range.baseTo + '), 관측 ' + res.counts.obs + '주 (' + res.range.obsFrom + ' ~ ' + res.range.obsTo + ')');
    res.keywords.forEach(function (p) {
      L.push('[' + p.role + '] ' + p.name + ': 기준선 최댓값 ' + p.baseMax + ', 관측 ' + JSON.stringify(p.obs) + ' → ' + (p.breach ? '돌파' : '미돌파'));
    });
    res.warnings.forEach(function (w) { L.push('주의: ' + w.text); });
    L.push('한계: ' + res.limits[0]);
    L.push('기준: 황민상, 해외 정부의 가정 비축 권고 보도와 한국의 비상 대비 검색 관심 (2026)');
    return L.join('\n');
  }

  return { parseTable: parseTable, judge: judge, summaryText: summaryText, parseDate: parseDate };
});
