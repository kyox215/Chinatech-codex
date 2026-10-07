# Dot-source after runner.ps1. No function in this module runs at import time.
# Production requires the independently verified release gate in runner.ps1.
# A fixture adapter is deliberately unavailable on Windows.

function Throw-CT([string]$Code) { throw ('workflow.' + $Code) }

function Get-CTHashBytes([byte[]]$Bytes) {
    $a = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($a.ComputeHash($Bytes))).Replace('-','').ToLowerInvariant() }
    finally { $a.Dispose() }
}

function Get-CTStringSetHash($Items) {
    $json=ConvertTo-Json -InputObject @($Items | ForEach-Object { [string]$_ } | Sort-Object) -Compress
    return Get-CTHashBytes ([Text.Encoding]::UTF8.GetBytes($json))
}

function Test-CTFixedEqual([byte[]]$A, [byte[]]$B) {
    if ($null -eq $A -or $null -eq $B -or $A.Length -ne $B.Length) { return $false }
    $difference = 0
    for ($i = 0; $i -lt $A.Length; $i++) { $difference = $difference -bor ($A[$i] -bxor $B[$i]) }
    return $difference -eq 0
}

function Protect-CTStateEnvelope($State, [byte[]]$Key) {
    if ($Key.Length -ne 32) { Throw-CT 'stateKey' }
    $bytes = [Text.Encoding]::UTF8.GetBytes(($State | ConvertTo-Json -Depth 12 -Compress))
    $mac = New-Object Security.Cryptography.HMACSHA256(,$Key)
    try { return @{ schema = 1; data = [Convert]::ToBase64String($bytes); mac = [Convert]::ToBase64String($mac.ComputeHash($bytes)) } | ConvertTo-Json -Compress }
    finally { $mac.Dispose() }
}

function Unprotect-CTStateEnvelope([string]$Envelope, [byte[]]$Key) {
    try {
        $outer = $Envelope | ConvertFrom-Json
        if ($outer.schema -ne 1 -or $Key.Length -ne 32) { Throw-CT 'stateTampered' }
        $bytes = [Convert]::FromBase64String([string]$outer.data)
        $mac = New-Object Security.Cryptography.HMACSHA256(,$Key)
        try { $expected = $mac.ComputeHash($bytes) } finally { $mac.Dispose() }
        if (-not (Test-CTFixedEqual $expected ([Convert]::FromBase64String([string]$outer.mac)))) { Throw-CT 'stateTampered' }
        $state = [Text.Encoding]::UTF8.GetString($bytes) | ConvertFrom-Json
        if ($state.Schema -ne 1 -or $state.RunId -notmatch '^[a-f0-9]{32}$' -or $state.Sequence -lt 1 -or
            $state.OwnerSid -notmatch '^S-1-5-21-\d+-\d+-\d+-\d+$' -or $state.ReleaseHash -notmatch '^[a-f0-9]{64}$' -or
            @('ready','preparing','scanning','executing','awaiting-restart','verifying','completed','failed','cancelled') -notcontains $state.Status) { Throw-CT 'stateTampered' }
        return $state
    } catch { Throw-CT 'stateTampered' }
}

function Assert-CTWindowsRuntime {
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { Throw-CT 'platform' }
    if ($PSVersionTable.PSVersion -lt [Version]'5.1' -or [IntPtr]::Size -ne 8) { Throw-CT 'prerequisite' }
    $knownWindows = [Environment]::GetFolderPath([Environment+SpecialFolder]::Windows)
    if (-not $knownWindows -or [IO.Path]::GetFullPath($env:WINDIR).TrimEnd('\') -ine [IO.Path]::GetFullPath($knownWindows).TrimEnd('\')) { Throw-CT 'systemPath' }
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal $identity
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) -or
        $identity.User.Value -notmatch '^S-1-5-21-\d+-\d+-\d+-\d+$' -or -not [Environment]::UserInteractive) { Throw-CT 'interactiveAdmin' }
}

function Get-CTNativeExecutable([string]$Name) {
    Assert-CTWindowsRuntime
    if (@('cmd.exe','dism.exe','changepk.exe','WindowsPowerShell\v1.0\powershell.exe') -notcontains $Name) { Throw-CT 'systemPath' }
    $path = Join-Path ([Environment]::SystemDirectory) $Name
    Assert-CTNoReparse $path
    Assert-MicrosoftSetup $path
    return $path
}

function Assert-CTNoReparse([string]$Path) {
    $full = [IO.Path]::GetFullPath($Path)
    $current = $full
    while ($current) {
        if (Test-Path -LiteralPath $current) {
            $item = Get-Item -LiteralPath $current -Force -ErrorAction Stop
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { Throw-CT 'reparse' }
        }
        $parent = [IO.Directory]::GetParent($current)
        if ($null -eq $parent) { break }; $current = $parent.FullName
    }
}

function Set-CTProtectedAcl([string]$Path, [switch]$Directory) {
    Assert-CTWindowsRuntime
    Assert-CTNoReparse $Path
    $acl = New-Object Security.AccessControl.FileSecurity
    if ($Directory) { $acl = New-Object Security.AccessControl.DirectorySecurity }
    $acl.SetAccessRuleProtection($true,$false)
    $acl.SetOwner((New-Object Security.Principal.SecurityIdentifier 'S-1-5-32-544'))
    foreach ($sid in @('S-1-5-18','S-1-5-32-544')) {
        $inherit = [Security.AccessControl.InheritanceFlags]::None
        if ($Directory) { $inherit = [Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit' }
        $rule = New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier $sid),[Security.AccessControl.FileSystemRights]::FullControl,$inherit,[Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow)
        [void]$acl.AddAccessRule($rule)
    }
    Set-Acl -LiteralPath $Path -AclObject $acl -ErrorAction Stop
    Assert-CTProtectedAcl $Path
}

function Assert-CTProtectedAcl([string]$Path) {
    Assert-CTNoReparse $Path
    $acl = Get-Acl -LiteralPath $Path -ErrorAction Stop
    if (-not $acl.AreAccessRulesProtected -or @('S-1-5-18','S-1-5-32-544') -notcontains $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value) { Throw-CT 'unsafeAcl' }
    $allow = @{}
    foreach ($rule in $acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])) {
        $sid = $rule.IdentityReference.Value
        if ($rule.AccessControlType -ne 'Allow' -or @('S-1-5-18','S-1-5-32-544') -notcontains $sid -or $rule.IsInherited) { Throw-CT 'unsafeAcl' }
        if (($rule.FileSystemRights -band [Security.AccessControl.FileSystemRights]::FullControl) -ne [Security.AccessControl.FileSystemRights]::FullControl) { Throw-CT 'unsafeAcl' }
        $allow[$sid] = $true
    }
    if (-not $allow.ContainsKey('S-1-5-18') -or -not $allow.ContainsKey('S-1-5-32-544')) { Throw-CT 'unsafeAcl' }
}

function Assert-CTWorkPath([string]$WorkPath) {
    Assert-CTWindowsRuntime
    $base = Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) 'ChinaTechWindows'
    $full = [IO.Path]::GetFullPath($WorkPath)
    if ([IO.Path]::GetDirectoryName($full) -ne $base -or [IO.Path]::GetFileName($full) -notmatch '^run-[a-f0-9]{32}$') { Throw-CT 'workPath' }
    Assert-CTProtectedAcl $base; Assert-CTProtectedAcl $full
    return $full
}

