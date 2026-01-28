@echo off
REM Deployment script for Custom Forms API
REM This bypasses PowerShell execution policy issues

echo ========================================
echo Custom Forms API Deployment
echo ========================================
echo.

cd /d "%~dp0"

echo Checking if we're in the api directory...
if not exist "wrangler.toml" (
    echo ERROR: wrangler.toml not found!
    echo Please run this script from the api directory.
    pause
    exit /b 1
)

echo.
echo Deploying to Cloudflare Workers...
echo.

npx wrangler@latest deploy

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo ✅ Deployment successful!
    echo ========================================
    echo.
    echo Your Worker is now live at:
    echo https://custom-forms-api.mr-adhi125.workers.dev
    echo.
    echo Next steps:
    echo 1. Refresh your admin panel (Ctrl+F5)
    echo 2. Try creating a new form
    echo 3. Check browser console for any errors
    echo.
) else (
    echo.
    echo ========================================
    echo ❌ Deployment failed!
    echo ========================================
    echo.
    echo Please check the error messages above.
    echo.
)

pause
