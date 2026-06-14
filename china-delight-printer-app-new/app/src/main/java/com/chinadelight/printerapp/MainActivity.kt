package com.chinadelight.printerapp

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Typeface
import android.net.Uri
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.InetSocketAddress
import java.net.Socket
import java.net.URL
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

class MainActivity : Activity() {
    private val adminUrl = "https://www.chinadelightct.com/admin"
    private val siteUrl = "https://www.chinadelightct.com/"
    private val exampleUrl = "https://example.com/"
    private val defaultPrinterIp = "192.168.1.172"
    private val defaultPrinterPort = "9100"
    private val timeoutMs = 5000
    private val mobileChromeUserAgent =
        "Mozilla/5.0 (Linux; Android 13; Lenovo Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
    private val handler = Handler(Looper.getMainLooper())
    private val webHandler = Handler(Looper.getMainLooper())
    private val orderNumberRegex = Regex("\\b(?:CD|TEST)-\\d{6}-[A-Z0-9]{3}\\b", RegexOption.IGNORE_CASE)

    private lateinit var rootFrame: FrameLayout
    private lateinit var homeScreen: ScrollView
    private lateinit var adminScreen: LinearLayout
    private lateinit var webView: WebView
    private lateinit var appStatus: TextView
    private lateinit var webStatus: TextView
    private lateinit var printerIpInput: EditText
    private lateinit var printerPortInput: EditText
    private lateinit var orderNumberInput: EditText

    private var lastOrderNumber = ""
    private var lastTicketBytes: ByteArray? = null
    private var lastProgress = 0
    private var lastWebUrl = ""
    private var lastWebTitle = ""
    private var lastWebError = "none"
    private var clearStatusRunnable: Runnable? = null
    private var loadTimeoutRunnable: Runnable? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val prefs = prefs()
        printerIpInput = input(prefs.getString("printerIp", defaultPrinterIp) ?: defaultPrinterIp, "Printer IP")
        printerPortInput = input(prefs.getString("printerPort", defaultPrinterPort) ?: defaultPrinterPort, "Printer port")
        orderNumberInput = input("", "Backup order number")
        appStatus = statusText("Ready. Tap Admin Orders to load the real website admin page.")

        buildWebView()
        homeScreen = buildHomeScreen()
        adminScreen = buildAdminScreen()

