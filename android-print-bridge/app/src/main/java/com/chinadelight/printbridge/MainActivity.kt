package com.chinadelight.printbridge

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.text.InputType
import android.util.Base64
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.InetSocketAddress
import java.net.Socket
import java.net.URL
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

class MainActivity : Activity() {
    private val defaultAdminUrl = "https://chinadelightct.com/admin"
    private val defaultPrinterIp = "192.168.1.172"
    private val defaultPrinterPort = "9100"
    private val timeoutMs = 5000
    private val activeStatuses = setOf("new", "accepted", "preparing", "ready")

    private lateinit var statusText: TextView
    private lateinit var printerIpInput: EditText
    private lateinit var printerPortInput: EditText
    private lateinit var adminUrlInput: EditText
    private lateinit var adminPasswordInput: EditText
    private lateinit var orderNumberInput: EditText
    private lateinit var recentOrdersContainer: LinearLayout

    private var lastOrderNumber: String = ""
    private var lastTicketBytes: ByteArray? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val prefs = prefs()
        printerIpInput = input(prefs.getString("printerIp", defaultPrinterIp) ?: defaultPrinterIp, "Printer IP")
        printerPortInput = input(prefs.getString("printerPort", defaultPrinterPort) ?: defaultPrinterPort, "Printer port")
        adminUrlInput = input(prefs.getString("adminUrl", defaultAdminUrl) ?: defaultAdminUrl, "Website/admin URL")
        adminPasswordInput = input("", "Admin password").apply {
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        orderNumberInput = input("", "Order number, e.g. CD-123456-ABC")
        statusText = TextView(this).apply {
            text = "Ready."
            textSize = 16f
            setTextColor(Color.parseColor("#222222"))
            setPadding(0, 8, 0, 16)
        }
        recentOrdersContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        recentOrdersContainer.addView(note("Log in, then tap Load recent active orders."))

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(28, 28, 28, 28)
        }
        root.addView(TextView(this).apply {
            text = "China Delight Kitchen Printer"
            textSize = 24f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        })
        root.addView(statusText)

        root.addView(section("Printer settings"))
        root.addView(printerIpInput)
        root.addView(printerPortInput)
        root.addView(button("Save settings") {
            saveSettings()
            setStatus("Settings saved. Printer ${printerHost()}:${printerPort()}.")
        })
        root.addView(button("Test Print") {
            saveSettings()
            printBytes(testTicketBytes(), "test ticket")
        })

        root.addView(section("Admin / order access"))
        root.addView(adminUrlInput)
        root.addView(adminPasswordInput)
        root.addView(button("Log in") { loginAdmin() })
        root.addView(button("Load recent active orders") { loadRecentOrders() })
        root.addView(button("Open Admin in Chrome") {
            saveSettings()
            openExternal(adminUrl())
        })

        root.addView(section("Recent orders"))
        root.addView(recentOrdersContainer)

        root.addView(section("Manual backup print"))
        root.addView(orderNumberInput)
        root.addView(button("Fetch ticket") { fetchTicketOnly() })
        root.addView(button("Print order") { printManualOrder() })
        root.addView(button("Fetch & Print") { fetchAndPrintOrder(orderNumberInput.text.toString().trim()) })