function New-CTWorkDirectory {
    Assert-CTWindowsRuntime
    $base = Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) 'ChinaTechWindows'
    Assert-CTNoReparse $base
    if (Test-Path -LiteralPath $base) { Assert-CTProtectedAcl $base }
    else {
        # Supply the DACL at creation; there is no ordinary-user writable window.
        $acl = New-Object Security.AccessControl.DirectorySecurity
        $acl.SetAccessRuleProtection($true,$false)
        $acl.SetOwner((New-Object Security.Principal.SecurityIdentifier 'S-1-5-32-544'))
        foreach ($sid in @('S-1-5-18','S-1-5-32-544')) {
            [void]$acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier $sid),'FullControl','ContainerInherit,ObjectInherit','None','Allow')))
        }
        [void][IO.Directory]::CreateDirectory($base,$acl)
        Assert-CTProtectedAcl $base
    }
    $path = Join-Path $base ('run-' + [Guid]::NewGuid().ToString('N'))
    $baseAcl = Get-Acl -LiteralPath $base
    [void][IO.Directory]::CreateDirectory($path,$baseAcl)
    Set-CTProtectedAcl $path -Directory
    $key = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($key) } finally { $rng.Dispose() }
    $protected = [Security.Cryptography.ProtectedData]::Protect($key,[Text.Encoding]::UTF8.GetBytes('ChinaTechWindows:state:v1'),[Security.Cryptography.DataProtectionScope]::LocalMachine)
    [IO.File]::WriteAllBytes((Join-Path $path 'state-key.bin'),$protected)
    Set-CTProtectedAcl (Join-Path $path 'state-key.bin')
    return $path
}

function Get-CTStateKey([string]$WorkPath) {
    [void](Assert-CTWorkPath $WorkPath)
    $path = Join-Path $WorkPath 'state-key.bin'; Assert-CTProtectedAcl $path
    try { return [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($path),[Text.Encoding]::UTF8.GetBytes('ChinaTechWindows:state:v1'),[Security.Cryptography.DataProtectionScope]::LocalMachine) }
    catch { Throw-CT 'stateKey' }
}

