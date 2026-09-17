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

  // 혜택 탭 — 생활비 절감 계산 (챗봇 흐름)
  //   구조: 봇 아바타 + 봇 버블(질문 + 러닝 토탈 인라인 카드) → 사용자 버블 → 다음 스텝
  //   TODO 수식 — 지금 절감액은 자리표시자(—). savingState.answers 로 계산하도록 확장.
  var savingFlow = document.querySelector('[data-saving-flow]');
  if (savingFlow) {
    var savingHome = document.querySelector('[data-benefit-home]');
    var savingHeader = document.querySelector('.screen[data-screen="benefit"] .screen-header');
    var savingChat = savingFlow.querySelector('[data-saving-chat]');
    var savingOptions = savingFlow.querySelector('[data-saving-options]');
    var savingProgress = savingFlow.querySelector('[data-saving-progress]');
    var savingBar = savingFlow.querySelector('[data-saving-bar]');
    var savingStart = document.querySelector('[data-saving-start]');
    var bundleStart = document.querySelector('[data-bundle-start]');
    var savingBack = savingFlow.querySelector('[data-saving-back]');
    var savingClose = savingFlow.querySelector('[data-saving-close]');
    var savingTitleEl = savingFlow.querySelector('[data-saving-title]');
    var savingTotalEl = savingFlow.querySelector('[data-saving-total]');

    // 두 챗봇 흐름 정의. key = 요약 라벨. bubble = 봇 질문(HTML).
    // contrib = 스텝별 답변 → 목업 절감액. 실제 수식이 오면 이 매핑만 교체.
    // 지원금 목업 배수 — bundle 일 때 월 절감 × 이 값 = 지원금 표시 금액.
    // 실제 지원금 계산식이 오면 여기 또는 hero 함수만 교체.
    var BUNDLE_SUBSIDY_MULT = 12;

    var FLOWS = {
      saving: {
        title: '생활비 절감 계산',
        resultLayout: 'unified', // 결과·요약·폼 한 화면
        sectionTitle: '절감 플랜 안내 받기',
        sectionSub: '위플랫 담당자가 직접 연락드려서 절감 방법을 자세히 알려드려요',
        ctaLabel: '안내 받기',
        hero: function (amt, mo, ext) {
          return {
            icon: 'savings',
            eyebrow: '확인해봤더니',
            amount: amt.monthly,
            memo: '1년이면 <b>' + amt.yearly + '</b>이나 아껴요'
          };
        },
        steps: [
          {
            key: '휴대폰 요금',
            bubble:
              '안녕하세요!<br>' +
              '지금 쓰시는 <b>휴대폰 요금</b>부터 볼게요.<br>' +
              '한 달에 얼마 내고 계세요?',
            options: [
              { label: '3만 원 이하',    value: 'lt30' },
              { label: '3만 ~ 6만 원',   value: '30_60' },
              { label: '6만 ~ 9만 원',   value: '60_90' },
              { label: '9만 원 이상',    value: 'gt90' },
              { label: '잘 모르겠어요',  value: 'unknown' }
            ]
          },
          {
            key: '통신사',
            bubble: '<b>어느 통신사</b> 쓰세요?',
            options: [
              { label: 'SKT',           value: 'skt' },
              { label: 'KT',            value: 'kt' },
              { label: 'LG U+',         value: 'lgu' },
              { label: '알뜰폰',        value: 'mvno' },
              { label: '잘 모르겠어요', value: 'unknown' }
            ]
          },
          {
            key: '인터넷·TV',
            bubble: '집에서 <b>인터넷·TV</b>는 어떻게 쓰세요?',
            options: [
              { label: '인터넷만 씀',              value: 'net' },
              { label: '인터넷 + TV',              value: 'net_tv' },
              { label: '인터넷 + TV + 휴대폰',     value: 'net_tv_mob' },
              { label: '아무 것도 안 씀',           value: 'none' }
            ]
          },
          {
            key: '기초연금',
            bubble: '<b>기초연금</b> 받고 계세요?',
            options: [
              { label: '네, 받고 있어요',   value: 'gov' },
              { label: '아니요',             value: 'no' },
              { label: '잘 모르겠어요',      value: 'unknown' }
            ]
          }
        ],
        contrib: {
          0: { lt30: 3000,  '30_60': 10000, '60_90': 24000, gt90: 32000, unknown: 15000 },
          1: { skt: 6000,   kt: 6000,       lgu: 6000,       mvno: 0,     unknown: 3000 },
          2: { net: 2000,   net_tv: 5000,   net_tv_mob: 8000, none: 0 },
          3: { gov: 11000,  no: 0,          unknown: 2000 }
        }
      },
      bundle: {
        title: '혜택 계산',
        resultLayout: 'split', // 결과 화면 → CTA → 신청 폼 화면 (2단)
        sectionTitle: '지원금 신청하기',
        sectionSub: '위플랫 담당자가 지원금 조건과 신청 방법을 자세히 안내해드려요',
        ctaLabel: '지원금 신청',
        resultCtaLabel: '지원금 신청하기',
        hero: function (amt, mo, ext) {
          var total = ext ? ext.totalBenefit : mo * BUNDLE_SUBSIDY_MULT * 2;
          var frame = ext ? ext.frame : '';
          return {
            icon: 'redeem',
            eyebrow: '받을 수 있는 총 혜택',
            amount: total.toLocaleString('ko-KR') + '원',
            memo: (frame ? '<b>' + frame + '</b>, ' : '') + '2년 약정 기준'
          };
        },
        steps: [
          {
            key: '휴대폰 통신사',
            bubble:
              '안녕하세요!<br>' +
              '휴대폰은 <b>어느 통신사</b> 쓰세요?',
            options: [
              { label: 'SKT',            value: 'skt' },
              { label: 'KT',             value: 'kt' },
              { label: 'LG U+',          value: 'lgu' },
              { label: '알뜰폰',         value: 'mvno' },
              { label: '휴대폰 안 씀',    value: 'none' },
              { label: '잘 모르겠어요',  value: 'unknown' }
            ]
          },
          {
            key: '인터넷 통신사',
            bubble: '인터넷은 <b>어느 통신사</b>예요?',
            options: [
              { label: 'SKT',                 value: 'skt' },
              { label: 'KT',                  value: 'kt' },
              { label: 'LG U+',               value: 'lgu' },
              { label: '휴대폰이랑 같아요',  value: 'same_as_mobile' },
              { label: '인터넷 안 씀',        value: 'none' },
              { label: '잘 모르겠어요',       value: 'unknown' }
            ]
          },
          {
            key: 'TV',
            bubble: '<b>TV(IPTV)</b>도 같이 보세요?',
            options: [
              { label: '네, 인터넷이랑 같은 곳', value: 'same_as_internet' },
              { label: '네, TV는 다른 곳',       value: 'different' },
              { label: 'TV 안 봐요',              value: 'none' }
            ]
          },
          {
            key: '매달 요금',
            bubble:
              '지금 매달 <b>얼마 정도</b> 나가세요?<br>' +
              '(휴대폰·인터넷·TV 다 합쳐서)',
            options: [
              { label: '5만 원 이하',     value: 'lt50' },
              { label: '5만 ~ 10만 원',   value: '50_100' },
              { label: '10만 ~ 15만 원',  value: '100_150' },
              { label: '15만 원 이상',    value: 'gt150' },
              { label: '잘 모르겠어요',   value: 'unknown' }
            ]
          },
          {
            key: '가족 결합',
            bubble:
              '<b>가족과 함께</b> 결합할 수 있으세요?<br>' +
              '결합 인원이 많을수록 할인 폭이 커요',
            options: [
              { label: '네, 2~3명',       value: 'family_small' },
              { label: '네, 4명 이상',    value: 'family_big' },
              { label: '혼자예요',         value: 'alone' },
              { label: '잘 모르겠어요',   value: 'unknown' }
            ]
          }
        ],
        // step 3(매달 요금) 은 savings 기여 없음 — 도식화 입력값(현재 요금)으로만 사용.
        contrib: {
          0: { skt: 6000, kt: 6000, lgu: 6000, mvno: 2000, none: 0, unknown: 3000 },
          1: { skt: 15000, kt: 15000, lgu: 15000, same_as_mobile: 3000, none: 0, unknown: 8000 },
          2: { same_as_internet: 6000, different: 12000, none: 0 },
          3: {},
          4: { family_small: 10000, family_big: 18000, alone: 3000, unknown: 6000 }
        },
        // step 3 답변 → 현재 월 요금 목업 대표값 (도식화용)
        currentMonthly: {
          lt50: 40000, '50_100': 75000, '100_150': 125000, gt150: 180000, unknown: 90000
        }
      }
    };

    var currentFlow = FLOWS.saving;
    var SAVING_STEPS = currentFlow.steps;
    var SAVING_CONTRIB = currentFlow.contrib;
    var SAVING_TOTAL = SAVING_STEPS.length;
    var savingState = { step: 0, answers: [] };

    function savingMonthlySavings(answers) {
      var total = 0;
      for (var i = 0; i < answers.length; i++) {
        var a = answers[i];
        var value = a.value;
        // 혜택(bundle) 흐름 — 사용자가 인터넷을 명시적으로 골랐지만 실질 같은 통신사면
        // "휴대폰이랑 같음" 케이스로 취급 (이중 계산 방지)
        if (currentFlow === FLOWS.bundle && a.step === 1 && answers[0]) {
          if (value === answers[0].value && ['skt','kt','lgu'].indexOf(value) >= 0) {
            value = 'same_as_mobile';
          }
        }
        var table = SAVING_CONTRIB[a.step];
        if (table && typeof table[value] === 'number') total += table[value];
      }
      return total;
    }
    function savingWon(n) { return n.toLocaleString('ko-KR') + '원'; }
    function savingFinalAmount(answers) {
      var m = savingMonthlySavings(answers);
      return { monthly: '월 ' + savingWon(m), yearly: savingWon(m * 12) };
    }

    function savingBotAvatar() {
      return '<div class="saving-avatar"><img src="assets/weplat_symbol.svg" alt=""></div>';
    }

    function savingAppendBotRow(bubbleHTML) {
      var row = document.createElement('div');
      row.className = 'saving-chatrow is-bot';
      row.innerHTML =
        savingBotAvatar() +
        '<div class="saving-bubble is-bot">' + bubbleHTML + '</div>';
      savingChat.appendChild(row);
    }

    function savingAppendUserRow(text, stepIdx) {
      var row = document.createElement('div');
      row.className = 'saving-chatrow is-user';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'saving-bubble is-user';
      btn.setAttribute('aria-label', '이 답변 수정');
      btn.dataset.savingEdit = String(stepIdx);
      btn.innerHTML = '<span></span><span class="ms">edit</span>';
      btn.firstChild.textContent = text;
      btn.addEventListener('click', function () { savingRewindTo(stepIdx); });
      row.appendChild(btn);
      savingChat.appendChild(row);
    }

    // 특정 스텝 답변을 수정: 그 스텝 이후 대화·상태·결과 카드 다 지우고 그 스텝을 다시 렌더
    function savingRewindTo(stepIdx) {
      if (stepIdx < 0 || stepIdx > savingState.answers.length) return;
      savingState.step = stepIdx;
      savingState.answers = savingState.answers.slice(0, stepIdx);
      savingClearBottomCards();
      savingChat.hidden = false;
      savingOptions.hidden = false;
      savingChat.innerHTML = '';
      for (var i = 0; i < savingState.step; i++) {
        savingAppendBotRow(SAVING_STEPS[i].bubble);
        savingAppendUserRow(savingState.answers[i].label, i);
      }
      savingRenderStep(savingState.step);
    }

    function savingScrollBottom() {
      requestAnimationFrame(function () {
        savingChat.scrollTop = savingChat.scrollHeight;
      });
    }

    function savingSetProgress(i) {
      var cur = Math.min(i + 1, SAVING_TOTAL);
      savingProgress.textContent = cur;
      if (savingBar) savingBar.style.width = (cur / SAVING_TOTAL * 100) + '%';
    }

    function savingRenderStep(i) {
      var step = SAVING_STEPS[i];
      savingSetProgress(i);
      savingAppendBotRow(step.bubble);
      savingOptions.innerHTML = '';
      step.options.forEach(function (opt) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'saving-option';
        b.textContent = opt.label;
        b.addEventListener('click', function () { savingPick(opt, b); });
        savingOptions.appendChild(b);
      });
      savingScrollBottom();
    }

    function savingPick(opt, btn) {
      // 선택 시각화(체크마크) + 다른 옵션 잠금. 뒤로가기 전까진 그대로 유지.
      Array.prototype.forEach.call(savingOptions.querySelectorAll('.saving-option'), function (b) {
        b.disabled = true;
      });
      if (btn) btn.classList.add('is-picked');
      savingState.answers.push({ step: savingState.step, value: opt.value, label: opt.label });
      savingAppendUserRow(opt.label, savingState.step);
      savingScrollBottom();
      savingState.step += 1;
      // 챗봇 리듬 — 살짝 지연 후 다음 스텝
      setTimeout(function () {
        if (savingState.step >= SAVING_TOTAL) savingShowResult();
        else savingRenderStep(savingState.step);
      }, 420);
    }

    // 답변 구성에 따라 히어로 프레임 문구를 동적으로 결정.
    function bundleFrame(answers) {
      var mobile = (answers[0] || {}).value;
      var inet = (answers[1] || {}).value;
      var tv = (answers[2] || {}).value;
      var isMoving = ['skt','kt','lgu'].indexOf(inet) >= 0 && inet !== mobile;
      var isBundlingTV = tv === 'different';
      if (isMoving && isBundlingTV) return '통신사 이동하고 결합하면';
      if (isMoving) return '통신사 이동하면';
      if (isBundlingTV) return 'TV까지 결합하면';
      if (tv === 'same_as_internet') return '지금 결합 유지하면';
      return '지금 상태 그대로도';
    }

    // 이동 지원금 목업 — 통신사 이동/TV 신규 결합 시 일회성 지급 가정.
    function bundleSubsidy(answers) {
      var mobile = (answers[0] || {}).value;
      var inet = (answers[1] || {}).value;
      var tv = (answers[2] || {}).value;
      if (mobile === 'mvno' || mobile === 'none') return 0;
      var s = 0;
      var isMovingInternet = ['skt','kt','lgu'].indexOf(inet) >= 0 && inet !== mobile;
      if (isMovingInternet) s += 200000;
      if (tv === 'different') s += 80000;
      return s;
    }

    // Bundle 결과 데이터 통합 계산. 2년 약정(24개월) 기준.
    function bundleExt(answers) {
      var currentAns = answers[3]; // step 3 = 매달 요금
      var currentMonthly = 0;
      if (currentAns && currentFlow.currentMonthly) {
        currentMonthly = currentFlow.currentMonthly[currentAns.value] || 0;
      }
      var monthlySavings = savingMonthlySavings(answers);
      var projectedMonthly = Math.max(0, currentMonthly - monthlySavings);
      var twoYearSavings = monthlySavings * 24;
      var subsidy = bundleSubsidy(answers);
      return {
        frame: bundleFrame(answers),
        currentMonthly: currentMonthly,
        projectedMonthly: projectedMonthly,
        monthlySavings: monthlySavings,
        twoYearSavings: twoYearSavings,
        subsidy: subsidy,
        totalBenefit: twoYearSavings + subsidy
      };
    }

    // 2년 약정 기간 동안 월요금이 지금→바꾸면 으로 하락하는 라인 그래프 SVG.
    function bundleChartSVG(ext) {
      var W = 300, H = 92;
      var padL = 6, padR = 6, padT = 14, padB = 14;
      var chartLeft = padL;
      var chartRight = W - padR;
      var chartTop = padT;
      var chartBot = H - padB;

      var current = ext.currentMonthly;
      var projected = ext.projectedMonthly;
      var ratio = current > 0 ? projected / current : 1;
      var topY = chartTop;
      var botY = chartTop + (chartBot - chartTop) * (1 - ratio);
      if (botY > chartBot - 4) botY = chartBot - 4;

      // 드롭 지점 (가입 직후) — 전체 폭의 ~10% ~ 25% 사이에서 커브
      var dropStartX = chartLeft + (chartRight - chartLeft) * 0.10;
      var dropEndX   = chartLeft + (chartRight - chartLeft) * 0.24;

      var linePath =
        'M ' + chartLeft + ' ' + topY +
        ' L ' + dropStartX + ' ' + topY +
        ' C ' + (dropStartX + 14) + ' ' + topY + ',' +
              ' ' + (dropEndX - 14) + ' ' + botY + ',' +
              ' ' + dropEndX + ' ' + botY +
        ' L ' + chartRight + ' ' + botY;
      var fillPath = linePath +
        ' L ' + chartRight + ' ' + chartBot +
        ' L ' + chartLeft + ' ' + chartBot + ' Z';

      return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart-svg" preserveAspectRatio="none">' +
        '<defs>' +
          '<linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="#0D76FF" stop-opacity="0.22"/>' +
            '<stop offset="1" stop-color="#0D76FF" stop-opacity="0"/>' +
          '</linearGradient>' +
        '</defs>' +
        '<path d="' + fillPath + '" fill="url(#chartFill)"/>' +
        '<path d="' + linePath + '" fill="none" stroke="#0D76FF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<circle cx="' + chartLeft + '" cy="' + topY + '" r="3.5" fill="#0D76FF"/>' +
        '<circle cx="' + chartRight + '" cy="' + botY + '" r="3.5" fill="#0D76FF"/>' +
      '</svg>';
    }

    function bundleVisualHTML(ext) {
      if (!ext || ext.currentMonthly <= 0) return '';
      var currentStr   = ext.currentMonthly.toLocaleString('ko-KR');
      var projectedStr = ext.projectedMonthly.toLocaleString('ko-KR');
      var monthlyStr   = ext.monthlySavings.toLocaleString('ko-KR');
      var twoYearStr   = ext.twoYearSavings.toLocaleString('ko-KR');
      var subsidyStr   = ext.subsidy.toLocaleString('ko-KR');
      var totalStr     = ext.totalBenefit.toLocaleString('ko-KR');

      var subsidyRow = ext.subsidy > 0
        ? '<div class="bd-row"><span>통신사 이동 지원금</span><b>+' + subsidyStr + '원</b></div>'
        : '';

      return '<div class="benefit-detail-card">' +
        '<div class="section-title">월요금이 2년 동안 이렇게 낮아져요</div>' +
        '<div class="bundle-chart">' +
          '<div class="chart-legend">' +
            '<div class="cl-item cl-item--now">' +
              '<span class="cl-tag">지금</span><b>' + currentStr + '원</b>' +
            '</div>' +
            '<div class="cl-item cl-item--after">' +
              '<span class="cl-tag">바꾸면</span><b>' + projectedStr + '원</b>' +
            '</div>' +
          '</div>' +
          bundleChartSVG(ext) +
          '<div class="chart-xaxis">' +
            '<span>가입</span><span>12개월</span><span>24개월</span>' +
          '</div>' +
        '</div>' +
        '<div class="bd-divider"></div>' +
        '<div class="bd-rows">' +
          '<div class="bd-row"><span>월요금 할인</span><b>매달 -' + monthlyStr + '원</b></div>' +
          '<div class="bd-row"><span>2년 요금 절감</span><b>' + twoYearStr + '원</b></div>' +
          subsidyRow +
          '<div class="bd-divider bd-divider--strong"></div>' +
          '<div class="bd-row bd-row--total"><span>받을 수 있는 총 혜택</span><b>' + totalStr + '원</b></div>' +
        '</div>' +
      '</div>';
    }

    // 공용 폼 필드 HTML (이름/전번/동의) — 통합 화면, 분리 폼 화면 둘 다 사용
    function savingFormFieldsHTML() {
      return '<label class="plan-field"><span>이름</span>' +
        '<input type="text" data-plan-name placeholder="예: 김영희" autocomplete="name"></label>' +
        '<label class="plan-field"><span>휴대폰 번호</span>' +
        '<input type="tel" data-plan-phone placeholder="010-1234-5678" inputmode="tel" autocomplete="tel"></label>' +
        '<div class="plan-consent">' +
          '<label class="consent-check">' +
            '<input type="checkbox" data-plan-consent>' +
            '<span class="consent-box"><span class="ms">check</span></span>' +
            '<span>개인정보 수집·이용 동의 <em>(필수)</em></span>' +
          '</label>' +
          '<button type="button" data-plan-consent-view class="consent-view">원문 보기</button>' +
        '</div>';
    }

    // 폼 필드 → submit 활성/제출 이벤트 배선. 두 화면(unified/form-only)에서 공유.
    function savingWireForm(panel) {
      var nameInput = panel.querySelector('[data-plan-name]');
      var phoneInput = panel.querySelector('[data-plan-phone]');
      var consentInput = panel.querySelector('[data-plan-consent]');
      var consentView = panel.querySelector('[data-plan-consent-view]');
      var submitBtn = panel.querySelector('[data-plan-submit]');
      function refreshSubmit() {
        submitBtn.disabled = !(
          nameInput.value.trim() &&
          phoneInput.value.trim() &&
          consentInput.checked
        );
      }
      nameInput.addEventListener('input', refreshSubmit);
      phoneInput.addEventListener('input', refreshSubmit);
      consentInput.addEventListener('change', refreshSubmit);
      consentView.addEventListener('click', function () {
        // TODO 개인정보 수집·이용 동의 원문 URL 확정되면 연결
        var url = consentView.dataset.url;
        if (url) window.open(url, '_blank', 'noopener');
      });
      submitBtn.addEventListener('click', function () {
        if (submitBtn.disabled) return;
        savingShowDone(nameInput.value.trim());
      });
    }

    function savingShowResult() {
      // 채팅 접고 결과 화면으로.
      // unified(saving): 히어로 + 요약 + 폼 인라인
      // split(bundle):   히어로(크게) + 요약 + "지원금 신청하기" CTA (폼은 다음 화면)
      savingOptions.innerHTML = '';
      savingOptions.hidden = true;
      savingChat.hidden = true;
      if (savingBar) savingBar.style.width = '100%';
      savingProgress.textContent = SAVING_TOTAL;
      savingClearBottomCards();

      var mo = savingMonthlySavings(savingState.answers);
      var amt = savingFinalAmount(savingState.answers);
      var isSplit = currentFlow.resultLayout === 'split';
      var ext = isSplit ? bundleExt(savingState.answers) : null;
      var hero = currentFlow.hero(amt, mo, ext);

      var summaryRows = savingState.answers.map(function (a) {
        return '<li><span>' + SAVING_STEPS[a.step].key + '</span>' +
               '<b>' + a.label + '</b></li>';
      }).join('');

      // Split(혜택) 결과 화면 — 지금/바꾸면 비교 카드 + 이동 지원금 콜아웃
      var breakdownHTML = isSplit ? bundleVisualHTML(ext) : '';

      var afterSummary = '';
      var actions = '';
      if (isSplit) {
        actions =
          '<div class="final-actions">' +
            '<button type="button" class="cta-secondary" data-saving-restart>다시 계산</button>' +
            '<button type="button" class="cta-primary" data-goto-form>' +
              currentFlow.resultCtaLabel + ' <span class="ms">arrow_forward</span></button>' +
          '</div>';
      } else {
        afterSummary =
          '<div class="panel-divider"></div>' +
          '<div class="panel-section">' +
            '<div class="section-title">' + currentFlow.sectionTitle + '</div>' +
            '<div class="section-sub">' + currentFlow.sectionSub + '</div>' +
            savingFormFieldsHTML() +
          '</div>';
        actions =
          '<div class="final-actions">' +
            '<button type="button" class="cta-secondary" data-saving-restart>다시 계산</button>' +
            '<button type="button" class="cta-primary" data-plan-submit disabled>' +
              currentFlow.ctaLabel + '</button>' +
          '</div>';
      }

      var heroIconHTML = hero.icon
        ? '<div class="final-hero__icon"><span class="ms">' + hero.icon + '</span></div>'
        : '';

      // Split(bundle) 는 도식화 카드가 요약을 대체. 요약 섹션은 unified(saving) 에만.
      var summaryPanel = isSplit ? '' :
        '<div class="final-panel">' +
          '<div class="panel-section">' +
            '<div class="section-title">내가 답한 내용</div>' +
            '<ul class="summary-list">' + summaryRows + '</ul>' +
          '</div>' +
          afterSummary +
        '</div>';

      var panel = document.createElement('div');
      panel.className = 'saving-final';
      panel.innerHTML =
        '<div class="final-hero">' +
          heroIconHTML +
          '<div class="eyebrow">' + hero.eyebrow + '</div>' +
          '<div class="amount">' + hero.amount + '</div>' +
          '<div class="memo">' + hero.memo + '</div>' +
        '</div>' +
        breakdownHTML +
        summaryPanel +
        actions;
      savingFlow.appendChild(panel);

      panel.querySelector('[data-saving-restart]').addEventListener('click', savingReset);
      if (isSplit) {
        panel.querySelector('[data-goto-form]').addEventListener('click', savingShowForm);
      } else {
        savingWireForm(panel);
      }
    }

    // Split flow 전용 — 폼만 있는 2번째 화면.
    // 상단에 미니 리마인더(지원금 금액)만 얹고 나머진 폼 + 제출 하나.
    function savingShowForm() {
      savingClearBottomCards();
      savingChat.hidden = true;

      var mo = savingMonthlySavings(savingState.answers);
      var amt = savingFinalAmount(savingState.answers);
      var ext = currentFlow.resultLayout === 'split' ? bundleExt(savingState.answers) : null;
      var hero = currentFlow.hero(amt, mo, ext);

      var panel = document.createElement('div');
      panel.className = 'saving-final is-form-only';
      panel.innerHTML =
        '<div class="mini-hero">' +
          '<div class="mini-hero__label">' + hero.eyebrow + '</div>' +
          '<div class="mini-hero__amount">' + hero.amount + '</div>' +
        '</div>' +
        '<div class="final-panel">' +
          '<div class="panel-section">' +
            '<div class="section-title">' + currentFlow.sectionTitle + '</div>' +
            '<div class="section-sub">' + currentFlow.sectionSub + '</div>' +
            savingFormFieldsHTML() +
          '</div>' +
        '</div>' +
        '<div class="final-actions is-single">' +
          '<button type="button" class="cta-primary" data-plan-submit disabled>' +
            currentFlow.ctaLabel + '</button>' +
        '</div>';
      savingFlow.appendChild(panel);
      savingWireForm(panel);
    }

    // 최종 패널·완료 카드 정리
    function savingClearBottomCards() {
      ['.saving-final', '.saving-done'].forEach(function (sel) {
        var el = savingFlow.querySelector(sel);
        if (el) el.remove();
      });
    }

    function savingShowDone(name) {
      savingClearBottomCards();
      savingChat.hidden = true;
      var panel = document.createElement('div');
      panel.className = 'saving-done';
      var who = name ? name + '님' : '고객님';
      panel.innerHTML =
        '<div class="done-icon"><span class="ms is-filled">check_circle</span></div>' +
        '<div class="done-title">신청이 접수됐어요</div>' +
        '<div class="done-memo"><b>' + who + '</b>께<br>위플랫 담당자가 곧 연락드릴 거예요.<br>' +
        '<small>보통 영업일 기준 1~2일 안에 연락드려요</small></div>' +
        '<button type="button" data-done-close>확인</button>';
      savingFlow.appendChild(panel);
      panel.querySelector('[data-done-close]').addEventListener('click', savingClose_);
    }

    function savingReset() {
      savingState = { step: 0, answers: [] };
      savingChat.innerHTML = '';
      savingChat.hidden = false;
      savingOptions.innerHTML = '';
      savingOptions.hidden = false;
      savingClearBottomCards();
      savingRenderStep(0);
    }

    function savingOpen(mode) {
      // mode: 'saving' | 'bundle' — 어느 카드에서 진입했는지에 따라 세트 스위치
      var flow = FLOWS[mode] || FLOWS.saving;
      currentFlow = flow;
      SAVING_STEPS = flow.steps;
      SAVING_CONTRIB = flow.contrib;
      SAVING_TOTAL = SAVING_STEPS.length;
      if (savingTitleEl) savingTitleEl.textContent = flow.title;
      if (savingTotalEl) savingTotalEl.textContent = SAVING_TOTAL;
      if (savingHome) savingHome.hidden = true;
      if (savingHeader) savingHeader.hidden = true;
      savingFlow.hidden = false;
      savingReset();
    }
    function savingClose_() {
      savingFlow.hidden = true;
      if (savingHeader) savingHeader.hidden = false;
      if (savingHome) savingHome.hidden = false;
    }

    function savingGoBack() {
      // 완료 카드에서 뒤로 = 이미 신청 끝났으니 그냥 닫기
      if (savingFlow.querySelector('.saving-done')) { savingClose_(); return; }
      // Split flow 폼 화면에서 뒤로 = 결과 화면으로 복귀
      var formOnly = savingFlow.querySelector('.saving-final.is-form-only');
      if (formOnly) { formOnly.remove(); savingShowResult(); return; }
      // 결과 화면에서 뒤로 = 마지막 스텝 질문으로 복귀
      var final = savingFlow.querySelector('.saving-final');
      if (final) {
        final.remove();
        savingState.step = SAVING_TOTAL - 1;
        savingState.answers.pop();
      } else if (savingState.step === 0) {
        savingClose_();
        return;
      } else {
        savingState.step -= 1;
        savingState.answers.pop();
      }
      savingChat.hidden = false;
      savingOptions.hidden = false;
      savingChat.innerHTML = '';
      for (var i = 0; i < savingState.step; i++) {
        savingAppendBotRow(SAVING_STEPS[i].bubble);
        savingAppendUserRow(savingState.answers[i].label, i);
      }
      savingRenderStep(savingState.step);
    }

    var savingRestartTop = savingFlow.querySelector('[data-saving-restart-top]');
    if (savingStart) savingStart.addEventListener('click', function () { savingOpen('saving'); });
    if (bundleStart) bundleStart.addEventListener('click', function () { savingOpen('bundle'); });
    if (savingClose) savingClose.addEventListener('click', savingClose_);
    if (savingBack) savingBack.addEventListener('click', savingGoBack);
    if (savingRestartTop) savingRestartTop.addEventListener('click', savingReset);
  }

  // ─────────────────────────────────────────────────────────────
  // 혜택 탭 세 번째 카드 — 내게 맞는 상품 찾기 (quiz 타일 흐름)
  //   챗봇 대신 카테고리별 타일 그리드에서 하나씩 선택 → 결과 추천 카드.
  //   목업 추천 로직은 planRecommend*() 두 개만 교체하면 실계산과 연결됨.
  // ─────────────────────────────────────────────────────────────
  var planFlow = document.querySelector('[data-plan-flow]');
  if (planFlow) {
    var planStart = document.querySelector('[data-plan-start]');
    var planBack = planFlow.querySelector('[data-plan-back]');
    var planClose = planFlow.querySelector('[data-plan-close]');
    var planBody = planFlow.querySelector('[data-plan-body]');
    var planFooter = planFlow.querySelector('[data-plan-footer]');
    var planHome = document.querySelector('[data-benefit-home]');
    var planHeader = document.querySelector('.screen[data-screen="benefit"] .screen-header');

    // layout: 'tiles' | 'list' | 'chips' | 'people' | 'cards'
    // 카테고리마다 다른 UI 패턴 — 반복 지루함 해소.
    var PLAN_CATEGORIES = [
      {
        key: 'tv',
        layout: 'tiles',
        title: 'TV, 주로 어떻게 보세요?',
        subtitle: '가장 자주 보는 콘텐츠로 골라주세요',
        options: [
          { icon: 'newspaper',      label: '뉴스·시사',    value: 'news' },
          { icon: 'theaters',       label: '드라마·예능',   value: 'drama' },
          { icon: 'sports_soccer',  label: '스포츠',       value: 'sports' },
          { icon: 'movie',          label: '영화·시리즈',   value: 'binge' }
        ]
      },
      {
        key: 'internet',
        layout: 'list',
        title: '인터넷은 뭐 하실 때 쓰세요?',
        subtitle: '가장 많이 하시는 걸로 골라주세요',
        options: [
          { icon: 'search',          label: '검색·메시지',    sub: '가끔 검색하고 카톡 정도',       value: 'light' },
          { icon: 'play_circle',     label: '유튜브·SNS',     sub: '영상 자주 보고 SNS 사용',       value: 'video' },
          { icon: 'shopping_cart',   label: '쇼핑·뱅킹',      sub: '온라인 쇼핑·인터넷 뱅킹',       value: 'shop' },
          { icon: 'sports_esports',  label: '게임·재택근무',   sub: '고속·안정성 있게 써야 해요',    value: 'heavy' }
        ]
      },
      {
        key: 'mobile',
        layout: 'chips',
        title: '휴대폰은 주로 어떻게 쓰세요?',
        subtitle: '가장 많이 하는 걸로',
        options: [
          { icon: 'call',    label: '통화·문자',   value: 'basic' },
          { icon: 'chat',    label: '카톡·유튜브',  value: 'chat' },
          { icon: 'map',     label: '지도·사진',   value: 'nav' },
          { icon: 'stream',  label: '게임·영상',   value: 'heavy' }
        ]
      },
      {
        key: 'family',
        layout: 'people',
        title: '집에 몇 분이세요?',
        subtitle: '결합 인원이 많을수록 할인 폭이 커요',
        options: [
          { count: 1, label: '혼자',      value: 'alone' },
          { count: 2, label: '2명',       value: 'couple' },
          { count: 3, label: '3~4명',     value: 'family',  icon: 'groups' },
          { count: 5, label: '5명 이상',  value: 'many',    icon: 'family_restroom' }
        ]
      },
      {
        key: 'priority',
        layout: 'cards',
        title: '뭐가 제일 중요해요?',
        subtitle: '이거 하나만 고르면 끝나요',
        options: [
          { icon: 'payments',            label: '저렴하게',   sub: '월 요금을 최대한 낮추기',     value: 'price' },
          { icon: 'speed',               label: '빠르게',     sub: '인터넷·모바일 속도 우선',      value: 'speed' },
          { icon: 'signal_cellular_alt', label: '데이터 많이', sub: '모바일·인터넷 넉넉하게',      value: 'data' },
          { icon: 'redeem',              label: '부가 혜택',   sub: 'OTT·멤버십·포인트 등',        value: 'perks' }
        ]
      }
    ];

    // 3사 요금제 목업 카탈로그. 답변 조합에 맞춰 골라내는 용도.
    // 실제 요금제 데이터 연결 시 이 배열만 실제 catalog 로 교체.
    var PLAN_CATALOG = [
      {
        carrier: 'SKT',  logo: 'SK', name: '5G 시그니처 결합',
        monthly: 118000,
        features: ['모바일 데이터 무제한', 'IPTV 프리미엄', '인터넷 1G'],
        fit: { priority:['perks','speed','data'], mobile:['heavy'], tv:['binge','sports'], family:['couple','family','many'] }
      },
      {
        carrier: 'KT',   logo: 'KT', name: '가족 프리미엄 결합',
        monthly: 105000,
        features: ['모바일 무제한 × 4', 'IPTV 프리미엄', '인터넷 500M'],
        fit: { priority:['perks','data'], family:['family','many'], tv:['drama','binge'] }
      },
      {
        carrier: 'SKT',  logo: 'SK', name: '5G 스탠다드 결합',
        monthly: 95000,
        features: ['모바일 데이터 100GB', 'IPTV 시그니처', '인터넷 500M'],
        fit: { priority:['speed','data'], mobile:['chat','nav','photo'], tv:['drama','sports'] }
      },
      {
        carrier: 'KT',   logo: 'KT', name: '결합 베이직',
        monthly: 75000,
        features: ['모바일 10GB', 'IPTV 베이직', '인터넷 500M'],
        fit: { priority:['price'], mobile:['chat','nav'], tv:['news','drama'], family:['couple','family'] }
      },
      {
        carrier: 'LG U+', logo: 'LG', name: '가족 실속 결합',
        monthly: 68000,
        features: ['모바일 5GB × 2', 'IPTV 스탠다드', '인터넷 500M'],
        fit: { priority:['price'], family:['couple','family'], mobile:['basic','chat'] }
      },
      {
        carrier: 'LG U+', logo: 'LG', name: '싱글 라이트',
        monthly: 48000,
        features: ['모바일 3GB', 'IPTV 라이트', '인터넷 100M'],
        fit: { priority:['price'], family:['alone'], mobile:['basic'], tv:['news','none'] }
      }
    ];

    var planAnswers = {};
    var planStep = 0;

    // 답변 vs 각 요금제 fit 룰 매칭 점수. 점수가 높을수록 잘 맞음.
    function planFitScore(plan, answers) {
      var score = 0;
      Object.keys(plan.fit || {}).forEach(function (k) {
        if (plan.fit[k].indexOf(answers[k]) >= 0) score += (k === 'priority' ? 3 : 1);
      });
      return score;
    }

    function planRecommend(answers) {
      var scored = PLAN_CATALOG.map(function (p) {
        return { plan: p, score: planFitScore(p, answers) };
      }).sort(function (a, b) { return b.score - a.score; });
      // 매치율(%)은 목업 — 최고 점수 대비 상대 스코어 + 기본 80.
      var top = scored[0];
      var maxScore = 6;
      return scored.map(function (s, i) {
        return {
          plan: s.plan,
          match: Math.min(99, 80 + Math.round(s.score / maxScore * 19))
        };
      });
    }

    function planEscape(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
      });
    }

    // 카테고리 layout 별로 옵션 HTML 렌더링. 같은 데이터, 다른 시각 리듬.
    function planRenderOptions(cat, picked) {
      var opts = cat.options;
      var pickedCls = function (v) { return v === picked ? ' is-picked' : ''; };

      if (cat.layout === 'tiles') {
        return '<div class="opt-tiles">' + opts.map(function (o) {
          return '<button type="button" class="opt-tile' + pickedCls(o.value) + '" data-value="' + o.value + '">' +
            '<span class="ms">' + o.icon + '</span>' +
            '<span class="tile-label">' + planEscape(o.label) + '</span>' +
          '</button>';
        }).join('') + '</div>';
      }
      if (cat.layout === 'list') {
        return '<div class="opt-list">' + opts.map(function (o) {
          return '<button type="button" class="opt-list-item' + pickedCls(o.value) + '" data-value="' + o.value + '">' +
            '<div class="oli-icon"><span class="ms">' + o.icon + '</span></div>' +
            '<div class="oli-body">' +
              '<div class="oli-label">' + planEscape(o.label) + '</div>' +
              (o.sub ? '<div class="oli-sub">' + planEscape(o.sub) + '</div>' : '') +
            '</div>' +
            '<span class="ms oli-chev">chevron_right</span>' +
          '</button>';
        }).join('') + '</div>';
      }
      if (cat.layout === 'chips') {
        return '<div class="opt-chips">' + opts.map(function (o) {
          return '<button type="button" class="opt-chip' + pickedCls(o.value) + '" data-value="' + o.value + '">' +
            '<span class="ms">' + o.icon + '</span>' + planEscape(o.label) +
          '</button>';
        }).join('') + '</div>';
      }
      if (cat.layout === 'people') {
        return '<div class="opt-people">' + opts.map(function (o) {
          var figs = '';
          if (o.icon) {
            figs = '<span class="ms">' + o.icon + '</span>';
          } else {
            for (var i = 0; i < o.count; i++) figs += '<span class="ms">person</span>';
          }
          return '<button type="button" class="opt-person' + pickedCls(o.value) + '" data-value="' + o.value + '">' +
            '<div class="op-figs">' + figs + '</div>' +
            '<div class="op-label">' + planEscape(o.label) + '</div>' +
          '</button>';
        }).join('') + '</div>';
      }
      if (cat.layout === 'cards') {
        return '<div class="opt-cards">' + opts.map(function (o) {
          return '<button type="button" class="opt-card' + pickedCls(o.value) + '" data-value="' + o.value + '">' +
            '<div class="oc-icon"><span class="ms">' + o.icon + '</span></div>' +
            '<div class="oc-label">' + planEscape(o.label) + '</div>' +
            (o.sub ? '<div class="oc-sub">' + planEscape(o.sub) + '</div>' : '') +
          '</button>';
        }).join('') + '</div>';
      }
      return '';
    }

    // 한 화면 = 한 카테고리. 선택하면 자동 다음 스텝. planStep === length 면 결과로.
    function planRenderScreen() {
      if (planStep >= PLAN_CATEGORIES.length) { planRenderResult(); return; }
      var cat = PLAN_CATEGORIES[planStep];
      var picked = planAnswers[cat.key];

      var dots = PLAN_CATEGORIES.map(function (_, i) {
        var s = i < planStep ? 'is-done' : i === planStep ? 'is-active' : '';
        return '<span class="ps-dot ' + s + '"></span>';
      }).join('');

      planBody.innerHTML =
        '<div class="plan-screen" data-layout="' + cat.layout + '">' +
          '<div class="ps-meta">' +
            '<div class="ps-num">' + (planStep + 1) + ' / ' + PLAN_CATEGORIES.length + '</div>' +
            '<div class="ps-dots">' + dots + '</div>' +
          '</div>' +
          '<h2 class="ps-title">' + planEscape(cat.title) + '</h2>' +
          (cat.subtitle ? '<p class="ps-sub">' + planEscape(cat.subtitle) + '</p>' : '') +
          '<div class="ps-options">' + planRenderOptions(cat, picked) + '</div>' +
        '</div>';

      // 첫 스텝은 '이전' 감춤, 이후엔 노출
      if (planStep === 0) {
        planFooter.innerHTML = '';
      } else {
        planFooter.innerHTML =
          '<button type="button" data-plan-prev class="plan-prev-btn">' +
            '<span class="ms">arrow_back</span>이전' +
          '</button>';
        planFooter.querySelector('[data-plan-prev]').addEventListener('click', function () {
          planStep -= 1;
          planRenderScreen();
        });
      }

      // 옵션 선택 → 즉시 하이라이트 → 280ms 후 다음 스텝
      Array.prototype.forEach.call(planBody.querySelectorAll('[data-value]'), function (el) {
        el.addEventListener('click', function () {
          planAnswers[cat.key] = el.getAttribute('data-value');
          Array.prototype.forEach.call(planBody.querySelectorAll('[data-value]'), function (e2) {
            e2.classList.toggle('is-picked', e2 === el);
          });
          setTimeout(function () {
            planStep += 1;
            planRenderScreen();
          }, 280);
        });
      });
    }

    function planRenderResult() {
      var results = planRecommend(planAnswers);
      var top = results[0];
      var alts = results.slice(1, 3);

      var featuresHTML = top.plan.features.map(function (f) {
        return '<li><span class="ms">check_circle</span>' + planEscape(f) + '</li>';
      }).join('');
      var altsHTML = alts.map(function (r) {
        return '<div class="plan-alt">' +
          '<div class="plan-alt__logo">' + planEscape(r.plan.logo) + '</div>' +
          '<div class="plan-alt__body">' +
            '<div class="plan-alt__name">' + planEscape(r.plan.name) + '</div>' +
            '<div class="plan-alt__meta">' + planEscape(r.plan.carrier) + ' · 매치율 ' + r.match + '%</div>' +
          '</div>' +
          '<div class="plan-alt__price">' + r.plan.monthly.toLocaleString('ko-KR') + '<small>원 / 월</small></div>' +
        '</div>';
      }).join('');

      planBody.innerHTML =
        '<div class="plan-result">' +
          '<div class="result-hero">' +
            '<div class="eyebrow">답변에 딱 맞는 요금제</div>' +
            '<div class="headline">이 조합이<br><b>가장 잘 맞아요</b></div>' +
          '</div>' +
          '<div class="plan-card">' +
            '<div class="plan-card__head">' +
              '<div class="plan-card__logo">' + planEscape(top.plan.logo) + '</div>' +
              '<div class="plan-card__title">' +
                '<div class="plan-card__carrier">' + planEscape(top.plan.carrier) + '</div>' +
                '<div class="plan-card__name">' + planEscape(top.plan.name) + '</div>' +
              '</div>' +
              '<div class="plan-card__match">' + top.match + '%</div>' +
            '</div>' +
            '<div class="plan-card__price">' +
              '<span class="price-label">월 결합 요금</span>' +
              '<span class="price-value">' + top.plan.monthly.toLocaleString('ko-KR') + '</span>' +
              '<span class="price-unit">원</span>' +
            '</div>' +
            '<ul class="plan-card__features">' + featuresHTML + '</ul>' +
          '</div>' +
          (altsHTML ?
            '<div class="plan-alts">' +
              '<div class="alts-title">이런 옵션도 있어요</div>' +
              altsHTML +
            '</div>' : '') +
        '</div>';

      planFooter.innerHTML =
        '<button type="button" data-plan-consult class="plan-submit-btn">' +
          '이 요금제로 상담 받기 <span class="ms">arrow_forward</span>' +
        '</button>';
      planFooter.querySelector('[data-plan-consult]').addEventListener('click', planRenderDone);
    }

    function planRenderDone() {
      planBody.innerHTML =
        '<div class="plan-done">' +
          '<div class="done-icon"><span class="ms is-filled">check_circle</span></div>' +
          '<div class="done-title">상담 신청이 접수됐어요</div>' +
          '<div class="done-memo">위플랫 담당자가 곧 연락드려서<br>이 요금제로 옮길 수 있는지 안내해드릴게요.<br>' +
          '<small>보통 영업일 기준 1~2일 안에 연락드려요</small></div>' +
        '</div>';
      planFooter.innerHTML =
        '<button type="button" data-plan-done-close class="plan-submit-btn">확인</button>';
      planFooter.querySelector('[data-plan-done-close]').addEventListener('click', planClose_);
    }

    function planOpen() {
      if (planHome) planHome.hidden = true;
      if (planHeader) planHeader.hidden = true;
      planFlow.hidden = false;
      planAnswers = {};
      planStep = 0;
      planRenderScreen();
    }
    function planClose_() {
      planFlow.hidden = true;
      if (planHeader) planHeader.hidden = false;
      if (planHome) planHome.hidden = false;
    }
    function planGoBack() {
      // done → 닫기
      if (planBody.querySelector('.plan-done')) { planClose_(); return; }
      // result → 마지막 스텝 질문으로
      if (planBody.querySelector('.plan-result')) {
        planStep = PLAN_CATEGORIES.length - 1;
        planRenderScreen();
        return;
      }
      // quiz 첫 스텝 → 닫기, 그 외 → 이전 스텝
      if (planStep === 0) { planClose_(); return; }
      planStep -= 1;
      planRenderScreen();
    }

    if (planStart) planStart.addEventListener('click', planOpen);
    if (planBack) planBack.addEventListener('click', planGoBack);
    if (planClose) planClose.addEventListener('click', planClose_);
  }

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
