# P2PMeet native input host for Chrome/Edge Native Messaging.
# Control is disabled until the Windows user accepts the system consent dialog.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class P2PInput {
  [DllImport("user32.dll", SetLastError=true)] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
  [DllImport("user32.dll")] public static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extra);
  [DllImport("user32.dll")] public static extern int GetSystemMetrics(int index);
}
'@

$script:input = [Console]::OpenStandardInput()
$script:output = [Console]::OpenStandardOutput()
$script:armed = $false
$script:pressedKeys = @{}
$script:pressedButtons = @{}
$script:keyMap = @{}
foreach ($i in 0..25) { $script:keyMap["Key$([char](65 + $i))"] = 0x41 + $i }
foreach ($i in 0..9) { $script:keyMap["Digit$i"] = 0x30 + $i }
foreach ($i in 1..12) { $script:keyMap["F$i"] = 0x6F + $i }
foreach ($i in 0..9) { $script:keyMap["Numpad$i"] = 0x60 + $i }
foreach ($pair in @{
  Enter=0x0D; Escape=0x1B; Backspace=0x08; Tab=0x09; Space=0x20; Delete=0x2E; Insert=0x2D
  Home=0x24; End=0x23; PageUp=0x21; PageDown=0x22; ArrowUp=0x26; ArrowDown=0x28; ArrowLeft=0x25; ArrowRight=0x27
  ShiftLeft=0x10; ShiftRight=0x10; ControlLeft=0x11; ControlRight=0x11; AltLeft=0x12; AltRight=0x12
  MetaLeft=0x5B; MetaRight=0x5C; CapsLock=0x14; Minus=0xBD; Equal=0xBB; BracketLeft=0xDB; BracketRight=0xDD
  Backslash=0xDC; Semicolon=0xBA; Quote=0xDE; Backquote=0xC0; Comma=0xBC; Period=0xBE; Slash=0xBF
  NumpadAdd=0x6B; NumpadSubtract=0x6D; NumpadMultiply=0x6A; NumpadDivide=0x6F; NumpadDecimal=0x6E
  PrintScreen=0x2C; ScrollLock=0x91; Pause=0x13
}.GetEnumerator()) { $script:keyMap[$pair.Key] = $pair.Value }

function Send-Frame($value) {
  $bytes = [Text.Encoding]::UTF8.GetBytes(($value | ConvertTo-Json -Compress -Depth 8))
  $length = [BitConverter]::GetBytes([int]$bytes.Length)
  $script:output.Write($length, 0, 4)
  $script:output.Write($bytes, 0, $bytes.Length)
  $script:output.Flush()
  [Console]::Error.WriteLine("P2PMeet helper sent $($bytes.Length) response bytes.")
}

function Read-Exact([int]$count) {
  $buffer = [byte[]]::new($count); $offset = 0
  while ($offset -lt $count) {
    $read = $script:input.Read($buffer, $offset, $count - $offset)
    if ($read -le 0) { return $null }
    $offset += $read
  }
  return ,$buffer
}

function Release-Inputs {
  foreach ($vk in @($script:pressedKeys.Keys)) { [P2PInput]::keybd_event([byte]$vk, 0, 0x0002, [UIntPtr]::Zero) }
  $script:pressedKeys.Clear()
  foreach ($flag in @($script:pressedButtons.Values)) { [P2PInput]::mouse_event([uint32]$flag, 0, 0, 0, [UIntPtr]::Zero) }
  $script:pressedButtons.Clear()
}

function Handle-Action($message) {
  switch ($message.type) {
    'status' { Send-Frame @{ requestId=$message.requestId; kind='status'; available=$true; armed=$script:armed }; return }
    'authorize' {
      $answer = [System.Windows.Forms.MessageBox]::Show(
        'Allow the current P2PMeet participant to control this Windows desktop? You can revoke access from the meeting at any time.',
        'P2PMeet remote control request', [System.Windows.Forms.MessageBoxButtons]::YesNo,
        [System.Windows.Forms.MessageBoxIcon]::Warning, [System.Windows.Forms.MessageBoxDefaultButton]::Button2)
      $script:armed = $answer -eq [System.Windows.Forms.DialogResult]::Yes
      if (-not $script:armed) { Release-Inputs }
      Send-Frame @{ requestId=$message.requestId; kind='authorized'; allowed=$script:armed }
      return
    }
    'revoke' { $script:armed = $false; Release-Inputs; Send-Frame @{ requestId=$message.requestId; kind='revoked'; ok=$true }; return }
  }
  if (-not $script:armed) { return }
  if ([string]$message.code -in @('MetaLeft','MetaRight','AltLeft','AltRight')) { return }
  switch ($message.type) {
    'move' {
      $width = [P2PInput]::GetSystemMetrics(0); $height = [P2PInput]::GetSystemMetrics(1)
      if ($width -gt 0 -and $height -gt 0) {
        $x = [Math]::Max(0, [Math]::Min($width - 1, [int]([double]$message.x * $width)))
        $y = [Math]::Max(0, [Math]::Min($height - 1, [int]([double]$message.y * $height)))
        [void][P2PInput]::SetCursorPos($x, $y)
      }
    }
    'buttonDown' { $flags = @{ left=@(0x0002,0x0004); right=@(0x0008,0x0010); middle=@(0x0020,0x0040) }; if ($flags.ContainsKey([string]$message.button)) { $f=$flags[[string]$message.button]; $script:pressedButtons[[string]$message.button]=$f[1]; [P2PInput]::mouse_event([uint32]$f[0],0,0,0,[UIntPtr]::Zero) } }
    'buttonUp' { $flags = @{ left=@(0x0002,0x0004); right=@(0x0008,0x0010); middle=@(0x0020,0x0040) }; if ($flags.ContainsKey([string]$message.button)) { $f=$flags[[string]$message.button]; [void]$script:pressedButtons.Remove([string]$message.button); [P2PInput]::mouse_event([uint32]$f[1],0,0,0,[UIntPtr]::Zero) } }
    'wheel' { $delta=[int]$message.delta; if ([Math]::Abs($delta) -le 1200) { $wheelData=[BitConverter]::ToUInt32([BitConverter]::GetBytes([int32]$delta),0); [P2PInput]::mouse_event(0x0800,0,0,$wheelData,[UIntPtr]::Zero) } }
    'keyDown' { $code=[string]$message.code; if ($script:keyMap.ContainsKey($code)) { $vk=[int]$script:keyMap[$code]; if (-not $script:pressedKeys.ContainsKey($vk)) { $script:pressedKeys[$vk]=$true; [P2PInput]::keybd_event([byte]$vk,0,0,[UIntPtr]::Zero) } } }
    'keyUp' { $code=[string]$message.code; if ($script:keyMap.ContainsKey($code)) { $vk=[int]$script:keyMap[$code]; if ($script:pressedKeys.ContainsKey($vk)) { [void]$script:pressedKeys.Remove($vk); [P2PInput]::keybd_event([byte]$vk,0,0x0002,[UIntPtr]::Zero) } } }
  }
}

try {
  [Console]::Error.WriteLine('P2PMeet native helper ready.')
  while ($true) {
    $header = Read-Exact 4; if ($null -eq $header) { break }
    $length = [BitConverter]::ToInt32($header, 0)
    if ($length -le 0 -or $length -gt 65536) { break }
    $body = Read-Exact $length; if ($null -eq $body) { break }
    $message = [Text.Encoding]::UTF8.GetString($body) | ConvertFrom-Json
    Handle-Action $message
  }
} finally { $script:armed = $false; Release-Inputs }