        rootFrame = FrameLayout(this).apply {
            addView(homeScreen, matchParent())
            addView(adminScreen, matchParent())
        }
        adminScreen.visibility = View.GONE
        setContentView(rootFrame)
    }

    private fun buildHomeScreen(): ScrollView {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(28, 28, 28, 28)
            setBackgroundColor(Color.parseColor("#FFFDF8"))
        }
        root.addView(TextView(this).apply {
            text = "China Delight Kitchen Printer"
            textSize = 25f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(Color.parseColor("#1F1A17"))
        })
        root.addView(appStatus)

        root.addView(section("Main Workflow"))
        root.addView(button("Admin Orders") { openAdmin() })
        root.addView(note("Loads the real website admin page inside this app. Log in there, scroll orders, then tap Print to Epson on an order card."))

        root.addView(section("Printer Settings"))
        root.addView(printerIpInput)
        root.addView(printerPortInput)
        root.addView(button("Save Settings") {
            saveSettings()
            setAppStatus("Settings saved. Printer ${printerHost()}:${printerPort()}.", true)
        })
        root.addView(button("Test Print") {
            saveSettings()
            printBytes(testTicketBytes(), "test ticket")
        })

        root.addView(section("Manual Backup"))
        root.addView(note("Backup only. Normal printing should happen from the visible admin order cards."))
        root.addView(orderNumberInput)
        root.addView(button("Fetch & Print") {
            fetchAndPrint(orderNumberInput.text.toString().trim())
        })

        root.addView(section("Fallback"))
        root.addView(button("Open Admin in Chrome") { openExternal(adminUrl) })

        return ScrollView(this).apply { addView(root) }
    }

    private fun buildAdminScreen(): LinearLayout {
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.WHITE)
        }

        val topBar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(10, 6, 10, 6)
            setBackgroundColor(Color.parseColor("#FFF4DF"))
        }
        topBar.addView(smallButton("Back") { showHome() })
        topBar.addView(smallButton("Reload") { loadUrl(currentOrAdminUrl()) })
        topBar.addView(smallButton("Clear WebView Data") { clearWebViewData() })
        topBar.addView(smallButton("Open Chrome") { openExternal(currentOrAdminUrl()) })
        topBar.addView(smallButton("Re-scan Print Buttons") {
            webView.evaluateJavascript(injectionJs(), null)
            setAppStatus("Re-scanned visible admin order cards.", true)
        })
        container.addView(topBar, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))

        val diagnosticsBar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(10, 4, 10, 4)
            setBackgroundColor(Color.WHITE)
        }
        diagnosticsBar.addView(smallButton("Load Example") { loadUrl(exampleUrl) })
        diagnosticsBar.addView(smallButton("Load Site Home") { loadUrl(siteUrl) })
        diagnosticsBar.addView(smallButton("Load Admin") { loadUrl(adminUrl) })
        diagnosticsBar.addView(smallButton("Check Internet") { checkInternet() })
        container.addView(diagnosticsBar, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))

        webStatus = TextView(this).apply {
            text = "WebView diagnostics will appear here."
            textSize = 12f
            setTextColor(Color.parseColor("#5E3B00"))
            setBackgroundColor(Color.parseColor("#FFF8D7"))
            setPadding(12, 6, 12, 6)
        }
        container.addView(webStatus, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))

        container.addView(webView, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
        return container
    }

    private fun buildWebView() {
        WebView.setWebContentsDebuggingEnabled(true)
        CookieManager.getInstance().setAcceptCookie(true)
        webView = WebView(this).apply {
            setBackgroundColor(Color.WHITE)
            setLayerType(View.LAYER_TYPE_HARDWARE, null)
            isVerticalScrollBarEnabled = true
            isHorizontalScrollBarEnabled = false
            overScrollMode = View.OVER_SCROLL_IF_CONTENT_SCROLLS
            isNestedScrollingEnabled = true
            settings.javaScriptEnabled = true
            settings.javaScriptCanOpenWindowsAutomatically = true
            settings.domStorageEnabled = true
            settings.blockNetworkLoads = false
            settings.allowContentAccess = true
            settings.allowFileAccess = true
            @Suppress("DEPRECATION")
            settings.databaseEnabled = true
            settings.loadsImagesAutomatically = true
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            settings.cacheMode = WebSettings.LOAD_DEFAULT
            settings.userAgentString = mobileChromeUserAgent
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = false
            settings.builtInZoomControls = false
            settings.displayZoomControls = false
            settings.setSupportMultipleWindows(false)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                settings.safeBrowsingEnabled = false
            }
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
            addJavascriptInterface(PrintBridge(), "AndroidPrintBridge")
            setOnTouchListener { view, event ->
                view.parent?.requestDisallowInterceptTouchEvent(event.action != MotionEvent.ACTION_UP && event.action != MotionEvent.ACTION_CANCEL)
                false
            }

            webChromeClient = object : WebChromeClient() {
                override fun onProgressChanged(view: WebView?, newProgress: Int) {
                    lastProgress = newProgress
                    lastWebUrl = view?.url ?: lastWebUrl
                    setWebStatus("Progress $newProgress% | Current URL: ${view?.url ?: "(none)"}")
                }

                override fun onReceivedTitle(view: WebView?, title: String?) {
                    lastWebTitle = title ?: ""
                    setWebStatus("Title: ${title ?: "(none)"} | URL: ${view?.url ?: "(none)"}")
                }

                override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                    consoleMessage ?: return false
                    setWebStatus("Console ${consoleMessage.messageLevel()} line ${consoleMessage.lineNumber()}: ${consoleMessage.message()}")
                    return false
                }
            }

            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    lastWebUrl = request?.url?.toString() ?: lastWebUrl
                    setWebStatus("Navigating to: ${request?.url ?: "(unknown)"}")
                    return false
                }

                override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                    lastWebUrl = url ?: lastWebUrl
                    lastWebError = "none"
                    startLoadWatchdog(url ?: "(unknown)")
                    setWebStatus("Page started: ${url ?: "(unknown)"}")
                }

                override fun onPageCommitVisible(view: WebView?, url: String?) {
                    lastWebUrl = url ?: lastWebUrl
                    setWebStatus("Page visible: ${url ?: "(unknown)"}")
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    stopLoadWatchdog()
                    val finalUrl = url ?: view?.url ?: "(unknown)"
                    lastWebUrl = finalUrl
                    lastWebTitle = view?.title ?: ""
                    setWebStatus("Page finished. Final URL: $finalUrl | Title: ${view?.title ?: "(none)"}")
                    injectDiagnostics(view)
                    view?.evaluateJavascript(injectionJs(), null)
                }

                override fun onReceivedHttpError(view: WebView?, request: WebResourceRequest?, errorResponse: WebResourceResponse?) {
                    if (request?.isForMainFrame == true) {
                        lastWebError = "HTTP ${errorResponse?.statusCode}: ${errorResponse?.reasonPhrase ?: ""}"
                        setWebStatus("HTTP error ${errorResponse?.statusCode}: ${errorResponse?.reasonPhrase ?: ""} | URL: ${request.url}")
                    }
                }

                override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                    if (request?.isForMainFrame == true) {
                        val message = "Load error ${error?.errorCode}: ${error?.description ?: "unknown"} | URL: ${request.url}"
                        lastWebError = message
                        stopLoadWatchdog()
                        setWebStatus(message)
                        showWebError(message)
                    }
                }

                @Suppress("DEPRECATION")
                override fun onReceivedError(view: WebView?, errorCode: Int, description: String?, failingUrl: String?) {
                    val message = "Load error $errorCode: ${description ?: "unknown"} | URL: ${failingUrl ?: "(unknown)"}"
                    lastWebError = message
                    stopLoadWatchdog()
                    setWebStatus(message)
                    showWebError(message)
                }

                override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: SslError?) {
                    val message = "SSL error ${error?.primaryError} | URL: ${error?.url ?: "(unknown)"}"
                    lastWebError = message
                    stopLoadWatchdog()
                    setWebStatus(message)
                    handler?.cancel()
                    showWebError(message)
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) {
            webView.onResume()
            webView.resumeTimers()
        }
    }

    override fun onPause() {
        if (::webView.isInitialized) {
            webView.onPause()
        }
        super.onPause()
    }

    private fun openAdmin() {
        saveSettings()
        showAdmin()
        setWebStatus("WebView provider: ${webViewProviderLabel()}")
        loadUrlAfterVisible(adminUrl)
    }

    private fun loadUrl(url: String) {
        showAdmin()
        setWebStatus("WebView provider: ${webViewProviderLabel()}")
        loadUrlAfterVisible(url)
    }

    private fun loadUrlAfterVisible(url: String) {
        setWebStatus("Preparing to load: $url")
        webView.postDelayed({
            setWebStatus("Loading: $url")
            webView.loadUrl(url)
        }, 250)
    }

    private fun currentOrAdminUrl(): String = webView.url ?: adminUrl

    private fun startLoadWatchdog(url: String) {
        stopLoadWatchdog()
        loadTimeoutRunnable = Runnable {
            if (lastProgress < 100) {
                setWebStatus("Load timeout after 10s | URL: ${lastWebUrl.ifBlank { url }} | Progress: $lastProgress% | Title: ${lastWebTitle.ifBlank { "(none)" }} | Last error: $lastWebError")
            }
        }
        webHandler.postDelayed(loadTimeoutRunnable!!, 10_000)
    }

    private fun stopLoadWatchdog() {
        loadTimeoutRunnable?.let { webHandler.removeCallbacks(it) }
        loadTimeoutRunnable = null
    }

    private fun clearWebViewData() {
        setWebStatus("Clearing WebView cache, history, form data, and cookies...")
        webView.stopLoading()
        webView.clearCache(true)
        webView.clearHistory()
        webView.clearFormData()
        CookieManager.getInstance().removeAllCookies {
            CookieManager.getInstance().flush()
            webView.loadUrl("about:blank")
            setWebStatus("WebView data cleared. Tap Load Admin and log in again.")
        }
    }

    private fun checkInternet() {
        setWebStatus("Checking native internet access to $exampleUrl ...")
        Thread {
            try {
                val connection = (URL(exampleUrl).openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = timeoutMs
                    readTimeout = timeoutMs
                    setRequestProperty("User-Agent", mobileChromeUserAgent)
                }
                val status = connection.responseCode
                val body = readBody(if (status in 200..299) connection.inputStream else connection.errorStream)
                runOnUiThread {
                    setWebStatus("Native internet OK. HTTP $status from $exampleUrl, ${body.length} chars. WebView provider: ${webViewProviderLabel()}")
                }
            } catch (error: Exception) {
                runOnUiThread {
                    setWebStatus("Native internet failed: ${error.javaClass.simpleName}: ${error.message}. WebView provider: ${webViewProviderLabel()}")
                }
            }
        }.start()
    }

    private fun injectDiagnostics(view: WebView?) {
        view?.evaluateJavascript(
            """
            (function(){
              if (window.__cdDiagInstalled) return;
              window.__cdDiagInstalled = true;
              window.onerror = function(message, source, lineno, colno){
                try { AndroidPrintBridge.webLog('JavaScript error: ' + message + ' at ' + source + ':' + lineno + ':' + colno); } catch(e) {}
                return false;
              };
              window.addEventListener('unhandledrejection', function(event){
                var reason = event.reason && (event.reason.stack || event.reason.message || String(event.reason));
                try { AndroidPrintBridge.webLog('Unhandled promise rejection: ' + reason); } catch(e) {}
              });
            })();
            """.trimIndent(),
            null
        )
    }

    private fun injectionJs(): String = """
        (function(){
          var ORDER = /\b(?:CD|TEST)-\d{6}-[A-Z0-9]{3}\b/i;
          function makeBtn(orderNumber){
            var b = document.createElement('button');
            b.textContent = 'Print to Epson';
            b.className = 'cd-android-print-btn';
            b.style.cssText = 'display:block;width:100%;margin-top:8px;padding:13px;border:0;border-radius:8px;background:#0f7a3d;color:#fff;font-weight:900;font-size:15px;';
            b.addEventListener('click', function(ev){
              ev.preventDefault();
              ev.stopPropagation();
              ev.stopImmediatePropagation();
              b.textContent = 'Sending to Epson...';
              setTimeout(function(){ b.textContent = 'Print to Epson'; }, 1800);
              try { AndroidPrintBridge.printOrder(orderNumber); } catch(e) {}
            }, true);
            return b;
          }
          function likelyOrderCards(){
            var nodes = Array.prototype.slice.call(document.querySelectorAll('article, [class*="order"], [data-order-number], li, section'));
            return nodes.filter(function(node){
              return ORDER.test(node.textContent || '') && !node.querySelector('.cd-android-print-btn');
            });
          }
          function scan(){
            var cards = likelyOrderCards();
            for (var i = 0; i < cards.length; i++){
              var card = cards[i];
              var match = (card.textContent || '').match(ORDER);
              if (!match) continue;
              card.appendChild(makeBtn(match[0]));
            }
            try { AndroidPrintBridge.webLog('Print button scan complete. Cards updated: ' + cards.length + '. URL: ' + location.href); } catch(e) {}
          }
          window.__cdAndroidScanPrintButtons = scan;
          if (!window.__cdAndroidPrintObserver){
            var timer = null;
            window.__cdAndroidPrintObserver = new MutationObserver(function(){
              if (timer) clearTimeout(timer);
              timer = setTimeout(scan, 300);
            });
            window.__cdAndroidPrintObserver.observe(document.body, { childList: true, subtree: true });
          }
          scan();
        })();
    """.trimIndent()

    inner class PrintBridge {
        @JavascriptInterface
        fun printOrder(orderNumber: String) {
            val trimmed = orderNumber.trim()
            if (!orderNumberRegex.matches(trimmed)) {
                runOnUiThread {
                    setAppStatus("Could not read a valid order number from that card.")
                    toast("Invalid order number")
                }
                return
            }
            fetchAndPrint(trimmed)
        }

        @JavascriptInterface
        fun webLog(message: String) {
            setWebStatus(message)
        }
    }

    private fun fetchAndPrint(orderNumber: String) {
        if (orderNumber.isBlank()) {
            setAppStatus("Enter an order number.")
            return
        }
        saveSettings()
        setAppStatus("Printing $orderNumber...")
        Thread {
            try {
                val bytes = fetchTicketPayload(orderNumber)
                sendToPrinter(bytes)
                lastOrderNumber = orderNumber
                lastTicketBytes = bytes
                runOnUiThread {
                    setAppStatus("Printed $orderNumber.", true)
                    toast("Printed $orderNumber")
                }
            } catch (error: Exception) {
                runOnUiThread {
                    setAppStatus(error.message ?: "Print failed.")
                    toast("Print failed")
                }
            }
        }.start()
    }

    private fun fetchTicketPayload(orderNumber: String): ByteArray {
        val encoded = URLEncoder.encode(orderNumber, StandardCharsets.UTF_8.name())
        val endpoint = "${payloadOrigin()}/api/admin/print-ticket/payload?orderNumber=$encoded"
        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = timeoutMs
            readTimeout = timeoutMs
            setRequestProperty("Accept", "application/json")
            val cookies = CookieManager.getInstance().getCookie(adminUrl)
            if (!cookies.isNullOrBlank()) setRequestProperty("Cookie", cookies)
        }
        val status = connection.responseCode
        val response = readBody(if (status in 200..299) connection.inputStream else connection.errorStream)
        if (status == 401) throw IllegalStateException("Payload failed: not logged in inside the app. Open Admin and log in first.")
        if (status !in 200..299) throw IllegalStateException("Payload failed: $endpoint returned $status: ${snippet(response)}")
        val json = JSONObject(response)
        if (!json.optBoolean("success")) throw IllegalStateException("Payload failed: ${snippet(response)}")
        val base64 = json.optString("escposBase64")
        if (base64.isBlank()) throw IllegalStateException("Payload failed: missing escposBase64.")
        return Base64.decode(base64, Base64.DEFAULT)
    }

    private fun printBytes(bytes: ByteArray, label: String) {
        saveSettings()
        setAppStatus("Printing $label...")
        Thread {
            try {
                sendToPrinter(bytes)
                runOnUiThread { setAppStatus("Printed $label.", true) }
            } catch (error: Exception) {
                runOnUiThread { setAppStatus(error.message ?: "Printer failed.") }
            }
        }.start()
    }

    private fun sendToPrinter(bytes: ByteArray) {
        val host = printerHost()
        val port = printerPort()
        try {
            Socket().use { socket ->
                socket.connect(InetSocketAddress(host, port), timeoutMs)
                socket.soTimeout = timeoutMs
                socket.getOutputStream().use { output ->
                    output.write(bytes)
                    output.flush()
                }
            }
        } catch (error: Exception) {
            throw IllegalStateException("Printer failed: $host:$port (${error.message})")
        }
    }

    private fun showWebError(message: String) {
        val html = """
            <html>
              <head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
              <body style="font-family:sans-serif;padding:22px;color:#222">
                <h2 style="color:#b81d1d">WebView load failed</h2>
                <p>${escapeHtml(message)}</p>
                <p>Try Reload, Clear WebView Data, or Open Chrome.</p>
              </body>
            </html>
        """.trimIndent()
        webView.loadDataWithBaseURL(null, html, "text/html", "utf-8", null)
    }

    private fun showAdmin() {
        homeScreen.visibility = View.GONE
        adminScreen.visibility = View.VISIBLE
    }

    private fun showHome() {
        adminScreen.visibility = View.GONE
        homeScreen.visibility = View.VISIBLE
    }

    @Deprecated("Deprecated in Android framework")
    override fun onBackPressed() {
        if (::adminScreen.isInitialized && adminScreen.visibility == View.VISIBLE) {
            if (webView.canGoBack()) webView.goBack() else showHome()
            return
        }
        super.onBackPressed()
    }

    private fun saveSettings() {
        prefs().edit()
            .putString("printerIp", printerIpInput.text.toString().trim().ifBlank { defaultPrinterIp })
            .putString("printerPort", printerPortInput.text.toString().trim().ifBlank { defaultPrinterPort })
            .apply()
    }

    private fun openExternal(url: String) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            setAppStatus("Opened in Chrome.", true)
        } catch (error: Exception) {
            setAppStatus("Open Chrome failed: ${error.message}")
        }
    }

    private fun readBody(stream: java.io.InputStream?): String {
        if (stream == null) return ""
        return stream.bufferedReader().use { it.readText() }
    }

    private fun testTicketBytes(): ByteArray {
        val out = ByteArrayOutputStream()
        fun bytes(vararg values: Int) = out.write(values.map { it.toByte() }.toByteArray())
        fun line(value: String = "") = out.write((value + "\n").toByteArray(StandardCharsets.US_ASCII))
        bytes(0x1b, 0x40)
        bytes(0x1b, 0x61, 0x01)
        bytes(0x1b, 0x45, 0x01)
        bytes(0x1d, 0x21, 0x11)
        line("CHINA DELIGHT")
        bytes(0x1d, 0x21, 0x00)
        line("Android Printer Test")
        bytes(0x1b, 0x45, 0x00)
        line("------------------------------")
        bytes(0x1b, 0x61, 0x00)
        line("Tablet can reach Epson printer.")
        line("Printer: ${printerHost()}:${printerPort()}")
        bytes(0x1b, 0x64, 0x04)
        bytes(0x1d, 0x56, 0x42, 0x00)
        return out.toByteArray()
    }

    private fun payloadOrigin(): String {
        return try {
            val url = URL(adminUrl)
            val authority = if (url.port == -1) url.host else "${url.host}:${url.port}"
            "${url.protocol}://$authority"
        } catch (error: Exception) {
            "https://chinadelightct.com"
        }
    }

    private fun webViewProviderLabel(): String {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val provider = WebView.getCurrentWebViewPackage()
            if (provider == null) "none" else "${provider.packageName} ${provider.versionName}"
        } else {
            "unknown on Android ${Build.VERSION.RELEASE}"
        }
    }

    private fun prefs() = getSharedPreferences("printer-app-settings", MODE_PRIVATE)
    private fun printerHost() = prefs().getString("printerIp", defaultPrinterIp)?.trim()?.ifBlank { defaultPrinterIp } ?: defaultPrinterIp
    private fun printerPort() = prefs().getString("printerPort", defaultPrinterPort)?.trim()?.toIntOrNull() ?: 9100

    private fun setAppStatus(message: String, autoClear: Boolean = false) {
        clearStatusRunnable?.let { handler.removeCallbacks(it) }
        clearStatusRunnable = null
        runOnUiThread {
            appStatus.text = message
            if (autoClear) {
                clearStatusRunnable = Runnable { appStatus.text = "Ready." }
                handler.postDelayed(clearStatusRunnable!!, 6000)
            }
        }
    }

    private fun setWebStatus(message: String) {
        runOnUiThread {
            if (::webStatus.isInitialized) webStatus.text = message
        }
    }

    private fun statusText(message: String) = TextView(this).apply {
        text = message
        textSize = 16f
        setTextColor(Color.parseColor("#222222"))
        setPadding(0, 8, 0, 18)
    }

    private fun input(value: String, hintText: String) = EditText(this).apply {
        setText(value)
        hint = hintText
        textSize = 18f
        setSingleLine(true)
        minHeight = 76
    }

    private fun button(label: String, onClick: () -> Unit) = Button(this).apply {
        text = label
        textSize = 18f
        minHeight = 104
        setOnClickListener { onClick() }
    }

    private fun smallButton(label: String, onClick: () -> Unit) = Button(this).apply {
        text = label
        textSize = 12f
        minHeight = 66
        setPadding(8, 0, 8, 0)
        setOnClickListener { onClick() }
    }

    private fun section(label: String) = TextView(this).apply {
        text = label
        textSize = 15f
        setTypeface(typeface, Typeface.BOLD)
        setTextColor(Color.parseColor("#B81D1D"))
        setPadding(0, 30, 0, 8)
    }

    private fun note(message: String) = TextView(this).apply {
        text = message
        textSize = 15f
        setTextColor(Color.parseColor("#5C5148"))
        setPadding(0, 8, 0, 10)
    }

    private fun toast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }

    private fun matchParent() = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)

    private fun snippet(value: String): String {
        return value.replace(Regex("\\s+"), " ").take(240)
    }

    private fun escapeHtml(value: String): String {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;")
    }
}
