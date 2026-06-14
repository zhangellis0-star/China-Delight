package com.chinadelight.printbridge

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.util.Base64
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.graphics.Bitmap
import android.net.http.SslError
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

/**
 * China Delight Kitchen Printer bridge.
 *
 * Two screens managed by visibility:
 *  - Controls screen (scrollable): printer settings, main actions, manual backup, status log.
 *  - Admin screen (full screen): the website admin loaded in a WebView that fills the area so the
 *    page scrolls natively. A small injected "Print to Epson" button is added to each order card;
 *    tapping it fetches the existing payload endpoint (using the admin session cookie) and prints
 *    the decoded ESC/POS bytes straight to the Epson over raw TCP. Manual + test printing remain.
 */
class MainActivity : Activity() {
    private val defaultAdminUrl = "https://chinadelightct.com/admin"
    private val defaultPrinterIp = "192.168.1.172"
    private val defaultPrinterPort = "9100"
    private val printerTimeoutMs = 5000
    private val mobileChromeUserAgent =
        "Mozilla/5.0 (Linux; Android 13; Lenovo Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"

    private lateinit var adminUrlInput: EditText
    private lateinit var orderNumberInput: EditText
    private lateinit var printerIpInput: EditText
    private lateinit var printerPortInput: EditText
    private lateinit var statusText: TextView

    private lateinit var controlsScreen: ScrollView
    private lateinit var adminScreen: LinearLayout
    private lateinit var webView: WebView
    private lateinit var webStatus: TextView

    private lateinit var fetchTicketButton: Button
    private lateinit var printOrderButton: Button
    private lateinit var testPrintButton: Button

    private var lastOrderNumber: String = ""
    private var lastTicketBytes: ByteArray? = null

    private val orderNumberRegex = Regex("\\b(?:CD|TEST)-\\d{6}-[A-Z0-9]{3}\\b", RegexOption.IGNORE_CASE)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val prefs = getSharedPreferences("bridge-settings", MODE_PRIVATE)
        adminUrlInput = editText(prefs.getString("adminUrl", defaultAdminUrl) ?: defaultAdminUrl, "Website/admin URL")
        orderNumberInput = editText("", "Order number (e.g. CD-123456-ABC)")
        printerIpInput = editText(prefs.getString("printerIp", defaultPrinterIp) ?: defaultPrinterIp, "Printer IP")
        printerPortInput = editText(prefs.getString("printerPort", defaultPrinterPort) ?: defaultPrinterPort, "Printer port")
        statusText = TextView(this).apply {
            text = "Ready. Open Admin and log in once so this app can reuse the session cookie."
            textSize = 16f
            setPadding(0, 16, 0, 16)
        }

        buildWebView()
        controlsScreen = buildControlsScreen()
        adminScreen = buildAdminScreen()

        val rootFrame = FrameLayout(this)
        rootFrame.addView(controlsScreen, matchParent())
        rootFrame.addView(adminScreen, matchParent())
        adminScreen.visibility = View.GONE
        setContentView(rootFrame)

