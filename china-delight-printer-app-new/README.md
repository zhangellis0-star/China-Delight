# China Delight Printer App

Native Android printer/admin helper for the restaurant tablet.

The main workflow loads the real China Delight admin website inside an Android WebView. Staff log in, see the normal admin order cards, and tap an injected **Print to Epson** button on the visible order card. The app fetches the existing protected kitchen ticket payload with the WebView admin session cookie and sends the ESC/POS bytes directly to the Epson printer over raw TCP.

## Main Flow

1. Open the app.
2. Confirm printer IP `192.168.1.172` and port `9100`.
3. Tap **Admin Orders**.
4. Log in to the real admin page if needed.
5. Scroll the current admin order cards.
6. Tap **Print to Epson** on an order card.

## Admin WebView

The app loads the canonical website host directly:

`https://www.chinadelightct.com/admin`

Diagnostics are shown for:

- loading progress
- current/final URL
- page title
- HTTP errors
- SSL errors
- console and JavaScript errors
- 10-second load timeout with last URL/progress/error

The top bar includes test loads for:

- `https://example.com/`
- `https://www.chinadelightct.com/`
- `https://www.chinadelightct.com/admin`
- native internet check to `https://example.com/`

The Android manifest includes:

- `INTERNET`
- `ACCESS_NETWORK_STATE`
- explicit network security config
- hardware acceleration

## Build APK

PowerShell:

```powershell
.\gradlew.bat assembleDebug
```

APK path:

`app/build/outputs/apk/debug/app-debug.apk`

## Tablet Notes

- Tablet and Epson printer must be on the same Wi-Fi/LAN.
- Guest Wi-Fi/client isolation can block access to `192.168.1.172`.
- Test Print checks direct tablet-to-printer TCP access.
- Open Admin in Chrome remains available as fallback.
- Manual order-number Fetch & Print is backup only.
