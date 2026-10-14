@echo off
cd /d "%~dp0token-ui"
set "NEXT_TELEMETRY_DISABLED=1"
set "npm_config_cache=D:\Lab2_Poster\Cache\npm"
set "TEMP=D:\Lab3_ERC20\Temp"
set "TMP=D:\Lab3_ERC20\Temp"
call npm run dev
pause
