(function () {
  'use strict';

  var screen = document.querySelector('.chat-screen');
  var thread = screen.querySelector('.chat-thread');
  var prompts = screen.querySelector('.chat-prompts');
  var form = screen.querySelector('form');
  var input = form.querySelector('input');
  var send = form.querySelector('button');
  var liverQuestion = '간암 진단비는 얼마나 나올까요?';
  var polypQuestion = '대장내시경 때 용종 뗐는데 수술비 나와요?';
  var surgeryQuestion = '위암 수술하면 진단비 말고도 받을 돈이 있나요?';
  var premiumQuestion = '보험료가 월 20만 원인데 특약만 빼도 줄까요?';
  var enrollmentQuestion = '혈압약 먹고 있는데 실비 들 수 있어요?';
  var coverageQuestion = '실비 든 지 일주일 됐는데 병원비 나와요?';
  var insuranceQuestions = [liverQuestion, polypQuestion, surgeryQuestion, enrollmentQuestion, premiumQuestion];
  var initial = insuranceQuestions.concat([
    '생활비를 줄이고 싶어요', '어떤 통신 혜택이 있나요?']);
  var current = null;

  // 구체적인 서비스 질문을 넓은 주제(보험, 절약 등)보다 먼저 판별한다.
  var topics = [
    { match: /간암/,
      answer: '보험증권의 암진단비 가입금액이 출발점이에요. 예를 들어 간암이 해당 담보의 지급 대상이고 가입금액 3,000만 원을 100% 지급하는 조건이면, 그 담보에서 3,000만 원이에요. 진단일이 감액기간에 해당하면 금액이 달라져요.',
      detail: '증권에서 암진단비 금액을 찾고 약관에서 진단일에 적용되는 지급률을 확인해 보세요. 가령 3,000만 원 담보에 지급률이 50%라면 계산 금액은 1,500만 원이에요.',
      next: ['간암 진단비 3천만 원인데 50%만 준대요', surgeryQuestion] },
    { match: /용종|폴립/,
      answer: '내시경 중 용종을 제거했다면 질병수술비 특약을 확인해 보세요. 그 특약에서 용종 절제를 보장하는지와 건당 지급액이 얼마인지가 중요해요. 용종 진단비에 따로 가입했다면 그 담보도 확인할 수 있어요.',
      detail: '병원에서 받은 서류의 시술명과 날짜를 확인하세요. 같은 날 여러 개를 뗐다면 약관에서 한 번의 수술로 계산하는지도 살펴보세요.',
      next: ['용종 두 개 떼면 두 번 받아요?', '수술비 청구할 때 서류는요?'] },
    { match: /위암.*수술|암수술비/,
      answer: '암수술비나 입원일당 특약이 있다면 진단비와 별도로 받을 수 있어요. 보험증권에서 암수술비 금액과 입원일당을 찾고, 이번 수술과 입원이 각각의 지급 조건에 맞는지 확인해 보세요.',
      detail: '암수술비는 약관에 적힌 지급 단위가 최초 1회인지, 수술 1회당인지 확인하세요. 입원일당은 보장 대상 입원일수에 하루 지급액을 곱해 계산해요.',
      next: ['위암 수술 두 번 하면 두 번 나와요?', '수술비 청구할 때 서류는요?'] },
    { match: /보험료.*(벅|부담|비싸|비싼|낮추|줄이|줄일|줄여|아끼|절약)|특약.*(빼|빼면|삭제|해지)|해지말고/,
      answer: '계약을 유지하면서 일부 특약을 빼거나 보장금액을 낮출 수 있는 상품도 있어요. 보험증권에서 매달 얼마씩 내는지 특약별로 보고, 보험사에 변경 전후의 월 보험료와 빠지는 보장을 함께 요청해 보세요.',
      detail: '특약 하나를 빼고 싶다면 그 특약만 변경할 수 있는지, 함께 없어지는 보장이 있는지 확인하세요. 나중에 다시 넣으려면 심사를 받아야 할 수 있어요.',
      next: ['특약 하나만 뺄 수 있어요?', '내 보험에 겹치는 보장이 있어요?'] },
    { match: /(혈압약|당뇨약|약먹|복용|병력|지병|치료중|병원다).*(가입|실비|보험|들수)|고지|가입.*(혈압약|복용|지병)/,
      answer: '혈압약을 복용 중이어도 가입 가능 여부는 상품과 심사 결과에 따라 달라요. 가입하려는 상품의 청약서에서 진단·투약에 대해 묻는 기간을 보고, 그 기간에 해당하는 내용을 알려 주세요.',
      detail: '최근 진료일과 약을 처방받은 기간을 확인해 두세요. 질문에 해당하는지 애매하면 보험사에 문의하고, 신청 전 답변이 청약서에 정확히 적혔는지도 확인하세요.',
      next: ['가입할 때 약 먹은 것도 고지해야 해요?', coverageQuestion] },
    { match: /(가입|실비든|보험든|실비들|보험들).*(일주일|다음날|바로|며칠|하자마자)|보장개시|언제부터보장/,
      answer: '가입한 지 일주일이라는 정보만으로는 지급 여부를 알기 어려워요. 보험증권에서 보장이 시작된 날짜를 찾고, 이번 진료가 가입 전에 받던 치료와 이어지는지, 그 질환에 별도 제한이 붙었는지 확인해 보세요.',
      detail: '보험증권의 보장개시일과 특별조건을 먼저 확인하세요. 약관에서 이번 진료에 해당하는 보장 항목과 제외 사유를 찾은 뒤, 진료일과 진료 내용을 보험사에 알려 확인할 수 있어요.',
      next: ['약관 어디에 안 되는 경우가 나와요?', '청구할 때 무슨 서류가 필요해요?'] },
    { match: /(영수증|병원비|진료비|실비).*(모아|모아서|한꺼번에|한번에|묶어)|여러건.*청구/,
      service: 'file', label: '보험금 청구하기',
      answer: '여러 번 다녀온 병원비는 영수증을 진료일별로 모아 두세요. 한 번에 접수할 수 있는지는 보험사와 청구 화면에서 확인할 수 있어요. 함께 제출해도 자기부담금을 영수증 합계에서 한 번만 빼는 것은 아니에요.',
      detail: '진료일과 병원 이름이 보이게 영수증을 준비하세요. 보험사에 같은 질환으로 여러 번 방문했다고 알리면 묶어서 접수할 수 있는지와 추가로 필요한 서류를 확인할 수 있어요.',
      next: ['청구할 때 무슨 서류가 필요해요?', '지난번 청구는 어디까지 진행됐어요?'] },
    { match: /약관|면책|감액|지급조건|지급사유|보장제외/,
      answer: '약관 분석에서는 어떤 경우에 보험금을 지급하는지와 지급이 제한되는 조건을 함께 살펴봐요. 궁금한 특약이 있다면 그 특약의 ‘보험금 지급사유’와 ‘보험금을 지급하지 않는 사유’를 함께 확인해 보세요.',
      detail: '특약 이름이 같아도 가입 시기에 따라 조건이 다를 수 있어요. 가입할 때 받은 약관에서 해당 특약을 찾아 지급사유, 보장이 시작되는 시점, 지급 횟수나 금액 제한을 차례로 확인하세요.',
      next: ['약관 어디에 안 되는 경우가 나와요?', '내 보험에 겹치는 보장이 있어요?'] },
    { match: /보장|담보|특약|가입금액/,
      answer: '보장 분석은 가입한 보험을 진단비·입원비·수술비처럼 같은 항목끼리 모아 보는 것부터 시작해요. 보험증권의 담보명, 가입금액, 보장기간을 나란히 보면 어떤 보장이 겹치고 어디가 비어 있는지 살펴볼 수 있어요.',
      detail: '예를 들어 두 보험에 모두 수술비가 있다면, 각각 어떤 수술을 대상으로 하는지, 얼마를 어떤 조건으로 지급하는지, 보장이 언제 끝나는지 비교해 보세요. 자세한 지급 조건은 각 특약의 약관에서 확인할 수 있어요.',
      next: ['겹치는 보장은 어떻게 비교해요?', '약관에서 지급 조건을 보려면?'] },
    { match: /진행|현황|청구내역|접수내역/, service: 'history', label: '청구 진행 현황 보기',
      answer: '이미 청구했다면 내 청구 진행 현황에서 접수한 건과 처리 상태를 확인할 수 있어요.',
      detail: '로그인한 뒤 청구 진행 현황을 열어 접수 건을 선택해 주세요.', next: ['새로 청구하려면?'] },
    { match: /놓친|숨은|미청구|병원비|보험금.*(찾|조회|얼마|받을)/, service: 'claim', label: '놓친 보험금 찾기',
      answer: '병원비 중 청구하지 않은 금액이 궁금하신가요? 놓친 보험금 찾기에서 본인 인증 후 연도와 실손보험 세대를 선택하면 예상 금액을 확인할 수 있어요.',
      detail: '조회할 연도와 가입한 실손보험 세대를 확인해 두세요. 결과는 선택한 조건에 따른 추정액이에요.', next: ['청구는 어떻게 해요?'] },
    { match: /청구|서류|영수증|진단서/, service: 'file', label: '보험금 청구하기',
      answer: '보험금 청구에서 보험사를 선택한 뒤 피보험자와 진료 내용을 입력하고 서류를 첨부해요. 마지막에 입력한 내용을 확인할 수 있어요.',
      detail: '청구할 보험사, 진료 정보, 보험금을 받을 계좌와 진료 관련 서류를 준비해 주세요. 필요한 서류는 청구 내용과 보험사에 따라 달라요.', next: ['어떤 서류를 준비해요?', '청구 진행 현황은?'] },
    { match: /보험|실손|실비/, answer: '보험 약관의 지급 조건이나 가입한 보장을 살펴보는 방법이 궁금하세요? 놓친 보험금 조회와 청구 방법도 안내해 드려요.',
      detail: '약관 분석은 계약의 지급 조건을, 보장 분석은 가입한 담보의 금액과 기간을 살펴봐요. 병원비를 돌려받고 싶다면 조회나 청구를 선택해 주세요.', next: insuranceQuestions },
    { match: /혜택|헤택|결합|할인|가족/, service: 'bundle', label: '결합 혜택 계산하기',
      answer: '휴대폰과 인터넷·TV를 함께 쓰거나 가족이 같은 통신사를 이용하면 결합 혜택을 살펴볼 수 있어요. 어떤 통신사를 이용하고 계세요?',
      detail: '휴대폰과 인터넷 통신사, TV 이용 여부, 월 통신비와 가족 회선 수를 입력하면 내 조건에 맞는 예상 혜택을 확인할 수 있어요.', next: ['가족 결합은 어떻게 확인해요?', '얼마나 할인돼요?'] },
    { match: /요금제|알뜰폰|데이터|상품추천/, service: 'plan', label: '내게 맞는 상품 찾기',
      answer: '영상 시청이 잦은지, 주로 메시지만 쓰는지에 따라 필요한 데이터가 달라요. 상품 찾기에서 사용 습관과 우선순위를 선택해 요금제를 비교해 보세요.',
      detail: '휴대폰과 TV 사용 습관, 가격과 속도 중 더 중요한 조건을 떠올려 두면 상품을 비교하기 쉬워요.', next: ['결합 혜택도 궁금해요'] },
    { match: /생활비|절약|절감|통신비|고정비|아끼|아껴|줄이|줄일/, service: 'saving', label: '생활비 절감 계산하기',
      answer: '매달 반복되는 지출 중 통신비부터 살펴보세요. 휴대폰 요금과 현재 이용 중인 결합 상품을 기준으로 예상 절감액을 계산할 수 있어요.',
      detail: '최근 휴대폰 청구서에서 월 요금과 통신사를 확인해 주세요. 절감 계산에서 인터넷·TV 이용 여부와 할인 적용 여부를 함께 입력해요.', next: ['무엇을 준비해요?', '요금제도 비교하고 싶어요'] }
  ];

  function setPrompts(questions) {
    prompts.textContent = '';
    questions.forEach(function (question) {
      var button = document.createElement('button');
      button.type = 'button';
      button.textContent = question;
      button.addEventListener('click', function () { ask(question); });
      prompts.appendChild(button);
    });
  }

  function bubble(message, user) {
    var row = document.createElement('p');
    row.className = user ? 'chat-bubble is-user' : 'chat-bubble';
    row.textContent = message;
    thread.appendChild(row);
    return row;
  }

  function ask(question) {
    bubble(question, true);
    var key = question.toLowerCase().replace(/\s/g, '');
    var topic = topics.find(function (item) { return item.match.test(key); });
    var followUp = current && (topic === current || (!topic && /얼마|어떻게|준비|필요|방법|자세|알려|다음|skt?|kt|lg|엘지|케이티|만원/.test(key)));
    var reply = followUp ? current.detail : topic ? topic.answer : '궁금한 내용을 조금 더 알려 주세요. 약관·보장 분석, 보험금 조회·청구, 생활비 절약과 통신 혜택에 대해 물어볼 수 있어요.';
    current = topic || (followUp ? current : null);
    var row = bubble(reply, false);
    if (current && current.service) {
      var link = document.createElement('button');
      link.type = 'button';
      link.dataset.chatService = current.service;
      link.textContent = current.label;
      row.appendChild(link);
    }
    setPrompts(current ? current.next : initial);
    thread.scrollTop = thread.scrollHeight;
  }

  input.addEventListener('input', function () { send.disabled = !input.value.trim(); });
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var question = input.value.trim();
    if (!question) return;
    input.value = '';
    send.disabled = true;
    ask(question);
  });
  setPrompts(initial);
})();