        updateButtonStates()
    }

    // ---- Controls screen --------------------------------------------------

    private fun buildControlsScreen(): ScrollView {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(28, 28, 28, 28)
        }

        root.addView(TextView(this).apply {
            text = "China Delight Kitchen Printer"
            textSize = 24f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        })

        root.addView(sectionLabel("Printer settings"))
        root.addView(printerIpInput)
        root.addView(printerPortInput)
        root.addView(adminUrlInput)
        root.addView(button("Save settings") {
            saveSettings()
            setStatus("Settings saved. Printer ${printerHost()}:${printerPort()}.")
        })

        root.addView(sectionLabel("Main actions"))
        root.addView(button("Open Admin (one-tap printing)") { openAdmin() })
        testPrintButton = button("Test Print") {
            saveSettings()
            printBytes(testTicketBytes(), "Test ticket")
        }
        root.addView(testPrintButton)

        root.addView(sectionLabel("Manual print backup"))
        root.addView(orderNumberInput)
        fetchTicketButton = button("Fetch ticket") { fetchTicketOnly() }
        root.addView(fetchTicketButton)
        printOrderButton = button("Print order") { fetchAndPrintOrder() }
        root.addView(printOrderButton)

        root.addView(sectionLabel("Status"))
        root.addView(statusText)

        // Keep button enabled-state in sync with the inputs they depend on.
        orderNumberInput.addTextChangedListener(simpleWatcher { updateButtonStates() })
        printerIpInput.addTextChangedListener(simpleWatcher { updateButtonStates() })

        return ScrollView(this).apply { addView(root) }
    }

    // ---- Admin screen (full-screen WebView) -------------------------------

    private fun buildAdminScreen(): LinearLayout {
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.WHITE)
        }

        val topBar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(16, 8, 16, 8)
            setBackgroundColor(Color.parseColor("#FFF7E8"))
        }
        topBar.addView(button("← Back") { showControlsScreen() })
        topBar.addView(button("Reload") { reloadAdmin() })
        topBar.addView(button("Open Chrome") { openExternal(adminUrl()) })
        topBar.addView(button("Re-scan orders") {
            webView.evaluateJavascript(injectionJs(), null)
            setStatus("Re-added print buttons to visible orders.")
        })
        container.addView(topBar, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))

        // Visible load/error status line so the WebView never just shows blank white.
        webStatus = TextView(this).apply {
            text = ""
            textSize = 12f
            setPadding(16, 6, 16, 6)
            setTextColor(Color.parseColor("#7a3d00"))
            setBackgroundColor(Color.parseColor("#FFF7CC"))
        }
        container.addView(webStatus, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))

        // WebView fills the rest of the screen (weight = 1) and scrolls natively.
        container.addView(webView, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
        return container
    }

    private fun buildWebView() {
        WebView.setWebContentsDebuggingEnabled(true)
        webView = WebView(this).apply {
            setBackgroundColor(Color.WHITE)
            setLayerType(View.LAYER_TYPE_HARDWARE, null)
            isVerticalScrollBarEnabled = true
            isHorizontalScrollBarEnabled = false
            overScrollMode = View.OVER_SCROLL_IF_CONTENT_SCROLLS
            settings.javaScriptEnabled = true
            settings.javaScriptCanOpenWindowsAutomatically = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.loadsImagesAutomatically = true
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            settings.cacheMode = WebSettings.LOAD_NO_CACHE
            settings.userAgentString = mobileChromeUserAgent
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = false
            settings.builtInZoomControls = false
            settings.displayZoomControls = false
            settings.mediaPlaybackRequiresUserGesture = false
            settings.setSupportMultipleWindows(false)
            isNestedScrollingEnabled = true
            setOnTouchListener { view, event ->
                view.parent?.requestDisallowInterceptTouchEvent(event.action != MotionEvent.ACTION_UP && event.action != MotionEvent.ACTION_CANCEL)
                false
            }
            CookieManager.getInstance().setAcceptCookie(true)
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
            addJavascriptInterface(PrintBridge(), "AndroidPrintBridge")

            webChromeClient = object : WebChromeClient() {
                override fun onProgressChanged(view: WebView?, newProgress: Int) {
                    if (newProgress in 1..99) setWebStatus("Loading ${view?.url ?: adminUrl()} - $newProgress%")
                    if (newProgress == 100) setWebStatus("Loaded ${view?.url ?: adminUrl()} - 100%")
                }

                override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                    consoleMessage ?: return false
                    setWebStatus("Console ${consoleMessage.messageLevel()}: ${consoleMessage.message()}")
                    return false
                }
            }

            webViewClient = object : WebViewClient() {
                override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                    setWebStatus("Loading ${url ?: ""} ...")
                }
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    if (url != null && url != "about:blank" && !url.startsWith("data:")) {
                        setWebStatus("Loaded $url")
                    }
                    view?.evaluateJavascript(injectionJs(), null)
                }
                override fun onPageCommitVisible(view: WebView?, url: String?) {
                    setWebStatus("Page visible: ${url ?: ""}")
                }
                override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                    if (request?.isForMainFrame == true) {
                        val desc = error?.description?.toString() ?: "Load failed"
                        val code = error?.errorCode
                        setWebStatus("Error${if (code != null) " $code" else ""}: $desc - ${request.url}")
                        showWebError(view, request.url.toString(), desc, code)
                    }
                }
                @Suppress("DEPRECATION")
                override fun onReceivedError(view: WebView?, errorCode: Int, description: String?, failingUrl: String?) {
                    setWebStatus("Error $errorCode: ${description ?: ""} - ${failingUrl ?: ""}")
                    showWebError(view, failingUrl ?: "", description ?: "Load failed", errorCode)
                }
                override fun onReceivedHttpError(view: WebView?, request: WebResourceRequest?, errorResponse: WebResourceResponse?) {
                    if (request?.isForMainFrame == true) {
                        setWebStatus("HTTP ${errorResponse?.statusCode} ${errorResponse?.reasonPhrase ?: ""} - ${request.url}")
                    }
                }
                override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: SslError?) {
                    setWebStatus("SSL error (${error?.primaryError}) - ${error?.url}. Page not loaded for safety.")
                    handler?.cancel()
                }
            }
        }
    }

    private fun openAdmin() {
        saveSettings()
        showAdminScreen()
        val url = adminUrl()
        setWebStatus("Loading $url ...")
        setStatus("Admin opened. Log in if needed, then tap \"Print to Epson\" on an order.")
        // Load after the view is visible + laid out so the WebView surface renders (avoids blank white).
        webView.postDelayed({ webView.loadUrl(url) }, 250)
    }

    private fun reloadAdmin() {
        val url = adminUrl()
        setWebStatus("Loading $url ...")
        webView.postDelayed({ webView.loadUrl(url) }, 150)
    }

    private fun openExternal(url: String) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            setStatus("Opened $url in Chrome/browser.")
        } catch (error: Exception) {
            setStatus("Could not open Chrome/browser: ${error.message}")
        }
    }

    private fun setWebStatus(message: String) {
        runOnUiThread { if (::webStatus.isInitialized) webStatus.text = message }
    }

    private fun showWebError(view: WebView?, url: String, description: String, code: Int?) {
        val html = "<html><head><meta name='viewport' content='width=device-width,initial-scale=1'></head>" +
            "<body style='font-family:sans-serif;padding:24px;color:#222'>" +
            "<h2 style='color:#b81d1d'>Could not load the admin page</h2>" +
            "<p><b>URL:</b> ${escapeHtml(url)}</p>" +
            "<p><b>Error:</b> ${escapeHtml(description)}${if (code != null) " (code $code)" else ""}</p>" +
            "<p>Check the tablet Wi-Fi / internet connection, then tap RELOAD in the top bar.</p>" +
            "</body></html>"
        view?.loadDataWithBaseURL(null, html, "text/html", "utf-8", null)
    }

    private fun escapeHtml(value: String): String {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;")
    }

    private fun showAdminScreen() {
        controlsScreen.visibility = View.GONE
        adminScreen.visibility = View.VISIBLE
    }

    private fun showControlsScreen() {
        adminScreen.visibility = View.GONE
        controlsScreen.visibility = View.VISIBLE
        updateButtonStates()
    }

    override fun onBackPressed() {
        if (adminScreen.visibility == View.VISIBLE) {
            if (webView.canGoBack()) webView.goBack() else showControlsScreen()
            return
        }
        super.onBackPressed()
    }

    // ---- One-tap print bridge (called from injected JS) -------------------

    inner class PrintBridge {
        // Invoked on the WebView's binder thread (not the UI thread).
        @JavascriptInterface
        fun printOrder(orderNumber: String) {
            val trimmed = orderNumber.trim()
            if (!orderNumberRegex.matches(trimmed)) {
                runOnUiThread {
                    setStatus("Could not read a valid order number from that order.")
                    toast("Invalid order number")
                }
                return
            }
            runOnUiThread { setStatus("Printing $trimmed...") }
            Thread {
                try {
                    val bytes = fetchTicketPayload(trimmed)
                    sendToPrinter(bytes)
                    lastOrderNumber = trimmed
                    lastTicketBytes = bytes
                    runOnUiThread {
                        setStatus("Printed $trimmed successfully.")
                        toast("Printed $trimmed")
                    }
                } catch (error: Exception) {
                    runOnUiThread {
                        setStatus("Print failed for $trimmed: ${error.message}")
                        toast("Print failed: ${error.message}")
                    }
                }
            }.start()
        }
    }

    /** JS injected into the admin page: adds a "Print to Epson" button to each order card. */
    private fun injectionJs(): String = """
        (function(){
          var ORDER = /\b(?:CD|TEST)-\d{6}-[A-Z0-9]{3}\b/i;
          function makeBtn(orderNumber){
            var b = document.createElement('button');
            b.textContent = '🖨 Print to Epson';
            b.className = 'cd-print-btn';
            b.style.cssText = 'display:block;width:100%;margin-top:8px;padding:12px;border:0;border-radius:8px;background:#0f7a3d;color:#fff;font-weight:800;font-size:15px;';
            b.addEventListener('click', function(ev){
              ev.preventDefault();
              ev.stopPropagation();
              ev.stopImmediatePropagation();
              b.textContent = 'Sending...';
              setTimeout(function(){ b.textContent = '🖨 Print to Epson'; }, 1500);
              try { AndroidPrintBridge.printOrder(orderNumber); } catch (e) {}
            }, false);
            return b;
          }
          function scan(){
            var cards = document.querySelectorAll('article');
            for (var i=0;i<cards.length;i++){
              var c = cards[i];
              if (c.querySelector('.cd-print-btn')) continue;
              var m = (c.textContent || '').match(ORDER);
              if (!m) continue;
              c.appendChild(makeBtn(m[0]));
            }
          }
          window.__cdScan = scan;
          if (!window.__cdObserver){
            var timer = null;
            window.__cdObserver = new MutationObserver(function(){
              if (timer) clearTimeout(timer);
              timer = setTimeout(scan, 250);
            });
            window.__cdObserver.observe(document.body, { childList: true, subtree: true });
          }
          scan();
        })();
    """.trimIndent()

    // ---- Manual backup flow (unchanged behavior) --------------------------

    private fun fetchTicketOnly() {
        val orderNumber = orderNumberInput.text.toString().trim()
        if (orderNumber.isBlank()) {
            setStatus("Enter an order number first.")
            return
        }
        saveSettings()
        setStatus("Fetching ticket payload for $orderNumber...")
        Thread {
            try {
                val bytes = fetchTicketPayload(orderNumber)
                lastOrderNumber = orderNumber
                lastTicketBytes = bytes
                runOnUiThread { setStatus("Fetched $orderNumber (${bytes.size} bytes). Ready to print.") }
            } catch (error: Exception) {
                runOnUiThread { setStatus("Fetch failed: ${error.message}") }
            }
        }.start()
    }

    private fun fetchAndPrintOrder() {
        val orderNumber = orderNumberInput.text.toString().trim()
        if (orderNumber.isBlank()) {
            setStatus("Enter an order number first.")
            return
        }
        saveSettings()
        setStatus("Fetching and printing $orderNumber...")
        Thread {
            try {
                val bytes = if (lastOrderNumber == orderNumber && lastTicketBytes != null) {
                    lastTicketBytes!!
                } else {
                    fetchTicketPayload(orderNumber).also {
                        lastOrderNumber = orderNumber
                        lastTicketBytes = it
                    }
                }
                sendToPrinter(bytes)
                runOnUiThread { setStatus("Printed order $orderNumber successfully.") }
            } catch (error: Exception) {
                runOnUiThread { setStatus("Print failed: ${error.message}") }
            }
        }.start()
    }

    private fun printBytes(bytes: ByteArray, label: String) {
        setStatus("Printing $label...")
        Thread {
            try {
                sendToPrinter(bytes)
                runOnUiThread { setStatus("$label printed successfully.") }
            } catch (error: Exception) {
                runOnUiThread { setStatus("$label failed: ${error.message}") }
            }
        }.start()
    }

    // ---- Networking + printing (reused raw TCP code) ----------------------

    private fun fetchTicketPayload(orderNumber: String): ByteArray {
        val encodedOrder = URLEncoder.encode(orderNumber, StandardCharsets.UTF_8.name())
        val url = URL("${payloadUrl()}?orderNumber=$encodedOrder")
        val connection = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = printerTimeoutMs
            readTimeout = printerTimeoutMs
            setRequestProperty("Accept", "application/json")
            val cookies = CookieManager.getInstance().getCookie(adminUrl())
            if (!cookies.isNullOrBlank()) setRequestProperty("Cookie", cookies)
        }
        val status = connection.responseCode
        val body = readBody(if (status in 200..299) connection.inputStream else connection.errorStream)
        if (status == 401) throw IllegalStateException("Not logged in. Open Admin in this app and sign in first.")
        if (status !in 200..299) throw IllegalStateException("Payload endpoint returned $status: $body")
        val json = JSONObject(body)
        if (!json.optBoolean("success")) throw IllegalStateException(json.optString("error", "Payload request failed."))
        val base64 = json.optString("escposBase64")
        if (base64.isBlank()) throw IllegalStateException("Payload did not include escposBase64.")
        return Base64.decode(base64, Base64.DEFAULT)
    }

    private fun sendToPrinter(bytes: ByteArray) {
        val host = printerHost()
        val port = printerPort()
        try {
            Socket().use { socket ->
                socket.connect(InetSocketAddress(host, port), printerTimeoutMs)
                socket.soTimeout = printerTimeoutMs
                socket.getOutputStream().use { output ->
                    output.write(bytes)
                    output.flush()
                }
            }
        } catch (error: Exception) {
            throw IllegalStateException("Could not reach printer at $host:$port (${error.message})")
        }
    }

    private fun readBody(stream: java.io.InputStream?): String {
        if (stream == null) return ""
        return stream.bufferedReader().use { it.readText() }
    }

    // ---- Settings + helpers ----------------------------------------------

    private fun saveSettings() {
        getSharedPreferences("bridge-settings", MODE_PRIVATE).edit()
            .putString("adminUrl", adminUrlInput.text.toString().trim().ifBlank { defaultAdminUrl })
            .putString("printerIp", printerIpInput.text.toString().trim().ifBlank { defaultPrinterIp })
            .putString("printerPort", printerPortInput.text.toString().trim().ifBlank { defaultPrinterPort })
            .apply()
    }

    private fun prefs() = getSharedPreferences("bridge-settings", MODE_PRIVATE)
    private fun adminUrl() = prefs().getString("adminUrl", defaultAdminUrl)?.trim()?.ifBlank { defaultAdminUrl } ?: defaultAdminUrl
    private fun printerHost() = prefs().getString("printerIp", defaultPrinterIp)?.trim()?.ifBlank { defaultPrinterIp } ?: defaultPrinterIp
    private fun printerPort() = prefs().getString("printerPort", defaultPrinterPort)?.trim()?.toIntOrNull() ?: 9100

    // Derive the payload endpoint from the admin URL origin so the cookie host always matches.
    private fun payloadUrl(): String {
        return try {
            val u = URL(adminUrl())
            val authority = if (u.port == -1) u.host else "${u.host}:${u.port}"
            "${u.protocol}://$authority/api/admin/print-ticket/payload"
        } catch (error: Exception) {
            "https://chinadelightct.com/api/admin/print-ticket/payload"
        }
    }

    private fun updateButtonStates() {
        val hasOrder = orderNumberInput.text.toString().trim().isNotBlank()
        val hasPrinter = printerIpInput.text.toString().trim().isNotBlank()
        setEnabled(fetchTicketButton, hasOrder)
        setEnabled(printOrderButton, hasOrder && hasPrinter)
        setEnabled(testPrintButton, hasPrinter)
    }

    private fun setEnabled(button: Button, enabled: Boolean) {
        button.isEnabled = enabled
        button.alpha = if (enabled) 1f else 0.5f
    }

    private fun setStatus(message: String) {
        runOnUiThread { statusText.text = message }
    }

    private fun toast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }

    private fun editText(value: String, hint: String) = EditText(this).apply {
        setText(value)
        this.hint = hint
        textSize = 16f
        setSingleLine(true)
    }

    private fun button(label: String, onClick: () -> Unit) = Button(this).apply {
        text = label
        textSize = 16f
        minHeight = 120
        setOnClickListener { onClick() }
    }

    private fun sectionLabel(text: String) = TextView(this).apply {
        this.text = text
        textSize = 13f
        setTypeface(typeface, android.graphics.Typeface.BOLD)
        setTextColor(Color.parseColor("#B81D1D"))
        setPadding(0, 28, 0, 8)
    }

    private fun matchParent() = FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT
    )

    private fun simpleWatcher(onChange: () -> Unit) = object : android.text.TextWatcher {
        override fun afterTextChanged(s: android.text.Editable?) = onChange()
        override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
        override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
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
        line("Android Bridge Test")
        bytes(0x1b, 0x45, 0x00)
        line("------------------------------")
        bytes(0x1b, 0x61, 0x00)
        line("If this printed, the tablet can")
        line("reach the Epson printer over TCP.")
        line()
        line("Printer: ${printerHost()}:${printerPort()}")
        bytes(0x1b, 0x64, 0x04)
        bytes(0x1d, 0x56, 0x42, 0x00)
        return out.toByteArray()
    }
}
