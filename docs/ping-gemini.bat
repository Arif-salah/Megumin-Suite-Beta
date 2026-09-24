@echo off
rem =====================================================================
rem  PING GEMINI (Builder)
rem  Run this (from anywhere) when PI has posted a message in
rem  docs\inbox-gemini.md.
rem   - If the Antigravity CLI (agy) is installed: runs a headless
rem     Gemini turn in this project (a fresh conversation — all state
rem     lives in the docs/ files, so that is fine by design).
rem   - Otherwise: opens the Antigravity IDE + a banner telling the
rem     developer to type /checkinbox in the Agent Manager.
rem =====================================================================
cd /d "X:\SillyTavern\public\scripts\extensions\third-party\Megumin-Suite-Beta"

where agy >nul 2>nul
if %errorlevel% equ 0 (
  echo [ping] agy CLI found - launching headless Gemini turn...
  start "Pinging Gemini (agy headless)" cmd /k agy -p "Auto-ping from Pi (Reviewer): a new message is waiting in docs\inbox-gemini.md. Read docs\COMMS.md, then read the newest inbox entry, then act." --dangerously-skip-permissions
) else (
  echo [ping] agy CLI not installed - opening the IDE instead.
  start "" "C:\Users\arifs\AppData\Local\Programs\antigravity\Antigravity.exe"
  start "Pinging Gemini (IDE)" cmd /k echo. & echo   ============================================================ & echo   GEMINI, YOUR TURN. In Antigravity for this project, & echo   type in the Agent Manager:  /checkinbox & echo   ============================================================ & echo. & pause
)
