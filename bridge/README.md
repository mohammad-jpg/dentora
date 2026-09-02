# Dentora Imaging Bridge

Lets the "Open in Romexis" / "Open in CS Imaging" buttons in the Dentora web app
launch the practice's local imaging software with the right patient selected.

## How it works

The web app can't start desktop programs (browsers forbid it), so the bridge
registers a custom `dentora://` link type on the practice PC. Clicking the button
in Dentora fires `dentora://open?vendor=romexis&pid=...&first=...&last=...&dob=...`,
Windows hands it to the bridge, and the bridge launches the configured imaging
program with those patient details.

This is the same pattern commercial cloud PMS use for their imaging bridges.

## Install (each surgery PC, ~2 minutes, no admin rights needed)

1. Download `install-dentora-bridge.ps1` from this folder onto the PC.
2. Right-click → **Run with PowerShell**.
3. Edit `%LOCALAPPDATA%\Dentora\config.json` so the `exe` paths match where
   Romexis / CS Imaging are installed on that PC.
4. In Dentora → patient → Imaging → **Open in Romexis** — the program should launch.

## Confirming the command-line arguments

Both vendors support being launched by practice-management systems:

- **Planmeca Romexis** — the "Romexis PMS Bridge" module (`PmBridge.exe`); your
  Planmeca installer/support can confirm the exact executable path and patient
  arguments enabled at your site.
- **Carestream CS Imaging** — the PMS gateway (`TW.exe` heritage interface); your
  Carestream support contact can confirm the patient-handoff arguments for your version.

The defaults in `config.json` follow the common conventions, but versions differ —
a 5-minute call with the vendor's support line (every practice has a contract)
gets the exact string, and it's a one-time setup per PC.
