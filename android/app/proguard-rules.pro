# WebView JS 브릿지 리플렉션 유지
-keepclassmembers class kr.co.weplat.app.** {
    @android.webkit.JavascriptInterface <methods>;
}
