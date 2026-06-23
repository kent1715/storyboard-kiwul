@echo off
title START KIWUL - ONE WINDOWS TERMINAL

cd /d D:\storyboard-kiwul

echo Stop proses lama di port 3000, 9000, 9100, 9200, 8188...
for %%p in (3000 9000 9100 9200 8188) do (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%%p ^| findstr LISTENING') do (
        echo Killing port %%p PID %%a
        taskkill /PID %%a /F
    )
)

echo.
echo Membuka semua service dalam 1 Windows Terminal...
echo.

wt -w new ^
  new-tab --title "Z-Image UI 9000" cmd /k "D:\storyboard-kiwul\scripts-start\run-zimage-ui.cmd" ^
  ; new-tab --title "Z-Image Proxy 9100" cmd /k "D:\storyboard-kiwul\scripts-start\run-zimage-proxy.cmd" ^
  ; new-tab --title "Video Proxy 9200" cmd /k "D:\storyboard-kiwul\scripts-start\run-video-proxy.cmd" ^
  ; new-tab --title "ComfyUI 8188" cmd /k "D:\storyboard-kiwul\scripts-start\run-comfyui.cmd" ^
  ; new-tab --title "Storyboard Kiwul 3000" cmd /k "D:\storyboard-kiwul\scripts-start\run-storyboard.cmd"

echo.
echo Jika Windows Terminal sudah terbuka, tunggu semua service loading.
echo Buka: http://localhost:3000
echo.
pause