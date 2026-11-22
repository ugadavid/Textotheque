param([Parameter(Mandatory)][string]$Destination)

# Copies de qualification uniquement, après fermeture normale de Textothèque.
$ErrorActionPreference = 'Stop'
$root = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Textotheque'
$profilePath = Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'Textotheque'
$marker = Join-Path $profilePath 'qualification-052.txt'
if ((Get-Content -Raw -LiteralPath $marker) -notmatch '^CODEX_VM 052 - profil fictif' -or
    (Get-Process -Name Textotheque -ErrorAction SilentlyContinue)) {
    throw 'Le relevé exige la fixture 052 identifiée et fermée.'
}
$folder = New-Item -ItemType Directory -Path $Destination
foreach ($name in @('textotheque.sqlite', 'Qualification-052-B.sqlite', 'library-history.json')) {
    $file = Join-Path $profilePath $name
    if (Test-Path -LiteralPath ($file + '-wal')) { throw "WAL présent pour $name" }
    Copy-Item -LiteralPath $file -Destination $folder.FullName
}

$shell = New-Object -ComObject WScript.Shell
$links = @(foreach ($scope in @('Programs', 'CommonPrograms')) {
    $programs = [Environment]::GetFolderPath($scope)
    foreach ($file in (Get-ChildItem -LiteralPath $programs -Recurse -Filter '*Textotheque*.lnk')) {
        [pscustomobject]@{ path = $file.FullName; target = $shell.CreateShortcut($file.FullName).TargetPath }
    }
})
$uninstall = @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*')
$installed = @(Get-ItemProperty $uninstall | Where-Object DisplayName -eq Textotheque |
    Select-Object PSChildName, DisplayVersion, InstallLocation)
$inventory = [ordered]@{
    root = $root
    files = @(Get-ChildItem -LiteralPath $root -Force -Name)
    packages = @(Get-ChildItem -LiteralPath (Join-Path $root 'packages') -Name)
    profile = $profilePath
    profileCreated = (Get-Item -LiteralPath $profilePath).CreationTimeUtc.ToString('o')
    contents = @(Get-ChildItem -LiteralPath $profilePath -Force -Name)
    links = $links
    installed = $installed
    programVersion = (Get-Item -LiteralPath (Join-Path $root 'Textotheque.exe')).VersionInfo.ProductVersion
}
$inventory | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 -LiteralPath (Join-Path $folder.FullName 'windows.json')