function Write-CTState([string]$WorkPath, $State) {
    [void](Assert-CTWorkPath $WorkPath)
    $State.Sequence = [long]$State.Sequence + 1
    $State.UpdatedUtc = [DateTime]::UtcNow.ToString('o')
    $bytes = [Text.Encoding]::UTF8.GetBytes((Protect-CTStateEnvelope $State (Get-CTStateKey $WorkPath)))
    $temporary = Join-Path $WorkPath ('state-' + [Guid]::NewGuid().ToString('N') + '.tmp')
    $stream = New-Object IO.FileStream($temporary,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try { $stream.Write($bytes,0,$bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
    Set-CTProtectedAcl $temporary
    $path = Join-Path $WorkPath 'state.json'
    if (Test-Path -LiteralPath $path) { Assert-CTProtectedAcl $path; [IO.File]::Replace($temporary,$path,$null) }
    else { [IO.File]::Move($temporary,$path) }
    Assert-CTProtectedAcl $path
}

function Read-CTState([string]$WorkPath) {
    [void](Assert-CTWorkPath $WorkPath)
    $path = Join-Path $WorkPath 'state.json'; Assert-CTProtectedAcl $path
    return Unprotect-CTStateEnvelope ([IO.File]::ReadAllText($path)) (Get-CTStateKey $WorkPath)
}

function Get-CTSystemFacts {
    Assert-CTWindowsRuntime
    $facts = Get-SystemFacts
    $os = Get-WmiObject Win32_OperatingSystem -ErrorAction Stop
    # DISM reads the installed servicing edition; registry EditionID alone is not proof.
    $dism = Get-CTNativeExecutable 'dism.exe'
    $output = @(& $dism /English /Online /Get-CurrentEdition 2>&1)
    if ($LASTEXITCODE -ne 0) { Throw-CT 'editionUnknown' }
    $matches = @($output | Select-String '^Current Edition\s*:\s*([A-Za-z0-9]+)\s*$')
    if ($matches.Count -ne 1) { Throw-CT 'editionUnknown' }
    $realEdition = $matches[0].Matches[0].Groups[1].Value
    if ($realEdition -ne $facts.Edition) { Throw-CT 'editionMismatch' }
    $facts | Add-Member NoteProperty BootId ([string]$os.LastBootUpTime) -Force
    $facts | Add-Member NoteProperty SystemDrive ([string]$os.SystemDrive) -Force
    $facts | Add-Member NoteProperty OwnerSid ([Security.Principal.WindowsIdentity]::GetCurrent().User.Value) -Force
    $facts | Add-Member NoteProperty OsSku ([int]$os.OperatingSystemSKU) -Force
    $facts | Add-Member NoteProperty RealEdition $realEdition -Force
    return $facts
}

function Get-CTPreflightIssues($Facts) {
    $issues = @(Get-PreflightIssues $Facts)
    if ($Facts.Architecture -ne 'x64' -or -not $Facts.BootId -or -not $Facts.OwnerSid) { $issues += 'unknown' }
    if ($Facts.RealEdition -ne $Facts.Edition) { $issues += 'editionMismatch' }
    return @($issues | Select-Object -Unique)
}

function Get-CTStagePlan($Release, [string]$Route) {
    $entry = @($Release.verifiedRoutes.route | Where-Object { $_.id -eq $Route })
    if ($entry.Count -ne 1) { Throw-CT 'routeUnverified' }
    $stages = @($entry[0].stages.stage)
    if ($stages.Count -eq 0) { Throw-CT 'routeUnverified' }
    $ids = @{}
    foreach ($stage in $stages) {
        if ($null -eq $stage -or $stage.id -notmatch '^[a-z0-9-]{1,48}$' -or $ids.ContainsKey([string]$stage.id) -or
            @('upgrade','conversion','activation','verify') -notcontains [string]$stage.kind -or
            $stage.expectedVersion -notmatch '^\d+\.\d+$' -or $stage.expectedBuild -notmatch '^\d+$' -or
            @('Core','CoreSingleLanguage','CoreCountrySpecific','Professional') -notcontains [string]$stage.expectedEdition) { Throw-CT 'stagePolicy' }
        if ($stage.kind -eq 'upgrade' -and ($stage.mediaId -notmatch '^[a-z0-9-]{1,64}$' -or $stage.scanSupported -ne 'true')) { Throw-CT 'retentionUnverified' }
        if ($stage.kind -eq 'conversion' -and ($stage.conversionMode -ne 'native-ui' -or $stage.expectedEdition -ne 'Professional')) { Throw-CT 'conversionUnverified' }
        $ids[[string]$stage.id] = $true
    }
    if ($stages[-1].kind -ne 'verify' -or $stages[-1].expectedEdition -ne 'Professional' -or
        $stages[-1].expectedBuild -ne [string]$Release.target.build -or $stages[-1].expectedVersion -ne [string]$Release.target.osVersion) { Throw-CT 'stagePolicy' }
    return $stages
}

function Test-CTActualStage($Facts, $Stage, [string]$Language) {
    return $Facts.Version -eq [string]$Stage.expectedVersion -and [int]$Facts.Build -eq [int]$Stage.expectedBuild -and
        $Facts.RealEdition -eq [string]$Stage.expectedEdition -and $Facts.Edition -eq [string]$Stage.expectedEdition -and
        $Facts.Architecture -eq 'x64' -and $Facts.InstallLanguage -eq $Language
}

function Get-CTMediaDefinition($Release, $Stage, $Facts) {
    $items = @($Release.media.image | Where-Object { $_.id -eq $Stage.mediaId })
    if ($items.Count -ne 1) { Throw-CT 'media' }; $media = $items[0]
    if ($media.language -ne $Facts.InstallLanguage -or $media.edition -ne $Stage.expectedEdition -or $media.architecture -ne 'x64' -or
        $media.build -ne $Stage.expectedBuild -or $media.version -ne $Stage.expectedVersion -or $media.sha256 -notmatch '^[a-f0-9]{64}$' -or
        @('iso','extracted') -notcontains [string]$media.type) { Throw-CT 'mediaMismatch' }
    if ($media.url -and $media.url -notmatch '^https://(software-download\.microsoft\.com|software\.download\.prss\.microsoft\.com)/[^\s]+$') { Throw-CT 'mediaSource' }
    if ($media.type -eq 'extracted' -and $media.receiptSha256 -notmatch '^[a-f0-9]{64}$') { Throw-CT 'mediaReceipt' }
    return $media
}

function Assert-CTImageMetadata($Image, $Media) {
    $version = [Version]([string]$Image.Version)
    $languages = @($Image.Languages | ForEach-Object { [string]$_ })
    if ([string]$Image.EditionId -ne [string]$Media.edition -or [int]$Image.Architecture -ne 9 -or
        ($version.Major.ToString() + '.' + $version.Minor.ToString()) -ne [string]$Media.version -or
        $version.Build -ne [int]$Media.build -or $languages.Count -ne 1 -or $languages[0] -ne [string]$Media.language) { Throw-CT 'mediaMismatch' }
}

function Assert-CTExtractedReceipt([string]$Directory, [string]$ReceiptHash) {
    Assert-CTNoReparse $Directory
    $receipt = Join-Path $Directory 'media-receipt.json'
    if ((Get-Sha256 $receipt) -ne $ReceiptHash) { Throw-CT 'mediaReceipt' }
    $data = [IO.File]::ReadAllText($receipt) | ConvertFrom-Json
    if ($data.schemaVersion -ne 1 -or @($data.files).Count -eq 0) { Throw-CT 'mediaReceipt' }
    $seen = @{}
    foreach ($file in @($data.files)) {
        $relative = [string]$file.path
        if (-not $relative -or $relative -match '(^[\\/]|[<>:"|?*]|(^|[\\/])\.\.?([\\/]|$))' -or $file.sha256 -notmatch '^[a-f0-9]{64}$' -or $seen.ContainsKey($relative.ToLowerInvariant())) { Throw-CT 'mediaReceipt' }
        $path = [IO.Path]::GetFullPath((Join-Path $Directory $relative))
        if (-not $path.StartsWith([IO.Path]::GetFullPath($Directory).TrimEnd('\') + '\',[StringComparison]::OrdinalIgnoreCase)) { Throw-CT 'mediaReceipt' }
        Assert-CTNoReparse $path
        if ((Get-Sha256 $path) -ne $file.sha256) { Throw-CT 'mediaReceipt' }
        $seen[$relative.ToLowerInvariant()] = $true
    }
    foreach ($actual in @(Get-ChildItem -LiteralPath $Directory -Recurse -Force)) {
        Assert-CTNoReparse $actual.FullName
        if (-not $actual.PSIsContainer -and $actual.FullName -ne $receipt) {
            $relative = $actual.FullName.Substring($Directory.TrimEnd('\').Length + 1).ToLowerInvariant()
            if (-not $seen.ContainsKey($relative)) { Throw-CT 'mediaReceipt' }
        }
    }
}

function Get-CTPreparedMedia($Context, $Stage, $Facts) {
    [void](Assert-CTWorkPath $Context.WorkPath)
    $media = Get-CTMediaDefinition $Context.Release $Stage $Facts
    $destination = Join-Path $Context.WorkPath ('media-' + $media.id)
    if (Test-Path -LiteralPath $destination) { Throw-CT 'mediaAlreadyPresent' }
    [void][IO.Directory]::CreateDirectory($destination); Set-CTProtectedAcl $destination -Directory
    $source = $null
    if ($Context.MediaPaths -and $Context.MediaPaths.ContainsKey([string]$media.id)) { $source = [string]$Context.MediaPaths[[string]$media.id] }
    if ($media.type -eq 'iso') {
        $iso = Join-Path $destination 'installation.iso'
        if ($source) { Assert-CTNoReparse $source; Copy-Item -LiteralPath $source -Destination $iso -ErrorAction Stop }
        elseif ($media.url) { Receive-VerifiedFile $media.url $media.sha256 $iso }
        else { Throw-CT 'media' }
        Set-CTProtectedAcl $iso
        if ((Get-Sha256 $iso) -ne $media.sha256) { Throw-CT 'integrity' }
        $disk = Mount-DiskImage -ImagePath $iso -Access ReadOnly -PassThru -ErrorAction Stop
        $Context.MountedIso = $iso
        $volumes = @($disk | Get-Volume -ErrorAction Stop | Where-Object { $_.DriveLetter })
        if ($volumes.Count -ne 1) { Throw-CT 'media' }
        $root = [string]$volumes[0].DriveLetter + ':\'
    } else {
        if (-not $source) { Throw-CT 'media' }
        Assert-CTExtractedReceipt $source $media.receiptSha256
        foreach ($item in @(Get-ChildItem -LiteralPath $source -Force)) { Copy-Item -LiteralPath $item.FullName -Destination $destination -Recurse -ErrorAction Stop }
        foreach ($item in @(Get-ChildItem -LiteralPath $destination -Recurse -Force)) { Set-CTProtectedAcl $item.FullName -Directory:$item.PSIsContainer }
        Assert-CTExtractedReceipt $destination $media.receiptSha256
        $root = $destination
    }
    $setup = Join-Path $root 'setup.exe'; Assert-MicrosoftSetup $setup
    $images = @(@(Join-Path $root 'sources\install.wim'; Join-Path $root 'sources\install.esd') | Where-Object { Test-Path -LiteralPath $_ })
    if (@($images).Count -ne 1) { Throw-CT 'media' }
    $details = @(Get-WindowsImage -ImagePath $images[0] -ErrorAction Stop)
    $matching = @($details | Where-Object { $_.ImageName -and $_.ImageIndex } | ForEach-Object { Get-WindowsImage -ImagePath $images[0] -Index $_.ImageIndex -ErrorAction Stop } | Where-Object { $_.EditionId -eq $media.edition })
    if ($matching.Count -ne 1) { Throw-CT 'mediaMismatch' }
    Assert-CTImageMetadata $matching[0] $media
    return New-Object PSObject -Property @{ SetupPath=$setup; SetupHash=(Get-Sha256 $setup); ImageIndex=[int]$matching[0].ImageIndex; MediaHash=[string]$media.sha256; Definition=$media }
}

function Get-CTSetupArguments($Stage, $Media, [switch]$Scan) {
    if ($Stage.kind -ne 'upgrade' -or $Stage.scanSupported -ne 'true' -or [int]$Stage.expectedBuild -lt 10240 -or $Media.ImageIndex -lt 1) { Throw-CT 'retentionUnverified' }
    $args = '/Auto Upgrade /DynamicUpdate Disable /Quiet /NoReboot /ImageIndex ' + [int]$Media.ImageIndex
    if ($Scan) { $args += ' /Compat ScanOnly' }
    if ([int]$Stage.expectedBuild -ge 22000) { $args += ' /Eula Accept' }
    return $args
}

function Invoke-CTSetup($Context, $Stage, $Media, [switch]$Scan) {
    Assert-ExecutionGate $Context.Release $Context.Route
    $facts = Get-CTSystemFacts
    if ($facts.Version -ne '10.0' -or $facts.Build -lt 10240) { Throw-CT 'retentionUnverified' }
    if ((Get-Sha256 $Media.SetupPath) -ne $Media.SetupHash) { Throw-CT 'integrity' }
    Assert-MicrosoftSetup $Media.SetupPath
    $process = Start-Process -FilePath $Media.SetupPath -ArgumentList (Get-CTSetupArguments $Stage $Media -Scan:$Scan) -Wait -PassThru -ErrorAction Stop
    return [long]$process.ExitCode
}

function Get-CTActivationSnapshot {
    Assert-CTWindowsRuntime
    $files = @()
    foreach ($dir in @('System32','SysWOW64')) {
        foreach ($name in @('SppExtComObjHook.dll','SppExtComObjHookAvrf.dll','SppExtComObjPatcher.dll','SppExtComObjPatcher.exe')) {
            if (Test-Path -LiteralPath (Join-Path (Join-Path $env:WINDIR $dir) $name)) { $files += $name }
        }
    }
    $ifeo = @()
    foreach ($view in @([Microsoft.Win32.RegistryView]::Registry64,[Microsoft.Win32.RegistryView]::Registry32)) {
        $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::LocalMachine,$view)
        try {
            foreach ($name in @('SppExtComObj.exe','sppsvc.exe','osppsvc.exe')) {
                $key = $base.OpenSubKey('SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\' + $name)
                if ($key) { $ifeo += $name; $key.Dispose() }
            }
        } finally { $base.Dispose() }
    }
    $service = New-Object -ComObject 'Schedule.Service'; $service.Connect()
    $taskData = @(); $conflictingTasks = @()
    function Read-CTTaskFolder($Folder) {
        foreach ($task in @($Folder.GetTasks(1))) {
            $script:CTCollectedTasks += ([string]$task.Path + ':' + (Get-CTHashBytes ([Text.Encoding]::UTF8.GetBytes([string]$task.Xml))))
            if ($task.Path -match '(?i)(KMS|AutoKMS|SvcTrigger)' -or $task.Xml -match '(?i)(SppExtComObjHook|KMS_VL_ALL|AutoKMS)') { $script:CTConflictTasks += [string]$task.Path }
        }
        foreach ($child in @($Folder.GetFolders(0))) { Read-CTTaskFolder $child }
    }
    $script:CTCollectedTasks = @(); $script:CTConflictTasks = @()
    try { Read-CTTaskFolder ($service.GetFolder('\')); $taskData=$script:CTCollectedTasks; $conflictingTasks=$script:CTConflictTasks }
    finally { Remove-Variable CTCollectedTasks,CTConflictTasks -Scope Script -ErrorAction SilentlyContinue }
    if (-not (Get-Command Get-MpPreference -ErrorAction SilentlyContinue)) { Throw-CT 'activationSafetyUnknown' }
    $defender = Get-MpPreference -ErrorAction Stop
    $exclusions = @()
    foreach ($name in @('ExclusionPath','ExclusionProcess','ExclusionExtension','ExclusionIpAddress')) {
        foreach ($value in @($defender.$name)) { if ($null -ne $value) { $exclusions += $name + ':' + [string]$value } }
    }
    $conflictingExclusions = @()
    foreach ($exclusion in @($defender.ExclusionPath)) {
        if (-not $exclusion) { continue }
        $pattern = [Environment]::ExpandEnvironmentVariables([string]$exclusion).TrimEnd('\')
        foreach ($dir in @('System32','SysWOW64')) {
            $hook = Join-Path (Join-Path $env:WINDIR $dir) 'SppExtComObjHook.dll'
            if ($hook -like $pattern -or $hook.StartsWith($pattern + '\',[StringComparison]::OrdinalIgnoreCase)) { $conflictingExclusions += [string]$exclusion }
        }
    }
    foreach ($exclusion in @($defender.ExclusionProcess)) { if ($exclusion -match '(?i)(KMS|sppsvc|osppsvc|SppExtComObj)') { $conflictingExclusions += [string]$exclusion } }
    $office = @(Get-WmiObject SoftwareLicensingProduct -Filter "ApplicationID != '55c92734-d682-4d71-983e-d6ec3f16059f'" -ErrorAction Stop | ForEach-Object { [string]$_.ID + ':' + [string]$_.LicenseStatus + ':' + [string]$_.LicenseFamily + ':' + [string]$_.PartialProductKey })
    if (Get-WmiObject -List -Class OfficeSoftwareProtectionProduct -ErrorAction Stop) {
        $office += @(Get-WmiObject OfficeSoftwareProtectionProduct -ErrorAction Stop | ForEach-Object { [string]$_.ID + ':' + [string]$_.LicenseStatus + ':' + [string]$_.PartialProductKey })
    }
    $officeRegistry = @(); $officeInstalled=$false; $officeKmsConfigured=$false
    foreach ($view in @([Microsoft.Win32.RegistryView]::Registry64,[Microsoft.Win32.RegistryView]::Registry32)) {
        $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::LocalMachine,$view)
        try {
            foreach ($path in @('SOFTWARE\Microsoft\Office\ClickToRun\Configuration','SOFTWARE\Microsoft\Office\14.0\Common\InstallRoot','SOFTWARE\Microsoft\Office\15.0\Common\InstallRoot','SOFTWARE\Microsoft\Office\16.0\Common\InstallRoot')) {
                $key=$base.OpenSubKey($path)
                if ($key) {
                    $officeInstalled=$true
                    try { foreach ($name in @('Path','InstallationPath','ProductReleaseIds','VersionToReport','Platform')) { $officeRegistry += [string]$view + ':' + $path + ':' + $name + ':' + [string]$key.GetValue($name) } }
                    finally { $key.Dispose() }
                }
            }
            foreach ($path in @('SOFTWARE\Microsoft\Windows NT\CurrentVersion\SoftwareProtectionPlatform\0ff1ce15-a989-479d-af46-f275c6370663','SOFTWARE\Microsoft\OfficeSoftwareProtectionPlatform')) {
                $key=$base.OpenSubKey($path)
                if ($key) {
                    try {
                        foreach ($name in @('KeyManagementServiceName','KeyManagementServicePort')) {
                            if ($key.GetValueNames() -contains $name) {
                                $officeKmsConfigured=$true
                                $officeRegistry += [string]$view + ':' + $path + ':' + $name + ':' + [string]$key.GetValue($name)
                            }
                        }
                    } finally { $key.Dispose() }
                }
            }
        } finally { $base.Dispose() }
    }
    # Existing Office whose licensing cannot be observed is a stop, not proof of
    # preservation. Store/vNext-only installations require separate evidence.
    if ($officeInstalled -and $office.Count -eq 0) { Throw-CT 'activationSafetyUnknown' }
    if (Get-Command Get-AppxPackage -ErrorAction SilentlyContinue) {
        if (@(Get-AppxPackage -AllUsers -Name Microsoft.Office.Desktop -ErrorAction Stop).Count) { Throw-CT 'activationSafetyUnknown' }
    }
    $office += $officeRegistry
    return New-Object PSObject -Property @{
        Clean=($files.Count -eq 0 -and $ifeo.Count -eq 0 -and $conflictingTasks.Count -eq 0 -and $conflictingExclusions.Count -eq 0)
        Hooks=@($files); Ifeo=@($ifeo); Renewal=@($conflictingTasks); ConflictingExclusions=@($conflictingExclusions)
        DefenderHash=(Get-CTStringSetHash $exclusions)
        OfficeHash=(Get-CTStringSetHash $office)
        HasOffice=($officeInstalled -or $officeKmsConfigured -or $office.Count -gt 0)
        TasksHash=(Get-CTStringSetHash $taskData)
    }
}

function Convert-CTWindowsOnlyKms([string]$Path) {
    # The original is fetched only from its pinned commit. Do not distribute it,
    # execute it directly, or trust a changed upstream file.
    if ((Get-Sha256 $Path) -ne '231a26b590dd53342f962fd6b46254772d74fce9b9c321df4f5fc6c2bf398b0b') { Throw-CT 'sourcePolicy' }
    $text=[IO.File]::ReadAllText($Path)
    foreach ($change in @(@('set ActOffice=1','set ActOffice=0',4),@('set AutoR2V=1','set AutoR2V=0',2),@('set vNextOverride=1','set vNextOverride=0',2))) {
        if ([regex]::Matches($text,[regex]::Escape($change[0])).Count -ne $change[2]) { Throw-CT 'sourcePolicy' }
        $text=$text.Replace($change[0],$change[1])
    }
    $pattern='(?m)^reg (?:add|delete) "HKLM\\%SPPk%\\%_oApp%"[^\r\n]*'
    if ([regex]::Matches($text,$pattern).Count -ne 14) { Throw-CT 'sourcePolicy' }
    $text=[regex]::Replace($text,$pattern,'rem ChinaTech: Office KMS configuration is not processed.')
    $cleanup='for %%# in (SppExtComObj.exe,sppsvc.exe,osppsvc.exe)'
    if ([regex]::Matches($text,[regex]::Escape($cleanup)).Count -ne 1) { Throw-CT 'sourcePolicy' }
    $text=$text.Replace($cleanup,'for %%# in (SppExtComObj.exe,sppsvc.exe)')
    $bytes=(New-Object Text.UTF8Encoding($false)).GetBytes($text)
    if ((Get-CTHashBytes $bytes) -ne '7d53dac13170e8d748d3127c506ebbed8c5f131a49149d05fb209dc1ea2d5a82') { Throw-CT 'sourcePolicy' }
    $derived=Join-Path (Split-Path -Parent $Path) 'KMS5.2-windows-only.cmd'
    if (Test-Path -LiteralPath $derived) { Throw-CT 'activationUnknown' }
    [IO.File]::WriteAllBytes($derived,$bytes); Set-CTProtectedAcl $derived
    return $derived
}

function Test-CTActivationPreserved($Before, $After) {
    return $Before.Clean -and $After.Clean -and $Before.DefenderHash -eq $After.DefenderHash -and $Before.OfficeHash -eq $After.OfficeHash -and $Before.TasksHash -eq $After.TasksHash
}

function Get-CTLicenseState {
    Assert-CTWindowsRuntime
    $rows=@(Get-WmiObject SoftwareLicensingProduct -Filter "ApplicationID='55c92734-d682-4d71-983e-d6ec3f16059f'" -ErrorAction Stop)
    $installed=@($rows | Where-Object { $_.PartialProductKey -and -not [bool]$_.LicenseIsAddon })
    $matching=@($installed | Where-Object { [string]$_.LicenseFamily -eq 'Professional' })
    if ($matching.Count -eq 0 -or @($matching | Where-Object { [int]$_.LicenseStatus -lt 0 -or [int]$_.LicenseStatus -gt 6 }).Count -or
        @($installed | Where-Object { [int]$_.LicenseStatus -eq 1 -and [string]$_.LicenseFamily -ne 'Professional' }).Count) {
        return New-Object PSObject -Property @{Known=$false;Activated=$false;GraceMinutes=0}
    }
    $licensed=@($matching | Where-Object { [int]$_.LicenseStatus -eq 1 })
    return New-Object PSObject -Property @{Known=$true;Activated=($licensed.Count -gt 0);GraceMinutes=($(if($licensed.Count){[long]$licensed[0].GracePeriodRemaining}else{0}))}
}

function Invoke-CTActivation($Context) {
    Assert-ExecutionGate $Context.Release $Context.Route
    $facts = Get-CTSystemFacts
    if ($facts.RealEdition -ne 'Professional') { Throw-CT 'edition' }
    $license=Get-CTLicenseState
    if (-not $license.Known) { Throw-CT 'licenseUnknown' }
    if ($license.Activated) { return 'preserved' }
    $before = Get-CTActivationSnapshot
    if (-not $before.Clean) { Throw-CT 'activationConflict' }
    # Windows-wide SPP changes can affect Office fallback renewal even after
    # removing explicit Office branches. Existing Office is therefore refused.
    if ($before.HasOffice) { Throw-CT 'officeActivationConflict' }
    if ($Context.State) { $Context.State.ActivationBefore=$before; Write-CTState $Context.WorkPath $Context.State }
    $source = @($Context.Release.sources.source | Where-Object { $_.id -eq 'kms' })
    if ($source.Count -ne 1 -or $source[0].repository -ne 'nminhducit/KMS_VL_ALL_AIO' -or
        $source[0].commit -ne 'bb8988973d82a9b39d54516dbb35b1c338dba5f5' -or $source[0].path -ne 'KMS5.2.cmd' -or
        $source[0].sha256 -ne '231a26b590dd53342f962fd6b46254772d74fce9b9c321df4f5fc6c2bf398b0b') { Throw-CT 'sourcePolicy' }
    $file = Join-Path $Context.WorkPath 'KMS5.2.cmd'
    if (Test-Path -LiteralPath $file) { Throw-CT 'activationUnknown' }
    Receive-VerifiedFile ('https://raw.githubusercontent.com/nminhducit/KMS_VL_ALL_AIO/' + $source[0].commit + '/KMS5.2.cmd') $source[0].sha256 $file
    Set-CTProtectedAcl $file
    if ((Get-Sha256 $file) -ne $source[0].sha256) { Throw-CT 'integrity' }
    $windowsOnly = Convert-CTWindowsOnlyKms $file
    # Take another snapshot immediately before mutation; never clean existing hooks.
    if (-not (Test-CTActivationPreserved $before (Get-CTActivationSnapshot))) { Throw-CT 'activationConflict' }
    $process = Start-Process -FilePath (Get-CTNativeExecutable 'cmd.exe') -ArgumentList ('/d /c ""' + $windowsOnly + '" /m /w"') -Wait -PassThru -ErrorAction Stop
    $after = Get-CTActivationSnapshot
    if ($Context.State) { $Context.State.ActivationAfter=$after; Write-CTState $Context.WorkPath $Context.State }
    if (-not (Test-CTActivationPreserved $before $after)) { Throw-CT 'activationChangedOfficeOrSafety' }
    $license=Get-CTLicenseState
    if ($process.ExitCode -ne 0 -or -not $license.Known -or -not $license.Activated) { Throw-CT 'activationFailed' }
    return 'activated'
}

function Invoke-CTEditionChange($Context, $Stage) {
    Assert-ExecutionGate $Context.Release $Context.Route
    $facts = Get-CTSystemFacts
    if ($facts.Version -ne '10.0' -or @('Core','CoreSingleLanguage','CoreCountrySpecific') -notcontains $facts.RealEdition -or $Stage.conversionMode -ne 'native-ui') { Throw-CT 'conversionUnverified' }
    # Home->Pro is a native, user-visible product-key flow. No registry spoofing,
    # embedded product key, DISM Set-Edition, or activation-as-conversion fallback.
    $path = Get-CTNativeExecutable 'changepk.exe'
    $process = Start-Process -FilePath $path -Wait -PassThru -ErrorAction Stop
    $after = Get-CTSystemFacts
    if ($process.ExitCode -ne 0 -or ($after.RealEdition -ne 'Professional' -and -not $after.PendingReboot)) { Throw-CT 'conversionCancelled' }
    return [long]$process.ExitCode
}

function Get-CTResumeTaskXml([string]$OwnerSid, [string]$PowerShellPath, [string]$Arguments, [string]$Description='ChinaTech Windows') {
    if ($OwnerSid -notmatch '^S-1-5-21-\d+-\d+-\d+-\d+$') { Throw-CT 'identity' }
    $escape = { param($s) [Security.SecurityElement]::Escape([string]$s) }
    $sid = & $escape $OwnerSid; $exe = & $escape $PowerShellPath; $args = & $escape $Arguments; $description = & $escape $Description
    return @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
<RegistrationInfo><Description>$description</Description></RegistrationInfo>
<Triggers><LogonTrigger><Enabled>true</Enabled><UserId>$sid</UserId><Delay>PT30S</Delay></LogonTrigger></Triggers>
<Principals><Principal id="Owner"><UserId>$sid</UserId><LogonType>InteractiveToken</LogonType><RunLevel>HighestAvailable</RunLevel></Principal></Principals>
<Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><DisallowStartIfOnBatteries>true</DisallowStartIfOnBatteries><StopIfGoingOnBatteries>false</StopIfGoingOnBatteries><StartWhenAvailable>true</StartWhenAvailable><Enabled>true</Enabled><ExecutionTimeLimit>PT0S</ExecutionTimeLimit><AllowStartOnDemand>true</AllowStartOnDemand></Settings>
<Actions Context="Owner"><Exec><Command>$exe</Command><Arguments>$args</Arguments></Exec></Actions>
</Task>
"@
}

function Copy-CTTrustedPackage($Context) {
    [void](Assert-CTWorkPath $Context.WorkPath)
    $files = @($Context.EntryFile,'release.xml')
    if ($Context.ModuleFile) { $files += $Context.ModuleFile }
    $hashes = @{}
    # Hash before and after copy. The package entry has already been verified by
    # the loader; the parent must re-verify that same pinned entry before UAC.
    foreach ($name in $files) {
        if ($name -notmatch '^[A-Za-z0-9.-]+$') { Throw-CT 'package' }
        $source = Join-Path $Context.PackageRoot $name; Assert-CTNoReparse $source
        $hash = Get-Sha256 $source
        if ($name -eq 'release.xml' -and $hash -ne $script:ExpectedReleaseHash) { Throw-CT 'integrity' }
        if ($name -eq $Context.EntryFile -and $Context.ExpectedEntryHash -ne $hash) { Throw-CT 'integrity' }
        if ($name -eq $Context.ModuleFile -and $Context.ExpectedModuleHash -ne $hash) { Throw-CT 'integrity' }
        $destination = Join-Path $Context.WorkPath $name
        Copy-Item -LiteralPath $source -Destination $destination -ErrorAction Stop
        Set-CTProtectedAcl $destination
        if ((Get-Sha256 $destination) -ne $hash -or (Get-Sha256 $source) -ne $hash) { Throw-CT 'integrity' }
        $hashes[$name] = $hash
    }
    return $hashes
}

function Register-CTResumeTask($Context) {
    [void](Assert-CTWorkPath $Context.WorkPath)
    $entryProperty = $Context.State.CodeFiles.PSObject.Properties[$Context.EntryFile]
    if ($null -eq $entryProperty -or $entryProperty.Value -notmatch '^[a-f0-9]{64}$') { Throw-CT 'package' }
    # The pinned loader reads, verifies and invokes the same immutable byte array.
    # HMAC/ACL and the remaining copied files are checked again inside resume.
    $code = Get-CTPinnedEntryLoader $Context.WorkPath ([string]$entryProperty.Value) $Context.State.DisplayLanguage $Context.WorkPath $Context.State.OwnerSid
    $args = '-NoLogo -NoProfile -ExecutionPolicy Bypass -EncodedCommand ' + [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($code))
    $xml = Get-CTResumeTaskXml $Context.State.OwnerSid (Get-CTNativeExecutable 'WindowsPowerShell\v1.0\powershell.exe') $args (Get-Message 'workflow.taskDescription')
    $service = New-Object -ComObject 'Schedule.Service'; $service.Connect()
    $folder = $service.GetFolder('\')
    # CREATE (2) + DONT_ADD_PRINCIPAL_ACE (16): never replace another task or
    # implicitly grant the account's unelevated token permission to edit it.
    # A filtered token of the same user must not be able to edit an elevated
    # resume action. Security owner and DACL are Administrators/SYSTEM only.
    $sddl='O:BAG:BAD:P(A;;FA;;;SY)(A;;FA;;;BA)'
    [void]$folder.RegisterTask($Context.State.TaskName,$xml,18,$Context.State.OwnerSid,$null,3,$sddl)
    $task = $folder.GetTask($Context.State.TaskName)
    if ([xml]$task.Xml -eq $null -or $task.Definition.Principal.UserId -ne $Context.State.OwnerSid -or
        $task.Definition.Principal.LogonType -ne 3 -or $task.Definition.Principal.RunLevel -ne 1) { Throw-CT 'task' }
    $security=New-Object Security.AccessControl.RawSecurityDescriptor($task.GetSecurityDescriptor(7))
    if ($security.Owner.Value -ne 'S-1-5-32-544') { Throw-CT 'task' }
    foreach ($ace in $security.DiscretionaryAcl) {
        if ($ace.AceQualifier -ne 'AccessAllowed' -or @('S-1-5-18','S-1-5-32-544') -notcontains $ace.SecurityIdentifier.Value) { Throw-CT 'task' }
    }
}

function Remove-CTResumeTask($Context) {
    if ($Context.State.TaskName -ne ('ChinaTechWindows-' + $Context.State.RunId)) { Throw-CT 'task' }
    $service = New-Object -ComObject 'Schedule.Service'; $service.Connect()
    $folder = $service.GetFolder('\')
    try { $task = $folder.GetTask($Context.State.TaskName) } catch {
        if (Test-CTMissingTaskError $_.Exception) { return }; throw
    }
    if ($task.Definition.Principal.UserId -ne $Context.State.OwnerSid -or $task.Definition.Principal.LogonType -ne 3) { Throw-CT 'task' }
    $folder.DeleteTask($Context.State.TaskName,0)
}

function Test-CTMissingTaskError($Exception) {
    $current=$Exception
    while ($current) {
        if (@(-2147024894,-2147024893) -contains [int]$current.HResult) { return $true }
        $current=$current.InnerException
    }
    return $false
}

function New-CTContext($Release,[string]$Route,[string]$PackageRoot,[string]$Language,[string]$EntryFile,[string]$ExpectedEntryHash,[string]$ModuleFile,[string]$ExpectedModuleHash,$MediaPaths,[switch]$FixtureMode,$Adapter) {
    if ($FixtureMode) {
        if ([Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT -or $null -eq $Adapter) { Throw-CT 'fixtureOnly' }
    } else {
        if ($null -ne $Adapter) { Throw-CT 'fixtureOnly' }
        Assert-CTWindowsRuntime
    }
    if (@('zh-CN','it','en') -notcontains $Language) { Throw-CT 'language' }
    return New-Object PSObject -Property @{ Release=$Release;Route=$Route;PackageRoot=$PackageRoot;Language=$Language;EntryFile=$EntryFile;ExpectedEntryHash=$ExpectedEntryHash;ModuleFile=$ModuleFile;ExpectedModuleHash=$ExpectedModuleHash;MediaPaths=$MediaPaths;Fixture=[bool]$FixtureMode;Adapter=$Adapter;WorkPath='';State=$null;MountedIso=$null;Mutex=$null;Locked=$false }
}

function Enter-CTWorkflowLock($Context) {
    if ($Context.Fixture) { $Context.Locked=$true; return }
    $Context.Mutex=New-Object Threading.Mutex($false,'Global\ChinaTechWindowsUpgrade')
    try { $Context.Locked=$Context.Mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $Context.Locked=$true }
    if (-not $Context.Locked) { Throw-CT 'alreadyRunning' }
}

function Exit-CTWorkflowLock($Context) {
    if ($Context.Mutex) { if ($Context.Locked) { $Context.Mutex.ReleaseMutex() }; $Context.Mutex.Dispose() }
}

function Invoke-CTOperation($Context,[string]$Name,$Arguments=@()) {
    if ($Context.Fixture) {
        if ([Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT -or -not $Context.Adapter.ContainsKey($Name)) { Throw-CT 'fixtureOnly' }
        return & $Context.Adapter[$Name] $Context @Arguments
    }
    switch ($Name) {
        'Gate' { Assert-ExecutionGate $Context.Release $Context.Route }
        'Facts' { Get-CTSystemFacts }
        'Confirm' { (Read-Host (Get-Message 'workflow.confirm')) -ceq 'UPGRADE' }
        'NewWork' { New-CTWorkDirectory }
        'CopyPackage' { Copy-CTTrustedPackage $Context }
        'WriteState' { Write-CTState $Context.WorkPath $Context.State }
        'ReadState' { Read-CTState $Context.WorkPath }
        'RegisterTask' { Register-CTResumeTask $Context }
        'RemoveTask' { Remove-CTResumeTask $Context }
        'Media' { Get-CTPreparedMedia $Context $Arguments[0] $Arguments[1] }
        'Scan' { Invoke-CTSetup $Context $Arguments[0] $Arguments[1] -Scan }
        'Setup' { Invoke-CTSetup $Context $Arguments[0] $Arguments[1] }
        'Convert' { Invoke-CTEditionChange $Context $Arguments[0] }
        'Activate' { Invoke-CTActivation $Context }
        'License' { Get-CTLicenseState }
        'Reboot' { Restart-Computer -Force -ErrorAction Stop }
        'Unmount' { if ($Context.MountedIso) { Dismount-DiskImage -ImagePath $Context.MountedIso -ErrorAction Stop; $Context.MountedIso=$null } }
        default { Throw-CT 'operation' }
    }
}

function Set-CTCheckpoint($Context,[string]$Status,[string]$Failure='') {
    $allowed = @{
        ready=@('preparing','executing','verifying','completed','failed','cancelled')
        preparing=@('scanning','failed'); scanning=@('executing','failed')
        executing=@('awaiting-restart','ready','verifying','failed')
        'awaiting-restart'=@('verifying','failed'); verifying=@('ready','completed','failed')
        completed=@(); failed=@(); cancelled=@()
    }
    if (-not $allowed.ContainsKey([string]$Context.State.Status) -or $allowed[[string]$Context.State.Status] -notcontains $Status) { Throw-CT 'stateTransition' }
    $Context.State.Status=$Status; $Context.State.Failure=$Failure
    Invoke-CTOperation $Context 'WriteState' | Out-Null
}

function Assert-CTResumeIdentity($Context,$Facts) {
    if ($Context.State.OwnerSid -ne $Facts.OwnerSid -or $Context.State.Language -ne $Facts.InstallLanguage -or $Context.State.Route -ne $Context.Route -or
        $Context.State.ReleaseHash -ne $script:ExpectedReleaseHash -or $Context.State.StageIndex -lt 0) { Throw-CT 'identity' }
    if (-not $Context.Fixture) {
        [void](Assert-CTWorkPath $Context.WorkPath)
        foreach ($property in $Context.State.CodeFiles.PSObject.Properties) {
            if ($property.Name -notmatch '^[A-Za-z0-9.-]+$' -or $property.Value -notmatch '^[a-f0-9]{64}$') { Throw-CT 'integrity' }
            $path = Join-Path $Context.WorkPath $property.Name; Assert-CTProtectedAcl $path
            if ((Get-Sha256 $path) -ne $property.Value) { Throw-CT 'integrity' }
        }
    }
}

function Invoke-CTStages($Context,$Stages,[switch]$Resume) {
    $facts = Invoke-CTOperation $Context 'Facts'
    Assert-CTResumeIdentity $Context $facts
    if ($Context.State.StageIndex -ge $Stages.Count) { Throw-CT 'stateTampered' }
    if ($Resume) {
        $stage = $Stages[$Context.State.StageIndex]
        if (@('completed','failed','cancelled') -contains $Context.State.Status) { Invoke-CTOperation $Context 'RemoveTask' | Out-Null; return $Context.State.Status }
        # Mutation may have started just before an interruption. Only a new boot
        # plus the exact expected OS can prove an upgrade/conversion outcome.
        if (@('executing','awaiting-restart') -contains $Context.State.Status) {
            if (@('upgrade','conversion') -notcontains $stage.kind -or $facts.BootId -eq $Context.State.StageBootId -or
                -not (Test-CTActualStage $facts $stage $Context.State.Language)) { Throw-CT 'interruptedUnknown' }
            Set-CTCheckpoint $Context 'verifying'
        } elseif (@('ready','verifying') -notcontains $Context.State.Status) { Throw-CT 'interruptedUnknown' }
        if ($Context.State.Status -eq 'verifying') {
            if (-not (Test-CTActualStage $facts $stage $Context.State.Language)) { Throw-CT 'actualTargetMismatch' }
            if ($stage.kind -eq 'verify') {
                # Re-enter the read-only final stage; it must query authorization
                # again, never infer success from a persisted "verifying" label.
                Set-CTCheckpoint $Context 'ready'
            } elseif (@('upgrade','conversion') -contains $stage.kind -and $facts.BootId -ne $Context.State.StageBootId) {
                $Context.State.StageIndex++; Set-CTCheckpoint $Context 'ready'
            } else { Throw-CT 'interruptedUnknown' }
        }
    }
    while ($Context.State.StageIndex -lt $Stages.Count) {
        Invoke-CTOperation $Context 'Gate' | Out-Null
        $facts = Invoke-CTOperation $Context 'Facts'; Assert-CTResumeIdentity $Context $facts
        if (@(Get-CTPreflightIssues $facts).Count) { Throw-CT 'preflight' }
        $stage = $Stages[$Context.State.StageIndex]
        $Context.State.StageId=[string]$stage.id; $Context.State.StageKind=[string]$stage.kind; $Context.State.StageBootId=[string]$facts.BootId
        switch ([string]$stage.kind) {
            'upgrade' {
                if ($facts.Version -ne '10.0' -or $facts.Build -lt 10240) { Throw-CT 'retentionUnverified' }
                if (Test-CTActualStage $facts $stage $Context.State.Language) {
                    Set-CTCheckpoint $Context 'verifying'
                    $Context.State.StageIndex++; Set-CTCheckpoint $Context 'ready'
                    continue
                }
                if ([int]$facts.Build -gt [int]$stage.expectedBuild) { Throw-CT 'downgrade' }
                Set-CTCheckpoint $Context 'preparing'
                $media = Invoke-CTOperation $Context 'Media' @($stage,$facts)
                Set-CTCheckpoint $Context 'scanning'
                $scan = Invoke-CTOperation $Context 'Scan' @($stage,$media)
                if (-not (Test-RetentionScan $scan)) { Throw-CT 'retention' }
                $Context.State.ScanExitCode=Get-NormalizedExitCode $scan
                Set-CTCheckpoint $Context 'executing'
                $exit = Invoke-CTOperation $Context 'Setup' @($stage,$media)
                $Context.State.SetupExitCode=Get-NormalizedExitCode $exit
                if (@('00000000','00000BC2') -notcontains $Context.State.SetupExitCode) { Throw-CT 'setupFailed' }
                Set-CTCheckpoint $Context 'awaiting-restart'
                Invoke-CTOperation $Context 'Unmount' | Out-Null
                Invoke-CTOperation $Context 'Reboot' | Out-Null
                return 'awaiting-restart'
            }
            'conversion' {
                Set-CTCheckpoint $Context 'executing'
                Invoke-CTOperation $Context 'Convert' @($stage) | Out-Null
                Set-CTCheckpoint $Context 'awaiting-restart'
                Invoke-CTOperation $Context 'Reboot' | Out-Null
                return 'awaiting-restart'
            }
            'activation' {
                if (-not (Test-CTActualStage $facts $stage $Context.State.Language)) { Throw-CT 'actualTargetMismatch' }
                Set-CTCheckpoint $Context 'executing'
                $Context.State.Activation=Invoke-CTOperation $Context 'Activate'
                $license=Invoke-CTOperation $Context 'License'
                $Context.State.LastLicense=$license
                if (-not $license.Known -or -not $license.Activated) { Throw-CT 'activationFailed' }
                $Context.State.StageIndex++; Set-CTCheckpoint $Context 'ready'
            }
            'verify' {
                Set-CTCheckpoint $Context 'verifying'
                $license=Invoke-CTOperation $Context 'License'
                $Context.State.LastLicense=$license
                if (-not (Test-CTActualStage $facts $stage $Context.State.Language) -or -not $license.Known -or -not $license.Activated) { Throw-CT 'finalVerification' }
                $Context.State.ActualTarget=New-Object PSObject -Property @{Version=$facts.Version;Build=$facts.Build;Edition=$facts.RealEdition;Architecture=$facts.Architecture;InstallLanguage=$facts.InstallLanguage;BootId=$facts.BootId}
                Set-CTCheckpoint $Context 'completed'
                Invoke-CTOperation $Context 'RemoveTask' | Out-Null
                return 'completed'
            }
        }
    }
    Throw-CT 'finalVerification'
}

function Stop-CTWorkflow($Context,[string]$Code) {
    if ($Context.State -and @('completed','failed','cancelled') -notcontains $Context.State.Status) {
        try { Set-CTCheckpoint $Context 'failed' $Code } catch { }
    }
    if (-not $Context.State -and $Context.WorkPath -and -not $Context.Fixture) {
        # A damaged state must not leave a runnable logon task. Derive only the
        # name from a validated protected directory, never from damaged JSON.
        try {
            [void](Assert-CTWorkPath $Context.WorkPath)
            $runId=[IO.Path]::GetFileName($Context.WorkPath).Substring(4)
            $Context.State=New-Object PSObject -Property @{RunId=$runId;TaskName=('ChinaTechWindows-'+$runId);OwnerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value}
        } catch { }
    }
    $cleanupFailed=$false
    if ($Context.State) { try { Invoke-CTOperation $Context 'RemoveTask' | Out-Null } catch { $cleanupFailed=$true } }
    try { Invoke-CTOperation $Context 'Unmount' | Out-Null } catch { }
    # Diagnostic/state/media are retained. Never remove Windows.old, repair Office,
    # reinstall a key, remove a foreign hook, or replay an unknown mutation.
    if ($cleanupFailed) { Throw-CT 'taskCleanup' }
}

function Invoke-CTWorkflow {
    param($Release,[string]$Route,[string]$PackageRoot,[string]$Language='zh-CN',[string]$EntryFile='ChinaTech-Windows.ps1',[string]$ExpectedEntryHash,[string]$ModuleFile='',[string]$ExpectedModuleHash='',$MediaPaths,[switch]$FixtureMode,$Adapter)
    $context = New-CTContext $Release $Route $PackageRoot $Language $EntryFile $ExpectedEntryHash $ModuleFile $ExpectedModuleHash $MediaPaths -FixtureMode:$FixtureMode -Adapter $Adapter
    try {
        Enter-CTWorkflowLock $context
        Invoke-CTOperation $context 'Gate' | Out-Null
        $stages = @(Get-CTStagePlan $Release $Route)
        $facts = Invoke-CTOperation $context 'Facts'
        if (-not $context.Fixture -and -not (Test-RouteRelease $Release $Route $facts)) { Throw-CT 'routeUnverified' }
        if (@(Get-CTPreflightIssues $facts).Count) { Throw-CT 'preflight' }
        $actualRoute = Get-Route $facts.Version $facts.Build $facts.Edition $facts.Architecture
        if (-not $actualRoute.Allowed -or $actualRoute.Route -ne $Route) { Throw-CT 'routeChanged' }
        if (-not (Invoke-CTOperation $context 'Confirm')) { return 'cancelled' }
        # Re-read after the local confirmation, before any persistent mutation.
        $fresh = Invoke-CTOperation $context 'Facts'
        if ($fresh.BootId -ne $facts.BootId -or $fresh.OwnerSid -ne $facts.OwnerSid -or $fresh.Edition -ne $facts.Edition -or $fresh.Build -ne $facts.Build -or @((Get-CTPreflightIssues $fresh)).Count) { Throw-CT 'preflightChanged' }
        $context.WorkPath=Invoke-CTOperation $context 'NewWork'
        $codeFiles=Invoke-CTOperation $context 'CopyPackage'
        $runId=[IO.Path]::GetFileName($context.WorkPath).Substring(4)
        $context.State=New-Object PSObject -Property @{ Schema=1; RunId=$runId; Sequence=0; Route=$Route; OwnerSid=$facts.OwnerSid; Language=$facts.InstallLanguage; DisplayLanguage=$Language; ReleaseHash=$script:ExpectedReleaseHash; CodeFiles=($codeFiles | ConvertTo-Json | ConvertFrom-Json); Status='ready'; Failure=''; StageIndex=0; StageId=''; StageKind=''; StageBootId=$facts.BootId; ScanExitCode=''; SetupExitCode=''; Activation='';ActivationBefore=$null;ActivationAfter=$null;LastLicense=$null;ActualTarget=$null; TaskName=('ChinaTechWindows-'+$runId); UpdatedUtc='' }
        Invoke-CTOperation $context 'WriteState' | Out-Null
        Invoke-CTOperation $context 'RegisterTask' | Out-Null
        return Invoke-CTStages $context $stages
    } catch { if ($context.Locked) { Stop-CTWorkflow $context $_.Exception.Message }; throw }
    finally { Exit-CTWorkflowLock $context }
}

function Invoke-CTResume {
    param([string]$WorkPath,$Release,[string]$Route,[string]$PackageRoot,[string]$Language='zh-CN',[string]$EntryFile='ChinaTech-Windows.ps1',[switch]$FixtureMode,$Adapter)
    $context=New-CTContext $Release $Route $PackageRoot $Language $EntryFile '' '' '' $null -FixtureMode:$FixtureMode -Adapter $Adapter
    $context.WorkPath=$WorkPath
    try {
        Enter-CTWorkflowLock $context
        $context.State=Invoke-CTOperation $context 'ReadState'
        if ($Route -and $Route -ne $context.State.Route) { Throw-CT 'routeChanged' }
        $context.Route=[string]$context.State.Route
        Invoke-CTOperation $context 'Gate' | Out-Null
        $stages=@(Get-CTStagePlan $Release $context.Route)
        return Invoke-CTStages $context $stages -Resume
    } catch { if ($context.Locked) { Stop-CTWorkflow $context $_.Exception.Message }; throw }
    finally { Exit-CTWorkflowLock $context }
}