        setContentView(ScrollView(this).apply { addView(root) })
    }

    private fun loginAdmin() {
        val password = adminPasswordInput.text.toString()
        if (password.isBlank()) {
            setStatus("Login failed: enter admin password.")
            return
        }
        saveSettings()
        setStatus("Logging in...")
        Thread {
            try {
                val body = JSONObject().put("password", password).toString().toByteArray(StandardCharsets.UTF_8)
                val connection = openConnection(apiUrl("/api/admin/login"), "POST").apply {
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    outputStream.use { it.write(body) }
                }
                val response = readResponse(connection)
                if (!response.ok) throw IllegalStateException("Login failed: ${response.status} ${snippet(response.body)}")
                val cookie = connection.headerFields["Set-Cookie"]?.firstOrNull()?.substringBefore(";") ?: ""
                if (cookie.isBlank()) throw IllegalStateException("Login failed: no session cookie returned.")
                prefs().edit().putString("adminCookie", cookie).apply()
                runOnUiThread {
                    adminPasswordInput.text.clear()
                    setStatus("Logged in. Tap Load recent active orders.")
                }
            } catch (error: Exception) {
                runOnUiThread { setStatus(error.message ?: "Login failed.") }
            }
        }.start()
    }

    private fun loadRecentOrders() {
        saveSettings()
        setStatus("Loading recent active orders...")
        Thread {
            try {
                val endpoint = apiUrl("/api/orders?status=all")
                val connection = openConnection(endpoint, "GET").apply {
                    setRequestProperty("Accept", "application/json")
                    authCookie()?.let { setRequestProperty("Cookie", it) }
                }
                val response = readResponse(connection)
                if (response.status == 401) throw IllegalStateException("Recent orders failed: not logged in. Enter password and tap Log in.")
                if (!response.ok) throw IllegalStateException("Recent orders failed: $endpoint returned ${response.status}: ${snippet(response.body)}")
                val orders = JSONObject(response.body).getJSONArray("orders")
                runOnUiThread {
                    renderOrders(orders)
                    setStatus("Loaded recent active orders.")
                }
            } catch (error: Exception) {
                runOnUiThread { setStatus(error.message ?: "Recent orders failed.") }
            }
        }.start()
    }

    private fun renderOrders(orders: JSONArray) {
        recentOrdersContainer.removeAllViews()
        var shown = 0
        for (index in 0 until orders.length()) {
            val order = orders.getJSONObject(index)
            val status = order.optString("status")
            if (status !in activeStatuses) continue
            shown += 1
            recentOrdersContainer.addView(orderRow(order))
            if (shown >= 30) break
        }
        if (shown == 0) {
            recentOrdersContainer.addView(note("No recent active orders found."))
        }
    }

    private fun orderRow(order: JSONObject): LinearLayout {
        val orderNumber = order.optString("order_number")
        val status = order.optString("status")
        val customer = order.optString("customer_name")
        val pickup = pickupText(order)
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, 14, 0, 14)
            addView(TextView(this@MainActivity).apply {
                text = "$orderNumber\n$customer\n$pickup | $status"
                textSize = 17f
                setTypeface(typeface, android.graphics.Typeface.BOLD)
            })
            addView(button("Print to Epson") { fetchAndPrintOrder(orderNumber) })
        }
    }

    private fun fetchTicketOnly() {
        val orderNumber = orderNumberInput.text.toString().trim()
        if (orderNumber.isBlank()) {
            setStatus("Enter order number.")
            return
        }
        saveSettings()
        setStatus("Fetching ticket for $orderNumber...")
        Thread {
            try {
                val bytes = fetchTicketPayload(orderNumber)
                lastOrderNumber = orderNumber
                lastTicketBytes = bytes
                runOnUiThread { setStatus("Fetched $orderNumber (${bytes.size} bytes).") }
            } catch (error: Exception) {
                runOnUiThread { setStatus(error.message ?: "Payload failed.") }
            }
        }.start()
    }

    private fun printManualOrder() {
        val orderNumber = orderNumberInput.text.toString().trim()
        if (orderNumber.isBlank()) {
            setStatus("Enter order number.")
            return
        }
        if (lastOrderNumber == orderNumber && lastTicketBytes != null) {
            printBytes(lastTicketBytes!!, "order $orderNumber")
        } else {
            fetchAndPrintOrder(orderNumber)
        }
    }

    private fun fetchAndPrintOrder(orderNumber: String) {
        if (orderNumber.isBlank()) {
            setStatus("Enter order number.")
            return
        }
        saveSettings()
        setStatus("Fetching and printing $orderNumber...")
        Thread {
            try {
                val bytes = fetchTicketPayload(orderNumber)
                sendToPrinter(bytes)
                lastOrderNumber = orderNumber
                lastTicketBytes = bytes
                runOnUiThread { setStatus("Printed $orderNumber successfully.") }
            } catch (error: Exception) {
                runOnUiThread { setStatus(error.message ?: "Print failed.") }
            }
        }.start()
    }

    private fun fetchTicketPayload(orderNumber: String): ByteArray {
        val encoded = URLEncoder.encode(orderNumber, StandardCharsets.UTF_8.name())
        val endpoint = "${apiUrl("/api/admin/print-ticket/payload")}?orderNumber=$encoded"
        val connection = openConnection(endpoint, "GET").apply {
            setRequestProperty("Accept", "application/json")
            authCookie()?.let { setRequestProperty("Cookie", it) }
        }
        val response = readResponse(connection)
        if (response.status == 401) throw IllegalStateException("Payload failed: not logged in. Enter password and tap Log in.")
        if (!response.ok) throw IllegalStateException("Payload failed: $endpoint returned ${response.status}: ${snippet(response.body)}")
        val json = JSONObject(response.body)
        if (!json.optBoolean("success")) throw IllegalStateException("Payload failed: ${snippet(response.body)}")
        val base64 = json.optString("escposBase64")
        if (base64.isBlank()) throw IllegalStateException("Payload failed: missing escposBase64.")
        return Base64.decode(base64, Base64.DEFAULT)
    }

    private fun printBytes(bytes: ByteArray, label: String) {
        saveSettings()
        setStatus("Printing $label...")
        Thread {
            try {
                sendToPrinter(bytes)
                runOnUiThread { setStatus("Printed $label successfully.") }
            } catch (error: Exception) {
                runOnUiThread { setStatus(error.message ?: "Printer failed.") }
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

    private fun openConnection(endpoint: String, method: String): HttpURLConnection {
        return (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = timeoutMs
            readTimeout = timeoutMs
        }
    }

    private fun readResponse(connection: HttpURLConnection): HttpResponse {
        val status = connection.responseCode
        val stream = if (status in 200..299) connection.inputStream else connection.errorStream
        val body = stream?.bufferedReader()?.use { it.readText() } ?: ""
        return HttpResponse(status, body, status in 200..299)
    }

    private data class HttpResponse(val status: Int, val body: String, val ok: Boolean)

    private fun saveSettings() {
        prefs().edit()
            .putString("printerIp", printerIpInput.text.toString().trim().ifBlank { defaultPrinterIp })
            .putString("printerPort", printerPortInput.text.toString().trim().ifBlank { defaultPrinterPort })
            .putString("adminUrl", adminUrlInput.text.toString().trim().ifBlank { defaultAdminUrl })
            .apply()
    }

    private fun prefs() = getSharedPreferences("bridge-settings", MODE_PRIVATE)
    private fun printerHost() = prefs().getString("printerIp", defaultPrinterIp)?.trim()?.ifBlank { defaultPrinterIp } ?: defaultPrinterIp
    private fun printerPort() = prefs().getString("printerPort", defaultPrinterPort)?.trim()?.toIntOrNull() ?: 9100
    private fun adminUrl() = prefs().getString("adminUrl", defaultAdminUrl)?.trim()?.ifBlank { defaultAdminUrl } ?: defaultAdminUrl
    private fun authCookie() = prefs().getString("adminCookie", "")?.trim()?.takeIf { it.isNotBlank() }

    private fun apiUrl(path: String): String {
        return try {
            val url = URL(adminUrl())
            val authority = if (url.port == -1) url.host else "${url.host}:${url.port}"
            "${url.protocol}://$authority$path"
        } catch (error: Exception) {
            "https://chinadelightct.com$path"
        }
    }

    private fun pickupText(order: JSONObject): String {
        return if (order.optString("pickup_time_type") == "scheduled") {
            "Scheduled ${formatTime(order.optString("scheduled_pickup_time"))}"
        } else {
            "ASAP"
        }
    }

    private fun formatTime(value: String): String {
        if (value.isBlank() || value == "null") return ""
        return try {
            val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
            parser.timeZone = TimeZone.getTimeZone("UTC")
            val parsed = parser.parse(value.substringBefore(".").removeSuffix("Z"))
            if (parsed == null) value else SimpleDateFormat("MMM d h:mm a", Locale.US).format(parsed)
        } catch (error: Exception) {
            value
        }
    }

    private fun openExternal(url: String) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            setStatus("Opened admin in Chrome.")
        } catch (error: Exception) {
            setStatus("Open Admin in Chrome failed: ${error.message}")
        }
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
        line("Tablet can reach Epson printer.")
        line("Printer: ${printerHost()}:${printerPort()}")
        bytes(0x1b, 0x64, 0x04)
        bytes(0x1d, 0x56, 0x42, 0x00)
        return out.toByteArray()
    }

    private fun input(value: String, hintText: String) = EditText(this).apply {
        setText(value)
        hint = hintText
        textSize = 18f
        setSingleLine(true)
        minHeight = 72
    }

    private fun button(label: String, onClick: () -> Unit) = Button(this).apply {
        text = label
        textSize = 18f
        minHeight = 96
        setOnClickListener { onClick() }
    }

    private fun section(label: String) = TextView(this).apply {
        text = label
        textSize = 15f
        setTypeface(typeface, android.graphics.Typeface.BOLD)
        setTextColor(Color.parseColor("#B81D1D"))
        setPadding(0, 28, 0, 8)
    }

    private fun note(message: String) = TextView(this).apply {
        text = message
        textSize = 15f
        setPadding(0, 8, 0, 8)
    }

    private fun setStatus(message: String) {
        runOnUiThread { statusText.text = message }
    }

    private fun snippet(value: String): String {
        return value.replace(Regex("\\s+"), " ").take(240)
    }

    private fun toast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }
}
