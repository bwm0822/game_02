@echo off
cd /d "%~dp0.."

for %%f in (scripts\*.js) do (
    rem item.json is hand-edited (paperdoll tool writes equip placement); item.js would overwrite it
    rem role.json is hand-edited too and has no converter (xls/role.xlsx is out of sync)
    rem ability.json / ab_tree.json / local.json are hand-edited (tools/ability); their xlsx are out of sync
    if /I not "%%~nxf"=="minimap.js" if /I not "%%~nxf"=="lang.js" if /I not "%%~nxf"=="item.js" if /I not "%%~nxf"=="ability.js" if /I not "%%~nxf"=="ab_tree.js" if /I not "%%~nxf"=="local.js" (
        echo Running %%f...
        node "%%f"
    )
)
rem lang.js only checks public/assets/lang/*.json (hand-edited in tools/lang) against the outputs above, so it runs last
echo Running scripts\lang.js...
node scripts\lang.js
echo Done.
