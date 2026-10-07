param([string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot))
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'Native Windows required' }
$manifest = Get-Content -LiteralPath (Join-Path $ProjectRoot 'public/toolbox/windows/checksums.json') -Raw | ConvertFrom-Json
if ($manifest.status -ne 'inspection-only') { throw 'Smoke test only permits the read-only release' }
$messages = Get-Content -LiteralPath (Join-Path $ProjectRoot 'scripts/windows-toolbox/messages.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$zip = Join-Path $ProjectRoot 'public/toolbox/windows/ChinaTech-Windows-Check.zip'
if ((Get-FileHash -LiteralPath $zip).Hash -ine $manifest.archive.sha256) { throw 'ZIP fingerprint mismatch' }
$temp = Join-Path ([IO.Path]::GetTempPath()) ('ChinaTech-cmd-' + [Guid]::NewGuid().ToString('N'))
# Exercise spaces, shell metacharacters, an apostrophe and a non-ASCII folder.
$package = Join-Path $temp ('package ! & () ' + "'" + [char]0x6d4b + [char]0x8bd5)
[void][IO.Directory]::CreateDirectory($package)
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::ExtractToDirectory($zip,$package)
$entry = Join-Path $package 'ChinaTech-Windows.ps1'
$release = Join-Path $package 'release.xml'
$entryBytes = [IO.File]::ReadAllBytes($entry)
$releaseBytes = [IO.File]::ReadAllBytes($release)
$count = 0
function Invoke-CmdCheck([string]$Locale,[int]$CodePage,[int]$ExpectedExit,[string]$ExpectedText,[switch]$MissingHost) {
    $process = New-Object Diagnostics.Process
    $info = $process.StartInfo
    $info.FileName = Join-Path ([Environment]::SystemDirectory) 'cmd.exe'
    $info.Arguments = '/d /v:off /c "chcp ' + $CodePage + '>nul & Start-' + $Locale + '.cmd"'
    $info.WorkingDirectory = $package
    $info.UseShellExecute = $false
    $info.RedirectStandardInput = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.StandardOutputEncoding = New-Object Text.UTF8Encoding
    $info.StandardErrorEncoding = New-Object Text.UTF8Encoding
    if ($MissingHost) { $info.EnvironmentVariables['SystemRoot'] = Join-Path $temp 'missing-system' }
    try {
        [void]$process.Start()
        $process.StandardInput.WriteLine(); $process.StandardInput.WriteLine(); $process.StandardInput.Close()
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(45000)) { $process.Kill(); throw 'CMD launch timed out' }
        $output = $stdout.Result; $errorOutput = $stderr.Result
        if ($process.ExitCode -ne $ExpectedExit -or -not $output.Contains($ExpectedText) -or $errorOutput.Trim()) {
            throw ('CMD ' + $Locale + ' CP' + $CodePage + ' expected ' + $ExpectedExit + '; actual ' + $process.ExitCode + "`n" + $output + "`n" + $errorOutput)
        }
        $script:count++
    } finally { $process.Dispose() }
}
try {
    $languages = @('zh-CN','it','en')
    foreach ($locale in $languages) {
        $index = [Array]::IndexOf($languages,$locale)
        foreach ($cp in @(437,936)) { Invoke-CmdCheck $locale $cp 10 $messages.blocked[$index] }
        [IO.File]::AppendAllText($entry,'# intentional test corruption')
        Invoke-CmdCheck $locale 936 2 $messages.integrity[$index]
        [IO.File]::WriteAllBytes($entry,$entryBytes)
        [IO.File]::AppendAllText($release,'intentional test corruption')
        Invoke-CmdCheck $locale 437 1 $messages.integrity[$index]
        [IO.File]::WriteAllBytes($release,$releaseBytes)
        [IO.File]::Delete($entry)
        Invoke-CmdCheck $locale 936 2 $messages.integrity[$index]
        [IO.File]::WriteAllBytes($entry,$entryBytes)
        Invoke-CmdCheck $locale 936 2 $messages.missingPowerShell[$index] -MissingHost
    }
    Write-Output ($count.ToString() + ' native CMD checks passed; inspection and rejected packages only')
} finally {
    # Only this test's GUID-named temporary directory is removed.
    if ([IO.Directory]::Exists($temp)) { [IO.Directory]::Delete($temp,$true) }
}
