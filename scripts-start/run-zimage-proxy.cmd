@echo off
title Z-Image Proxy 9100
cd /d D:\zimage-openai-proxy
.\.venv\Scripts\python.exe -m uvicorn server:app --host 0.0.0.0 --port 9100
pause