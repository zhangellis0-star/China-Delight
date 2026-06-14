# China Delight Android Print Bridge

Simple Android printer helper for the restaurant tablet.

The app does not manage orders. Staff use Chrome to view the normal China Delight admin website, then type the order number into this app to print the kitchen ticket.

## What The App Does

- Saves printer IP and port.
- Prints a simple Epson test ticket.
- Opens `https://chinadelightct.com/admin` in Chrome.
- Fetches one order ticket payload by order number from:

`https://chinadelightct.com/api/admin/print-ticket/payload?orderNumber=ORDER_NUMBER`

- Decodes `escposBase64`.
- Sends raw ESC/POS bytes to the Epson printer at `192.168.1.172:9100`.

## What The App Does Not Do

- No WebView admin screen.
- No native admin login.
- No native recent order list.
- No order management.
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
4. Tap **Open Admin in Chrome**.
5. View/manage orders in Chrome.
6. Read or copy the order number from Chrome.
7. Return to this app.
8. Enter the order number.
9. Tap **Fetch & Print**.

## Notes

- Tablet and printer must be on the same Wi-Fi/LAN.
- Guest Wi-Fi/client isolation can block access to `192.168.1.172`.
- A successful socket write means bytes were sent to the Epson printer; it cannot prove paper physically printed.
- If the printer IP changes, update the IP field and tap **Save Settings**.
