package com.chinadelight.printerapp

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.util.Base64
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.InetSocketAddress
import java.net.Socket
import java.net.URL
import java.nio.charset.StandardCharsets

class MainActivity : Activity() {
    private val adminUrl = "https://chinadelightct.com/admin"
    private val bridgeUrl = "https://chinadelightct.com/api/android/print-bridge"
    private val defaultPrinterIp = "192.168.1.172"
    private val defaultPrinterPort = "9100"
    private val timeoutMs = 5000
    private val handler = Handler(Looper.getMainLooper())

    private lateinit var statusText: TextView
    private lateinit var printerIpInput: EditText
    private lateinit var printerPortInput: EditText
    private lateinit var printCodeInput: EditText
    private lateinit var orderNumberInput: EditText
    private lateinit var ordersContainer: LinearLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val prefs = prefs()
        printerIpInput = input(prefs.getString("printerIp", defaultPrinterIp) ?: defaultPrinterIp, "Printer IP")
        printerPortInput = input(prefs.getString("printerPort", defaultPrinterPort) ?: defaultPrinterPort, "Printer port")
        printCodeInput = input(prefs.getString("printCode", "") ?: "", "Restaurant print code").apply {
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        orderNumberInput = input("", "Manual order number")
        ordersContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(note("Tap Refresh Orders."))
        }
        statusText = TextView(this).apply {
            text = "Ready."
            textSize = 16f
            setTextColor(Color.parseColor("#222222"))
            setPadding(0, 8, 0, 18)
        }

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
        root.addView(statusText)

        root.addView(section("Printer Settings"))
        root.addView(printerIpInput)
        root.addView(printerPortInput)
        root.addView(button("Save Settings") {
            saveSettings()
            setStatus("Settings saved. Printer ${printerHost()}:${printerPort()}.", true)
        })
        root.addView(button("Test Print") {
            saveSettings()
            printBytes(testTicketBytes(), "test ticket")
        })

        root.addView(section("Order Access"))
        root.addView(printCodeInput)
        root.addView(button("Refresh Orders") { refreshOrders() })
        root.addView(ordersContainer)

        root.addView(section("Manual Backup Print"))
        root.addView(note("Use this only if the order list is unavailable."))
        root.addView(orderNumberInput)
        root.addView(button("Fetch & Print") {
            fetchAndPrint(orderNumberInput.text.toString().trim())
        })

        root.addView(section("Admin Website Fallback"))
        root.addView(button("Open Admin in Chrome") { openAdminInChrome() })

