# 위플랫 v4 · Android WebView 하이브리드

시안(HTML/CSS/JS)을 그대로 Android WebView 앱에 얹는 구조입니다.
웹 자산은 루트에, 안드로이드 프로젝트는 `android/`에 있습니다.

## 폴더 구조
    index.html                     # SPA 셸 (탭 4개: 안심 / 혜택 / 보험 / 더보기)
    assets/css/tokens.css          # 색·라운드·그림자·타이포 토큰 (전역)
    assets/css/shell.css           # body·screen·tabbar (실기기 풀뷰포트, safe-area 대응)
    assets/css/<screen>.css        # 화면 전용 스타일 (비어 있음 — 인라인 스타일을 여기로 이관)
    assets/js/app.js               # 탭 전환 + Android 백 버튼 처리 (WeplatBridge)

    android/                       # Android Studio 프로젝트 (WebView 얇은 셸)
      settings.gradle.kts
      build.gradle.kts
      app/build.gradle.kts         # preBuild 시 웹 자산을 assets/www/로 자동 복사
      app/src/main/AndroidManifest.xml
      app/src/main/java/kr/co/weplat/app/MainActivity.kt

## 웹으로 미리보기
`index.html`을 브라우저에서 열면 됩니다. 실기기 뷰포트로 검사하려면 DevTools의 디바이스 툴바에서 360×800 (Android)으로.

## Android 빌드
1. Android Studio에서 `android/` 폴더를 열기 (JDK 17 필요).
2. Gradle Sync 후 `Run 'app'` — 에뮬레이터/실기기에 설치.
3. 첫 빌드 때 Gradle Wrapper가 없으면 터미널에서 `gradle wrapper` 실행 (또는 Studio가 자동 생성).

빌드 시 `app/build.gradle.kts`의 `copyWebAssets` 태스크가 루트의 `index.html`과 `assets/`를 `app/src/main/assets/www/`로 복사합니다.
`MainActivity`는 `file:///android_asset/www/index.html`을 로드합니다.

패키지명: `kr.co.weplat.app` (변경하려면 `namespace`·`applicationId`·폴더·`MainActivity` package를 함께 수정).

## 작업 방식
- **레이아웃**: 시안 마크업이 인라인 스타일입니다. 반복 요소(카드·리스트 행·알약·CTA)를 화면별 CSS 파일의 클래스로 옮기고 토큰(`var(--blue-500)` 등) 참조로 바꾸세요.
- **탭 전환**: `assets/js/app.js`의 `show(name)` 하나로 처리. 화면은 `<main class="screen" data-screen="...">`로 구분되어 있고 `hidden` 속성으로 토글합니다.
- **하드웨어 백 버튼**: 웹의 탭 이동 히스토리를 우선 되감고, 남은 게 없으면 앱 종료로 위임됩니다 (`MainActivity.onBackPressedDispatcher` ↔ `window.WeplatBridge.onBackPressed`).
- **safe-area**: 상단 상태바/하단 제스처 바 영역은 CSS `env(safe-area-inset-*)`로 처리 (WebView는 `WindowCompat.setDecorFitsSystemWindows(false)`로 확장).

## 외부 리소스
- Pretendard (jsdelivr CDN), Material Symbols Rounded (Google Fonts CDN) — 인터넷 권한 필요 (`AndroidManifest.xml`에 이미 있음).
- 오프라인 지원이 필요하면 두 폰트를 `assets/fonts/`로 번들링하고 `@font-face`로 로드하도록 바꾸세요.
