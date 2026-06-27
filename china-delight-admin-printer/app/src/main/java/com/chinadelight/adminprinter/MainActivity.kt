package com.chinadelight.adminprinter

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Color
import android.net.http.SslError
import android.os.Bundle
import android.util.Base64
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.webkit.CookieManager
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
 * China Delight Admin Printer — a simple two-screen app.
 *
 *  - Home: printer IP/port settings, Open Admin, Test Print, status.
 *  - Admin: the real admin website in a full-screen WebView. After login the app injects a
 *    "Print to Epson" button onto each order card; tapping it reads the order number, calls the
 *    existing payload endpoint with the WebView's admin session cookie, decodes escposBase64, and
 *    sends the ESC/POS bytes straight to the Epson printer over a raw TCP socket.
 */
class MainActivity : Activity() {
    private val adminUrl = "https://www.chinadelightct.com/admin"
    private val defaultPrinterIp = "192.168.1.172"
    private val defaultPrinterPort = "9100"
    private val timeoutMs = 6000
    private val mobileUserAgent =
        "Mozilla/5.0 (Linux; Android 13; Lenovo Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"

    private lateinit var printerIpInput: EditText
    private lateinit var printerPortInput: EditText
    private lateinit var statusText: TextView

    private lateinit var homeScreen: ScrollView
    private lateinit var adminScreen: LinearLayout
    private lateinit var webView: WebView
    private lateinit var webStatus: TextView

    private val orderNumberRegex = Regex("\\b(?:CD|TEST)-\\d{6}-[A-Z0-9]{3}\\b", RegexOption.IGNORE_CASE)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val prefs = getSharedPreferences("admin-printer", MODE_PRIVATE)
        printerIpInput = editText(prefs.getString("printerIp", defaultPrinterIp) ?: defaultPrinterIp, "Printer IP")
        printerPortInput = editText(prefs.getString("printerPort", defaultPrinterPort) ?: defaultPrinterPort, "Printer port")
        statusText = TextView(this).apply {
            text = "Ready. Tap Open Admin and log in once; then tap Print to Epson on an order."
            textSize = 16f
            setPadding(0, 16, 0, 16)
        }

        buildWebView()
        homeScreen = buildHomeScreen()
        adminScreen = buildAdminScreen()

