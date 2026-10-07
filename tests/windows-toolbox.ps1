$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$file = Join-Path $root 'public/toolbox/windows/ChinaTech-Windows.ps1.txt'
$tokens = $null; $errors = $null
[Management.Automation.Language.Parser]::ParseFile($file,[ref]$tokens,[ref]$errors) | Out-Null
if ($errors.Count) { throw ($errors.Message -join '; ') }
foreach ($locale in @('zh-CN','it','en')) {
    $loader = [IO.File]::ReadAllText((Join-Path $root ('public/toolbox/windows/Start-' + $locale + '.cmd.txt')))
    $code = [regex]::Match($loader, '-Command "([^\r\n]+)"').Groups[1].Value
    if (-not $code) { throw 'missing CMD PowerShell loader' }
    [Management.Automation.Language.Parser]::ParseInput($code,[ref]$tokens,[ref]$errors) | Out-Null
    if ($errors.Count) { throw ($errors.Message -join '; ') }
}
# Import the exact bytes with a .ps1 extension, as in the downloaded package.
# PowerShell does not dot-source .txt files; invoking a script block would lose
# MyInvocation.MyCommand.Path and would not test the real file entry context.
$validation = Join-Path $root '.local/windows-toolbox/validation'
[void][IO.Directory]::CreateDirectory($validation)
$copy = Join-Path $validation 'ChinaTech-Windows.ps1'
[IO.File]::WriteAllBytes($copy, [IO.File]::ReadAllBytes($file))
. $copy -LibraryOnly
$count = 0
function Assert($Condition, $Label) {
    if (-not $Condition) { throw $Label }
    $script:count++
}
# Exercise the exact pinned manifest, then corruption/missing-file failures.
$releasePath = Join-Path $validation 'release.xml'
[IO.File]::WriteAllBytes($releasePath, [IO.File]::ReadAllBytes((Join-Path $root 'public/toolbox/windows/release.xml')))
Assert ((Read-Release).status -eq 'inspection-only') 'original release parses as inspection'
[IO.File]::AppendAllText($releasePath, 'corrupted')
$tampered = $false
try { Read-Release } catch { $tampered = $_.Exception.Message -eq (Get-Message 'integrity') }
Assert $tampered 'tampered manifest stops before XML parsing'
[IO.File]::Delete($releasePath)
$missing = $false
try { Read-Release } catch { $missing = $_.Exception.Message -eq (Get-Message 'integrity') }
Assert $missing 'missing manifest requests complete package'
Assert ((Get-InstalledArchitecture 8 'AMD64' @(12)) -eq 'arm64') 'ARM64 emulation is not native x64'
Assert ((Get-InstalledArchitecture 4 '' @(9)) -eq 'x86') '32-bit OS on 64-bit CPU stays unsupported'
Assert ((Get-InstalledArchitecture 4 'AMD64' @(9)) -eq 'x64') 'WOW64 process identifies installed 64-bit OS'
Assert ((Get-InstalledArchitecture 8 '' @()) -eq 'unknown') 'missing CPU architecture does not guess'
foreach ($case in @(
    @('6.1',7601,'Professional','windows7-pro-x64'),
    @('6.1',7601,'Ultimate','windows7-pro-x64'),
    @('6.1',7601,'HomePremium','windows7-home-x64'),
    @('6.2',9200,'Core','windows8-home-x64'),
    @('6.3',9600,'Professional','windows81-pro-x64'),
    @('10.0',19045,'Professional','windows10-pro-x64'),
    @('10.0',19045,'CoreSingleLanguage','windows10-home-x64'),
    @('10.0',22631,'Professional','windows11-pro-x64'),
    @('10.0',22631,'Core','windows11-home-x64')
)) {
    $route = Get-Route $case[0] $case[1] $case[2] 'x64'
    Assert ($route.Allowed -and $route.Route -eq $case[3]) ('route: '+$case[3])
    Assert ($route.Steps[-1] -eq 'verify-target') 'always verify real target'
}
Assert ((Get-Route '6.2' 9200 'Core' 'x64').Steps[0] -eq 'windows81') 'Windows 8 requires 8.1 bridge'
foreach ($case in @(@('10.0',19045,'Professional','x86'),@('10.0',22631,'Professional','arm64'),@('10.0',19045,'ProfessionalN','x64'),@('10.0',19045,'Enterprise','x64'),@('6.1',7600,'Professional','x64'),@('6.3',9600,'Unknown','x64'),@('5.1',2600,'Professional','x64'),@('10.0',19045,'Ultimate','x64'))) {
    Assert (-not (Get-Route $case[0] $case[1] $case[2] $case[3]).Allowed) 'unsupported paths must stop'
}
$good = New-Object PSObject -Property @{ InstallLanguage='it-IT'; Edition='Professional'; FreeBytes=80GB; Power='ac'; PendingReboot=$false; Encryption='unencrypted'; ExistingHook=$false }
Assert (@(Get-PreflightIssues $good).Count -eq 0) 'clean preflight fixture'
foreach ($case in @(@('FreeBytes',0,'space'),@('Power','unknown','power'),@('Power','battery','power'),@('PendingReboot',$true,'reboot'),@('Encryption','encrypted','encryption'),@('Encryption','unknown','encryption'),@('ExistingHook',$true,'hook'),@('InstallLanguage','','unknown'))) {
    $copy = New-Object PSObject -Property @{}
    foreach ($property in $good.PSObject.Properties) { $copy | Add-Member NoteProperty $property.Name $property.Value }
    $copy.($case[0]) = $case[1]
    Assert (@(Get-PreflightIssues $copy) -contains $case[2]) ('preflight: '+$case[2])
}
Assert (Test-RetentionScan 3247440400) 'only documented ScanOnly success'
Assert (Test-RetentionScan -1047526896) 'signed ScanOnly success'
foreach ($code in @(0,3010,3247440388,3247440384,3247440392,-1)) { Assert (-not (Test-RetentionScan $code)) ('scan must stop: '+$code) }
# The modern module is embedded, imports only on supported PowerShell, and has
# no operations at import time. Exercise its actual gate entry helpers.
. Import-CTWorkflow
Assert ([bool](Get-Command Invoke-CTWorkflow -ErrorAction SilentlyContinue)) 'workflow functions imported into runner scope'
$release = [xml]'<release schemaVersion="1" status="verified"><target edition="Professional" architecture="x64"/><verifiedRoutes><route id="windows10-pro-x64" sourceVersion="10.0" sourceBuild="19045" sourceEdition="Professional" architecture="x64" language="it-IT" hardwarePolicy="setup-scan" windowsEvidence="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" codeSha256="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" independentReview="cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"/></verifiedRoutes></release>'
Assert (-not (Test-RouteRelease $release.release 'windows10-pro-x64')) 'editing XML cannot unlock preview'
function Start-Process { throw 'unexpected-system-process' }
$context = New-Object PSObject -Property @{Release=$release.release;Route='windows10-pro-x64';WorkPath='missing'}
foreach ($call in @(
    { Invoke-CTActivation $context },
    { Invoke-CTSetup $context $null $null -Scan },
    { Invoke-CTEditionChange $context $null }
)) {
    $stopped = $false
    try { & $call } catch { $stopped = $_.Exception.Message -eq (Get-Message 'blocked') }
    Assert $stopped 'workflow execution helpers reject before system access'
}
$gateStatus = $script:AutomationEnabled
$script:AutomationEnabled = $true
Assert (-not (Test-RouteRelease $release.release 'windows10-pro-x64')) 'stale source hash cannot unlock enabled compilation'
$release.release.verifiedRoutes.route.codeSha256=$script:SourceInputHash
Assert (Test-RouteRelease $release.release 'windows10-pro-x64') 'source-bound synthetic route passes only the policy gate'
$sourceFacts = New-Object PSObject -Property @{Version='10.0';Build=19045;Edition='Professional';Architecture='x64';InstallLanguage='it-IT'}
Assert (Test-RouteRelease $release.release 'windows10-pro-x64' $sourceFacts) 'verified source build/language matches exact facts'
foreach ($change in @(@('Build',19044),@('InstallLanguage','en-US'),@('Edition','Core'),@('Architecture','arm64'))) {
    $old=$sourceFacts.($change[0]);$sourceFacts.($change[0])=$change[1]
    Assert (-not (Test-RouteRelease $release.release 'windows10-pro-x64' $sourceFacts)) 'source identity drift rejects verified route'
    $sourceFacts.($change[0])=$old
}
$release.release.verifiedRoutes.route.windowsEvidence='invalid'
Assert (-not (Test-RouteRelease $release.release 'windows10-pro-x64')) 'bad evidence rejected'
$script:AutomationEnabled = $gateStatus

