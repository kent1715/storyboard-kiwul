@echo off
title Storyboard Kiwul 3000
cd /d D:\storyboard-kiwul

echo Cleaning .next...
if exist .next rmdir /s /q .next

echo Starting Storyboard Kiwul...
echo URL: http://localhost:3000
echo.

bunx next dev -p 3000

pause