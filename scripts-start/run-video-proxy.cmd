@echo off
title Video Proxy 9200
cd /d D:\local-video-proxy
.\.venv\Scripts\python.exe -m uvicorn server:app --host 0.0.0.0 --port 9200
pause