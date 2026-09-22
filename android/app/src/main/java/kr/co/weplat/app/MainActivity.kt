package kr.co.weplat.app

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 상태바 뒤로 콘텐츠 확장 (safe-area CSS 로 여백 처리)
        WindowCompat.setDecorFitsSystemWindows(window, false)

        webView = WebView(this).apply {
            layoutParams = android.widget.FrameLayout.LayoutParams(
                android.widget.FrameLayout.LayoutParams.MATCH_PARENT,
                android.widget.FrameLayout.LayoutParams.MATCH_PARENT
            )
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                cacheMode = WebSettings.LOAD_DEFAULT
                textZoom = 100
                mediaPlaybackRequiresUserGesture = false
                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            }
            overScrollMode = View.OVER_SCROLL_NEVER
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
            webViewClient = AppWebViewClient()
            loadUrl("file:///android_asset/www/index.html")
        }
        setContentView(webView)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                // 웹 측 히스토리 우선 → false 반환 시 앱 종료
                webView.evaluateJavascript(
                    "(function(){try{return WeplatBridge.onBackPressed();}catch(e){return false;}})();"
                ) { result ->
                    if (result != "true") {
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                    }
                }
            }
        })
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }

    /**
     * 앱 화면(file://)만 WebView 안에서 열고, 나머지는 기기에 넘긴다.
     * tel:(전화 상담) · sms: · mailto: 는 WebView 가 해석하지 못해
     * 기본 WebViewClient 로는 ERR_UNKNOWN_URL_SCHEME 이 뜬다.
     * 카카오 채널·네이버 지도 같은 외부 http(s) 링크도 외부 브라우저로 보낸다.
     */
    private inner class AppWebViewClient : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val uri = request.url ?: return false
            if (uri.scheme == "file") return false          // 앱 화면은 그대로 WebView 에서
            return openExternally(uri)
        }

        private fun openExternally(uri: Uri): Boolean {
            return try {
                startActivity(Intent(Intent.ACTION_VIEW, uri).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                })
                true
            } catch (e: ActivityNotFoundException) {
                // 전화 앱이 없는 기기(태블릿 등) — WebView 가 에러 페이지를 띄우지 않게 삼킨다
                true
            }
        }
    }
}
