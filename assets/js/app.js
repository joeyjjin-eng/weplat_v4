// 위플랫 v4 — SPA 셸 + 캐러셀 인터랙션
(function () {
  'use strict';

  var TABS = ['ansim', 'benefit', 'insurance', 'more'];
  var screens = {};
  var tabs = {};
  var history = ['ansim'];
  var carouselUpdaters = [];

  TABS.forEach(function (name) {
    screens[name] = document.querySelector('.screen[data-screen="' + name + '"]');
    tabs[name] = document.querySelector('.tab[data-target="' + name + '"]');
  });

  // 캐러셀 — 각 캐러셀마다 카드/칩/prev-next 버튼 동기화
  document.querySelectorAll('[data-carousel]').forEach(function (car) {
    var cards = Array.prototype.slice.call(car.querySelectorAll('.carousel-card'));
    if (!cards.length) return;
    var key = car.getAttribute('data-carousel');

    var chipContainer = document.querySelector('[data-chip-nav="' + key + '"]');
    var chips = chipContainer
      ? Array.prototype.slice.call(chipContainer.querySelectorAll('[data-target-card]'))
      : [];

    var navContainer = document.querySelector('[data-carousel-nav="' + key + '"]');
    var prevBtn = navContainer ? navContainer.querySelector('[data-nav-prev]') : null;
    var nextBtn = navContainer ? navContainer.querySelector('[data-nav-next]') : null;
    var prevLabel = prevBtn ? prevBtn.querySelector('[data-nav-label]') : null;
    var nextLabel = nextBtn ? nextBtn.querySelector('[data-nav-label]') : null;

    function currentIndex() {
      var carRect = car.getBoundingClientRect();
      var center = carRect.left + carRect.width / 2;
      var closestIdx = 0;
      var minDist = Infinity;
      cards.forEach(function (card, i) {
        var rect = card.getBoundingClientRect();
        var cardCenter = rect.left + rect.width / 2;
        var dist = Math.abs(cardCenter - center);
        if (dist < minDist) { minDist = dist; closestIdx = i; }
      });
      return closestIdx;
    }

    function update() {
      var idx = currentIndex();
      cards.forEach(function (c, i) { c.classList.toggle('is-centered', i === idx); });
      chips.forEach(function (chip, i) { chip.classList.toggle('is-active', i === idx); });
      if (prevBtn) {
        if (idx > 0) {
          prevBtn.hidden = false;
          if (prevLabel) prevLabel.textContent = cards[idx - 1].getAttribute('data-nav-label') || '';
        } else {
          prevBtn.hidden = true;
        }
      }
      if (nextBtn) {
        if (idx < cards.length - 1) {
          nextBtn.hidden = false;
          if (nextLabel) nextLabel.textContent = cards[idx + 1].getAttribute('data-nav-label') || '';
        } else {
          nextBtn.hidden = true;
        }
      }
    }

    function scrollToCard(i) {
      if (i < 0 || i >= cards.length) return;
      cards[i].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var i = parseInt(chip.getAttribute('data-target-card'), 10);
        scrollToCard(i);
      });
    });

    if (prevBtn) prevBtn.addEventListener('click', function () {
      scrollToCard(currentIndex() - 1);
    });
    if (nextBtn) nextBtn.addEventListener('click', function () {
      scrollToCard(currentIndex() + 1);
    });

    car.addEventListener('scroll', update, { passive: true });
    carouselUpdaters.push(update);
  });

  function updateCarousels() {
    carouselUpdaters.forEach(function (fn) { fn(); });
  }

  function show(name, pushHistory) {
    if (!screens[name]) return;
    TABS.forEach(function (n) {
      screens[n].hidden = (n !== name);
      tabs[n].classList.toggle('is-active', n === name);
    });
    document.body.setAttribute('data-tab', name);
    if (pushHistory !== false && history[history.length - 1] !== name) {
      history.push(name);
      if (history.length > 20) history.shift();
    }
    // 탭 전환 후 캐러셀 재계산 (숨겨져 있을 때는 getBoundingClientRect가 0을 반환)
    requestAnimationFrame(updateCarousels);
  }

  TABS.forEach(function (name) {
    tabs[name].addEventListener('click', function () { show(name); });
  });

  window.addEventListener('resize', updateCarousels);
  // 초기 렌더 후 한 번 호출
  requestAnimationFrame(updateCarousels);

  // 안심 탭 체크인 (design_handoff_daily_checkin)
  //   - 괜찮아요 클릭: 헤드라인 스왑 + 메시지 라이즈인 + 페인트 블리드 워시 + 스트릭 +1
  //   - 도움이 필요해요 클릭: 같은 자리에서 arm(2단 확인) → 5초 안 재클릭시 도움 뷰로 전환
  //   - 다시 보내기: idle 상태로 복귀 (블리드 숨김)
  var checkinViews = document.querySelectorAll('[data-checkin-view]');
  var helpBtn = document.querySelector('[data-checkin-view="default"] [data-checkin-btn="help"]');
  var checkedIn = false;
  var helpConfirming = false;
  var helpTimer = null;

  // 시간대별 질문·답변 세트. dev 스위처로 전환하거나 실제 배포 시 서버 시간 기반으로 선택.
  var TIME_CONTENT = {
    morning: { question: '아침 컨디션<br>어떠세요?',   answer: '좋아요' },
    lunch:   { question: '점심은 드셨어요?',           answer: '잘 먹었어요' },
    evening: { question: '오늘 하루<br>어떠셨어요?',   answer: '잘 지냈어요' }
  };
  var currentTime = 'morning';

  function setTimeOfDay(time) {
    if (!TIME_CONTENT[time]) return;
    currentTime = time;
    // 배경 클래스 토글 — idle 시간대별 수채화 톤
    var mainScreen = document.querySelector('.screen[data-screen="ansim"]');
    if (mainScreen) {
      mainScreen.classList.remove('is-morning', 'is-lunch', 'is-evening');
      mainScreen.classList.add('is-' + time);
    }
    var bigLabel = document.querySelector('.ansim-ok .big');
    if (bigLabel) bigLabel.textContent = TIME_CONTENT[time].answer;
    // idle 상태일 때만 헤드라인 시간대 질문으로 갱신 (sent 상태는 그대로 유지)
    if (!checkedIn) {
      var headline = document.querySelector('[data-checkin-headline]');
      if (headline) headline.innerHTML = TIME_CONTENT[time].question;
    }
  }

  function setCheckinView(view) {
    checkinViews.forEach(function (v) {
      v.hidden = v.getAttribute('data-checkin-view') !== view;
    });
    // 블리드는 default 뷰 + sent 상태일 때만 노출. 다른 뷰 열면 감춰서 웜 워시가 새어나가지 않게.
    var bleed = document.querySelector('[data-checkin-bleed]');
    if (bleed) bleed.hidden = !(view === 'default' && checkedIn);
  }
  function setCheckedIn(done) {
    checkedIn = done;
    var okBtn = document.querySelector('[data-checkin-view="default"] [data-checkin-btn="ok"]');
    var msg = document.querySelector('[data-checkin-msg]');
    var head = document.querySelector('.ansim-checkin-head');
    var headline = document.querySelector('[data-checkin-headline]');
    var bleed = document.querySelector('[data-checkin-bleed]');
    var mainScreen = document.querySelector('.screen[data-screen="ansim"]');
    if (done) {
      if (okBtn) okBtn.hidden = true;
      if (msg) msg.hidden = false;
      if (head) head.hidden = true;
      if (mainScreen) mainScreen.classList.add('is-sent');
      // 페인트 블리드 리플레이 (매번 처음부터)
      if (bleed) {
        bleed.hidden = true;
        void bleed.offsetWidth;
        bleed.hidden = false;
        Array.prototype.forEach.call(bleed.children, function (c) {
          c.style.animation = 'none';
          void c.offsetWidth;
          c.style.animation = '';
        });
      }
      if (msg) {
        msg.style.animation = 'none';
        void msg.offsetWidth;
        msg.style.animation = '';
      }
    } else {
      if (okBtn) okBtn.hidden = false;
      if (msg) msg.hidden = true;
      if (head) head.hidden = false;
      if (mainScreen) mainScreen.classList.remove('is-sent');
      if (headline) headline.innerHTML = TIME_CONTENT[currentTime].question;
      if (bleed) bleed.hidden = true;
    }
  }
  function resetHelpBtn() {
    helpConfirming = false;
    if (helpTimer) { clearTimeout(helpTimer); helpTimer = null; }
    if (!helpBtn) return;
    helpBtn.classList.remove('is-armed');
    helpBtn.innerHTML = '<span class="ms">emergency_home</span>도움이 필요해요';
  }
  function armHelpBtn() {
    helpConfirming = true;
    if (!helpBtn) return;
    helpBtn.classList.add('is-armed');
    helpBtn.innerHTML = '<span class="ms">emergency_home</span>한번 더 누르면 보호자에게 도움을 요청합니다';
    helpTimer = setTimeout(resetHelpBtn, 5000);
  }

  document.querySelectorAll('[data-checkin-btn]').forEach(function (el) {
    el.addEventListener('click', function () {
      var action = el.getAttribute('data-checkin-btn');
      if (action === 'ok') {
        setCheckedIn(true);
      } else if (action === 'help') {
        if (helpConfirming) { resetHelpBtn(); setCheckinView('help'); }
        else armHelpBtn();
      } else if (action === 'cancel') {
        setCheckinView('default');
        resetHelpBtn();
      } else if (action === 'notifications') {
        setCheckinView('notifications');
      } else if (action === 'alert-missed' || action === 'alert-anomaly') {
        setCheckinView(action);
      } else if (action === 'alert-ok') {
        // 알림 응답: 괜찮아요 → default 뷰의 완료 상태로 복귀
        setCheckinView('default');
        setCheckedIn(true);
      } else if (action === 'alert-help') {
        // 알림 응답: 도움이 필요해요 → 바로 도움 요청 뷰 (이미 알림에 반응 중이라 2단 확인 생략)
        setCheckinView('help');
      }
    });
  });

  // dev 스위처 — 안심 탭 시연용 사용자·화면·시간대 전환
  var userViews = document.querySelectorAll('[data-user-view]');
  var devUser = document.querySelector('[data-dev-user]');
  var devView = document.querySelector('[data-dev-view]');
  var devTime = document.querySelector('[data-dev-time]');
  // 스위처 토글 (최소화/확장)
  var devToggle = document.querySelector('[data-dev-toggle]');
  var devBody = document.querySelector('[data-dev-body]');
  var devIcon = document.querySelector('[data-dev-icon]');
  if (devToggle && devBody) devToggle.addEventListener('click', function () {
    var wasHidden = devBody.hidden;
    devBody.hidden = !wasHidden;
    if (devIcon) devIcon.textContent = wasHidden ? '−' : '+';
  });
  if (devTime) devTime.addEventListener('change', function () {
    setTimeOfDay(devTime.value);
  });
  // 초기 시간대 적용 (스위처 기본값과 동기화)
  setTimeOfDay(devTime ? devTime.value : 'morning');
  function setUserView(name) {
    userViews.forEach(function (v) {
      v.hidden = v.getAttribute('data-user-view') !== name;
    });
  }
  if (devUser) devUser.addEventListener('change', function () {
    setUserView(devUser.value);
    // 사용자 뷰 전환 시 블리드는 무조건 리셋 (보호자/미가입자 뷰에 웜 워시 새어나가지 않게)
    var bleed = document.querySelector('[data-checkin-bleed]');
    if (bleed) bleed.hidden = true;
    // 대상자로 돌아올 때는 안심 탭도 기본 화면으로 복귀
    if (devUser.value === 'protected') {
      setCheckinView('default');
      if (devView) devView.value = 'default';
    }
  });
  if (devView) devView.addEventListener('change', function () {
    // 대상자 뷰가 아닌 상태에서 상태 선택하면 자동으로 대상자로 전환
    if (devUser && devUser.value !== 'protected') {
      devUser.value = 'protected';
      setUserView('protected');
    }
    resetHelpBtn();
    var bellBadge = document.querySelector('[data-bell-badge]');
    var val = devView.value;
    if (val === 'alarm-pending') {
      // 알람 온: 체크인 카드 활성 + 벨 dot (읽지 않은 알람)
      setCheckinView('default');
      setCheckedIn(false);
      if (bellBadge) bellBadge.hidden = false;
    } else if (val === 'ok') {
      // 응답완료: 카드 흐림, 벨 dot 없음 (알람 처리됨)
      setCheckinView('default');
      setCheckedIn(true);
      if (bellBadge) bellBadge.hidden = true;
    } else if (val === 'alert-missed') {
      // 미응답: 재알림 intercept + 벨 dot
      setCheckinView('alert-missed');
      if (bellBadge) bellBadge.hidden = false;
    } else if (val === 'alert-anomaly') {
      // 워치신호: 이상신호 intercept + 벨 dot
      setCheckinView('alert-anomaly');
      if (bellBadge) bellBadge.hidden = false;
    }
  });

  // Android 하드웨어 백 버튼 — 이전 탭으로. 마지막 탭이면 앱 종료(네이티브에 위임).
  window.WeplatBridge = {
    onBackPressed: function () {
      if (history.length > 1) {
        history.pop();
        show(history[history.length - 1], false);
        return true;
      }
      return false;
    }
  };
})();
