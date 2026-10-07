param(
    [ValidateSet('zh-CN','it','en')][string]$Language = 'zh-CN',
    [switch]$LibraryOnly,
    [string]$PackageDirectory = '',
    [string]$EntryHash = '',
    [string]$ResumePath = '',
    [string]$OwnerSid = ''
)

# Generated package pins the release policy. Inspection never downloads or executes
# third-party scripts, changes licensing, or creates a scheduled task.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
# ScriptBlock invocation has no MyInvocation path; a pinned loader supplies it.
$script:PackageRoot = $PackageDirectory
if (-not $script:PackageRoot -and $MyInvocation.MyCommand.Path) { $script:PackageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path }
$script:ExpectedReleaseHash = '__RELEASE_HASH__'
$script:AutomationEnabled = __AUTOMATION_ENABLED__
$script:SourceInputHash = '__SOURCE_INPUT_HASH__'
$script:ExpectedEntryHash = $EntryHash
$script:OwnerSid = $OwnerSid
$script:EntryLoaderTemplate = '__ENTRY_LOADER_TEMPLATE__'
$script:WorkflowBytes = '__WORKFLOW_BASE64__'
$script:Messages = __MESSAGES__
$script:LanguageIndex = 0
if ($Language -eq 'it') { $script:LanguageIndex = 1 }
if ($Language -eq 'en') { $script:LanguageIndex = 2 }

function Get-Message([string]$Key) {
    if (-not $script:Messages.ContainsKey($Key)) { throw 'unknown-message-key' }
    return [string]$script:Messages[$Key][$script:LanguageIndex]
}

# Direct console output avoids encoded-command CLIXML on redirected streams.
function Write-CTMessage([string]$Message) { [Console]::WriteLine($Message) }

function Get-Sha256([string]$Path) {
    $stream = [IO.File]::OpenRead($Path)
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace('-','').ToLowerInvariant() }
    finally { $stream.Dispose(); $algorithm.Dispose() }
}

function Get-Sha256Bytes([byte[]]$Bytes) {
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($algorithm.ComputeHash($Bytes))).Replace('-','').ToLowerInvariant() }
    finally { $algorithm.Dispose() }
}

function Read-Release {
    try {
        $bytes = [IO.File]::ReadAllBytes((Join-Path $script:PackageRoot 'release.xml'))
        if ((Get-Sha256Bytes $bytes) -ne $script:ExpectedReleaseHash) { throw 'integrity' }
        $settings = New-Object System.Xml.XmlReaderSettings
        $settings.ProhibitDtd = $true; $settings.XmlResolver = $null
        $stream = New-Object IO.MemoryStream(,$bytes)
        $reader = [Xml.XmlReader]::Create($stream,$settings)
        $doc = New-Object Xml.XmlDocument; $doc.XmlResolver = $null
        try { $doc.Load($reader) } finally { $reader.Close(); $stream.Dispose() }
        $release = $doc.release
        if ($release.schemaVersion -ne '1' -or $release.target.edition -ne 'Professional' -or $release.target.architecture -ne 'x64') { throw 'integrity' }
        return $release
    } catch { throw (Get-Message 'integrity') }
}

# The template is generated into the same pinned entry. Paths and identities are
# encoded data, never interpolated as PowerShell or CMD source text.
function Get-CTPinnedEntryLoader([string]$PackageDirectory,[string]$ExpectedEntryHash,[string]$Language,[string]$ResumePath,[string]$OwnerSid) {
    if ($ExpectedEntryHash -notmatch '^[a-f0-9]{64}$' -or @('zh-CN','it','en') -notcontains $Language -or
        $OwnerSid -notmatch '^S-1-5-21-\d+-\d+-\d+-\d+$') { throw (Get-Message 'integrity') }
    $loader = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($script:EntryLoaderTemplate))
    $values = @{
        PACKAGE = $PackageDirectory; HASH = $ExpectedEntryHash; LANGUAGE = $Language
        RESUME = $ResumePath; OWNER = $OwnerSid; ERROR = (Get-Message 'integrity')
        BOOTSTRAP = (Get-Message 'bootstrap'); PRESSENTER = (Get-Message 'pressEnter')
    }
    foreach ($name in @('PACKAGE','HASH','LANGUAGE','RESUME','OWNER','ERROR','BOOTSTRAP','PRESSENTER')) {
        $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes([string]$values[$name]))
        $loader = $loader.Replace(('__' + $name + '_B64__'),$encoded)
    }
    return $loader
}

