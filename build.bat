powershell -Command "if (Test-Path './dist') { Remove-Item './dist' -Recurse -Force }"
powershell.exe npm run build