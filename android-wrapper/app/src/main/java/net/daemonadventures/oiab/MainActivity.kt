package net.daemonadventures.oiab

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.Window
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.TextView
import android.widget.Toast
import java.net.InetAddress

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var audioManager: AudioManager
    private var audioFocusRequest: AudioFocusRequest? = null
    private var lastWebAudioResult: String = "not run"
    private val prefs by lazy { getSharedPreferences("oiab-wrapper", Context.MODE_PRIVATE) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestWindowFeature(Window.FEATURE_NO_TITLE)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        volumeControlStream = AudioManager.STREAM_MUSIC
        audioManager = getSystemService(AUDIO_SERVICE) as AudioManager
        requestAudioFocus()
        requestRuntimePermissions()

        webView = WebView(this)
        configureWebView(webView)

        val root = FrameLayout(this)
        root.addView(webView, FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT,
        ))
        root.addView(hiddenDiagnosticsHotspot(), FrameLayout.LayoutParams(dp(96), dp(96), Gravity.TOP or Gravity.START))
        setContentView(root)

        webView.loadUrl(configuredUrl())
    }

    override fun onResume() {
        super.onResume()
        requestAudioFocus()
        enterImmersiveMode()
        webView.onResume()
        injectWebAudioUnlock("resume")
    }

    override fun onPause() {
        webView.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        abandonAudioFocus()
        webView.destroy()
        super.onDestroy()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) enterImmersiveMode()
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            Toast.makeText(this, "Long-press the top-left corner for diagnostics/exit.", Toast.LENGTH_SHORT).show()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView(view: WebView) {
        WebView.setWebContentsDebuggingEnabled(true)
        view.setBackgroundColor(0xFF07110C.toInt())
        view.keepScreenOn = true
        view.isFocusable = true
        view.isFocusableInTouchMode = true
        view.requestFocus()
        view.addJavascriptInterface(NativeBridge(), "IIABOverlandAndroid")

        view.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            setGeolocationEnabled(true)
            mediaPlaybackRequiresUserGesture = false
            useWideViewPort = true
            loadWithOverviewMode = true
            builtInZoomControls = false
            displayZoomControls = false
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            allowFileAccess = false
            allowContentAccess = true
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                safeBrowsingEnabled = false
            }
        }

        view.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                return false
            }

            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                Log.i(TAG, "Loaded $url")
                injectWebAudioUnlock("page-finished")
            }
        }

        view.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean {
                Log.d(TAG, "JS ${consoleMessage.messageLevel()} ${consoleMessage.sourceId()}:${consoleMessage.lineNumber()} ${consoleMessage.message()}")
                return true
            }

            override fun onGeolocationPermissionsShowPrompt(origin: String, callback: GeolocationPermissions.Callback) {
                val allow = isTrustedLocalOrigin(origin)
                Log.i(TAG, "Geolocation prompt origin=$origin allow=$allow")
                callback.invoke(origin, allow, false)
            }

            override fun onPermissionRequest(request: PermissionRequest) {
                val resources = request.resources?.toSet().orEmpty()
                val allowed = resources.filter {
                    it == PermissionRequest.RESOURCE_AUDIO_CAPTURE || it == PermissionRequest.RESOURCE_VIDEO_CAPTURE
                }.toTypedArray()
                Log.i(TAG, "Web permission request origin=${request.origin} resources=${resources.joinToString()} grant=${allowed.joinToString()}")
                if (allowed.isNotEmpty() && isTrustedLocalOrigin(request.origin.toString())) {
                    runOnUiThread { request.grant(allowed) }
                } else {
                    runOnUiThread { request.deny() }
                }
            }
        }

        view.setOnTouchListener { _, event ->
            if (event.action == MotionEvent.ACTION_UP || event.action == MotionEvent.ACTION_DOWN) {
                injectWebAudioUnlock("touch")
            }
            false
        }
    }

    private fun enterImmersiveMode() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.hide(android.view.WindowInsets.Type.statusBars() or android.view.WindowInsets.Type.navigationBars())
        }
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            )
    }

    private fun hiddenDiagnosticsHotspot(): View {
        return TextView(this).apply {
            text = ""
            alpha = 0.01f
            setOnLongClickListener {
                showDiagnosticsMenu()
                true
            }
        }
    }

    private fun showDiagnosticsMenu() {
        val webViewPackage = currentWebViewPackage()
        val message = """
            URL: ${webView.url ?: configuredUrl()}

            WebView: $webViewPackage

            Audio focus: requested
            Last WebAudio test: $lastWebAudioResult
        """.trimIndent()

        AlertDialog.Builder(this)
            .setTitle("OIAB Diagnostics")
            .setMessage(message)
            .setPositiveButton("Reload") { _, _ -> webView.reload() }
            .setNeutralButton("Clear Cache") { _, _ ->
                webView.clearCache(true)
                webView.clearHistory()
                Toast.makeText(this, "Cache/history cleared", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("More") { _, _ -> showDiagnosticsActions() }
            .show()
    }

    private fun showDiagnosticsActions() {
        val actions = arrayOf(
            "Run WebAudio test",
            "Set URL",
            "Reset URL",
            "Exit app",
        )
        AlertDialog.Builder(this)
            .setTitle("Diagnostics Actions")
            .setItems(actions) { _, which ->
                when (which) {
                    0 -> runInjectedWebAudioTest()
                    1 -> showUrlEditor()
                    2 -> {
                        prefs.edit().remove(KEY_URL).apply()
                        webView.loadUrl(configuredUrl())
                    }
                    3 -> finish()
                }
            }
            .show()
    }

    private fun showUrlEditor() {
        val input = EditText(this).apply {
            setSingleLine(true)
            setText(configuredUrl())
            selectAll()
        }
        AlertDialog.Builder(this)
            .setTitle("Set Overland URL")
            .setView(input)
            .setPositiveButton("Load") { _, _ ->
                val url = input.text.toString().trim().ifBlank { BuildConfig.DEFAULT_URL }
                prefs.edit().putString(KEY_URL, url).apply()
                webView.loadUrl(url)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun runInjectedWebAudioTest() {
        val script = """
            (async () => {
              try {
                const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
                if (!AudioContextCtor) return 'AudioContext unavailable';
                const ctx = window.__iiabWrapperAudioContext || new AudioContextCtor();
                window.__iiabWrapperAudioContext = ctx;
                if (ctx.state !== 'running') await ctx.resume();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.frequency.value = 660;
                gain.gain.value = 0.35;
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 1.25);
                return JSON.stringify({state: ctx.state, sampleRate: ctx.sampleRate, currentTime: ctx.currentTime});
              } catch (err) {
                return 'ERROR ' + (err && (err.name + ': ' + err.message));
              }
            })();
        """.trimIndent()
        webView.evaluateJavascript(script) { value ->
            lastWebAudioResult = value ?: "null"
            Log.i(TAG, "Injected WebAudio test result=$lastWebAudioResult")
            Toast.makeText(this, "WebAudio test: $lastWebAudioResult", Toast.LENGTH_LONG).show()
        }
    }

    private fun injectWebAudioUnlock(reason: String) {
        val script = """
            (async () => {
              try {
                const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
                if (!AudioContextCtor) return 'no-audio-context';
                const ctx = window.__iiabWrapperAudioContext || new AudioContextCtor();
                window.__iiabWrapperAudioContext = ctx;
                const before = ctx.state;
                if (ctx.state !== 'running') await ctx.resume();
                const buffer = ctx.createBuffer(1, 1, ctx.sampleRate || 48000);
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(ctx.destination);
                source.start(0);
                const result = {reason: ${jsString(reason)}, before, after: ctx.state, sampleRate: ctx.sampleRate};
                console.log('[IIAB wrapper audio unlock]', JSON.stringify(result));
                if (window.IIABOverlandAndroid) window.IIABOverlandAndroid.audioUnlockResult(JSON.stringify(result));
                return JSON.stringify(result);
              } catch (err) {
                const result = {reason: ${jsString(reason)}, error: err && (err.name + ': ' + err.message)};
                console.warn('[IIAB wrapper audio unlock failed]', JSON.stringify(result));
                if (window.IIABOverlandAndroid) window.IIABOverlandAndroid.audioUnlockResult(JSON.stringify(result));
                return JSON.stringify(result);
              }
            })();
        """.trimIndent()
        webView.evaluateJavascript(script, null)
    }

    private fun requestAudioFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val attrs = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build()
            audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(attrs)
                .setAcceptsDelayedFocusGain(true)
                .setOnAudioFocusChangeListener { change -> Log.i(TAG, "Audio focus changed: $change") }
                .build()
            audioManager.requestAudioFocus(audioFocusRequest!!)
        } else {
            @Suppress("DEPRECATION")
            audioManager.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN)
        }
    }

    private fun abandonAudioFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioFocusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
        } else {
            @Suppress("DEPRECATION")
            audioManager.abandonAudioFocus(null)
        }
    }

    private fun requestRuntimePermissions() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
        val permissions = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
            Manifest.permission.RECORD_AUDIO,
        ).filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (permissions.isNotEmpty()) requestPermissions(permissions.toTypedArray(), REQUEST_PERMISSIONS)
    }

    private fun configuredUrl(): String {
        return prefs.getString(KEY_URL, null)?.takeIf { it.isNotBlank() } ?: BuildConfig.DEFAULT_URL
    }

    private fun isTrustedLocalOrigin(origin: String): Boolean {
        val host = runCatching { Uri.parse(origin).host }.getOrNull() ?: return false
        if (host == "localhost" || host.endsWith(".local") || host.endsWith(".lan")) return true
        if (host.endsWith(".overland.daemonadventures.net")) return true
        if (host == "overland.daemonadventures.net") return true
        if (isPrivateIp(host)) return true
        return runCatching {
            InetAddress.getByName(host).let { address ->
                address.isSiteLocalAddress || address.isLoopbackAddress || address.isLinkLocalAddress
            }
        }.getOrDefault(false)
    }

    private fun isPrivateIp(host: String): Boolean {
        val parts = host.split(".").mapNotNull { it.toIntOrNull() }
        if (parts.size != 4) return false
        return parts[0] == 10 ||
            (parts[0] == 172 && parts[1] in 16..31) ||
            (parts[0] == 192 && parts[1] == 168) ||
            (parts[0] == 169 && parts[1] == 254)
    }

    private fun currentWebViewPackage(): String {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WebView.getCurrentWebViewPackage()?.let { "${it.packageName} ${it.versionName}" } ?: "unknown"
        } else {
            "unknown on API ${Build.VERSION.SDK_INT}"
        }
    }

    private fun jsString(value: String): String {
        return "'" + value.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n") + "'"
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    inner class NativeBridge {
        @JavascriptInterface
        fun audioUnlockResult(value: String) {
            lastWebAudioResult = value
            Log.i(TAG, "Audio unlock result=$value")
        }
    }

    companion object {
        private const val TAG = "IIABOverland"
        private const val KEY_URL = "url"
        private const val REQUEST_PERMISSIONS = 1001
    }
}
