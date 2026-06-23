@echo off
title START KIWUL - ONE TERMINAL WITH TABS
cd /d D:\storyboard-kiwul

echo ==========================================
echo  START KIWUL ALL SERVICES IN TABS
echo ==========================================
echo.

echo [1/2] Stop proses lama di port 3000, 9000, 9100, 9200, 8188...
for %%p in (3000 9000 9100 9200 8188) do (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%%p ^| findstr LISTENING') do (
        echo Killing port %%p PID %%a
        taskkill /PID %%a /F
    )
)

echo.
echo [2/2] Membuka Windows Terminal dengan tab berbeda...
echo.

wt -w new ^
  new-tab --title "Z-Image UI 9000" powershell -NoExit -ExecutionPolicy Bypass -Command "Set-Location 'D:\Z-Image-Turbo-Windows'; .\start_zimage.bat" ^
  ; new-tab --title "Z-Image Proxy 9100" powershell -NoExit -ExecutionPolicy Bypass -Command "Set-Location 'D:\zimage-openai-proxy'; .\.venv\Scripts\python.exe -m uvicorn server:app --host 0.0.0.0 --port 9100" ^
  ; new-tab --title "Video Proxy 9200" powershell -NoExit -ExecutionPolicy Bypass -Command "Set-Location 'D:\local-video-proxy'; .\.venv\Scripts\python.exe -m uvicorn server:app --host 0.0.0.0 --port 9200" ^
  ; new-tab --title "ComfyUI 8188" powershell -NoExit -ExecutionPolicy Bypass -Command "Set-Location 'C:\ComfyUI'; python main.py --listen 127.0.0.1 --port 8188" ^
  ; new-tab --title "Storyboard Kiwul 3000" powershell -NoExit -ExecutionPolicy Bypass -Command "Set-Location 'D:\storyboard-kiwul'; Remove-Item .\.next -Recurse -Force -ErrorAction SilentlyContinue; bunx next dev -p 3000"

echo.
echo Kalau Windows Terminal sudah terbuka, buka:
echo http://localhost:3000
echo.
pause