        setContentView(ScrollView(this).apply { addView(root) })
    }

    private fun refreshOrders() {
        saveSettings()
        val code = printCode()
        if (code.isBlank()) {
            setStatus("Enter the restaurant print code.")
            return
        }
        setStatus("Loading active orders...")
        Thread {
            try {
                val json = postBridge(JSONObject().put("code", code).put("action", "orders"))
                val orders = json.getJSONArray("orders")
                runOnUiThread {
                    renderOrders(orders)
                    setStatus(if (orders.length() == 0) "No active orders found." else "Loaded ${orders.length()} active orders.", true)
                }
            } catch (error: Exception) {
                runOnUiThread { setStatus(error.message ?: "Orders endpoint failed.") }
            }
        }.start()
    }

    private fun renderOrders(orders: JSONArray) {
        ordersContainer.removeAllViews()
        if (orders.length() == 0) {
            ordersContainer.addView(note("No active orders found."))
            return
        }
        for (index in 0 until orders.length()) {
            ordersContainer.addView(orderCard(orders.getJSONObject(index)))
        }
    }

    private fun orderCard(order: JSONObject): LinearLayout {
        val orderNumber = order.optString("orderNumber")
        val customer = order.optString("customerName")
        val phone = order.optString("customerPhone")
        val status = order.optString("status")
        val pickup = order.optString("pickupTime")
        val payment = order.optString("payment")
        val total = "$" + "%.2f".format(order.optDouble("total", 0.0))
        val items = order.optString("itemSummary").ifBlank { "No item summary." }

        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(18, 18, 18, 18)
            background = GradientDrawable().apply {
                setColor(Color.WHITE)
                setStroke(2, Color.parseColor("#E5D6C5"))
                cornerRadius = 14f
            }
            val margins = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            margins.setMargins(0, 0, 0, 18)
            layoutParams = margins

            addView(TextView(this@MainActivity).apply {
                text = orderNumber
                textSize = 21f
                setTypeface(typeface, Typeface.BOLD)
                setTextColor(Color.parseColor("#B81D1D"))
            })
            addView(cardLine("$customer  |  $phone", true))
            addView(cardLine("Status: $status"))
            addView(cardLine("Pickup: $pickup"))
            addView(cardLine("Payment: $payment"))
            addView(cardLine("Total: $total", true))
            addView(cardLine("Items: $items"))
            addView(button("Print to Epson") { fetchAndPrint(orderNumber) })
        }
    }

    private fun fetchAndPrint(orderNumber: String) {
        if (orderNumber.isBlank()) {
            setStatus("Enter an order number.")
            return
        }
        saveSettings()
        val code = printCode()
        if (code.isBlank()) {
            setStatus("Enter the restaurant print code.")
            return
        }
        setStatus("Printing $orderNumber...")
        Thread {
            try {
                val payload = postBridge(JSONObject().put("code", code).put("action", "payload").put("orderNumber", orderNumber))
                val base64 = payload.optString("escposBase64")
                if (base64.isBlank()) throw IllegalStateException("Payload failed: missing escposBase64.")
                sendToPrinter(Base64.decode(base64, Base64.DEFAULT))
                runOnUiThread { setStatus("Printed $orderNumber.", true) }
            } catch (error: Exception) {
                runOnUiThread { setStatus(error.message ?: "Print failed.") }
            }
        }.start()
    }

    private fun postBridge(body: JSONObject): JSONObject {
        val connection = (URL(bridgeUrl).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = timeoutMs
            readTimeout = timeoutMs
            doOutput = true
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Content-Type", "application/json")
            outputStream.use { it.write(body.toString().toByteArray(StandardCharsets.UTF_8)) }
        }
        val status = connection.responseCode
        val response = readBody(if (status in 200..299) connection.inputStream else connection.errorStream)
        if (status !in 200..299) {
            val label = if (body.optString("action") == "orders") "Orders endpoint failed" else "Payload failed"
            throw IllegalStateException("$label: $bridgeUrl returned $status: ${snippet(response)}")
        }
        return JSONObject(response)
    }

    private fun printBytes(bytes: ByteArray, label: String) {
        saveSettings()
        setStatus("Printing $label...")
        Thread {
            try {
                sendToPrinter(bytes)
                runOnUiThread { setStatus("Printed $label.", true) }
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

    private fun openAdminInChrome() {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(adminUrl)))
            setStatus("Opened admin in Chrome.", true)
        } catch (error: Exception) {
            setStatus("Open Admin in Chrome failed: ${error.message}")
        }
    }

    private fun saveSettings() {
        prefs().edit()
            .putString("printerIp", printerIpInput.text.toString().trim().ifBlank { defaultPrinterIp })
            .putString("printerPort", printerPortInput.text.toString().trim().ifBlank { defaultPrinterPort })
            .putString("printCode", printCodeInput.text.toString().trim())
            .apply()
    }

    private fun prefs() = getSharedPreferences("printer-app-settings", MODE_PRIVATE)
    private fun printerHost() = prefs().getString("printerIp", defaultPrinterIp)?.trim()?.ifBlank { defaultPrinterIp } ?: defaultPrinterIp
    private fun printerPort() = prefs().getString("printerPort", defaultPrinterPort)?.trim()?.toIntOrNull() ?: 9100
    private fun printCode() = printCodeInput.text.toString().trim().ifBlank { prefs().getString("printCode", "")?.trim().orEmpty() }

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

    private fun cardLine(message: String, bold: Boolean = false) = TextView(this).apply {
        text = message
        textSize = 16f
        setTextColor(Color.parseColor("#2B2520"))
        if (bold) setTypeface(typeface, Typeface.BOLD)
        setPadding(0, 4, 0, 4)
    }

    private fun setStatus(message: String, autoClear: Boolean = false) {
        handler.removeCallbacksAndMessages(null)
        statusText.text = message
        if (autoClear) handler.postDelayed({ statusText.text = "Ready." }, 6000)
    }

    private fun snippet(value: String): String {
        return value.replace(Regex("\\s+"), " ").take(240)
    }
}
