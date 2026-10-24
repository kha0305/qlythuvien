@echo off
REM Chay backend + frontend trong 1 terminal duy nhat.
REM Tu dong quet package.json, goi nao thieu thi npm install truoc khi chay.
REM Nhan Ctrl+C de dung ca 2.
cd /d "%~dp0"
call :ensure_deps backend
call :ensure_deps frontend
echo Dang khoi dong backend + frontend...
npx -y concurrently -n backend,frontend -c green,cyan "npm run dev --prefix backend" "npm run dev --prefix frontend"
echo.
echo Da dung. Nhan phim bat ky de dong cua so.
pause >nul
exit /b

:ensure_deps
node -e "const fs=require('fs');try{const deps=Object.keys(require('./%1/package.json').dependencies||{});const missing=deps.filter(d=>!fs.existsSync('./%1/node_modules/'+d));if(missing.length){console.log('Phat hien goi thieu o %1: '+missing.join(', '));process.exit(1);}}catch(e){process.exit(1);}"
if errorlevel 1 (
  echo Dang cai dat thu vien cho %1, cho chut...
  call npm install --prefix %1
)
exit /b
