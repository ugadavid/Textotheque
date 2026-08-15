@echo off
setlocal
cd /d "%~dp0"

title Textotheque - Dev

echo.
echo ==========================================
echo           TEXTOTHEQUE - LANCEMENT
echo ==========================================
echo.
echo Dossier : %CD%
echo.

if not exist "package.json" (
    echo [ERREUR] package.json est introuvable.
    echo Place ce fichier BAT a la racine de Textotheque.
    echo.
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo [ERREUR] Le dossier node_modules est introuvable.
    echo Les dependances du projet ne semblent pas installees.
    echo.
    echo Aucun npm install automatique n'est lance par ce script.
    echo.
    pause
    exit /b 1
)

rem Textotheque attend actuellement Vite sur le port 5173.
rem Si ce port est occupe, Vite pourrait basculer sur 5174 alors
rem qu'Electron continuerait a attendre/charger 5173.

powershell.exe -NoLogo -NoProfile -Command ^
  "$c = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($c) { Write-Host ('[ATTENTION] Le port 5173 est deja utilise par le processus PID ' + $c.OwningProcess + '.'); exit 2 } else { exit 0 }"

if errorlevel 2 (
    echo.
    echo Textotheque utilise actuellement un port de developpement fixe : 5173.
    echo Ferme l'ancien serveur Vite / Textotheque qui utilise ce port,
    echo puis relance ce fichier.
    echo.
    pause
    exit /b 2
)

echo [OK] Port 5173 disponible.
echo.
echo Lancement de Textotheque...
echo Pour arreter le serveur : Ctrl+C dans cette fenetre.
echo.

call npm.cmd run dev
set "TEXTOTHEQUE_EXIT=%ERRORLEVEL%"

echo.
if not "%TEXTOTHEQUE_EXIT%"=="0" (
    echo [ERREUR] Textotheque s'est arretee avec le code %TEXTOTHEQUE_EXIT%.
    echo.
    pause
) else (
    echo Textotheque est arretee.
)

exit /b %TEXTOTHEQUE_EXIT%
