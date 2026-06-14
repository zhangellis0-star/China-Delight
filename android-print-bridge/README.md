# China Delight Android Print Bridge

Android kitchen printer helper for the restaurant tablet.

The main flow opens the real China Delight admin website inside the app. Staff log in there, view the normal admin order cards, and tap the injected **Print to Epson** button on an order card. The app fetches the existing protected kitchen ticket payload using the WebView admin session cookie, decodes `escposBase64`, and sends raw ESC/POS bytes to the Epson printer.

## What The App Does

- Saves printer IP, port, and admin URL.
- Prints a simple Epson test ticket.
- Opens `https://chinadelightct.com/admin` inside the app.
- Preserves WebView admin cookies after login.
- Adds **Print to Epson** buttons to visible admin order cards.
- Fetches ticket payloads from:

`https://chinadelightct.com/api/admin/print-ticket/payload?orderNumber=ORDER_NUMBER`

- Sends raw ESC/POS bytes to the Epson printer at `192.168.1.172:9100`.
- Keeps manual order-number fetch/print as backup only.
- Opens the admin website in Chrome as fallback.

## What The App Does Not Do

- No native recent-orders API flow.
- No separate Android print bridge code.
- No checkout, payment, menu, offer, or daily report behavior.
- No auto-printing or polling.

## Printer

- Default IP: `192.168.1.172`
- Default port: `9100`
- Protocol: raw TCP ESC/POS

## Build APK

PowerShell:

```powershell
.\gradlew.bat assembleDebug
```

APK path:

`app/build/outputs/apk/debug/app-debug.apk`

## Restaurant Use

1. Open the app.
2. Confirm printer IP `192.168.1.172` and port `9100`.
3. Tap **Test Print**.
4. Tap **Open Admin (one-tap printing)**.
5. Log in to the real admin page if needed.
6. Scroll the admin page normally.
7. Tap **Print to Epson** on the order card.
8. Use manual order-number printing only as backup.
9. Tap **Open Chrome** if the full external browser is needed.

## Notes

- Tablet and printer must be on the same Wi-Fi/LAN.
- Guest Wi-Fi/client isolation can block access to `192.168.1.172`.
- A successful socket write means bytes were sent to the Epson printer; it cannot prove paper physically printed.
- If the printer IP changes, update the IP field and tap **Save Settings**.
- The app must be logged in inside its WebView before protected ticket payload requests will work.
