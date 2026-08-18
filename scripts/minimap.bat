@echo off
cd /d "%~dp0.."

set "TMXRASTERIZER=C:\Program Files\Tiled\tmxrasterizer.exe"
if not exist "%TMXRASTERIZER%" (
    echo tmxrasterizer.exe not found at "%TMXRASTERIZER%", falling back to PATH
    set "TMXRASTERIZER=tmxrasterizer"
)

node scripts\minimap.js

pause
