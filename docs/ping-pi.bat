@echo off
rem =====================================================================
rem  PING PI (Reviewer)
rem  Run this (from anywhere) when GEMINI has posted a message in
rem  docs\inbox-pi.md. It opens a console window that wakes the Pi
rem  session for this project.
rem =====================================================================
cd /d "X:\SillyTavern\public\scripts\extensions\third-party\Megumin-Suite-Beta"
start "Pinging Pi (Reviewer)" cmd /k pi -c -p "Auto-ping from Gemini (Builder): a new message is waiting in docs\inbox-pi.md. Read docs\COMMS.md, then read the newest inbox entry, then act."
