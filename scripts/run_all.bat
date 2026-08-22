@echo off
cd /d "%~dp0.."

for %%f in (scripts\*.js) do (
    if /I not "%%~nxf"=="minimap.js" (
        echo Running %%f...
        node "%%f"
    )
)
echo Done.
