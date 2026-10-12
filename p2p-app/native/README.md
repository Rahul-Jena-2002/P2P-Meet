# Windows desktop control helper

Full Windows mouse and keyboard control requires both the Chromium extension and its native helper on the computer sharing its primary display. The meeting website alone cannot inject input into Windows.

## Install on the sharing computer

1. In Chrome or Edge, open `chrome://extensions` or `edge://extensions`, turn on Developer mode, and choose **Load unpacked**.
2. Select `native/browser-extension`. Copy the extension ID shown by the browser.
3. Open PowerShell in `native/windows-control-host` and run:

   ```powershell
   .\install-host.ps1 -ExtensionId YOUR_32_CHARACTER_EXTENSION_ID
   ```

   The script installs a per-user Native Messaging host for Chrome and Edge. It compiles a small launcher with the Windows .NET Framework compiler already present on supported Windows installations; it does not require the .NET SDK.
4. If you deploy to a custom domain, add that exact origin to `host_permissions` and `content_scripts.matches` in `native/browser-extension/manifest.json`, then reload the extension.
5. Restart the browser and rejoin the meeting. The share controls should report when the helper is unavailable.

## Use

The viewer chooses **Request desktop control** on the active screen share. The sharer reviews the request in the meeting and approves it. Windows then shows a separate consent dialog from the native helper. Control starts only after both approvals. The sharer can revoke control from the meeting at any time; revocation releases held mouse buttons and keys. Closing the browser connection also releases held inputs.

The helper maps normalized coordinates to the primary Windows display. The sharer must share the full primary display for pointer coordinates to line up; application-window sharing and secondary-monitor control are not supported in this first version. Control events use the existing peer-to-peer WebRTC data channel. No screen or file data is uploaded. With STUN-only networking, some peers still cannot establish a direct connection.

## Uninstall

Remove the extension in the browser, then run this in PowerShell:

```powershell
Remove-Item 'HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.p2pmeet.remote_control' -ErrorAction SilentlyContinue
Remove-Item 'HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\com.p2pmeet.remote_control' -ErrorAction SilentlyContinue
Remove-Item "$env:LOCALAPPDATA\P2PMeet\RemoteControlHost" -Recurse -Force -ErrorAction SilentlyContinue
```

The native helper is source code in this repository; this project does not yet ship a signed installer. The Windows user controls installation and can remove the per-user registry entries and files above.
