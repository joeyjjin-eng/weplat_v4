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