        val root = FrameLayout(this)
        root.addView(homeScreen, matchParent())
        root.addView(adminScreen, matchParent())
        adminScreen.visibility = View.GONE
        setContentView(root)
    }

    // ---- Home screen ------------------------------------------------------

    private fun buildHomeScreen(): ScrollView {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 32, 32, 32)
        }
        root.addView(TextView(this).apply {
            text = "China Delight Admin Printer"
            textSize = 24f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        })

        root.addView(sectionLabel("Printer settings"))
        root.addView(printerIpInput)
        root.addView(printerPortInput)
        root.addView(button("Save settings") {
            saveSettings()
            setStatus("Saved. Printer ${printerHost()}:${printerPort()}.")
        })

        root.addView(sectionLabel("Actions"))
        root.addView(button("Open Admin") { openAdmin() })
        root.addView(button("Test Print") {
            saveSettings()
            printBytes(testTicketBytes(), "Test ticket")
        })

        root.addView(sectionLabel("Status"))
        root.addView(statusText)

        return ScrollView(this).apply { addView(root) }
    }

    // ---- Admin screen (full-screen WebView) -------------------------------

    private fun buildAdminScreen(): LinearLayout {
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.WHITE)
        }

        // Slim top bar: tiny controls + inline status in one thin row, so the WebView gets
        // almost the whole screen for orders. (Print buttons are injected automatically.)
        val topBar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(8, 2, 8, 2)
            setBackgroundColor(Color.parseColor("#FFF7E8"))
        }
        topBar.addView(smallButton("‹ Home") { showHomeScreen() })
        topBar.addView(smallButton("Reload") { reloadAdmin() })
        topBar.addView(smallButton("Rescan") {
            webView.evaluateJavascript(injectionJs(), null)
            setWebStatus("Re-added Print to Epson buttons.")
        })
        webStatus = TextView(this).apply {
            text = ""
            textSize = 11f
            setPadding(12, 0, 8, 0)
            setSingleLine(true)
            ellipsize = android.text.TextUtils.TruncateAt.END
            setTextColor(Color.parseColor("#7a3d00"))
        }
        topBar.addView(webStatus, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        container.addView(topBar, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))

        // WebView fills the rest of the screen and scrolls natively.
        container.addView(webView, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
        return container
    }

    private fun buildWebView() {
        webView = WebView(this).apply {
            setBackgroundColor(Color.WHITE)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            @Suppress("DEPRECATION")
            settings.databaseEnabled = true
            settings.loadsImagesAutomatically = true
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            settings.cacheMode = WebSettings.LOAD_DEFAULT
            settings.userAgentString = mobileUserAgent
            isNestedScrollingEnabled = true
            CookieManager.getInstance().setAcceptCookie(true)
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
            addJavascriptInterface(PrintBridge(), "AndroidPrintBridge")

            webChromeClient = object : WebChromeClient() {
                override fun onProgressChanged(view: WebView?, newProgress: Int) {
                    if (newProgress in 1..99) setWebStatus("Loading ${view?.url ?: adminUrl} - $newProgress%")
                }
            }

            webViewClient = object : WebViewClient() {
                override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                    setWebStatus("Loading ${url ?: ""} ...")
                }
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    if (url != null && url != "about:blank" && !url.startsWith("data:")) setWebStatus("Loaded $url")
                    view?.evaluateJavascript(injectionJs(), null)
                }
                override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                    if (request?.isForMainFrame == true) {
                        val desc = error?.description?.toString() ?: "Load failed"
                        setWebStatus("Error ${error?.errorCode}: $desc - ${request.url}")
                        showWebError(view, request.url.toString(), desc, error?.errorCode)
                    }
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
        setWebStatus("Loading $adminUrl ...")
        setStatus("Admin opened. Log in if needed, then tap Print to Epson on an order.")
        // Load after the view is visible/laid out so the WebView surface renders (avoids blank white).
        webView.post { webView.loadUrl(adminUrl) }
    }

    private fun reloadAdmin() {
        setWebStatus("Loading $adminUrl ...")
        webView.loadUrl(adminUrl)
    }

    private fun showAdminScreen() {
        homeScreen.visibility = View.GONE
        adminScreen.visibility = View.VISIBLE
    }

    private fun showHomeScreen() {
        adminScreen.visibility = View.GONE
        homeScreen.visibility = View.VISIBLE
    }

    override fun onBackPressed() {
        if (adminScreen.visibility == View.VISIBLE) {
            if (webView.canGoBack()) webView.goBack() else showHomeScreen()
            return
        }
        super.onBackPressed()
    }

    // ---- One-tap print bridge (called from injected JS) -------------------

    inner class PrintBridge {
        // Invoked on the WebView's binder thread (not the UI thread).
        @JavascriptInterface
        fun printOrder(orderNumber: String) {
            printOrderInternal(orderNumber, null)
        }

        @JavascriptInterface
        fun printOrderWithRequest(orderNumber: String, requestId: String) {
            printOrderInternal(orderNumber, requestId)
        }

        private fun printOrderInternal(orderNumber: String, requestId: String?) {
            val trimmed = orderNumber.trim()
            if (!orderNumberRegex.matches(trimmed)) {
                runOnUiThread {
                    setWebStatus("No valid order number found on that card.")
                    toast("No order number selected")
                    notifyPrintResult(requestId, trimmed, false, "No valid order number found on that card.")
                }
                return
            }
            runOnUiThread { setWebStatus("Printing $trimmed ...") }
            Thread {
                try {
                    val bytes = fetchTicketPayload(trimmed)
                    sendToPrinter(bytes)
                    runOnUiThread {
                        setWebStatus("Printed $trimmed successfully.")
                        toast("Printed $trimmed")
                        notifyPrintResult(requestId, trimmed, true, "Printed through tablet bridge.")
                    }
                } catch (error: Exception) {
                    runOnUiThread {
                        setWebStatus("Print failed for $trimmed: ${error.message}")
                        toast("Print failed: ${error.message}")
                        notifyPrintResult(requestId, trimmed, false, error.message ?: "Print failed.")
                    }
                }
            }.start()
        }
    }

    private fun notifyPrintResult(requestId: String?, orderNumber: String, ok: Boolean, message: String) {
        if (requestId.isNullOrBlank()) return
        val detail = JSONObject()
            .put("requestId", requestId)
            .put("orderNumber", orderNumber)
            .put("ok", ok)
            .put("message", message)
        val script = "window.dispatchEvent(new CustomEvent('cd-bridge-print-result', { detail: ${detail.toString()} }));"
        webView.evaluateJavascript(script, null)
    }

    /** JS injected into the admin page: adds a "Print to Epson" button to each order card. */
    private fun injectionJs(): String = """
        (function(){
          var ORDER = /\b(?:CD|TEST)-\d{6}-[A-Z0-9]{3}\b/i;
          function makeBtn(orderNumber){
            var b = document.createElement('button');
            b.textContent = '🖨 Print to Epson';
            b.className = 'cd-print-btn';
            b.style.cssText = 'display:block;width:100%;margin-top:8px;padding:14px;border:0;border-radius:8px;background:#0f7a3d;color:#fff;font-weight:800;font-size:16px;';
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

    // ---- Networking + printing -------------------------------------------

    private fun fetchTicketPayload(orderNumber: String): ByteArray {
        val encoded = URLEncoder.encode(orderNumber, StandardCharsets.UTF_8.name())
        val url = URL("${payloadUrl()}?orderNumber=$encoded")
        val connection = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = timeoutMs
            readTimeout = timeoutMs
            setRequestProperty("Accept", "application/json")
            val cookies = CookieManager.getInstance().getCookie(adminUrl)
            if (!cookies.isNullOrBlank()) setRequestProperty("Cookie", cookies)
        }
        val status = connection.responseCode
        val body = readBody(if (status in 200..299) connection.inputStream else connection.errorStream)
        if (status == 401) throw IllegalStateException("Not logged in. Open Admin and sign in first.")
        if (status !in 200..299) throw IllegalStateException("Payload endpoint returned $status: $body")
        val json = JSONObject(body)
        if (!json.optBoolean("success")) throw IllegalStateException(json.optString("error", "Payload request failed."))
        val base64 = json.optString("escposBase64")
        if (base64.isBlank()) throw IllegalStateException("Payload did not include escposBase64.")
        return Base64.decode(base64, Base64.DEFAULT)
    }

    private fun printBytes(bytes: ByteArray, label: String) {
        setStatus("Printing $label ...")
        Thread {
            try {
                sendToPrinter(bytes)
                runOnUiThread { setStatus("$label printed successfully.") }
            } catch (error: Exception) {
                runOnUiThread { setStatus("$label failed: ${error.message}") }
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
            throw IllegalStateException("Could not reach printer at $host:$port (${error.message})")
        }
    }

    private fun readBody(stream: java.io.InputStream?): String {
        if (stream == null) return ""
        return stream.bufferedReader().use { it.readText() }
    }

    // ---- Settings + helpers ----------------------------------------------

    private fun saveSettings() {
        getSharedPreferences("admin-printer", MODE_PRIVATE).edit()
            .putString("printerIp", printerIpInput.text.toString().trim().ifBlank { defaultPrinterIp })
            .putString("printerPort", printerPortInput.text.toString().trim().ifBlank { defaultPrinterPort })
            .apply()
    }

    private fun prefs() = getSharedPreferences("admin-printer", MODE_PRIVATE)
    private fun printerHost() = prefs().getString("printerIp", defaultPrinterIp)?.trim()?.ifBlank { defaultPrinterIp } ?: defaultPrinterIp
    private fun printerPort() = prefs().getString("printerPort", defaultPrinterPort)?.trim()?.toIntOrNull() ?: 9100

    // Payload endpoint on the same origin as the admin URL (so the session cookie matches).
    private fun payloadUrl(): String {
        return try {
            val u = URL(adminUrl)
            val authority = if (u.port == -1) u.host else "${u.host}:${u.port}"
            "${u.protocol}://$authority/api/admin/print-ticket/payload"
        } catch (error: Exception) {
            "https://www.chinadelightct.com/api/admin/print-ticket/payload"
        }
    }

    private fun setStatus(message: String) {
        runOnUiThread { statusText.text = message }
    }

    private fun setWebStatus(message: String) {
        runOnUiThread { if (::webStatus.isInitialized) webStatus.text = message }
    }

    private fun toast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
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

    // Compact button for the slim admin top bar (small text, minimal padding).
    private fun smallButton(label: String, onClick: () -> Unit) = Button(this).apply {
        text = label
        textSize = 12f
        isAllCaps = false
        minWidth = 0
        minHeight = 0
        minimumWidth = 0
        minimumHeight = 0
        setPadding(22, 10, 22, 10)
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
        line("Admin Printer Test")
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
