@echo off
rem =====================================================================
rem  PING DEVELOPER (Telegram)
rem  Sends ONE line to the developer's Telegram via maidchaanbot:
rem      need your review - <task ref>
rem  Usage:  docs\ping-developer.bat [task ref]
rem          (default ref: "the loop")
rem  Bot token + chat id are read from C:\Users\arifs\.pi\agent\telegram.json
rem  (profiles.default.botToken / .allowedUserId) - not hardcoded here.
rem =====================================================================
setlocal
set "REF=%~1"
if "%REF%"=="" set "REF=the loop"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$j = Get-Content 'C:\Users\arifs\.pi\agent\telegram.json' -Raw | ConvertFrom-Json; $t = $j.profiles.default.botToken; $id = [string]$j.profiles.default.allowedUserId; $body = @{chat_id=$id; text=('need your review - ' + '%REF%')} | ConvertTo-Json; try { $r = Invoke-WebRequest -Method Post -Uri ('https://api.telegram.org/bot' + $t + '/sendMessage') -Body $body -ContentType 'application/json' -UseBasicParsing; Write-Host ('Telegram sent: ' + $r.StatusCode) } catch { Write-Host ('Telegram send FAILED: ' + $_.Exception.Message) }"
endlocal
