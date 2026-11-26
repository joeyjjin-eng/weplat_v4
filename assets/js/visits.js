// 구독자 시연 데이터. 같은 방문 이벤트에서 일정, 기록, 앱 내 알림을 만든다.
var visitSubscription = (function () {
  'use strict';
  var storageKey = 'weplat-visit-demo-v1';
  var partner = '김지은 파트너';
  var labels = { scheduled: '방문 예정', travel: '파트너 이동 중', arrived: '방문 중', complete: '안부 확인 완료', missed: '부재로 미방문' };
  var control = document.querySelector('[data-dev-visit]');
  var dateFormat = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit' });

  function weekly(time, weeks) {
    var date = new Date(time);
    date.setDate(date.getDate() + weeks * 7);
    return date.getTime();
  }
  function event(slot, status, time, read) {
    return { slot: slot, status: status, time: time, read: read };
  }
  function initial() {
    var first = new Date();
    first.setHours(10, 0, 0, 0);
    if (first.getTime() < Date.now()) first.setDate(first.getDate() + 1);
    var slot = first.getTime();
    return { first: slot, events: [
      event(slot, 'scheduled', Date.now(), false),
      event(weekly(slot, -1), 'complete', weekly(slot, -1) + 1800000, false),
      event(weekly(slot, -2), 'complete', weekly(slot, -2) + 1800000, true)
    ] };
  }
  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved && Number.isFinite(saved.first) && Array.isArray(saved.events) && saved.events.length &&
          saved.events.every(function (e) { return e && Number.isFinite(e.slot) && Number.isFinite(e.time) && Object.prototype.hasOwnProperty.call(labels, e.status); })) return saved;
    } catch (_) {}
    return initial();
  }
  var state;
  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch (_) {}
  }
  function latest(slot) {
    return state.events.find(function (e) { return e.slot === slot; });
  }
  function active(slot) {
    var e = latest(slot);
    return !e || (e.status !== 'complete' && e.status !== 'missed');
  }
  function nextSlot() {
    var slot = state.first;
    // 지난 방문은 파트너의 확인 없이 완료 처리하지 않는다.
    while (weekly(slot, 1) <= Date.now() || !active(slot)) slot = weekly(slot, 1);
    return slot;
  }
  function ensureScheduled(slot) {
    if (!latest(slot)) state.events.unshift(event(slot, 'scheduled', Date.now(), false));
  }
  function statusText(e) {
    if (e.status === 'scheduled' && e.slot < Date.now()) return '방문 결과 확인 대기';
    return labels[e.status];
  }
  function row(list, title, note) {
    var li = document.createElement('li');
    var name = document.createElement('strong');
    var sub = document.createElement('small');
    name.textContent = title;
    sub.textContent = note;
    li.append(name, sub);
    list.appendChild(li);
    return li;
  }
  function render() {
    if (!state) state = load();
    var slot = nextSlot();
    ensureScheduled(slot);
    var current = latest(slot);
    document.querySelector('[data-visit-preview]').textContent = dateFormat.format(slot) + ' · ' + statusText(current);
    document.querySelector('[data-visit-date]').textContent = dateFormat.format(slot);
    document.querySelector('[data-visit-partner]').textContent = '담당 ' + partner;
    document.querySelector('[data-visit-status]').textContent = statusText(current);
    document.querySelector('[data-visit-badge]').hidden = !state.events.some(function (e) { return !e.read; });
    control.value = current.status;
    Array.from(control.options).forEach(function (option, i) {
      option.disabled = i < control.selectedIndex;
    });
    var schedule = document.querySelector('[data-visit-schedule]');
    schedule.textContent = '';
    for (var i = 0; i < 3; i++) {
      var week = weekly(slot, i);
      row(schedule, dateFormat.format(week), i === 0 ? statusText(current) : '정기 방문 예정');
    }
    var recent = document.querySelector('[data-visit-recent]');
    var history = document.querySelector('[data-visit-history]');
    recent.textContent = '';
    history.textContent = '';
    state.events.forEach(function (e) {
      var note = dateFormat.format(e.slot) + ' 방문 · ' + partner;
      var entry = row(history, labels[e.status], note + ' · 기록 ' + dateFormat.format(e.time));
      entry.id = 'visit-' + e.slot + '-' + e.status;
      entry.tabIndex = -1;
      if (e.status !== 'scheduled' && recent.children.length < 2) row(recent, labels[e.status], note);
    });
    save();
  }
  control.addEventListener('change', function () {
    var slot = nextSlot();
    if (latest(slot) && latest(slot).status === control.value) return;
    state.events.unshift(event(slot, control.value, Date.now(), false));
    render();
  });
  function notifications() {
    render();
    return state.events.map(function (e) {
      return { icon: 'event', color: 'teal', title: labels[e.status], read: e.read, visitEvent: e,
        meta: dateFormat.format(e.slot) + ' 방문 · ' + partner };
    });
  }
  return { render: render, notifications: notifications, markRead: function (e) { e.read = true; render(); } };
})();