# ScriptBlock loses MyInvocation.Path; explicit package data must keep release
# validation tied to the trusted directory.
$packageBytes = [IO.File]::ReadAllBytes($file)
$packageHash = Get-Sha256Bytes $packageBytes
$entryCode = [Text.Encoding]::UTF8.GetString($packageBytes).TrimStart([char]65279)
. ([ScriptBlock]::Create($entryCode)) -LibraryOnly -PackageDirectory $validation -EntryHash $packageHash
[IO.File]::WriteAllBytes($releasePath,[IO.File]::ReadAllBytes((Join-Path $root 'public/toolbox/windows/release.xml')))
Assert ((Read-Release).status -eq 'inspection-only') 'ScriptBlock uses explicit PackageDirectory'
Assert-CTEntryBytes
$count++

$hostile = "C:\package';Write-Host injected;# & ! `"quoted`""
$loader = Get-CTPinnedEntryLoader $hostile ('a' * 64) 'it' ($hostile + '\run') 'S-1-5-21-1-2-3-1001'
[Management.Automation.Language.Parser]::ParseInput($loader,[ref]$tokens,[ref]$errors) | Out-Null
Assert ($errors.Count -eq 0) 'encoded package/resume path leaves generated loader parseable'
Assert (-not $loader.Contains($hostile)) 'package path is not PowerShell source'
Assert (($loader.Split(@('ReadAllBytes'),[StringSplitOptions]::None).Count - 1) -eq 1) 'loader reads entry bytes exactly once'
$decoded = [Text.Encoding]::Unicode.GetString([Convert]::FromBase64String([regex]::Match($loader,'\$pkg=d ''([^'']+)''').Groups[1].Value))
Assert ($decoded -eq $hostile) 'hostile package path survives unchanged as data'

# Exercise the exact read/hash/invoke portion with a harmless local script. A
# replacement after ReadAllBytes must not change the executed code. Host and SID
# validation still require Windows and are not simulated as actual OS evidence.
$probe = Join-Path $validation 'ChinaTech-Windows.ps1'
$original = [IO.File]::ReadAllBytes($probe)
$harmless = 'param($Language,$PackageDirectory,$EntryHash,$ResumePath,$OwnerSid); return "original-memory-entry"'
[IO.File]::WriteAllText($probe,$harmless,(New-Object Text.UTF8Encoding($true)))
$expected = Get-Sha256 $probe; $pkg=$validation; $lang='en'; $resume=''; $sid='S-1-5-21-1-2-3-1001'
$probeLoader = Get-CTPinnedEntryLoader $validation $expected 'en' '' $sid
$segment = $probeLoader.Substring($probeLoader.IndexOf('$bytes=')).Split(@('}catch{'),[StringSplitOptions]::None)[0]
$replacement = '$code=[Text.Encoding]::UTF8.GetString($bytes)'
$segment = $segment.Replace($replacement,'[IO.File]::WriteAllText((Join-Path $pkg ''ChinaTech-Windows.ps1''),''throw "replacement-must-not-run"'');' + $replacement)
try {
    Assert ((& ([ScriptBlock]::Create($segment))) -eq 'original-memory-entry') 'verified bytes are the executed bytes after path replacement'
    $tampered=$false
    try { & ([ScriptBlock]::Create($segment)) } catch { $tampered=$_.Exception.Message -eq 'integrity' }
    Assert $tampered 'changed bytes fail the compiled expected hash'
} finally { [IO.File]::WriteAllBytes($probe,$original) }
Assert ((Get-CTFailureMessage 'workflow.identity') -eq (Get-Message 'workflow.identity')) 'known workflow error is translated'
Assert ((Get-CTFailureMessage 'bad C:\private-path') -eq (Get-Message 'workflow.failedUnknown')) 'unknown failure hides exception/path'
foreach ($locale in @('zh-CN','it','en')) {
    $script:LanguageIndex = @('zh-CN','it','en').IndexOf($locale)
    Assert ((Get-Message 'blocked').Length -gt 20) ('blocked translated: '+$locale)
}
Write-Host "PowerShell checks passed: $count assertions; syntax and pure fixtures only, zero Windows activation/installation."
