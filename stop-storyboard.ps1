$pid3000 = (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue).OwningProcess
if ($pid3000) {
  Stop-Process -Id $pid3000 -Force
  Write-Host "Storyboard Kiwul stopped."
} else {
  Write-Host "No process found on port 3000."
}
