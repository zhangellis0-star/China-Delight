package com.chinadelight.printbridge

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.util.Base64
import android.view.WindowManager
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
import java.net.URL
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

class MainActivity : Activity() {
    private val adminUrl = "https://chinadelightct.com/admin"
    private val payloadUrl = "https://chinadelightct.com/api/admin/print-ticket/payload"
    private val defaultPrinterIp = "192.168.1.172"
    private val defaultPrinterPort = "9100"
    private val timeoutMs = 5000

    private lateinit var statusText: TextView
    private lateinit var printerIpInput: EditText
    private lateinit var printerPortInput: EditText
    private lateinit var orderNumberInput: EditText

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val prefs = prefs()
        printerIpInput = input(prefs.getString("printerIp", defaultPrinterIp) ?: defaultPrinterIp, "Printer IP")
        printerPortInput = input(prefs.getString("printerPort", defaultPrinterPort) ?: defaultPrinterPort, "Printer port")
        orderNumberInput = input("", "Order number, e.g. CD-123456-ABC")
        statusText = TextView(this).apply {
            text = "Ready. Use Chrome to view orders. Enter the order number here to print."
            textSize = 16f
            setTextColor(Color.parseColor("#222222"))
            setPadding(0, 8, 0, 18)
        }

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

        root.addView(section("Printer"))
        root.addView(printerIpInput)
        root.addView(printerPortInput)
        root.addView(button("Save Settings") {
            saveSettings()
            setStatus("Settings saved. Printer ${printerHost()}:${printerPort()}.")
        })
        root.addView(button("Test Print") {
            saveSettings()
            printBytes(testTicketBytes(), "test ticket")
        })

        root.addView(section("Print Order"))
        root.addView(note("Use Chrome to view orders. Enter the order number here to print."))
        root.addView(orderNumberInput)
        root.addView(button("Fetch & Print") {
            fetchAndPrint(orderNumberInput.text.toString().trim())
        })

        root.addView(section("Admin Website"))
        root.addView(button("Open Admin in Chrome") {
            openAdminInChrome()
        })

        setContentView(ScrollView(this).apply { addView(root) })
    }

    private fun fetchAndPrint(orderNumber: String) {
        if (orderNumber.isBlank()) {
            setStatus("Enter an order number.")
            return
        }
        saveSettings()
        setStatus("Fetching ticket for $orderNumber...")
        Thread {
            try {
                val bytes = fetchTicketPayload(orderNumber)
                sendToPrinter(bytes)
                runOnUiThread { setStatus("Printed $orderNumber.") }
            } catch (error: Exception) {
                runOnUiThread { setStatus(error.message ?: "Print failed.") }
            }
        }.start()
    }

    private fun fetchTicketPayload(orderNumber: String): ByteArray {
        val encoded = URLEncoder.encode(orderNumber, StandardCharsets.UTF_8.name())
        val endpoint = "$payloadUrl?orderNumber=$encoded"
        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = timeoutMs
            readTimeout = timeoutMs
            setRequestProperty("Accept", "application/json")
        }
        val status = connection.responseCode
        val body = readBody(if (status in 200..299) connection.inputStream else connection.errorStream)
        if (status !in 200..299) {
            throw IllegalStateException("Payload failed: $endpoint returned $status: ${snippet(body)}")
        }
        val json = JSONObject(body)
        if (!json.optBoolean("success")) {
            throw IllegalStateException("Payload failed: ${snippet(body)}")
        }
        val base64 = json.optString("escposBase64")
        if (base64.isBlank()) {
            throw IllegalStateException("Payload failed: missing escposBase64.")
        }
        return Base64.decode(base64, Base64.DEFAULT)
    }

    private fun printBytes(bytes: ByteArray, label: String) {
        saveSettings()
        setStatus("Printing $label...")
        Thread {
            try {
                sendToPrinter(bytes)
                runOnUiThread { setStatus("Printed $label.") }
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
            setStatus("Opened admin in Chrome.")
        } catch (error: Exception) {
            setStatus("Open Admin in Chrome failed: ${error.message}")
        }
    }

    private fun saveSettings() {
        prefs().edit()
            .putString("printerIp", printerIpInput.text.toString().trim().ifBlank { defaultPrinterIp })
            .putString("printerPort", printerPortInput.text.toString().trim().ifBlank { defaultPrinterPort })
            .apply()
    }

    private fun prefs() = getSharedPreferences("bridge-settings", MODE_PRIVATE)
    private fun printerHost() = prefs().getString("printerIp", defaultPrinterIp)?.trim()?.ifBlank { defaultPrinterIp } ?: defaultPrinterIp
    private fun printerPort() = prefs().getString("printerPort", defaultPrinterPort)?.trim()?.toIntOrNull() ?: 9100

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
        minHeight = 100
        setOnClickListener { onClick() }
    }

    private fun section(label: String) = TextView(this).apply {
        text = label
        textSize = 15f
        setTypeface(typeface, android.graphics.Typeface.BOLD)
        setTextColor(Color.parseColor("#B81D1D"))
        setPadding(0, 30, 0, 8)
    }

    private fun note(message: String) = TextView(this).apply {
        text = message
        textSize = 15f
        setPadding(0, 8, 0, 10)
    }

    private fun setStatus(message: String) {
        runOnUiThread { statusText.text = message }
    }

    private fun snippet(value: String): String {
        return value.replace(Regex("\\s+"), " ").take(240)
    }
}
