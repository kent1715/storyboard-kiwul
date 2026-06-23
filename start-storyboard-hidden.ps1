$ErrorActionPreference = "SilentlyContinue"

Set-Location "D:\storyboard-kiwul"

# Matikan proses lama di port 3000 agar tidak bentrok
$pid3000 = (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue).OwningProcess
if ($pid3000) {
  Stop-Process -Id $pid3000 -Force
  Start-Sleep -Seconds 2
}

# Hapus cache Next.js
Remove-Item ".\.next" -Recurse -Force -ErrorAction SilentlyContinue

# Jalankan Kiwul hidden, log masuk ke file
Start-Process -WindowStyle Hidden -FilePath "cmd.exe" -ArgumentList "/c cd /d D:\storyboard-kiwul && bunx next dev -p 3000 > D:\storyboard-kiwul\logs\kiwul-next.log 2>&1"
