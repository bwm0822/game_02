@echo off
cd /d "%~dp0.."

for %%f in (scripts\*.js) do (
    if /I not "%%~nxf"=="minimap.js" if /I not "%%~nxf"=="lang.js" (
        echo Running %%f...
        node "%%f"
    )
)
rem lang.js only checks public/assets/lang/*.json (hand-edited in tools/lang) against the outputs above, so it runs last
echo Running scripts\lang.js...
node scripts\lang.js
echo Done.