function Assert-CTEntryHost {
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw (Get-Message 'platform') }
    $expected = [IO.Path]::GetFullPath((Join-Path ([Environment]::SystemDirectory) 'WindowsPowerShell\v1.0\powershell.exe'))
    $actual = [IO.Path]::GetFullPath([Diagnostics.Process]::GetCurrentProcess().MainModule.FileName)
    if ($actual -ine $expected) { throw (Get-Message 'signature') }
    Assert-MicrosoftSetup $actual
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    if ($sid -notmatch '^S-1-5-21-\d+-\d+-\d+-\d+$' -or ($script:OwnerSid -and $script:OwnerSid -ne $sid)) { throw (Get-Message 'workflow.identity') }
    return $actual
}

function Assert-CTEntryBytes {
    if ($script:ExpectedEntryHash -notmatch '^[a-f0-9]{64}$') { throw (Get-Message 'integrity') }
    $bytes = [IO.File]::ReadAllBytes((Join-Path $script:PackageRoot 'ChinaTech-Windows.ps1'))
    if ((Get-Sha256Bytes $bytes) -ne $script:ExpectedEntryHash) { throw (Get-Message 'integrity') }
}

function Import-CTWorkflow {
    if ($PSVersionTable.PSVersion -lt [Version]'5.1') { throw (Get-Message 'workflow.prerequisite') }
    # Keeping modern module syntax inside a Base64 string leaves PS2 inspection
    # parseable. No module operation runs while its functions are imported.
    $code = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($script:WorkflowBytes))
    . ([ScriptBlock]::Create($code))
}

function Get-Route([string]$Version, [int]$Build, [string]$Edition, [string]$Architecture) {
    if ($Architecture -ne 'x64') { return New-Object PSObject -Property @{ Allowed = $false; Reason = 'arch'; Route = ''; Steps = @() } }
    $isHomeEdition = @('Core','CoreSingleLanguage','CoreCountrySpecific','HomeBasic','HomePremium','Starter') -contains $Edition
    $pro = @('Professional','Ultimate') -contains $Edition
    if (-not $isHomeEdition -and -not $pro) { return New-Object PSObject -Property @{ Allowed = $false; Reason = 'edition'; Route = ''; Steps = @() } }
    $family = ''
    $steps = @()
    switch ($Version) {
        '6.1' {
            if ($Build -ne 7601) { return New-Object PSObject -Property @{ Allowed = $false; Reason = 'servicePack'; Route = ''; Steps = @() } }
            if (@('Starter','HomeBasic','HomePremium','Professional','Ultimate') -notcontains $Edition) { break }
            $family = 'windows7'; $steps += 'windows10'
        }
        '6.2' { if ($Build -ne 9200 -or @('Core','CoreSingleLanguage','CoreCountrySpecific','Professional') -notcontains $Edition) { break }; $family = 'windows8'; $steps += 'windows81'; $steps += 'windows10' }
        '6.3' { if ($Build -ne 9600 -or @('Core','CoreSingleLanguage','CoreCountrySpecific','Professional') -notcontains $Edition) { break }; $family = 'windows81'; $steps += 'windows10' }
        '10.0' { if ($Build -ge 10240 -and $Build -lt 22000) { $family = 'windows10' } elseif ($Build -ge 22000) { $family = 'windows11' } }
    }
    if ($family -eq '') { return New-Object PSObject -Property @{ Allowed = $false; Reason = 'unknown'; Route = ''; Steps = @() } }
    if (($family -eq 'windows10' -or $family -eq 'windows11') -and @('Starter','HomeBasic','HomePremium','Ultimate') -contains $Edition) {
        return New-Object PSObject -Property @{ Allowed = $false; Reason = 'edition'; Route = ''; Steps = @() }
    }
    $kind = 'pro'; if ($isHomeEdition) { $kind = 'home'; $steps += 'convert-pro' }
    $steps += 'activate-pro'; $steps += 'windows11-target'; $steps += 'verify-target'
    return New-Object PSObject -Property @{ Allowed = $true; Reason = ''; Route = ($family + '-' + $kind + '-x64'); Steps = $steps }
}

