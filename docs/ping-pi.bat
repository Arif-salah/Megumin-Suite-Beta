@echo off
rem =====================================================================
rem  PING PI (Reviewer)
rem  Run this (from anywhere) when GEMINI has posted a message in
rem  docs\inbox-pi.md. Opens a console window that wakes the Pi
rem  session for this project.
rem
rem  ENV NOTES (keep in sync with C:\Users\arifs\.pi\agent\models.json):
rem   - PI_PROVIDER / PI_MODEL are set explicitly so the ping run uses
rem     the local Qwen (LM Studio) provider regardless of who started it.
rem   - OPENAI_API_BASE / OPENAI_API_KEY are CLEARED: stale copies of
rem     these (e.g. the old LAN vLLM at 192.168.2.158:8888 with key
rem     123456) live in the user environment and override pi's own
rem     config, which made fresh runs 401.
rem =====================================================================
cd /d "X:\SillyTavern\public\scripts\extensions\third-party\Megumin-Suite-Beta"
set "PI_PROVIDER=Local-Qwen-Text"
set "PI_MODEL=qwen3.8-27b"
set "OPENAI_API_BASE="
set "OPENAI_API_KEY="
start "Pinging Pi (Reviewer)" cmd /k pi -c -p "Auto-ping from Gemini (Builder): a new message is waiting in docs\inbox-pi.md. Read docs\COMMS.md, then read the newest inbox entry, then act."
