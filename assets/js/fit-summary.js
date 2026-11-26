var fitSummary = (function () {
  'use strict';
  var cards = document.querySelectorAll('[data-fit-card]');
  var live = false;

  function valid(sample) {
    return sample && Number.isFinite(sample.bpm) && sample.bpm > 0 &&
      Number.isFinite(sample.at) && sample.at > 0 && sample.at <= Date.now();
  }
  function clockMinute(date) { return date.getHours() * 60 + date.getMinutes(); }

  // 같은 활동 상태에서 날짜별로 가장 가까운 시간의 기록을 하나씩 선택한다.
  // 가까운 이웃 최대 5일의 평균으로 개인 기준 심박수를 추정한다.
  function comparisonSamples(current, history) {
    var start = new Date(current.at);
    start.setHours(0, 0, 0, 0);
    var earliest = new Date(start);
    earliest.setDate(earliest.getDate() - 7);
    var target = clockMinute(new Date(current.at));
    var daily = new Map();
    history.forEach(function (s) {
      if (!valid(s) || s.activity !== current.activity || s.at < earliest || s.at >= start) return;
      var date = new Date(s.at);
      var gap = Math.abs(clockMinute(date) - target);
      gap = Math.min(gap, 1440 - gap);
      var key = date.toDateString();
      if (gap <= 90 && (!daily.has(key) || gap < daily.get(key).gap)) daily.set(key, { gap: gap, bpm: s.bpm });
    });
    var nearest = Array.from(daily.values()).sort(function (a, b) { return a.gap - b.gap; }).slice(0, 5);
    return nearest;
  }
  function render(current, history) {
    var value = '측정 대기';
    var note = '측정 대기';
    var tip = '';
    var samples = [];
    if (valid(current)) {
      var bpm = Math.round(current.bpm);
      var comparable = current.activity === 'resting' || current.activity === 'active';
      samples = comparable ? comparisonSamples(current, history) : [];
      var usual = samples.length < 3 ? null : Math.round(samples.reduce(function (sum, s) { return sum + s.bpm; }, 0) / samples.length);
      value = String(bpm);
      if (usual === null) note = '기록 수집 중';
      else {
        var delta = bpm - usual;
        note = delta === 0 ? '같아요' : '분당 ' + Math.abs(delta) + '회 ' + (delta > 0 ? '높아요' : '낮아요');
        var context = current.activity === 'resting' ? '휴식 중 심박수가 ' : '활동 중 심박수가 ';
        if (delta === 0) tip = context + '평소 같은 시간대와 비슷해요.';
        else {
          var degree = Math.abs(delta) <= 5 ? '조금 ' : '';
          tip = context + '평소보다 ' + degree + (delta > 0 ? '높아요.' : '낮아요.') +
            ' 다음 기록도 비교해 보세요.';
        }
      }
    }
    cards.forEach(function (card) {
      card.querySelector('.fit-unit').hidden = !valid(current);
      card.querySelector('strong').textContent = value;
      card.querySelector('.fit-compare p').textContent = note;
      card.querySelector('.fit-tip p').textContent = tip;
      card.querySelector('.fit-tip').hidden = !tip;
    });
  }
  cards.forEach(function (card) {
    card.innerHTML = '<div class="fit-body"><div class="fit-tile fit-pulse"><div class="fit-label">심박수' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.4 5.4a5.1 5.1 0 0 0-7.2 0L12 6.6l-1.2-1.2a5.1 5.1 0 0 0-7.2 7.2L12 21l8.4-8.4a5.1 5.1 0 0 0 0-7.2Z"/></svg></div>' +
      '<div class="fit-value"><strong></strong> <span class="fit-unit">회/분</span></div></div>' +
      '<div class="fit-tile fit-compare"><div class="fit-label">평소 대비' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h4l3-7 4 14 3-7h4"/></svg></div><p></p></div></div>' +
      '<div class="fit-tip" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 3 2.3 6.7L19 12l-6.7 2.3L10 21l-2.3-6.7L1 12l6.7-2.3zM19 1l1.2 3.8L24 6l-3.8 1.2L19 11l-1.2-3.8L14 6l3.8-1.2z"/></svg><div><h2>AI 건강 요약</h2><p></p></div></div>';
  });
  function preview(anomaly) {
    if (live) return;
    var now = Date.now();
    var history = [67, 69, 68, 66, 70].map(function (bpm, i) {
      var at = new Date(now);
      at.setDate(at.getDate() - i - 1);
      return { at: at.getTime(), bpm: bpm, activity: 'resting' };
    });
    render({ at: now, bpm: anomaly ? 83 : 72, activity:'resting' }, history);
  }
  preview(false);
  return { preview: preview, update: function (snapshot) {
    live = true;
    render(snapshot && snapshot.current, snapshot && Array.isArray(snapshot.history) ? snapshot.history : []);
  } };
})();
