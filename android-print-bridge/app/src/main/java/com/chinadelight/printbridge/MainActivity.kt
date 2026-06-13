package com.chinadelight.printbridge

import android.app.Activity
import android.os.Bundle
import android.util.Base64
import android.view.View
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.InetSocketAddress
import java.net.Socket
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

class MainActivity : Activity() {
    private val defaultAdminUrl = "https://chinadelightct.com/admin"
    private val defaultPayloadUrl = "https://chinadelightct.com/api/admin/print-ticket/payload"
    private val defaultPrinterIp = "192.168.1.172"
    private val defaultPrinterPort = "9100"
    private val printerTimeoutMs = 5000

    private lateinit var adminUrlInput: EditText
    private lateinit var orderNumberInput: EditText
    private lateinit var printerIpInput: EditText
    private lateinit var printerPortInput: EditText
    private lateinit var statusText: TextView
    private lateinit var webView: WebView

    private var lastOrderNumber: String = ""
    private var lastTicketBytes: ByteArray? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val prefs = getSharedPreferences("bridge-settings", MODE_PRIVATE)
        adminUrlInput = editText(prefs.getString("adminUrl", defaultAdminUrl) ?: defaultAdminUrl, "Website/admin URL")
        orderNumberInput = editText("", "Order number")
        printerIpInput = editText(prefs.getString("printerIp", defaultPrinterIp) ?: defaultPrinterIp, "Printer IP")
        printerPortInput = editText(prefs.getString("printerPort", defaultPrinterPort) ?: defaultPrinterPort, "Printer port")
        statusText = TextView(this).apply {
            text = "Ready. Log in to admin below before fetching protected ticket payloads."
            textSize = 16f
            setPadding(0, 12, 0, 12)
        }
        webView = WebView(this).apply {
            webViewClient = WebViewClient()
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            CookieManager.getInstance().setAcceptCookie(true)
            visibility = View.GONE
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(28, 28, 28, 28)
        }
        root.addView(TextView(this).apply {
            text = "China Delight Print Bridge"
            textSize = 24f
        })
        root.addView(adminUrlInput)
        root.addView(button("Open admin login") {
            saveSettings()
            webView.visibility = View.VISIBLE
            webView.loadUrl(adminUrlInput.text.toString().trim().ifBlank { defaultAdminUrl })
            setStatus("Admin page opened. Log in here so this app can reuse the admin session cookie.")
        })
        root.addView(button("Hide admin web view") {
            webView.visibility = View.GONE
            setStatus("Admin web view hidden. Session cookies remain available to the app.")
        })
        root.addView(orderNumberInput)
        root.addView(button("Fetch ticket") {
            fetchTicketOnly()
        })
        root.addView(button("Print order") {
            fetchAndPrintOrder()
        })
        root.addView(button("Print test ticket") {
            printBytes(testTicketBytes(), "Test ticket")
        })
        root.addView(printerIpInput)
        root.addView(printerPortInput)
        root.addView(statusText)
        root.addView(webView, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 900))

        setContentView(ScrollView(this).apply { addView(root) })
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
        minHeight = 64
        setOnClickListener { onClick() }
    }

    private fun saveSettings() {
        getSharedPreferences("bridge-settings", MODE_PRIVATE).edit()
            .putString("adminUrl", adminUrlInput.text.toString().trim().ifBlank { defaultAdminUrl })
            .putString("printerIp", printerIpInput.text.toString().trim().ifBlank { defaultPrinterIp })
            .putString("printerPort", printerPortInput.text.toString().trim().ifBlank { defaultPrinterPort })
            .apply()
    }

    private fun fetchTicketOnly() {
        val orderNumber = orderNumberInput.text.toString().trim()
        if (orderNumber.isBlank()) {
            setStatus("Enter an order number first.")
            return
        }
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

    private fun fetchTicketPayload(orderNumber: String): ByteArray {
        saveSettings()
        val encodedOrder = URLEncoder.encode(orderNumber, StandardCharsets.UTF_8.name())
        val url = java.net.URL("$defaultPayloadUrl?orderNumber=$encodedOrder")
        val connection = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = printerTimeoutMs
            readTimeout = printerTimeoutMs
            setRequestProperty("Accept", "application/json")
            val cookies = CookieManager.getInstance().getCookie(defaultAdminUrl)
            if (!cookies.isNullOrBlank()) setRequestProperty("Cookie", cookies)
        }
        val status = connection.responseCode
        val body = readBody(if (status in 200..299) connection.inputStream else connection.errorStream)
        if (status == 401) throw IllegalStateException("Not logged in. Open admin login in this app and sign in first.")
        if (status !in 200..299) throw IllegalStateException("Payload endpoint returned $status: $body")
        val json = JSONObject(body)
        if (!json.optBoolean("success")) throw IllegalStateException(json.optString("error", "Payload request failed."))
        val base64 = json.optString("escposBase64")
        if (base64.isBlank()) throw IllegalStateException("Payload did not include escposBase64.")
        return Base64.decode(base64, Base64.DEFAULT)
    }

    private fun sendToPrinter(bytes: ByteArray) {
        saveSettings()
        val host = printerIpInput.text.toString().trim().ifBlank { defaultPrinterIp }
        val port = printerPortInput.text.toString().trim().toIntOrNull() ?: 9100
        Socket().use { socket ->
            socket.connect(InetSocketAddress(host, port), printerTimeoutMs)
            socket.soTimeout = printerTimeoutMs
            socket.getOutputStream().use { output ->
                output.write(bytes)
                output.flush()
            }
        }
    }

    private fun readBody(stream: java.io.InputStream?): String {
        if (stream == null) return ""
        return stream.bufferedReader().use { it.readText() }
    }

    private fun setStatus(message: String) {
        statusText.text = message
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
        line("Printer: ${printerIpInput.text}:${printerPortInput.text}")
        bytes(0x1b, 0x64, 0x04)
        bytes(0x1d, 0x56, 0x42, 0x00)
        return out.toByteArray()
    }
}
