# China Delight Android Print Bridge

Native Android kitchen printer helper for the restaurant tablet.

The app shows recent active orders, fetches the existing kitchen ticket ESC/POS payload, and sends the bytes directly to the Epson receipt printer. Chrome remains available as a fallback for the full admin website.

## What The App Does

- Saves printer IP and port.
- Saves a restaurant print bridge code locally on the tablet.
- Prints a simple Epson test ticket.
- Loads recent active orders from:

`https://chinadelightct.com/api/android/print-bridge`

- Prints directly from each order card.
- Keeps a manual order-number **Fetch & Print** backup.
- Opens `https://chinadelightct.com/admin` in Chrome.
- Decodes `escposBase64`.
- Sends raw ESC/POS bytes to the Epson printer at `192.168.1.172:9100`.

## What The App Does Not Do

- No WebView admin screen.
- No public order access.
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
3. Enter the print bridge code that matches `ANDROID_PRINT_BRIDGE_CODE` in Vercel.
4. Tap **Test Print**.
5. Tap **Refresh Orders**.
6. Tap **Print to Epson** on an order card.
7. Use **Fetch & Print** with an order number as backup.
8. Tap **Open Admin in Chrome** when staff need the full admin website.

## Website Setup

Set this Vercel environment variable:

```text
ANDROID_PRINT_BRIDGE_CODE=<restaurant-only code>
```

The same code must be entered in the Android app. Do not commit the real code.

## Notes

- Tablet and printer must be on the same Wi-Fi/LAN.
- Guest Wi-Fi/client isolation can block access to `192.168.1.172`.
- A successful socket write means bytes were sent to the Epson printer; it cannot prove paper physically printed.
- If the printer IP changes, update the IP field and tap **Save Settings**.
- The print bridge endpoint returns active orders only and requires the print bridge code.
