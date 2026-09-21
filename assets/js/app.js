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
          '<div class="plan-alt__logo"><img src="assets/' + planEscape(r.plan.logo) + '.svg" alt="' + planEscape(r.plan.carrier) + '"></div>' +
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
              '<div class="plan-card__logo"><img src="assets/' + planEscape(top.plan.logo) + '.svg" alt="' + planEscape(top.plan.carrier) + '"></div>' +
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
      planFooter.querySelector('[data-plan-consult]').addEventListener('click', planRenderForm);
    }

    // 요약 + 이름/전번 입력 폼 화면 — 결과 화면에서 CTA 누르면 여기로 넘어옴.
    var PLAN_SUMMARY_LABELS = {
      tv: 'TV', internet: '인터넷', mobile: '휴대폰',
      family: '가구원', priority: '중요한 점'
    };
    function planRenderForm() {
      var results = planRecommend(planAnswers);
      var top = results[0];

      var summaryRows = PLAN_CATEGORIES.map(function (cat) {
        var pickedVal = planAnswers[cat.key];
        var pickedOpt = cat.options.filter(function (o) { return o.value === pickedVal; })[0];
        if (!pickedOpt) return '';
        return '<li><span>' + planEscape(PLAN_SUMMARY_LABELS[cat.key] || cat.key) + '</span>' +
               '<b>' + planEscape(pickedOpt.label) + '</b></li>';
      }).join('');

      planBody.innerHTML =
        '<div class="plan-form-view">' +
          '<div class="plan-mini">' +
            '<div class="plan-mini__logo"><img src="assets/' + planEscape(top.plan.logo) + '.svg" alt="' + planEscape(top.plan.carrier) + '"></div>' +
            '<div class="plan-mini__body">' +
              '<div class="plan-mini__carrier">' + planEscape(top.plan.carrier) + '</div>' +
              '<div class="plan-mini__name">' + planEscape(top.plan.name) + '</div>' +
            '</div>' +
            '<div class="plan-mini__price">' + top.plan.monthly.toLocaleString('ko-KR') + '<small>원 / 월</small></div>' +
          '</div>' +
          '<div class="plan-form-panel">' +
            '<div class="panel-section">' +
              '<div class="section-title">내가 답한 내용</div>' +
              '<ul class="summary-list">' + summaryRows + '</ul>' +
            '</div>' +
            '<div class="panel-divider"></div>' +
            '<div class="panel-section">' +
              '<div class="section-title">신청자 정보</div>' +
              '<div class="section-sub">담당자가 연락드릴 때 사용해요</div>' +
              '<label class="plan-field"><span>이름</span>' +
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
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';

      planFooter.innerHTML =
        '<button type="button" data-plan-submit class="plan-submit-btn" disabled>신청하기</button>';

      var nameInput = planBody.querySelector('[data-plan-name]');
      var phoneInput = planBody.querySelector('[data-plan-phone]');
      var consentInput = planBody.querySelector('[data-plan-consent]');
      var consentView = planBody.querySelector('[data-plan-consent-view]');
      var submitBtn = planFooter.querySelector('[data-plan-submit]');
      function refresh() {
        submitBtn.disabled = !(
          nameInput.value.trim() &&
          phoneInput.value.trim() &&
          consentInput.checked
        );
      }
      nameInput.addEventListener('input', refresh);
      phoneInput.addEventListener('input', refresh);
      consentInput.addEventListener('change', refresh);
      consentView.addEventListener('click', function () {
        var url = consentView.dataset.url;
        if (url) window.open(url, '_blank', 'noopener');
      });
      submitBtn.addEventListener('click', function () {
        if (submitBtn.disabled) return;
        planRenderDone(nameInput.value.trim());
      });
    }

    function planRenderDone(name) {
      var who = name ? planEscape(name) + '님' : '고객님';
      planBody.innerHTML =
        '<div class="plan-done">' +
          '<div class="done-icon"><span class="ms is-filled">check_circle</span></div>' +
          '<div class="done-title">신청이 접수됐어요</div>' +
          '<div class="done-memo"><b>' + who + '</b>께 위플랫 담당자가 곧 연락드려서<br>이 요금제로 옮길 수 있는지 안내해드릴게요.<br>' +
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
      // form → 결과 화면으로 복귀
      if (planBody.querySelector('.plan-form-view')) { planRenderResult(); return; }
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

  // ─────────────────────────────────────────────────────────────
  // 보험 탭 — 놓친 보험금 찾기 (조회 폼 오버레이)
  //   보험 탭 히어로 CTA 누르면 카카오톡 간편인증용 조회 폼이 열림.
  // ─────────────────────────────────────────────────────────────
  var claimFlow = document.querySelector('[data-claim-flow]');
  var claimStart = document.querySelector('[data-claim-start]');
  if (claimFlow && claimStart) {
    var claimBack = claimFlow.querySelector('[data-claim-back]');
    var claimCloseEl = claimFlow.querySelector('[data-claim-close]');
    var claimSubmit = claimFlow.querySelector('[data-claim-submit]');
    var claimVerifyDone = claimFlow.querySelector('[data-claim-verify-done]');
    var claimVerifyBack = claimFlow.querySelector('[data-claim-verify-back]');
    var claimResultDone = claimFlow.querySelector('[data-claim-result-done]');
    var claimViewForm = claimFlow.querySelector('[data-claim-view="form"]');
    var claimViewVerify = claimFlow.querySelector('[data-claim-view="verify"]');
    var claimViewResult = claimFlow.querySelector('[data-claim-view="result"]');
    var claimFooterForm = claimFlow.querySelector('[data-claim-footer="form"]');
    var claimFooterVerify = claimFlow.querySelector('[data-claim-footer="verify"]');
    var claimFooterResult = claimFlow.querySelector('[data-claim-footer="result"]');
    var claimNameInput = claimFlow.querySelector('[data-claim-name]');
    var claimSsnInput = claimFlow.querySelector('[data-claim-ssn]');
    var claimPhoneInput = claimFlow.querySelector('[data-claim-phone]');
    var claimSumName = claimFlow.querySelector('[data-claim-sum-name]');
    var claimSumMeta = claimFlow.querySelector('[data-claim-sum-meta]');
    var claimAvatar = claimFlow.querySelector('[data-claim-avatar]');

    function claimFormatBirth(ssn6) {
      if (!ssn6 || ssn6.length < 6) return '';
      var yy = ssn6.slice(0, 2);
      var mm = ssn6.slice(2, 4);
      var dd = ssn6.slice(4, 6);
      var century = parseInt(yy, 10) <= 25 ? '20' : '19';
      return century + yy + '.' + mm + '.' + dd;
    }
    function claimFillSummary() {
      var name = (claimNameInput && claimNameInput.value.trim()) || '홍길동';
      var ssn = (claimSsnInput && claimSsnInput.value.trim()) || '';
      var birth = claimFormatBirth(ssn) || '1990.10.04';
      var pickedCarrier = claimFlow.querySelector('.claim-carrier.is-picked');
      var carrier = pickedCarrier ? pickedCarrier.textContent.trim() : 'SKT';
      var phone = (claimPhoneInput && claimPhoneInput.value.trim()) || '010-1234-5678';
      if (claimSumName) claimSumName.textContent = name;
      if (claimAvatar) claimAvatar.textContent = name.charAt(0);
      if (claimSumMeta) claimSumMeta.textContent = birth + ' · ' + carrier + ' · ' + phone;
    }
    function claimShowView(view) {
      var isForm = view === 'form';
      var isVerify = view === 'verify';
      var isResult = view === 'result';
      if (claimViewForm) claimViewForm.hidden = !isForm;
      if (claimViewVerify) claimViewVerify.hidden = !isVerify;
      if (claimViewResult) claimViewResult.hidden = !isResult;
      if (claimFooterForm) claimFooterForm.hidden = !isForm;
      if (claimFooterVerify) claimFooterVerify.hidden = !isVerify;
      if (claimFooterResult) claimFooterResult.hidden = !isResult;
    }
    function claimOpen() {
      claimShowView('form');
      claimFlow.hidden = false;
    }
    function claimClose_() {
      claimFlow.hidden = true;
      claimShowView('form');
    }
    function claimTopbarBack() {
      // result 뷰 = 인증까지 끝난 상태 → 그냥 닫기
      if (claimViewResult && !claimViewResult.hidden) { claimClose_(); return; }
      // verify 뷰면 폼으로
      if (claimViewVerify && !claimViewVerify.hidden) { claimShowView('form'); return; }
      claimClose_();
    }
    claimStart.addEventListener('click', claimOpen);
    if (claimBack) claimBack.addEventListener('click', claimTopbarBack);
    if (claimCloseEl) claimCloseEl.addEventListener('click', claimClose_);

    // 카카오톡으로 인증하기 → 요약 채우고 verify 뷰로 전환
    if (claimSubmit) {
      claimSubmit.addEventListener('click', function () {
        claimFillSummary();
        claimShowView('verify');
      });
    }
    // 이전 → 폼 뷰 복귀
    if (claimVerifyBack) {
      claimVerifyBack.addEventListener('click', function () { claimShowView('form'); });
    }
    // 인증 완료 → 조회 결과 뷰로 전환
    if (claimVerifyDone) {
      claimVerifyDone.addEventListener('click', function () { claimShowView('result'); });
    }
    // 결과 화면 CTA → 오버레이 닫기 (mock)
    if (claimResultDone) {
      claimResultDone.addEventListener('click', claimClose_);
    }

    // 결과 화면 — 조회년도 / 실손보험 세대 단일 선택 + 금액 재계산
    var CLAIM_GEN_DESC = {
      '1': { title: '구 실손 · ~2009.9',            body: '자기부담이 거의 없어 보장 범위가 가장 큽니다.' },
      '2': { title: '표준화 실손 · 2009.10~2017.3', body: '급여·비급여 자기부담 10~20% 수준입니다.' },
      '3': { title: '착한실손 · 2017.4~2021.6',      body: '급여 10%·비급여 20% + 특약 구조입니다.' },
      '4': { title: '4세대 실손 · 2021.7~',          body: '급여 20%·비급여 30%로 자기부담이 가장 큽니다.' }
    };
    // 년도별 의료비/받은 실손 목업 데이터
    var CLAIM_YEAR_DATA = {
      '2025': { total: 1580000, received: 892400 },
      '2024': { total: 1230500, received: 720100 },
      '2023': { total:  940200, received: 512600 },
      '2022': { total: 1122370, received: 648770 },
      '2021': { total:  782800, received: 418500 }
    };
    // 세대별 청구 가능 계수 (2세대 기준 100%, 상위/하위 세대는 커버율 차이 반영)
    var CLAIM_GEN_FACTOR = { '1': 1.10, '2': 1.00, '3': 0.88, '4': 0.75 };

    var claimResultYearRow = claimFlow.querySelector('[data-result-year]');
    var claimResultGenRow = claimFlow.querySelector('[data-result-gen]');
    var claimResultContext = claimFlow.querySelector('[data-result-context]');
    var claimResultGenTitle = claimFlow.querySelector('[data-result-gen-title]');
    var claimResultGenBody = claimFlow.querySelector('[data-result-gen-body]');
    var claimResultTotal = claimFlow.querySelector('[data-result-total]');
    var claimResultReceived = claimFlow.querySelector('[data-result-received]');
    var claimResultMissed = claimFlow.querySelector('[data-result-missed]');

    function claimFmt(n) { return Math.max(0, Math.round(n)).toLocaleString('ko-KR'); }
    function claimResultRefresh() {
      var y = claimResultYearRow && claimResultYearRow.querySelector('.claim-seg__item.is-picked');
      var g = claimResultGenRow && claimResultGenRow.querySelector('.claim-seg__item.is-picked');
      var yearVal = y ? y.dataset.year : '2022';
      var genVal = g ? g.dataset.gen : '2';
      var data = CLAIM_YEAR_DATA[yearVal] || CLAIM_YEAR_DATA['2022'];
      var factor = CLAIM_GEN_FACTOR[genVal] || 1.0;
      var missed = Math.max(0, (data.total - data.received) * factor);
      // 100원 단위로 반올림 (실제 지급 단위 감성)
      missed = Math.round(missed / 100) * 100;

      if (claimResultTotal) claimResultTotal.textContent = claimFmt(data.total);
      if (claimResultReceived) claimResultReceived.textContent = claimFmt(data.received);
      if (claimResultMissed) claimResultMissed.textContent = claimFmt(missed);
      if (claimResultContext) claimResultContext.textContent = yearVal + '년 · ' + genVal + '세대 실손보험 기준';
      var desc = CLAIM_GEN_DESC[genVal];
      if (claimResultGenTitle) claimResultGenTitle.textContent = desc ? desc.title : '';
      if (claimResultGenBody) claimResultGenBody.textContent = desc ? desc.body : '';
    }
    function claimResultBindSingle(row) {
      if (!row) return;
      var items = row.querySelectorAll('.claim-seg__item');
      items.forEach(function (c) {
        c.addEventListener('click', function () {
          items.forEach(function (o) { o.classList.remove('is-picked'); });
          c.classList.add('is-picked');
          claimResultRefresh();
        });
      });
    }
    claimResultBindSingle(claimResultYearRow);
    claimResultBindSingle(claimResultGenRow);

    // ? 인포 툴팁 — 클릭 토글, 다른 툴팁 자동 닫힘, 바깥 탭 시 전체 닫힘
    var infoBtns = claimFlow.querySelectorAll('[data-info-toggle]');
    var infoTips = claimFlow.querySelectorAll('[data-info-tip]');
    function closeAllTips() {
      infoTips.forEach(function (t) { t.hidden = true; });
    }
    infoBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var key = btn.dataset.infoToggle;
        var tip = claimFlow.querySelector('[data-info-tip="' + key + '"]');
        if (!tip) return;
        var willOpen = tip.hidden;
        closeAllTips();
        tip.hidden = !willOpen;
      });
    });
    claimFlow.addEventListener('click', function (e) {
      if (e.target.closest('[data-info-toggle]') || e.target.closest('[data-info-tip]')) return;
      closeAllTips();
    });

    // 연도 칩 — 개별 토글 + '전체' 는 나머지 5개 일괄 on/off
    // ⚠ 폼 뷰 내로만 스코프 제한 — 결과 뷰의 칩과 충돌 방지
    var claimFormView = claimFlow.querySelector('[data-claim-view="form"]');
    var yearChips = claimFormView.querySelectorAll('.claim-chip');
    var allChip = claimFormView.querySelector('.claim-chip[data-year="all"]');
    var yearOnly = Array.prototype.filter.call(yearChips, function (c) {
      return c.dataset.year !== 'all';
    });
    function refreshAllChip() {
      var everyOn = yearOnly.every(function (c) { return c.classList.contains('is-picked'); });
      if (allChip) allChip.classList.toggle('is-picked', everyOn);
    }
    yearChips.forEach(function (c) {
      c.addEventListener('click', function () {
        if (c.dataset.year === 'all') {
          var on = !c.classList.contains('is-picked');
          yearOnly.forEach(function (o) { o.classList.toggle('is-picked', on); });
          c.classList.toggle('is-picked', on);
        } else {
          c.classList.toggle('is-picked');
          refreshAllChip();
        }
      });
    });

    // 통신사 — 단일 선택
    var carrierBtns = claimFlow.querySelectorAll('.claim-carrier');
    carrierBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        carrierBtns.forEach(function (o) { o.classList.remove('is-picked'); });
        b.classList.add('is-picked');
      });
    });
  }

  // 보험사별 고객센터 번호 (가라 — 실서비스 연결 시 API/카탈로그로 교체)
  //   file-flow · history-flow 공용이라 IIFE 스코프에 배치
  var CARRIER_PHONES = {
    '현대해상':'1588-5656','삼성화재':'1588-5114','메리츠화재':'1566-7711',
    'DB손해보험':'1588-0100','KB손해보험':'1544-0114','롯데손해보험':'1588-3344',
    '한화손해보험':'1566-8000','NH농협손해':'1644-9000','흥국화재':'1688-1688',
    'AIG손해':'1544-2792','하나손해보험':'1566-3000','라이나손해보험':'1588-0058',
    '예별손해보험':'1588-1234',
    'KB생명':'1588-9922','DB생명':'1588-3131','NH농협생명':'1544-4000',
    '라이나생명':'1588-0058','AIA생명':'1588-9898','ABL생명':'1588-6363',
    '처브라이프':'1544-1957','IM라이프':'1588-4770','카디프생명':'1544-8080'
  };

  // ─────────────────────────────────────────────────────────────
  // 보험 탭 — 보험금 청구 (file-flow) 다단계 폼
  //   보험사 → 피보험자 → 수익자 → 사고+계좌 → 서명 → 사진 → 검토 → 완료
  // ─────────────────────────────────────────────────────────────
  var fileFlow = document.querySelector('[data-file-flow]');
  var fileStart = document.querySelector('[data-file-start]');
  if (fileFlow && fileStart) {
    var FILE_STEPS = ['carrier','insured','beneficiary','accident','bank','sign-insured','sign-beneficiary','sign-guardian','photos','review'];
    var PHOTO_MAX = 10;
    // 로그인한 사용자 프로필 (mock) — 관계=본인일 때 피보험자 자동, 관계=자녀일 때 수익자/법정대리인 자동
    var FILE_ME = { name:'홍길동', ssnFront:'900101', phone:'01012345678' };
    // 서명 상태 — 관계=본인: insured 만 · 관계=자녀: 3개 다 필요
    var fileState = { step: 0, signs: { insured:false, beneficiary:false, guardian:false } };

    var fileBack = fileFlow.querySelector('[data-file-back]');
    var fileCloseBtn = fileFlow.querySelector('[data-file-close]');
    var fileNextBtn = fileFlow.querySelector('[data-file-next]');
    var fileProgress = fileFlow.querySelector('[data-file-progress]');
    var fileBody = fileFlow.querySelector('.file-flow__body');
    var filePhotoAdd = fileFlow.querySelector('[data-file-photo-add]');
    var filePhotos = fileFlow.querySelector('[data-file-photos]');
    var filePhotoCount = fileFlow.querySelector('[data-file-photo-count]');

    function fileGetRelation() {
      var el = fileFlow.querySelector('[data-file-relation] .file-chip.is-picked');
      return el ? el.dataset.relation : '본인';
    }
    function fileIsSelf() { return fileGetRelation() === '본인'; }
    // 관계=본인 → 수익자/법정대리인 서명 스텝 skip
    function fileEffectiveSteps() {
      return FILE_STEPS.filter(function (s) {
        if (fileIsSelf() && (s === 'sign-beneficiary' || s === 'sign-guardian')) return false;
        return true;
      });
    }
    function fileCurName() { return FILE_STEPS[fileState.step]; }

    function fileShowStep() {
      var name = fileCurName();
      fileFlow.querySelectorAll('[data-file-view]').forEach(function (v) {
        v.hidden = v.dataset.fileView !== name;
      });
      var eff = fileEffectiveSteps();
      var idx = eff.indexOf(name);
      var pct = ((idx + 1) / eff.length) * 100;
      if (fileProgress) fileProgress.style.width = pct + '%';
      if (fileNextBtn) {
        fileNextBtn.textContent = (name === 'review') ? '청구 완료하기' : '다음';
        delete fileNextBtn.dataset.done;
      }
      fileValidate();
      if (fileBody) fileBody.scrollTop = 0;
      if (name === 'insured') fileApplyRelation();
      if (name === 'beneficiary') fileAutoFillBeneficiary();
      if (name === 'bank') fileSyncBankHolder();
      if (name === 'sign-insured') { fileApplySignInsuredTitle(); fileInitSign('insured'); }
      if (name === 'sign-beneficiary') fileInitSign('beneficiary');
      if (name === 'sign-guardian') fileInitSign('guardian');
      if (name === 'review') filePopulateReview();
    }

    var FILE_SKIP_VALIDATE = true; // 데모 모드 — 필드 입력 없이 '다음' 항상 활성 (검토 화면 확인용)
    function fileValidate() {
      if (!fileNextBtn) return;
      if (FILE_SKIP_VALIDATE) { fileNextBtn.disabled = false; return; }
      var name = fileCurName();
      var ok = false;
      if (name === 'carrier') {
        ok = !!fileFlow.querySelector('.file-carrier.is-picked');
      } else if (name === 'insured') {
        var n = fileFlow.querySelector('[data-file-insured-name]');
        var sf = fileFlow.querySelector('[data-file-insured-ssn-front]');
        var sb = fileFlow.querySelector('[data-file-insured-ssn-back]');
        var p = fileFlow.querySelector('[data-file-insured-phone]');
        ok = n.value.trim() && sf.value.length === 6 && sb.value.length === 7 && p.value.trim();
      } else if (name === 'beneficiary') {
        // 자동 채움된 상태만 통과 (수익자 정보는 항상 자동 채워짐)
        ok = true;
      } else if (name === 'accident') {
        var d = fileFlow.querySelector('[data-file-accident-date]');
        var s = fileFlow.querySelector('[data-file-accident-symptoms]');
        ok = !!d.value && !!s.value.trim();
      } else if (name === 'bank') {
        var bkn = fileFlow.querySelector('[data-file-bank-name]');
        var bka = fileFlow.querySelector('[data-file-bank-account]');
        ok = bkn.value && bka.value.trim();
      } else if (name === 'sign-insured') {
        ok = fileState.signs.insured;
      } else if (name === 'sign-beneficiary') {
        ok = fileState.signs.beneficiary;
      } else if (name === 'sign-guardian') {
        ok = fileState.signs.guardian;
      } else if (name === 'photos') {
        ok = fileFlow.querySelectorAll('.file-photo-item').length > 0;
      } else if (name === 'review') {
        ok = true;
      }
      fileNextBtn.disabled = !ok;
    }

    function fileGoNext() {
      var name = fileCurName();
      if (name === 'review') {
        if (window.confirm('보험금 청구를 완료하시겠습니까?')) fileShowDone();
        return;
      }
      var next = fileState.step + 1;
      while (next < FILE_STEPS.length && fileIsSelf() &&
             (FILE_STEPS[next] === 'sign-beneficiary' || FILE_STEPS[next] === 'sign-guardian')) next++;
      fileState.step = next;
      fileShowStep();
    }
    function fileGoBack() {
      if (fileState.step === 0) { fileClose_(); return; }
      var prev = fileState.step - 1;
      while (prev >= 0 && fileIsSelf() &&
             (FILE_STEPS[prev] === 'sign-beneficiary' || FILE_STEPS[prev] === 'sign-guardian')) prev--;
      fileState.step = Math.max(0, prev);
      fileShowStep();
    }

    // 보험사 다중 선택 (여러 보험사에 동시 청구 가능)
    fileFlow.querySelectorAll('.file-carrier').forEach(function (c) {
      c.addEventListener('click', function () {
        c.classList.toggle('is-picked');
        fileValidate();
      });
    });

    // 폼 필드 change → validate
    fileFlow.querySelectorAll('.file-input').forEach(function (el) {
      el.addEventListener('input', fileValidate);
      el.addEventListener('change', fileValidate);
    });

    // 관계 chip — 관계에 따라 피보험자 자동채움/잠금 (본인 → 내 정보 잠금, 자녀 → 직접 입력)
    function fileApplyRelation() {
      var rel = fileGetRelation();
      var nEl = fileFlow.querySelector('[data-file-insured-name]');
      var sfEl = fileFlow.querySelector('[data-file-insured-ssn-front]');
      var sbEl = fileFlow.querySelector('[data-file-insured-ssn-back]');
      var pEl = fileFlow.querySelector('[data-file-insured-phone]');
      if (rel === '본인') {
        if (nEl) { nEl.value = FILE_ME.name; nEl.readOnly = true; }
        if (sfEl) { sfEl.value = FILE_ME.ssnFront; sfEl.readOnly = true; }
        if (sbEl) { sbEl.readOnly = false; }
        if (pEl) { pEl.value = FILE_ME.phone; pEl.readOnly = true; }
      } else {
        // 자녀 — 사용자가 자녀 정보 직접 입력
        if (nEl) { if (nEl.readOnly) { nEl.value = ''; } nEl.readOnly = false; }
        if (sfEl) { if (sfEl.readOnly) { sfEl.value = ''; } sfEl.readOnly = false; }
        if (sbEl) { sbEl.readOnly = false; }
        if (pEl) { if (pEl.readOnly) { pEl.value = ''; } pEl.readOnly = false; }
      }
    }

    // 피보험자 서명 스텝 — 관계에 따라 타이틀/메모 문구 조정
    function fileApplySignInsuredTitle() {
      var rel = fileGetRelation();
      var title = fileFlow.querySelector('[data-sign-insured-title]');
      var memo = fileFlow.querySelector('[data-sign-insured-memo]');
      if (rel === '자녀') {
        if (title) title.innerHTML = '피보험자 서명을<br>해주세요';
        if (memo) memo.textContent = '진료받은 자녀 본인의 서명이에요';
      } else {
        if (title) title.innerHTML = '본인 서명을<br>해주세요';
        if (memo) memo.textContent = '아래 영역에 손가락으로 서명해 주세요';
      }
    }
    fileFlow.querySelectorAll('[data-file-relation] .file-chip').forEach(function (c) {
      c.addEventListener('click', function () {
        fileFlow.querySelectorAll('[data-file-relation] .file-chip').forEach(function (o) { o.classList.remove('is-picked'); });
        c.classList.add('is-picked');
        fileApplyRelation();
        fileCheckMinor();
        fileValidate();
      });
    });

    // 자녀 미성년자 체크 (주민번호 앞자리로 출생연도 계산 → 만 나이 < 19 여부)
    function fileCheckMinor() {
      var rel = fileGetRelation();
      var relMemo = fileFlow.querySelector('[data-file-relation-memo]');
      var warn = fileFlow.querySelector('[data-file-minor-warn]');
      if (relMemo) relMemo.hidden = (rel !== '자녀');
      if (!warn) return;
      if (rel !== '자녀') { warn.hidden = true; return; }
      var ssn = fileFlow.querySelector('[data-file-insured-ssn-front]');
      if (!ssn || ssn.value.length !== 6) { warn.hidden = true; return; }
      var yy = parseInt(ssn.value.slice(0, 2), 10);
      var mm = parseInt(ssn.value.slice(2, 4), 10);
      var dd = parseInt(ssn.value.slice(4, 6), 10);
      var year = yy <= 25 ? 2000 + yy : 1900 + yy;
      var today = new Date();
      var age = today.getFullYear() - year;
      if (today.getMonth() + 1 < mm || (today.getMonth() + 1 === mm && today.getDate() < dd)) age--;
      warn.hidden = age < 19;
    }
    var minorSsnEl = fileFlow.querySelector('[data-file-insured-ssn-front]');
    if (minorSsnEl) minorSsnEl.addEventListener('input', fileCheckMinor);

    // 수익자 자동 채움 (수익자 스텝 진입 시 호출)
    //   관계=본인 → 수익자=피보험자(본인) 정보 그대로 (readonly)
    //   관계=자녀 → 수익자=로그인 사용자 (법정대리인=부모) (readonly)
    function fileAutoFillBeneficiary() {
      var rel = fileGetRelation();
      var src = (rel === '본인')
        ? {
            name: fileFlow.querySelector('[data-file-insured-name]').value,
            ssnFront: fileFlow.querySelector('[data-file-insured-ssn-front]').value,
            ssnBack: fileFlow.querySelector('[data-file-insured-ssn-back]').value,
            phone: fileFlow.querySelector('[data-file-insured-phone]').value
          }
        : { name: FILE_ME.name, ssnFront: FILE_ME.ssnFront, ssnBack: '', phone: FILE_ME.phone };
      // 이름·주민번호앞·전화 는 자동 채움 + 잠금 · 주민번호 뒷자리는 항상 사용자가 직접 입력
      var lockedMap = { 'name':src.name, 'ssn-front':src.ssnFront, 'phone':src.phone };
      Object.keys(lockedMap).forEach(function (k) {
        var el = fileFlow.querySelector('[data-file-beneficiary-' + k + ']');
        if (el) { el.value = lockedMap[k]; el.readOnly = true; }
      });
      var sbBenEl = fileFlow.querySelector('[data-file-beneficiary-ssn-back]');
      if (sbBenEl) {
        // 관계=본인 & 피보험자 뒷자리를 이미 입력해뒀다면 그 값 그대로 옮기고 (편의), 아니면 빈 상태
        sbBenEl.value = src.ssnBack || sbBenEl.value || '';
        sbBenEl.readOnly = false;
      }
      // 수익자 안내문 — 관계별 맥락 설명
      var memo = fileFlow.querySelector('[data-file-beneficiary-memo]');
      if (memo) memo.textContent = (rel === '본인')
        ? '피보험자 본인이 보험금을 받아요'
        : '법정대리인(나)이 자녀 대신 보험금을 받아요';
    }

    // 예금주 = 수익자 이름 (자동 동기화, readonly)
    function fileSyncBankHolder() {
      var bnEl = fileFlow.querySelector('[data-file-beneficiary-name]');
      var bhEl = fileFlow.querySelector('[data-file-bank-holder]');
      if (bhEl) bhEl.value = bnEl ? bnEl.value : '';
    }
    var bnInp = fileFlow.querySelector('[data-file-beneficiary-name]');
    if (bnInp) bnInp.addEventListener('input', fileSyncBankHolder);

    // 입력 필터 — 이름 (한글/영문/공백만), 주민번호/전화번호 (숫자만)
    function fileFilterLetters(el) {
      el.addEventListener('input', function () {
        el.value = el.value.replace(/[^\p{L}\s·]/gu, '');
      });
    }
    function fileFilterDigits(el) {
      el.addEventListener('input', function () {
        el.value = el.value.replace(/\D/g, '');
      });
    }
    ['[data-file-insured-name]','[data-file-beneficiary-name]'].forEach(function (sel) {
      var el = fileFlow.querySelector(sel); if (el) fileFilterLetters(el);
    });
    [
      '[data-file-insured-ssn-front]','[data-file-insured-ssn-back]','[data-file-insured-phone]',
      '[data-file-beneficiary-ssn-front]','[data-file-beneficiary-ssn-back]','[data-file-beneficiary-phone]',
      '[data-file-bank-account]'
    ].forEach(function (sel) {
      var el = fileFlow.querySelector(sel); if (el) fileFilterDigits(el);
    });

    // 사고 유형 라디오 카드 + 유형별 라벨/플레이스홀더 자동 변경
    function fileUpdateAccidentUI() {
      var picked = fileFlow.querySelector('[data-file-accident-type] .file-radio-card.is-picked');
      var type = picked ? picked.dataset.accidentType : '질병';
      var dateLabel = fileFlow.querySelector('[data-accident-date-label]');
      var symptoms = fileFlow.querySelector('[data-file-accident-symptoms]');
      if (dateLabel) dateLabel.textContent = (type === '질병') ? '치료받은 날짜' : '사고 난 날짜';
      if (symptoms) {
        var ph = (type === '질병') ? symptoms.dataset.phIllness : symptoms.dataset.phInjury;
        if (ph) symptoms.placeholder = ph;
      }
    }
    fileFlow.querySelectorAll('[data-file-accident-type] .file-radio-card').forEach(function (b) {
      b.addEventListener('click', function () {
        fileFlow.querySelectorAll('[data-file-accident-type] .file-radio-card').forEach(function (o) { o.classList.remove('is-picked'); });
        b.classList.add('is-picked');
        fileUpdateAccidentUI();
        fileValidate();
      });
    });
    // 증상 textarea 도 validate 대상에 포함
    var symptomsEl = fileFlow.querySelector('[data-file-accident-symptoms]');
    if (symptomsEl) {
      symptomsEl.addEventListener('input', fileValidate);
    }

    // 서명 캔버스 (3 종류: insured / beneficiary / guardian)
    function fileInitSign(which) {
      var canvas = fileFlow.querySelector('[data-file-sign-' + which + ']');
      if (!canvas || canvas.dataset.inited === '1') return;
      canvas.dataset.inited = '1';
      var rect = canvas.getBoundingClientRect();
      var dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      var ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = '#101B33';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      var drawing = false, lx = 0, ly = 0;
      function pos(e) {
        var r = canvas.getBoundingClientRect();
        var t = e.touches ? e.touches[0] : e;
        return { x: t.clientX - r.left, y: t.clientY - r.top };
      }
      function start(e) { e.preventDefault(); drawing = true; var p = pos(e); lx = p.x; ly = p.y; }
      function move(e) {
        if (!drawing) return;
        e.preventDefault();
        var p = pos(e);
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(p.x, p.y); ctx.stroke();
        lx = p.x; ly = p.y;
        if (!fileState.signs[which]) {
          fileState.signs[which] = true;
          fileValidate();
        }
      }
      function end() { drawing = false; }
      canvas.addEventListener('mousedown', start);
      canvas.addEventListener('mousemove', move);
      canvas.addEventListener('mouseup', end);
      canvas.addEventListener('mouseleave', end);
      canvas.addEventListener('touchstart', start, { passive: false });
      canvas.addEventListener('touchmove', move, { passive: false });
      canvas.addEventListener('touchend', end);
    }
    fileFlow.querySelectorAll('[data-file-sign-clear]').forEach(function (b) {
      b.addEventListener('click', function () {
        var which = b.dataset.fileSignClear;
        var canvas = fileFlow.querySelector('[data-file-sign-' + which + ']');
        if (canvas) {
          var ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        fileState.signs[which] = false;
        fileValidate();
      });
    });

    // 사진 첨부 — mock 타일 add/remove
    function fileUpdatePhotoCount() {
      var n = filePhotos.querySelectorAll('.file-photo-item').length;
      if (filePhotoCount) filePhotoCount.textContent = n;
      if (filePhotoAdd) filePhotoAdd.style.display = n >= PHOTO_MAX ? 'none' : '';
    }
    if (filePhotoAdd) {
      filePhotoAdd.addEventListener('click', function () {
        var n = filePhotos.querySelectorAll('.file-photo-item').length;
        if (n >= PHOTO_MAX) return;
        var tile = document.createElement('div');
        tile.className = 'file-photo-item';
        tile.innerHTML = '<div class="file-photo-item__icon"><span class="ms">image</span></div>' +
          '<button type="button" class="file-photo-item__remove" aria-label="삭제"><span class="ms">close</span></button>';
        filePhotos.insertBefore(tile, filePhotoAdd);
        tile.querySelector('.file-photo-item__remove').addEventListener('click', function () {
          tile.remove();
          fileUpdatePhotoCount();
          fileValidate();
        });
        fileUpdatePhotoCount();
        fileValidate();
      });
    }

    // 검토 채우기 — 영수증 스타일 섹션
    function filePopulateReview() {
      var v = function (sel) { var el = fileFlow.querySelector(sel); return el ? el.value.trim() : ''; };
      var set = function (attr, val) {
        var el = fileFlow.querySelector('[data-review-' + attr + ']');
        if (el) el.textContent = val || '—';
      };

      // 보험사 (다중) — 리스트로 렌더
      var pickedCarriers = fileFlow.querySelectorAll('.file-carrier.is-picked');
      var list = fileFlow.querySelector('[data-review-carrier-list]');
      var cntLbl2 = fileFlow.querySelector('[data-review-carrier-count]');
      if (cntLbl2) cntLbl2.textContent = pickedCarriers.length > 1 ? pickedCarriers.length + '곳' : '';
      if (list) {
        list.innerHTML = '';
        if (pickedCarriers.length === 0) {
          var empty = document.createElement('div');
          empty.className = 'review-photos-empty';
          empty.textContent = '선택한 보험사가 없어요';
          list.appendChild(empty);
        } else {
          pickedCarriers.forEach(function (cEl) {
            var cName = cEl.dataset.carrier;
            var cLogo = cEl.querySelector('.file-carrier__logo').src;
            var cPhone = CARRIER_PHONES[cName] || '1588-0000';
            var card = document.createElement('div');
            card.className = 'review-carrier-card';
            card.innerHTML =
              '<img class="review-carrier-card__logo" src="' + cLogo + '" alt="">' +
              '<div class="review-carrier-card__name">' + cName + '</div>' +
              '<div class="review-carrier-card__phone">' + cPhone + '</div>';
            list.appendChild(card);
          });
        }
      }

      // 인적사항 — 피보험자/수익자 각각 이름·주민번호·전화
      var inN = v('[data-file-insured-name]');
      var inSf = v('[data-file-insured-ssn-front]');
      var beN = v('[data-file-beneficiary-name]');
      var beSf = v('[data-file-beneficiary-ssn-front]');
      var bePhone = v('[data-file-beneficiary-phone]');
      set('insured-name', inN);
      set('insured-ssn', inSf ? (inSf + '-*******') : '');
      set('beneficiary-name', beN);
      set('beneficiary-phone', (beSf ? beSf + '-******* · ' : '') + bePhone);

      // 사고사항
      var accEl = fileFlow.querySelector('[data-file-accident-type] .file-radio-card.is-picked');
      var accT = accEl ? accEl.dataset.accidentType : '';
      var accD = v('[data-file-accident-date]');
      var accS = v('[data-file-accident-symptoms]');
      set('accident-type', accT);
      set('accident-date', accD);
      set('symptoms', accS);
      var dateLabel = fileFlow.querySelector('[data-review-accident-date-label]');
      if (dateLabel) dateLabel.textContent = (accT === '상해') ? '사고일' : '발병일';

      // 수령계좌
      var bkN = v('[data-file-bank-name]');
      var bkA = v('[data-file-bank-account]');
      var bkH = v('[data-file-bank-holder]');
      var bkLine1 = bkN ? (bkN + (bkH ? '(' + bkH + ')' : '')) : '';
      set('bank-name', bkLine1);
      set('bank-account', bkA);

      // 서명 표시 (관계=본인 → 피보험자만, 관계=자녀 → 3개)
      var isSelf = fileIsSelf();
      var siEl = fileFlow.querySelector('[data-review-sign-insured]');
      var siLabel = fileFlow.querySelector('[data-review-sign-insured-label]');
      var sbEl = fileFlow.querySelector('[data-review-sign-beneficiary]');
      var sgEl = fileFlow.querySelector('[data-review-sign-guardian]');
      var seEl = fileFlow.querySelector('[data-review-signs-empty]');
      var siOn = fileState.signs.insured;
      var sbOn = !isSelf && fileState.signs.beneficiary;
      var sgOn = !isSelf && fileState.signs.guardian;
      if (siLabel) siLabel.textContent = (isSelf ? '본인' : '피보험자') + ' 서명 완료';
      if (siEl) siEl.hidden = !siOn;
      if (sbEl) sbEl.hidden = !sbOn;
      if (sgEl) sgEl.hidden = !sgOn;
      if (seEl) seEl.hidden = siOn || sbOn || sgOn;

      // 첨부 썸네일
      var photos = fileFlow.querySelectorAll('.file-photo-item');
      var phN = photos.length;
      var cntLbl = fileFlow.querySelector('[data-review-photo-count-label]');
      if (cntLbl) cntLbl.textContent = phN > 0 ? phN + '장' : '';
      var grid = fileFlow.querySelector('[data-review-photo-grid]');
      if (grid) {
        grid.innerHTML = '';
        if (phN === 0) {
          var empty = document.createElement('div');
          empty.className = 'review-photos-empty';
          empty.textContent = '첨부된 서류가 없어요';
          grid.appendChild(empty);
        } else {
          for (var i = 0; i < phN; i++) {
            var thumb = document.createElement('div');
            thumb.className = 'review-photo-thumb';
            thumb.innerHTML = '<span class="ms">description</span>';
            grid.appendChild(thumb);
          }
        }
      }
    }

    function fileShowDone() {
      fileFlow.querySelectorAll('[data-file-view]').forEach(function (v) {
        v.hidden = v.dataset.fileView !== 'done';
      });
      if (fileProgress) fileProgress.style.width = '100%';
      if (fileNextBtn) {
        fileNextBtn.textContent = '확인';
        fileNextBtn.disabled = false;
        fileNextBtn.dataset.done = '1';
      }
    }

    function fileReset() {
      fileState.step = 0;
      fileState.signs = { insured:false, beneficiary:false, guardian:false };
      fileFlow.querySelectorAll('.file-carrier').forEach(function (c) { c.classList.remove('is-picked'); });
      fileFlow.querySelectorAll('.file-input').forEach(function (i) {
        if (i.tagName === 'SELECT') i.selectedIndex = 0;
        else i.value = '';
        i.disabled = false;
        i.readOnly = false;
      });
      // 관계 기본값 본인
      fileFlow.querySelectorAll('[data-file-relation] .file-chip').forEach(function (c) {
        c.classList.toggle('is-picked', c.dataset.relation === '본인');
      });
      // 예금주 readonly 복구
      var bh = fileFlow.querySelector('[data-file-bank-holder]');
      if (bh) bh.readOnly = true;
      // 관계 적용 + 미성년 경고 리셋
      fileApplyRelation();
      var relMemo = fileFlow.querySelector('[data-file-relation-memo]');
      if (relMemo) relMemo.hidden = true;
      var minorWarn = fileFlow.querySelector('[data-file-minor-warn]');
      if (minorWarn) minorWarn.hidden = true;
      fileFlow.querySelectorAll('[data-file-accident-type] .file-radio-card').forEach(function (b) {
        b.classList.toggle('is-picked', b.dataset.accidentType === '질병');
      });
      var sym = fileFlow.querySelector('[data-file-accident-symptoms]');
      if (sym) sym.value = '';
      fileUpdateAccidentUI();
      fileFlow.querySelectorAll('.file-sign__canvas').forEach(function (c) {
        var sctx = c.getContext('2d');
        sctx.clearRect(0, 0, c.width, c.height);
        delete c.dataset.inited;
      });
      filePhotos.querySelectorAll('.file-photo-item').forEach(function (t) { t.remove(); });
      fileUpdatePhotoCount();
    }
    function fileOpen() {
      fileReset();
      fileFlow.hidden = false;
      fileShowStep();
    }
    function fileClose_() { fileFlow.hidden = true; }

    fileStart.addEventListener('click', fileOpen);
    if (fileBack) fileBack.addEventListener('click', fileGoBack);
    if (fileCloseBtn) fileCloseBtn.addEventListener('click', fileClose_);
    if (fileNextBtn) {
      fileNextBtn.addEventListener('click', function () {
        if (fileNextBtn.dataset.done === '1') { fileClose_(); return; }
        fileGoNext();
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 보험 탭 — 청구내역 (history-flow) 리스트 + 상세
  //   상태: 청구서접수 / 청구완료 / 보류
  // ─────────────────────────────────────────────────────────────
  var historyFlow = document.querySelector('[data-history-flow]');
  var historyStart = document.querySelector('[data-history-start]');
  if (historyFlow && historyStart) {
    // Mock 데이터 — 실서비스 연결 시 API 로 교체
    var HISTORY_DATA = [
      { id:1, date:'2025.09.15', carrier:'현대해상', logoFile:'hd', insured:'홍길동', ssn:'900101', accType:'질병', accDate:'2025.09.10', symptom:'감기몸살, 인후통', bank:'카카오뱅크', account:'321432112345', status:'received' },
      { id:2, date:'2025.09.08', carrier:'삼성화재', logoFile:'ss', insured:'홍길동', ssn:'900101', accType:'질병', accDate:'2025.09.01', symptom:'어깨통증, 물리치료', bank:'신한은행', account:'110234567890', status:'done' },
      { id:3, date:'2025.08.28', carrier:'DB손해보험', logoFile:'db', insured:'홍길동', ssn:'900101', accType:'상해', accDate:'2025.08.20', symptom:'넘어짐, 무릎 타박', bank:'KB국민은행', account:'004501234567', status:'hold' },
      { id:4, date:'2025.08.14', carrier:'롯데손해보험', logoFile:'lt', insured:'홍길동', ssn:'900101', accType:'질병', accDate:'2025.08.10', symptom:'감기, 기침', bank:'카카오뱅크', account:'321432112345', status:'done' },
      { id:5, date:'2025.07.30', carrier:'AIA생명', logoFile:'aia', insured:'홍길동', ssn:'900101', accType:'질병', accDate:'2025.07.22', symptom:'허리통증, 도수치료', bank:'신한은행', account:'110234567890', status:'done' }
    ];
    var HISTORY_STATUS = {
      received: { label:'청구서접수', cls:'received' },
      done:     { label:'청구완료',   cls:'done' },
      hold:     { label:'보류',        cls:'hold' }
    };

    var historyBack = historyFlow.querySelector('[data-history-back]');
    var historyCloseBtn = historyFlow.querySelector('[data-history-close]');
    var historyTitle = historyFlow.querySelector('[data-history-title]');
    var historyList = historyFlow.querySelector('[data-history-list]');
    var historyEmpty = historyFlow.querySelector('[data-history-empty]');
    var historyDetailEl = historyFlow.querySelector('[data-history-detail]');
    var historyViewList = historyFlow.querySelector('[data-history-view="list"]');
    var historyViewDetail = historyFlow.querySelector('[data-history-view="detail"]');
    var historySummary = document.querySelector('[data-history-summary]');

    function historyEscape(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
      });
    }

    function historyRenderList() {
      if (!historyList) return;
      historyList.innerHTML = '';
      if (HISTORY_DATA.length === 0) {
        if (historyEmpty) historyEmpty.hidden = false;
        return;
      }
      if (historyEmpty) historyEmpty.hidden = true;
      HISTORY_DATA.forEach(function (item) {
        var st = HISTORY_STATUS[item.status] || HISTORY_STATUS.received;
        var el = document.createElement('div');
        el.className = 'history-item';
        el.dataset.historyId = item.id;
        el.innerHTML =
          '<div class="history-item__head">' +
            '<div class="history-item__date">' + historyEscape(item.date) + '</div>' +
            '<div class="history-status history-status--' + st.cls + '">' + st.label + '</div>' +
          '</div>' +
          '<div class="history-item__body">' +
            '<img class="history-item__logo" src="assets/icn_blogo_' + item.logoFile + '_s.png" alt="">' +
            '<div class="history-item__info">' +
              '<div class="history-item__carrier">' + historyEscape(item.carrier) + '</div>' +
              '<div class="history-item__meta">' + historyEscape(item.accType) + ' · ' + historyEscape(item.symptom) + '</div>' +
            '</div>' +
            '<span class="ms history-item__chev">chevron_right</span>' +
          '</div>';
        el.addEventListener('click', function () { historyShowDetail(item.id); });
        historyList.appendChild(el);
      });
    }

    function historyShowDetail(id) {
      var item = HISTORY_DATA.filter(function (i) { return i.id === id; })[0];
      if (!item || !historyDetailEl) return;
      var st = HISTORY_STATUS[item.status] || HISTORY_STATUS.received;
      var carrierPhone = CARRIER_PHONES[item.carrier] || '1588-0000';
      historyDetailEl.innerHTML =
        '<div class="history-detail-header">' +
          '<div class="history-detail-header__row"><span class="history-detail-header__k">신청일</span><span class="history-detail-header__v">' + historyEscape(item.date) + '</span></div>' +
          '<div class="history-detail-header__row"><span class="history-detail-header__k">신청상태</span><span class="history-status history-status--' + st.cls + '">' + st.label + '</span></div>' +
        '</div>' +
        '<div class="review-section">' +
          '<div class="review-section__label">청구할 보험사</div>' +
          '<div class="review-carrier-card">' +
            '<img class="review-carrier-card__logo" src="assets/icn_blogo_' + item.logoFile + '_s.png" alt="">' +
            '<div class="review-carrier-card__name">' + historyEscape(item.carrier) + '</div>' +
            '<div class="review-carrier-card__phone">' + carrierPhone + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="review-section">' +
          '<div class="review-section__label">인적사항</div>' +
          '<div class="review-person">' +
            '<div class="review-person__row"><div class="review-person__k">피보험자</div><div class="review-person__v">' +
              '<div class="review-person__name">' + historyEscape(item.insured) + '</div>' +
              '<div class="review-person__sub">' + historyEscape(item.ssn) + '-*******</div>' +
            '</div></div>' +
          '</div>' +
        '</div>' +
        '<div class="review-section">' +
          '<div class="review-section__label">사고사항</div>' +
          '<div class="review-kv">' +
            '<div class="review-kv__row"><div class="review-kv__k">사고유형</div><div class="review-kv__v">' + historyEscape(item.accType) + '</div></div>' +
            '<div class="review-kv__row"><div class="review-kv__k">' + (item.accType === '상해' ? '사고일' : '발병일') + '</div><div class="review-kv__v">' + historyEscape(item.accDate) + '</div></div>' +
            '<div class="review-kv__row"><div class="review-kv__k">증상</div><div class="review-kv__v">' + historyEscape(item.symptom) + '</div></div>' +
            '<div class="review-kv__row"><div class="review-kv__k">수령계좌</div><div class="review-kv__v">' +
              '<div>' + historyEscape(item.bank) + '(' + historyEscape(item.insured) + ')</div>' +
              '<div class="review-kv__sub">' + historyEscape(item.account) + '</div>' +
            '</div></div>' +
          '</div>' +
        '</div>' +
        '<div class="review-section">' +
          '<div class="review-section__label">첨부서류</div>' +
          '<div class="review-photos">' +
            '<div class="review-photo-thumb"><span class="ms">description</span></div>' +
            '<div class="review-photo-thumb"><span class="ms">description</span></div>' +
          '</div>' +
        '</div>';

      historyViewList.hidden = true;
      historyViewDetail.hidden = false;
      if (historyTitle) historyTitle.textContent = '청구 상세';
    }

    function historyBackToList() {
      historyViewDetail.hidden = true;
      historyViewList.hidden = false;
      if (historyTitle) historyTitle.textContent = '청구내역';
    }

    function historyOpen() {
      historyRenderList();
      historyBackToList();
      historyFlow.hidden = false;
    }
    function historyClose() { historyFlow.hidden = true; }

    // 요약 라인 갱신 (홈 진입 CTA 서브텍스트)
    function historyUpdateSummary() {
      if (!historySummary) return;
      var received = HISTORY_DATA.filter(function (i) { return i.status === 'received'; }).length;
      var done = HISTORY_DATA.filter(function (i) { return i.status === 'done'; }).length;
      var hold = HISTORY_DATA.filter(function (i) { return i.status === 'hold'; }).length;
      var parts = [];
      if (received) parts.push(received + '건 접수');
      if (hold) parts.push(hold + '건 보류');
      if (done) parts.push(done + '건 완료');
      historySummary.textContent = parts.length ? parts.join(' · ') : '청구내역이 없어요';
    }
    historyUpdateSummary();

    historyStart.addEventListener('click', historyOpen);
    if (historyCloseBtn) historyCloseBtn.addEventListener('click', historyClose);
    if (historyBack) {
      historyBack.addEventListener('click', function () {
        if (!historyViewDetail.hidden) historyBackToList();
        else historyClose();
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 공통 알림 오버레이 — 모든 탭 상단 벨 아이콘에서 열림
  //   내부는 탭 (안심 / 혜택 / 보험) 으로 알림 종류 분리
  // ─────────────────────────────────────────────────────────────
  var notifFlow = document.querySelector('[data-notif-flow]');
  if (notifFlow) {
    var NOTIF_DATA = {
      ansim: [
        { icon:'monitor_heart', title:'평소와 다른 상태가 감지됐어요', meta:'심박수 이상 · 5분 전', color:'amber', action:'alert-anomaly' },
        { icon:'schedule', title:'아침 체크인이 지연됐어요', meta:'재알림 발송 · 오전 9:15', color:'blue', action:'alert-missed' },
        { icon:'check_circle', title:'보호자가 확인했어요', meta:'어제 저녁 체크인 · 오후 8:12', color:'teal', read:true }
      ],
      benefit: [
        { icon:'savings', title:'절감 진단 결과가 나왔어요', meta:'월 32,400원 절감 가능', color:'teal' },
        { icon:'router', title:'새 결합 혜택이 있어요', meta:'인터넷·TV 재약정 안내', color:'amber' }
      ],
      insurance: [
        { icon:'receipt_long', title:'현대해상 청구가 접수됐어요', meta:'2025.09.15', color:'blue' },
        { icon:'search_insights', title:'놓친 보험금 473,600원', meta:'2022년 2세대 실손 기준', color:'violet' },
        { icon:'fact_check', title:'서류 보완 요청', meta:'DB손해 · 진단서 필요', color:'amber' }
      ]
    };
    var notifCloseBtn = notifFlow.querySelector('[data-notif-close]');
    var notifTabs = notifFlow.querySelectorAll('[data-notif-tab]');
    var notifList = notifFlow.querySelector('[data-notif-list]');
    var notifCurrent = 'ansim';

    function notifEscape(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
      });
    }
    function notifRender() {
      if (!notifList) return;
      var items = NOTIF_DATA[notifCurrent] || [];
      notifList.innerHTML = '';
      if (items.length === 0) {
        notifList.innerHTML =
          '<div class="notif-empty">' +
            '<span class="ms">notifications_off</span>' +
            '<div class="notif-empty__title">알림이 없어요</div>' +
            '<div class="notif-empty__memo">새 알림이 오면 여기에 표시돼요</div>' +
          '</div>';
        return;
      }
      items.forEach(function (n, i) {
        var el = document.createElement('div');
        el.className = 'notif-item' + (n.read ? ' notif-item--read' : '');
        el.innerHTML =
          '<div class="notif-item__ico notif-item__ico--' + n.color + '"><span class="ms">' + n.icon + '</span></div>' +
          '<div class="notif-item__body">' +
            '<div class="notif-item__title">' + notifEscape(n.title) + '</div>' +
            '<div class="notif-item__meta">' + notifEscape(n.meta) + '</div>' +
          '</div>' +
          (n.read ? '' : '<span class="ms notif-item__chev">chevron_right</span>');
        if (!n.read) {
          el.addEventListener('click', function () {
            // 안심 알림 → 해당 intercept 뷰로 이동
            if (notifCurrent === 'ansim' && n.action) {
              notifClose();
              show('ansim', true);
              setCheckinView(n.action);
            } else {
              notifClose();
            }
          });
        }
        notifList.appendChild(el);
      });
    }
    function notifSetTab(name) {
      notifCurrent = name;
      notifTabs.forEach(function (t) {
        t.classList.toggle('is-active', t.dataset.notifTab === name);
      });
      notifRender();
    }
    function notifOpen() {
      notifSetTab(notifCurrent || 'ansim');
      notifFlow.hidden = false;
    }
    function notifClose() { notifFlow.hidden = true; }

    document.querySelectorAll('[data-notif-start]').forEach(function (btn) {
      btn.addEventListener('click', notifOpen);
    });
    if (notifCloseBtn) notifCloseBtn.addEventListener('click', notifClose);
    notifTabs.forEach(function (t) {
      t.addEventListener('click', function () { notifSetTab(t.dataset.notifTab); });
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 공통 인증 — 로그인/가입 시트 + 로그인 전후 더보기 + 마이페이지
  // ─────────────────────────────────────────────────────────────
  var authFlow = document.querySelector('[data-auth-flow]');
  var mypageFlow = document.querySelector('[data-mypage-flow]');
  var pendingAuthAction = null;
  var smsTimerId = null;
  var isAuthenticated = false;
  try { isAuthenticated = localStorage.getItem('weplat-auth') === 'member'; } catch (e) {}

  function authMessage(view, message) {
    var el = document.querySelector('[data-auth-message="' + view + '"]');
    if (!el) return;
    el.textContent = message || '';
    el.hidden = !message;
  }
  function authShowView(name) {
    document.querySelectorAll('[data-auth-view]').forEach(function (view) {
      view.hidden = view.dataset.authView !== name;
    });
    authMessage('login', '');
    authMessage('signup', '');
  }
  function authOpen(view) {
    authShowView(view || 'login');
    if (authFlow) authFlow.hidden = false;
  }
  function authClose() {
    if (authFlow) authFlow.hidden = true;
    pendingAuthAction = null;
  }
  function authRender() {
    document.querySelectorAll('[data-auth-guest]').forEach(function (el) { el.hidden = isAuthenticated; });
    document.querySelectorAll('[data-auth-member]').forEach(function (el) { el.hidden = !isAuthenticated; });
    document.querySelectorAll('.app-hero__login').forEach(function (el) { el.hidden = isAuthenticated; });
  }
  function authComplete() {
    isAuthenticated = true;
    try { localStorage.setItem('weplat-auth', 'member'); } catch (e) {}
    if (authFlow) authFlow.hidden = true;
    authRender();
    var action = pendingAuthAction;
    pendingAuthAction = null;
    if (action) setTimeout(function () { action.click(); }, 80);
  }

  document.querySelectorAll('[data-login-trigger]').forEach(function (btn) {
    btn.addEventListener('click', function () { authOpen('login'); });
  });
  document.querySelectorAll('[data-auth-close]').forEach(function (btn) {
    btn.addEventListener('click', authClose);
  });
  document.querySelectorAll('[data-auth-go]').forEach(function (btn) {
    btn.addEventListener('click', function () { authShowView(btn.dataset.authGo); });
  });
  document.querySelectorAll('[data-kakao-login]').forEach(function (btn) {
    btn.addEventListener('click', authComplete);
  });
  document.addEventListener('click', function (event) {
    var target = event.target.closest('[data-auth-required]');
    if (!target || isAuthenticated) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    pendingAuthAction = target;
    authOpen('login');
  }, true);

  // 시연용 — 입력값 검증 없이 누르면 바로 로그인 처리. 실제 인증 붙일 때 되돌릴 것.
  var loginSubmit = document.querySelector('[data-login-submit]');
  if (loginSubmit) loginSubmit.addEventListener('click', authComplete);

  var smsSend = document.querySelector('[data-sms-send]');
  if (smsSend) smsSend.addEventListener('click', function () {
    var phone = (document.querySelector('[data-signup-phone]').value || '').replace(/\D/g, '');
    if (phone.length < 10) { authMessage('signup', '휴대폰 번호를 정확히 입력해 주세요.'); return; }
    authMessage('signup', '');
    var field = document.querySelector('[data-sms-field]');
    var timer = document.querySelector('[data-sms-timer]');
    if (field) field.hidden = false;
    var left = 180;
    clearInterval(smsTimerId);
    smsTimerId = setInterval(function () {
      left -= 1;
      if (timer) timer.textContent = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0');
      if (left <= 0) clearInterval(smsTimerId);
    }, 1000);
  });

  var signupSubmit = document.querySelector('[data-signup-submit]');
  if (signupSubmit) signupSubmit.addEventListener('click', function () {
    var name = (document.querySelector('[data-signup-name]').value || '').trim();
    var phone = (document.querySelector('[data-signup-phone]').value || '').replace(/\D/g, '');
    var code = (document.querySelector('[data-sms-code]').value || '').trim();
    var password = document.querySelector('[data-signup-password]').value || '';
    var consent = document.querySelector('[data-signup-consent]').checked;
    if (!name || phone.length < 10 || code.length < 4 || password.length < 8 || !consent) {
      authMessage('signup', '기본 정보·인증번호·약관 동의를 모두 확인해 주세요.');
      return;
    }
    authComplete();
  });

  document.querySelectorAll('[data-mypage-open]').forEach(function (btn) {
    btn.addEventListener('click', function () { if (mypageFlow) mypageFlow.hidden = false; });
  });
  var mypageClose = document.querySelector('[data-mypage-close]');
  if (mypageClose) mypageClose.addEventListener('click', function () { mypageFlow.hidden = true; });
  var logout = document.querySelector('[data-logout]');
  if (logout) logout.addEventListener('click', function () {
    isAuthenticated = false;
    try { localStorage.removeItem('weplat-auth'); } catch (e) {}
    if (mypageFlow) mypageFlow.hidden = true;
    authRender();
  });
  authRender();

  // ─────────────────────────────────────────────────────────────
  // 더보기 탭 — 전체 기능 아이콘 클릭 → 해당 탭 이동 + CTA 자동 트리거
  // ─────────────────────────────────────────────────────────────
  document.querySelectorAll('[data-more-nav]').forEach(function (el) {
    el.addEventListener('click', function () {
      var target = el.dataset.moreNav;
      var cta = el.dataset.moreCta;
      show(target, true);
      // CTA 별 자동 트리거 (해당 탭의 진입 버튼 클릭)
      var ctaSelectors = {
        'saving':  '[data-saving-start]',
        'bundle':  '[data-bundle-start]',
        'plan':    '[data-plan-start]',
        'claim':   '[data-claim-start]',
        'file':    '[data-file-start]'
      };
      var sel = ctaSelectors[cta];
      if (sel) {
        setTimeout(function () {
          var btn = document.querySelector(sel);
          if (btn) btn.click();
        }, 120);
      }
    });
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
