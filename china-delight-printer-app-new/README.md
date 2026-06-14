# China Delight Printer App

Native Android printer/admin helper for the restaurant tablet.

The app loads recent active China Delight online orders through a protected website API, shows each order as a native card, and prints the existing kitchen ticket payload directly to the Epson printer over raw TCP.

## Main Flow

1. Open the app.
2. Enter the restaurant print code.
3. Confirm printer IP `192.168.1.172` and port `9100`.
4. Tap **Refresh Orders**.
5. Tap **Print to Epson** on an order card.

## Website API

The app calls:

`https://chinadelightct.com/api/android/print-bridge`

The endpoint is protected by:

`ANDROID_PRINT_BRIDGE_CODE`

Supported actions:

- `orders`: returns recent active orders.
- `payload`: returns the existing ESC/POS kitchen ticket payload as `escposBase64`.

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
- Open Admin in Chrome remains available for full admin management.
- Manual order-number Fetch & Print is backup only.
