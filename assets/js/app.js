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

  // 안심 탭 체크인
  //   - 괜찮아요 클릭: 카드 내부(아이콘·색·텍스트)만 인플레이스 토글. 도움이 필요해요는 상시.
  //   - 도움이 필요해요 클릭: 같은 자리에서 "다시 한 번 눌러주세요"로 바뀜 → 다시 누르면 뷰 전환.
  //     오조작 방지. 5초 안에 재클릭 없으면 원상복구.
  var checkinViews = document.querySelectorAll('[data-checkin-view]');
  var checkinIconwrap = document.querySelector('[data-checkin-iconwrap]');
  var checkinIcon = document.querySelector('[data-checkin-icon]');
  var checkinLabel = document.querySelector('[data-checkin-label]');
  var checkinTitle = document.querySelector('[data-checkin-title]');
  var helpBtn = document.querySelector('[data-checkin-btn="help"]');
  var checkedIn = false;
  var helpConfirming = false;
  var helpTimer = null;

  function setCheckinView(view) {
    checkinViews.forEach(function (v) {
      v.hidden = v.getAttribute('data-checkin-view') !== view;
    });
  }
  function setCheckedIn(done) {
    checkedIn = done;
    var okCard = document.querySelector('[data-checkin-view="default"] [data-checkin-btn="ok"]');
    if (done) {
      // 흰 카드 그대로, 아이콘과 글자만 옅게
      checkinIconwrap.style.background = 'linear-gradient(150deg,#00A98D,#0D76FF)';
      checkinIconwrap.style.boxShadow = '0 14px 32px rgba(0,169,141,.34)';
      checkinIconwrap.style.opacity = '.35';
      checkinIcon.textContent = 'check_circle';
      checkinIcon.classList.add('is-filled');
      checkinLabel.textContent = '완료';
      checkinLabel.style.opacity = '.4';
      checkinTitle.textContent = '오늘도 확인됐어요';
      if (okCard) {
        okCard.style.background = '#fff';
        okCard.style.border = 'none';
        okCard.style.boxShadow = '0 20px 44px rgba(5,27,80,.22)';
        okCard.style.cursor = 'default';
      }
    } else {
      checkinIconwrap.style.background = 'linear-gradient(150deg,#0D76FF,#5F6BFF)';
      checkinIconwrap.style.boxShadow = '0 14px 32px rgba(13,118,255,.34)';
      checkinIconwrap.style.opacity = '1';
      checkinIcon.textContent = 'thumb_up';
      checkinIcon.classList.remove('is-filled');
      checkinLabel.textContent = '괜찮아요';
      checkinLabel.style.opacity = '1';
      checkinTitle.textContent = '지금 괜찮으신가요?';
      if (okCard) {
        okCard.style.background = '#fff';
        okCard.style.border = 'none';
        okCard.style.boxShadow = '0 20px 44px rgba(5,27,80,.22)';
        okCard.style.cursor = 'pointer';
      }
    }
  }
  function resetHelpBtn() {
    helpConfirming = false;
    if (helpTimer) { clearTimeout(helpTimer); helpTimer = null; }
    helpBtn.innerHTML = '<span class="ms" style="font-size:26px">emergency_home</span>도움이 필요해요';
    helpBtn.style.background = 'rgba(255,255,255,.18)';
    helpBtn.style.borderColor = 'rgba(255,255,255,.46)';
  }
  function armHelpBtn() {
    helpConfirming = true;
    helpBtn.innerHTML = '<span class="ms" style="font-size:26px">emergency_home</span>한번 더 누르면 보호자에게 도움을 요청합니다';
    helpBtn.style.background = 'rgba(255,183,64,.30)';
    helpBtn.style.borderColor = 'rgba(255,206,120,.7)';
    helpTimer = setTimeout(resetHelpBtn, 5000);
  }

  document.querySelectorAll('[data-checkin-btn]').forEach(function (el) {
    el.addEventListener('click', function () {
      var action = el.getAttribute('data-checkin-btn');
      if (action === 'ok') {
        setCheckedIn(!checkedIn);
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

  // dev 스위처 — 안심 탭 시연용 사용자·화면 전환
  var userViews = document.querySelectorAll('[data-user-view]');
  var devUser = document.querySelector('[data-dev-user]');
  var devView = document.querySelector('[data-dev-view]');
  function setUserView(name) {
    userViews.forEach(function (v) {
      v.hidden = v.getAttribute('data-user-view') !== name;
    });
  }
  if (devUser) devUser.addEventListener('change', function () {
    setUserView(devUser.value);
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
