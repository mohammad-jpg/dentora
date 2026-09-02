# Dentora Imaging Bridge — one-time install on each practice PC (Windows)
# Registers the dentora:// link type so "Open in Romexis / CS Imaging" buttons
# in the Dentora web app launch the local imaging software with the right patient.
#
# Run:  Right-click this file -> Run with PowerShell   (no admin needed — installs per-user)

$ErrorActionPreference = 'Stop'
$dir = Join-Path $env:LOCALAPPDATA 'Dentora'
New-Item -ItemType Directory -Force -Path $dir | Out-Null

# --- default config: EDIT the exe paths/args to match this PC's install -------------
# Placeholders: {pid} {first} {last} {dob}  (dob = YYYY-MM-DD)
# Confirm exact paths/arguments with your Planmeca / Carestream installer —
# both vendors document PMS command-line integration (Romexis "PMS Bridge",
# CS Imaging "PMS Gateway"); paths below are the common defaults.
$configPath = Join-Path $dir 'config.json'
if (-not (Test-Path $configPath)) {
@'
{
  "romexis": {
    "exe": "C:\\Program Files\\Planmeca\\Romexis\\pmbridge\\PmBridge.exe",
    "args": "-pid \"{pid}\" -fn \"{first}\" -ln \"{last}\" -bd \"{dob}\""
  },
  "csimaging": {
    "exe": "C:\\Program Files\\Carestream\\CSImaging\\TW.exe",
    "args": "-P \"{pid}\" -N \"{last}^{first}\" -B \"{dob}\""
  }
}
'@ | Set-Content -Path $configPath -Encoding UTF8
}

# --- the handler script -------------------------------------------------------------
$handler = Join-Path $dir 'bridge.ps1'
@'
param([string]$uri)
try {
  $dir = Join-Path $env:LOCALAPPDATA 'Dentora'
  $config = Get-Content (Join-Path $dir 'config.json') -Raw | ConvertFrom-Json
  # dentora://open?vendor=romexis&pid=..&first=..&last=..&dob=..
  $q = @{}
  if ($uri -match '\?(.+)$') {
    foreach ($pair in $Matches[1] -split '&') {
      $kv = $pair -split '=', 2
      if ($kv.Count -eq 2) { $q[$kv[0]] = [System.Uri]::UnescapeDataString($kv[1]) }
    }
  }
  $vendor = $q['vendor']
  $cfg = $config.$vendor
  if (-not $cfg) { throw "No config for vendor '$vendor' - edit config.json" }
  $args = $cfg.args.Replace('{pid}', $q['pid']).Replace('{first}', $q['first']).Replace('{last}', $q['last']).Replace('{dob}', $q['dob'])
  Start-Process -FilePath $cfg.exe -ArgumentList $args
} catch {
  [System.Windows.Forms.MessageBox] | Out-Null
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show("Dentora Imaging Bridge: $($_.Exception.Message)`n`nCheck $env:LOCALAPPDATA\Dentora\config.json", 'Dentora Bridge')
}
'@ | Set-Content -Path $handler -Encoding UTF8

# --- register the dentora:// protocol (per-user, no admin) --------------------------
$root = 'HKCU:\Software\Classes\dentora'
New-Item -Path $root -Force | Out-Null
Set-ItemProperty -Path $root -Name '(Default)' -Value 'URL:Dentora Imaging Bridge'
Set-ItemProperty -Path $root -Name 'URL Protocol' -Value ''
New-Item -Path "$root\shell\open\command" -Force | Out-Null
$cmd = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$handler`" `"%1`""
Set-ItemProperty -Path "$root\shell\open\command" -Name '(Default)' -Value $cmd

Write-Host ''
Write-Host 'Dentora Imaging Bridge installed.' -ForegroundColor Green
Write-Host "1. Edit $configPath so the exe paths match this PC's Romexis / CS Imaging install."
Write-Host '2. In Dentora, open a patient -> Imaging -> "Open in ..." — the imaging software should launch.'
