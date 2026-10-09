@echo off
cd /d "%~dp0.."

for %%f in (scripts\*.js) do (
    if /I not "%%~nxf"=="minimap.js" if /I not "%%~nxf"=="lang.js" (
        echo Running %%f...
        node "%%f"
    )
)
rem lang.js reads the outputs of the scripts above, so it must run last
echo Running scripts\lang.js...
node scripts\lang.js
echo Done.
