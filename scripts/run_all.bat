@echo off
cd /d "%~dp0.."
for %%f in (scripts\*.js) do (
    echo Running %%f...
    node "%%f"
)
echo Done.