function Get-InstalledArchitecture([int]$ProcessSize, [string]$WowArchitecture, [int[]]$NativeCpuArchitectures) {
    if ($NativeCpuArchitectures.Count -eq 0) { return 'unknown' }
    foreach ($native in $NativeCpuArchitectures) {
        if ($native -eq 12) { return 'arm64' }
        if (@(0,9) -notcontains $native) { return 'unknown' }
    }
    if ($NativeCpuArchitectures -contains 9 -and ($ProcessSize -eq 8 -or $WowArchitecture -eq 'AMD64')) { return 'x64' }
    return 'x86'
}

function Get-SystemFacts {
    $os = Get-WmiObject Win32_OperatingSystem -ErrorAction Stop
    $system = Get-WmiObject Win32_ComputerSystem -ErrorAction Stop
    $processors = @(Get-WmiObject Win32_Processor -ErrorAction Stop)
    $versionKey = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' -ErrorAction Stop
    $languageKey = Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Nls\Language' -ErrorAction Stop
    $language = [Globalization.CultureInfo]::GetCultureInfo([Convert]::ToInt32([string]$languageKey.InstallLanguage,16)).Name
    $version = New-Object Version ([string]$os.Version)
    # Native CPU architecture takes precedence over an emulated AMD64 process.
    $architecture = Get-InstalledArchitecture ([IntPtr]::Size) $env:PROCESSOR_ARCHITEW6432 @($processors | ForEach-Object { [int]$_.Architecture })
    $disk = Get-WmiObject Win32_LogicalDisk -Filter ("DeviceID='" + [string]$os.SystemDrive + "'") -ErrorAction Stop
    $battery = @(Get-WmiObject Win32_Battery -ErrorAction Stop)
    $power = 'ac'
    if ($battery.Count -gt 0) {
        $power = 'unknown'
        # BatteryStatus 2 = AC; 6-9 = charging. Low/full alone does not prove AC.
        $allAc = $true
        foreach ($item in $battery) { if (@(2,6,7,8,9) -notcontains [int]$item.BatteryStatus) { $allAc = $false } }
        if ($allAc) { $power = 'ac' }
    } elseif ([int]$system.PCSystemType -eq 2) { $power = 'unknown' }
    $reboot = (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending') -or
        (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired')
    $session = Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager' -ErrorAction Stop
    if ($null -ne $session.PSObject.Properties['PendingFileRenameOperations'] -and $session.PendingFileRenameOperations) { $reboot = $true }
    $encryption = 'unknown'
    try {
        $volume = Get-WmiObject -Namespace 'root\CIMV2\Security\MicrosoftVolumeEncryption' -Class Win32_EncryptableVolume -Filter ("DriveLetter='" + [string]$os.SystemDrive + "'") -ErrorAction Stop
        if ($null -ne $volume -and [int]$volume.ProtectionStatus -eq 0 -and [int]$volume.ConversionStatus -eq 0) { $encryption = 'unencrypted' }
        elseif ($null -ne $volume) { $encryption = 'encrypted' }
    } catch { $encryption = 'unknown' }
    $hook = $false
    foreach ($name in @('SppExtComObj.exe','sppsvc.exe','osppsvc.exe')) {
        if (Test-Path ('HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\' + $name)) { $hook = $true }
    }
    foreach ($file in @('SppExtComObjHook.dll','SppExtComObjPatcher.dll')) {
        foreach ($dir in @('System32','SysWOW64')) { if (Test-Path (Join-Path (Join-Path $env:WINDIR $dir) $file)) { $hook = $true } }
    }
    return New-Object PSObject -Property @{
        Version = ($version.Major.ToString() + '.' + $version.Minor.ToString()); Build = [int]$os.BuildNumber
        Caption = [string]$os.Caption; Edition = [string]$versionKey.EditionID; Architecture = $architecture
        InstallLanguage = $language; FreeBytes = [long]$disk.FreeSpace; Power = $power; PendingReboot = $reboot
        Encryption = $encryption; ExistingHook = $hook
    }
}

function Get-PreflightIssues($Facts) {
    $issues = @()
    if (-not $Facts.InstallLanguage -or -not $Facts.Edition) { $issues += 'unknown' }
    if ($Facts.FreeBytes -lt 40GB) { $issues += 'space' }
    if ($Facts.Power -ne 'ac') { $issues += 'power' }
    if ($Facts.PendingReboot) { $issues += 'reboot' }
    if ($Facts.Encryption -ne 'unencrypted') { $issues += 'encryption' }
    if ($Facts.ExistingHook) { $issues += 'hook' }
    return $issues
}

function Test-RouteRelease($Release, [string]$Route, $Facts = $null) {
    # Build-time and runtime gates must both be open. The preview cannot be enabled
    # by editing an XML attribute or passing a command-line flag.
    if (-not $script:AutomationEnabled -or $Release.status -ne 'verified') { return $false }
    foreach ($entry in @($Release.verifiedRoutes.route)) {
        if ($null -ne $entry -and $entry.id -eq $Route -and $entry.windowsEvidence -match '^[a-f0-9]{64}$' -and
            $entry.codeSha256 -eq $script:SourceInputHash -and $entry.independentReview -match '^[a-f0-9]{64}$' -and
            $entry.sourceVersion -eq '10.0' -and $entry.sourceBuild -match '^\d+$' -and
            @('Core','CoreSingleLanguage','CoreCountrySpecific','Professional') -contains $entry.sourceEdition -and
            $entry.architecture -eq 'x64' -and $entry.language -match '^[a-z]{2,3}-[A-Za-z]{2,4}$' -and $entry.hardwarePolicy -eq 'setup-scan') {
            if ($null -eq $Facts) { return $true }
            return $Facts.Version -eq [string]$entry.sourceVersion -and $Facts.Build -eq [int]$entry.sourceBuild -and
                $Facts.Edition -eq [string]$entry.sourceEdition -and $Facts.Architecture -eq [string]$entry.architecture -and
                $Facts.InstallLanguage -eq [string]$entry.language
        }
    }
    return $false
}

function Assert-ExecutionGate($Release, $Route) {
    if (-not (Test-RouteRelease $Release $Route)) { throw (Get-Message 'blocked') }
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal $identity
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw (Get-Message 'admin') }
}

function Get-NormalizedExitCode([long]$Code) {
    if ($Code -lt 0) { $Code += 4294967296 }
    return ('{0:X8}' -f $Code)
}

function Test-RetentionScan([long]$ExitCode) { return (Get-NormalizedExitCode $ExitCode) -eq 'C1900210' }

function Receive-VerifiedFile([string]$Url, [string]$Hash, [string]$Destination) {
    if ($Hash -notmatch '^[a-f0-9]{64}$' -or $Url -notmatch '^https://') { throw (Get-Message 'integrity') }
    $client = New-Object Net.WebClient
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072
        $client.DownloadFile($Url, $Destination)
        if ((Get-Sha256 $Destination) -ne $Hash) { throw (Get-Message 'integrity') }
    } finally { $client.Dispose() }
}

function Assert-MicrosoftSetup([string]$Path) {
    $signature = Get-AuthenticodeSignature -LiteralPath $Path -ErrorAction Stop
    if ($signature.Status -ne 'Valid' -or $null -eq $signature.SignerCertificate -or
        $signature.SignerCertificate.Subject -notmatch '(^|,\s*)O=Microsoft Corporation(,|$)') { throw (Get-Message 'signature') }
}

function Invoke-Inspection {
    Write-CTMessage (Get-Message 'title')
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { Write-CTMessage (Get-Message 'platform'); return $null }
    [void](Assert-CTEntryHost)
    $release = Read-Release
    $facts = Get-SystemFacts
    Write-CTMessage ((Get-Message 'detected') -f $facts.Caption, $facts.Edition, $facts.Architecture, $facts.InstallLanguage)
    $route = Get-Route $facts.Version $facts.Build $facts.Edition $facts.Architecture
    if ($route.Allowed) {
        $displaySteps = @($route.Steps | ForEach-Object { Get-Message ('step-' + $_) })
        Write-CTMessage ((Get-Message 'route') -f ($displaySteps -join ' -> '))
    } else { Write-CTMessage (Get-Message $route.Reason) }
    $issues = @(Get-PreflightIssues $facts)
    foreach ($issue in $issues) { Write-CTMessage (Get-Message $issue) }
    # Inspection reports facts only. The separate entry branch checks both gates
    # before asking for UAC or importing any workflow operation.
    return New-Object PSObject -Property @{ Release=$release; Route=$route; Facts=$facts; Issues=$issues }
}

function Get-CTFailureMessage([string]$Code) {
    if ($Code -match '^workflow\.[A-Za-z][A-Za-z0-9]+$' -and $script:Messages.ContainsKey($Code)) { return Get-Message $Code }
    foreach ($key in @('integrity','platform','signature','blocked','admin')) {
        if ($Code -eq (Get-Message $key)) { return Get-Message $key }
    }
    # Do not display untrusted paths, exception payloads, or licensing details.
    return Get-Message 'workflow.failedUnknown'
}

if (-not $LibraryOnly) {
    $result = 1
    try {
        if ($ResumePath) {
            # No CLI flag can turn the compiled inspection release into execution.
            if (-not $script:AutomationEnabled) { throw (Get-Message 'blocked') }
            [void](Assert-CTEntryHost); Assert-CTEntryBytes
            $release = Read-Release
            if ($release.status -ne 'verified') { throw (Get-Message 'blocked') }
            . Import-CTWorkflow
            $outcome = Invoke-CTResume -WorkPath $ResumePath -Release $release -PackageRoot $script:PackageRoot -Language $Language
        } else {
            $inspection = Invoke-Inspection
            if ($null -eq $inspection) { $result = 2 }
            elseif (-not $inspection.Route.Allowed -or $inspection.Issues.Count -or
                -not (Test-RouteRelease $inspection.Release $inspection.Route.Route $inspection.Facts)) {
                Write-CTMessage (Get-Message 'blocked'); $result = 10
            } else {
                Assert-CTEntryBytes
                $hostPath = Assert-CTEntryHost
                $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
                $principal = New-Object Security.Principal.WindowsPrincipal $identity
                if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
                    # Before and after elevation the same compiled hash, real
                    # system PowerShell, package policy and owner are checked.
                    $loader = Get-CTPinnedEntryLoader $script:PackageRoot $script:ExpectedEntryHash $Language '' $identity.User.Value
                    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($loader))
                    $child = Start-Process -FilePath $hostPath -Verb RunAs -ArgumentList ('-NoLogo -NoProfile -ExecutionPolicy Bypass -EncodedCommand ' + $encoded) -Wait -PassThru
                    $result = $child.ExitCode
                } else {
                    . Import-CTWorkflow
                    Write-CTMessage (Get-Message 'backup'); Write-CTMessage (Get-Message 'kmsNotice')
                    # The workflow owns the single local confirmation and repeats
                    # facts, permissions and source checks before persistent writes.
                    $outcome = Invoke-CTWorkflow -Release $inspection.Release -Route $inspection.Route.Route -PackageRoot $script:PackageRoot -Language $Language -ExpectedEntryHash $script:ExpectedEntryHash -MediaPaths @{}
                }
            }
        }
        if ($outcome) {
            if ($outcome -eq 'completed') { Write-CTMessage (Get-Message 'completed'); $result=0 }
            elseif ($outcome -eq 'cancelled') { Write-CTMessage (Get-Message 'cancelled'); $result=0 }
            elseif ($outcome -eq 'awaiting-restart') { Write-CTMessage (Get-Message 'inProgress'); $result=0 }
            else { Write-CTMessage (Get-Message 'workflow.failedUnknown'); $result=1 }
        }
    } catch { Write-CTMessage (Get-CTFailureMessage $_.Exception.Message) }
    Write-CTMessage (Get-Message 'pressEnter')
    [void][Console]::ReadLine()
    exit $result
}
