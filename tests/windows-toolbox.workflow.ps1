param([switch]$NativeSafety)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$module=Join-Path $root 'scripts/windows-toolbox/workflow.ps1'
$tokens=$null; $errors=$null
[Management.Automation.Language.Parser]::ParseFile($module,[ref]$tokens,[ref]$errors) | Out-Null
if ($errors.Count) { throw ($errors.Message -join '; ') }
$validation=Join-Path $root '.local/windows-toolbox/workflow-fixtures'
[void][IO.Directory]::CreateDirectory($validation)
$runner=Join-Path $validation 'ChinaTech-Windows.ps1'
[IO.File]::WriteAllBytes($runner,[IO.File]::ReadAllBytes((Join-Path $root 'public/toolbox/windows/ChinaTech-Windows.ps1.txt')))
. $runner -LibraryOnly
. $module
$script:count=0
function Assert-Workflow($Condition,[string]$Label) {
    if (-not $Condition) { throw $Label }; $script:count++
}
function Assert-WorkflowError([scriptblock]$Action,[string]$Code,[string]$Label) {
    $caught=''
    try { & $Action | Out-Null } catch { $caught=$_.Exception.Message }
    Assert-Workflow ($caught -eq ('workflow.'+$Code)) ($Label+': '+$caught)
}
function Clone-Workflow($Object) { $Object | ConvertTo-Json -Depth 12 | ConvertFrom-Json }
$script:ExpectedReleaseHash='a'*64
$script:goodState=[pscustomobject]@{ Schema=1;RunId=('b'*32);Sequence=1;OwnerSid='S-1-5-21-1-2-3-1001';ReleaseHash=('a'*64);Status='ready';StageIndex=0 }
$key=[byte[]](1..32)
Assert-Workflow ((Get-CTStringSetHash @()) -match '^[a-f0-9]{64}$') 'empty Defender/Office collection is hashed'
Assert-Workflow ((Get-CTStringSetHash @('b','a')) -eq (Get-CTStringSetHash @('a','b'))) 'snapshot ignores enumeration order'
$envelope=Protect-CTStateEnvelope $goodState $key
Assert-Workflow ((Unprotect-CTStateEnvelope $envelope $key).RunId -eq $goodState.RunId) 'HMAC envelope round-trip'
$bad=($envelope | ConvertFrom-Json); $bad.data=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('{"Schema":1,"Status":"completed"}'))
Assert-WorkflowError { Unprotect-CTStateEnvelope ($bad | ConvertTo-Json) $key } 'stateTampered' 'payload tamper fails'
Assert-WorkflowError { Unprotect-CTStateEnvelope $envelope ([byte[]](2..33)) } 'stateTampered' 'wrong key fails'
Assert-WorkflowError { Unprotect-CTStateEnvelope '{broken}' $key } 'stateTampered' 'invalid JSON fails'
foreach ($value in @('SYSTEM','S-1-5-18','S-1-5-32-544','other-user')) {
    $copy=Clone-Workflow $goodState; $copy.OwnerSid=$value
    Assert-WorkflowError { Unprotect-CTStateEnvelope (Protect-CTStateEnvelope $copy $key) $key } 'stateTampered' 'non-user state identity fails'
}
$xml=[xml](Get-CTResumeTaskXml 'S-1-5-21-1-2-3-1001' 'C:\Windows\powershell.exe' '-EncodedCommand TEST')
Assert-Workflow ($xml.Task.Principals.Principal.UserId -eq 'S-1-5-21-1-2-3-1001') 'task binds exact owner SID'
Assert-Workflow ($xml.Task.Triggers.LogonTrigger.UserId -eq $xml.Task.Principals.Principal.UserId) 'trigger binds same owner SID'
Assert-Workflow ($xml.Task.Principals.Principal.LogonType -eq 'InteractiveToken') 'task is interactive token'
Assert-Workflow ($xml.Task.Principals.Principal.RunLevel -eq 'HighestAvailable') 'task uses highest available owner privilege'
Assert-Workflow (-not ($xml.OuterXml -match 'ServiceAccount|S-1-5-18')) 'no SYSTEM task'
Assert-WorkflowError { Get-CTResumeTaskXml 'S-1-5-18' 'C:\p.exe' 'exit' } 'identity' 'SYSTEM task rejected'
$missing=New-Object IO.FileNotFoundException('missing')
$wrapped=New-Object Reflection.TargetInvocationException('wrapper',$missing)
Assert-Workflow (Test-CTMissingTaskError $wrapped) 'wrapped missing task is safe idempotent cleanup'
Assert-Workflow (-not (Test-CTMissingTaskError (New-Object UnauthorizedAccessException('denied')))) 'access denied is not treated as removed task'

if ([Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT) {
    # CI can opt into only reversible, native ACL/DPAPI/task checks. There is no
    # adapter on Windows, and this branch never calls setup, changepk or KMS.
    Assert-WorkflowError { New-CTContext $null '' '' 'en' '' '' '' '' $null -FixtureMode -Adapter @{} } 'fixtureOnly' 'Windows cannot accept fixture adapter'
    if (-not $NativeSafety) { Write-Host "PowerShell workflow: $count pure assertions; native safety not requested."; exit 0 }
    Assert-CTWindowsRuntime
    $work=New-CTWorkDirectory
    try {
        $state=Clone-Workflow $goodState
        $state.RunId=[IO.Path]::GetFileName($work).Substring(4)
        $state.OwnerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
        Write-CTState $work $state
        Assert-Workflow ((Read-CTState $work).Sequence -eq 2) 'native DPAPI state persisted'
        Assert-CTProtectedAcl $work
        # Real Windows access check with the owner's Administrators group disabled
        # and all privileges removed. This checks the filtered-token boundary,
        # rather than just inspecting an ACL string.
        Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class CTFilteredToken {
 [StructLayout(LayoutKind.Sequential)] struct SidAttributes { public IntPtr Sid; public uint Attributes; }
 [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
 [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr h);
 [DllImport("advapi32.dll", SetLastError=true)] static extern bool OpenProcessToken(IntPtr p,uint a,out IntPtr token);
 [DllImport("advapi32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool ConvertStringSidToSid(string sid,out IntPtr p);
 [DllImport("advapi32.dll", SetLastError=true)] static extern bool CreateRestrictedToken(IntPtr token,uint flags,uint count,ref SidAttributes disabled,uint privileges,IntPtr privilegeList,uint restrictCount,IntPtr restrictList,out IntPtr restricted);
 [DllImport("advapi32.dll", SetLastError=true)] static extern bool ImpersonateLoggedOnUser(IntPtr token);
 [DllImport("advapi32.dll", SetLastError=true)] static extern bool RevertToSelf();
 [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateFile(string path,uint access,uint share,IntPtr security,uint disposition,uint flags,IntPtr template);
 public static bool Denied(string path,uint access,uint disposition) {
  IntPtr original=IntPtr.Zero, sid=IntPtr.Zero, restricted=IntPtr.Zero;
  bool impersonated=false;
  try {
   if(!OpenProcessToken(GetCurrentProcess(),0xA,out original))throw new Win32Exception(Marshal.GetLastWin32Error());
   if(!ConvertStringSidToSid("S-1-5-32-544",out sid))throw new Win32Exception(Marshal.GetLastWin32Error());
   var disabled=new SidAttributes{Sid=sid,Attributes=0};
   if(!CreateRestrictedToken(original,1,1,ref disabled,0,IntPtr.Zero,0,IntPtr.Zero,out restricted))throw new Win32Exception(Marshal.GetLastWin32Error());
   if(!ImpersonateLoggedOnUser(restricted))throw new Win32Exception(Marshal.GetLastWin32Error());
   impersonated=true;
   IntPtr file=CreateFile(path,access,7,IntPtr.Zero,disposition,0x80,IntPtr.Zero);
   int error=Marshal.GetLastWin32Error();
   if(file!=new IntPtr(-1)){CloseHandle(file);return false;}
   return error==5;
  } finally {
   if(impersonated&&!RevertToSelf())throw new Win32Exception(Marshal.GetLastWin32Error());
   if(restricted!=IntPtr.Zero)CloseHandle(restricted);
   if(sid!=IntPtr.Zero)LocalFree(sid);
   if(original!=IntPtr.Zero)CloseHandle(original);
  }
 }
}
'@
        $statePath=Join-Path $work 'state.json'
        Assert-Workflow ([CTFilteredToken]::Denied((Join-Path $work 'state-key.bin'),0x80000000,3)) 'filtered owner cannot read DPAPI key'
        Assert-Workflow ([CTFilteredToken]::Denied($statePath,0x40000000,3)) 'filtered owner cannot overwrite checkpoint'
        Assert-Workflow ([CTFilteredToken]::Denied((Join-Path $work 'injected.ps1'),0x40000000,1)) 'filtered owner cannot inject executable code'
        $nativeWindows=$env:WINDIR
        try {
            $env:WINDIR=Join-Path $work 'fake-windows'
            Assert-WorkflowError { Get-CTNativeExecutable 'cmd.exe' } 'systemPath' 'poisoned WINDIR cannot select executable'
        } finally { $env:WINDIR=$nativeWindows }
        $statePath=Join-Path $work 'state.json'
        $bytes=[IO.File]::ReadAllBytes($statePath); $bytes[8]=$bytes[8] -bxor 1; [IO.File]::WriteAllBytes($statePath,$bytes)
        Assert-WorkflowError { Read-CTState $work } 'stateTampered' 'native tamper stops'
        $sid=$state.OwnerSid
        $taskName='ChinaTechWindows-'+$state.RunId
        $service=New-Object -ComObject 'Schedule.Service'; $service.Connect(); $folder=$service.GetFolder('\')
        $taskXml=Get-CTResumeTaskXml $sid (Get-CTNativeExecutable 'WindowsPowerShell\v1.0\powershell.exe') '-NoProfile -Command exit'
        [void]$folder.RegisterTask($taskName,$taskXml,18,$sid,$null,3,'O:BAG:BAD:P(A;;FA;;;SY)(A;;FA;;;BA)')
        try {
            $task=$folder.GetTask($taskName)
            Assert-Workflow ($task.Definition.Principal.UserId -eq $sid -and $task.Definition.Principal.LogonType -eq 3) 'native task scope verified'
            $security=New-Object Security.AccessControl.RawSecurityDescriptor($task.GetSecurityDescriptor(7))
            Assert-Workflow ($security.Owner.Value -eq 'S-1-5-32-544') 'native task owner prevents filtered-user edits'
        } finally { $folder.DeleteTask($taskName,0) }
    } finally { if ($work) { Remove-Item -LiteralPath $work -Recurse -Force } }
    Write-Host "PowerShell workflow: $count checks; native ACL/DPAPI/interactive task only, zero OS changes."
    exit 0
}

$script:release=([xml]@'
<release status="verified"><target osVersion="10.0" build="26100" edition="Professional" architecture="x64"/>
<verifiedRoutes><route id="windows10-pro-x64"><stages>
<stage id="target" kind="upgrade" mediaId="win11-en-pro" expectedVersion="10.0" expectedBuild="26100" expectedEdition="Professional" scanSupported="true"/>
<stage id="activate" kind="activation" expectedVersion="10.0" expectedBuild="26100" expectedEdition="Professional"/>
<stage id="verify" kind="verify" expectedVersion="10.0" expectedBuild="26100" expectedEdition="Professional"/>
</stages></route></verifiedRoutes>
<media><image id="win11-en-pro" type="iso" language="en-US" edition="Professional" architecture="x64" version="10.0" build="26100" sha256="cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" url="https://software-download.microsoft.com/fixture.iso"/></media>
</release>
'@).release
$script:baseFacts=[pscustomobject]@{ Version='10.0';Build=19045;Edition='Professional';RealEdition='Professional';Architecture='x64';InstallLanguage='en-US';FreeBytes=80GB;Power='ac';PendingReboot=$false;Encryption='unencrypted';ExistingHook=$false;BootId='boot-1';OwnerSid='S-1-5-21-1-2-3-1001' }
$stages=@(Get-CTStagePlan $release 'windows10-pro-x64')
Assert-Workflow ($stages.Count -eq 3) 'complete stage plan parses'
foreach ($badRoute in @('unknown','windows10-home-x64')) { Assert-WorkflowError { Get-CTStagePlan $release $badRoute } 'routeUnverified' 'unverified route fails' }
# XML fixtures are copied as XML to preserve their element shape.
$badRelease=([xml]$release.OuterXml).release; $badRelease.verifiedRoutes.route.stages.stage[0].scanSupported='false'
Assert-WorkflowError { Get-CTStagePlan $badRelease 'windows10-pro-x64' } 'retentionUnverified' 'unproven scan policy fails'
$badRelease=([xml]$release.OuterXml).release; $badRelease.target.build='26200'
Assert-WorkflowError { Get-CTStagePlan $badRelease 'windows10-pro-x64' } 'stagePolicy' 'target and final verification must agree'
$stage=$stages[0]; $media=Get-CTMediaDefinition $release $stage $baseFacts
Assert-Workflow ($media.id -eq 'win11-en-pro') 'media matches installation language'
foreach ($field in @('InstallLanguage','Architecture')) {
    $facts=Clone-Workflow $baseFacts; $facts.$field='wrong'
    if ($field -eq 'InstallLanguage') { Assert-WorkflowError { Get-CTMediaDefinition $release $stage $facts } 'mediaMismatch' 'cross-language media fails' }
    else { Assert-Workflow (-not (Test-CTActualStage $facts $stage 'en-US')) 'actual architecture is checked' }
}
$badRelease=([xml]$release.OuterXml).release; $badRelease.media.image.url='https://download.example.com/fake.iso'
Assert-WorkflowError { Get-CTMediaDefinition $badRelease $stage $baseFacts } 'mediaSource' 'third-party media download fails'
$image=[pscustomobject]@{Version='10.0.26100.1';EditionId='Professional';Architecture=9;Languages=@('en-US')}
Assert-CTImageMetadata $image $media
foreach ($field in @('Version','EditionId','Architecture','Languages')) {
    $bad=Clone-Workflow $image
    switch ($field) { 'Version' {$bad.Version='10.0.22631.1'}; 'EditionId' {$bad.EditionId='Core'}; 'Architecture' {$bad.Architecture=12}; 'Languages' {$bad.Languages=@('en-US','it-IT')} }
    Assert-WorkflowError { Assert-CTImageMetadata $bad $media } 'mediaMismatch' ('actual image mismatch '+$field)
}
$scanArgs=Get-CTSetupArguments $stage ([pscustomobject]@{ImageIndex=6}) -Scan
$setupArgs=Get-CTSetupArguments $stage ([pscustomobject]@{ImageIndex=6})
Assert-Workflow ($scanArgs -match '/Auto Upgrade' -and $scanArgs -match '/Compat ScanOnly' -and $scanArgs -match '/ImageIndex 6') 'scan selects exact image and upgrade retention'
Assert-Workflow ($setupArgs -match '/Auto Upgrade' -and $setupArgs -match '/NoReboot' -and $setupArgs -notmatch 'ScanOnly|DataOnly|Clean|IgnoreWarning') 'installation cannot weaken scan choice'
$before=[pscustomobject]@{Clean=$true;DefenderHash='a';OfficeHash='b';TasksHash='c'}
foreach ($field in @('Clean','DefenderHash','OfficeHash','TasksHash')) {
    $after=Clone-Workflow $before; if ($field -eq 'Clean') {$after.Clean=$false} else {$after.$field='changed'}
    Assert-Workflow (-not (Test-CTActivationPreserved $before $after)) ('activation must preserve '+$field)
}
Assert-Workflow (Test-CTActivationPreserved $before (Clone-Workflow $before)) 'unchanged activation snapshot accepted'
Assert-WorkflowError { New-CTContext $release '' '' 'en' '' '' '' '' $null -Adapter @{} } 'fixtureOnly' 'nonfixture cannot accept adapter'
Assert-WorkflowError { New-CTContext $release '' '' 'en' '' '' '' '' $null -FixtureMode } 'fixtureOnly' 'fixture requires explicit adapter'

function Reset-WorkflowFixture {
    $script:events=@(); $script:current=Clone-Workflow $baseFacts; $script:saved=$null
    $script:scanCode=3247440400L; $script:setupCode=0L; $script:licensed=$true
    $script:confirmed=$true; $script:gateFails=$false; $script:failureAt=''; $script:factReads=0; $script:changeAfterConfirmation=$false
}
$script:adapter=@{
    Gate={param($c) $script:events+='gate'; if($script:gateFails){Throw-CT 'routeUnverified'}}
    Facts={param($c) $script:factReads++; if($script:changeAfterConfirmation -and $script:factReads -eq 2){$script:current.Edition='Core'}; Clone-Workflow $script:current}
    Confirm={param($c) $script:events+='confirm'; $script:confirmed}
    NewWork={param($c) $script:events+='work'; '/fixture/run-'+('b'*32)}
    CopyPackage={param($c) $script:events+='copy'; @{ 'ChinaTech-Windows.ps1'=('d'*64); 'release.xml'=('a'*64)}}
    WriteState={param($c) $c.State.Sequence++; $script:saved=Clone-Workflow $c.State; $script:events+=('checkpoint:'+ $c.State.Status); if($script:failureAt -eq ('checkpoint:'+ $c.State.Status)){Throw-CT 'injected'}}
    ReadState={param($c) Clone-Workflow $script:saved}
    RegisterTask={param($c) $script:events+='task-register'; if($script:failureAt -eq 'task-register'){Throw-CT 'injected'}}
    RemoveTask={param($c) $script:events+='task-remove'}
    Media={param($c,$stage,$facts) $script:events+='media'; if($script:failureAt -eq 'media'){Throw-CT 'injected'}; [pscustomobject]@{ImageIndex=6;SetupPath='fixture';SetupHash=('c'*64)}}
    Scan={param($c,$stage,$media) $script:events+='scan'; $script:scanCode}
    Setup={param($c,$stage,$media) $script:events+='setup'; if($script:failureAt -eq 'setup'){Throw-CT 'injected'}; $script:setupCode}
    Convert={param($c,$stage) $script:events+='convert'; if($script:failureAt -eq 'convert'){Throw-CT 'injected'}; 0L}
    Activate={param($c) $script:events+='activate'; if($script:failureAt -eq 'activate'){Throw-CT 'injected'}; 'preserved'}
    License={param($c) [pscustomobject]@{Known=$true;Activated=$script:licensed}}
    Reboot={param($c) $script:events+='reboot'; if($script:failureAt -eq 'reboot'){Throw-CT 'injected'}}
    Unmount={param($c) $script:events+='unmount'}
}
function Start-WorkflowFixture {
    Invoke-CTWorkflow -Release $script:release -Route 'windows10-pro-x64' -PackageRoot '/fixture' -Language 'en' -FixtureMode -Adapter $script:adapter
}
function Resume-WorkflowFixture {
    Invoke-CTResume -WorkPath '/fixture/run-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' -Release $script:release -Route 'windows10-pro-x64' -PackageRoot '/fixture' -Language 'en' -FixtureMode -Adapter $script:adapter
}
Reset-WorkflowFixture
Assert-Workflow ((Start-WorkflowFixture) -eq 'awaiting-restart') 'scan and launch yield awaiting restart, not completed'
Assert-Workflow ($saved.Status -eq 'awaiting-restart' -and $saved.ScanExitCode -eq 'C1900210') 'retention receipt persists before restart'
Assert-Workflow ($events.IndexOf('checkpoint:executing') -lt $events.IndexOf('setup')) 'checkpoint precedes installer mutation'
Assert-Workflow ($events.IndexOf('task-register') -lt $events.IndexOf('setup')) 'recovery task exists before setup'
Assert-Workflow (@($events | Where-Object {$_ -eq 'setup'}).Count -eq 1) 'installer launched once'
$script:events=@(); $script:current.Build=26100; $script:current.BootId='boot-2'
Assert-Workflow ((Resume-WorkflowFixture) -eq 'completed') 'actual target and activation verified after restart'
Assert-Workflow ($saved.Status -eq 'completed' -and $events -contains 'task-remove') 'completion removes recovery task'
Assert-Workflow ($events -notcontains 'setup') 'resume does not replay completed installation'

foreach ($code in @(0L,3010L,3247440388L,3247440384L,3247440392L,-1L)) {
    Reset-WorkflowFixture; $script:scanCode=$code
    Assert-WorkflowError { Start-WorkflowFixture } 'retention' ('bad scan '+$code)
    Assert-Workflow ($events -notcontains 'setup' -and $events -notcontains 'reboot' -and $saved.Status -eq 'failed' -and $events -contains 'task-remove') 'bad scan never launches setup and removes task'
}
foreach ($condition in @('Power','PendingReboot','Encryption','ExistingHook','FreeBytes','RealEdition')) {
    Reset-WorkflowFixture
    switch($condition){'Power'{$script:current.Power='battery'};'PendingReboot'{$script:current.PendingReboot=$true};'Encryption'{$script:current.Encryption='unknown'};'ExistingHook'{$script:current.ExistingHook=$true};'FreeBytes'{$script:current.FreeBytes=1};'RealEdition'{$script:current.RealEdition='Core'}}
    Assert-WorkflowError { Start-WorkflowFixture } 'preflight' ('bad preflight '+$condition)
    Assert-Workflow ($events -notcontains 'confirm' -and $events -notcontains 'work') 'preflight fails before confirmation and writes'
}
Reset-WorkflowFixture; $script:gateFails=$true
Assert-WorkflowError { Start-WorkflowFixture } 'routeUnverified' 'gate always first'
Assert-Workflow ($events -notcontains 'confirm' -and $events -notcontains 'work') 'closed gate never asks confirmation or writes'
Reset-WorkflowFixture; $script:confirmed=$false
Assert-Workflow ((Start-WorkflowFixture) -eq 'cancelled') 'local cancellation is honored'
Assert-Workflow ($events -notcontains 'work') 'cancellation creates no work directory'
Reset-WorkflowFixture; $script:changeAfterConfirmation=$true
Assert-WorkflowError { Start-WorkflowFixture } 'preflightChanged' 'confirmation cannot retain stale OS facts'
Assert-Workflow ($events -notcontains 'work') 'changed facts stop before write'
foreach ($failure in @('task-register','media','setup','reboot','checkpoint:executing')) {
    Reset-WorkflowFixture; $script:failureAt=$failure
    Assert-WorkflowError { Start-WorkflowFixture } 'injected' ('injected failure '+$failure)
    Assert-Workflow ($saved.Status -eq 'failed' -and $events -contains 'task-remove') 'failure is terminal and task removed'
}
foreach ($status in @('preparing','scanning','executing','awaiting-restart')) {
    Reset-WorkflowFixture; [void](Start-WorkflowFixture); $script:saved.Status=$status; $script:events=@()
    Assert-WorkflowError { Resume-WorkflowFixture } 'interruptedUnknown' ('same boot interrupted '+$status)
    Assert-Workflow ($events -notcontains 'setup' -and $events -notcontains 'activate' -and $events -notcontains 'convert') 'unknown state never replays mutation'
}
foreach ($mismatch in @('Build','Edition','InstallLanguage','OwnerSid')) {
    Reset-WorkflowFixture; [void](Start-WorkflowFixture); $script:current.Build=26100; $script:current.BootId='boot-2'
    switch($mismatch){'Build'{$script:current.Build=22631};'Edition'{$script:current.Edition='Core';$script:current.RealEdition='Core'};'InstallLanguage'{$script:current.InstallLanguage='it-IT'};'OwnerSid'{$script:current.OwnerSid='S-1-5-21-1-2-3-1002'}}
    $expected='interruptedUnknown'; if(@('InstallLanguage','OwnerSid') -contains $mismatch){$expected='identity'}
    $script:events=@(); Assert-WorkflowError { Resume-WorkflowFixture } $expected ('postboot mismatch '+$mismatch)
    Assert-Workflow ($events -notcontains 'activate' -and $events -notcontains 'setup' -and $events -contains 'task-remove') 'rollback/mismatch never installs or activates'
}
Reset-WorkflowFixture; [void](Start-WorkflowFixture); $script:current.Build=26100; $script:current.BootId='boot-2'; $script:licensed=$false
Assert-WorkflowError { Resume-WorkflowFixture } 'activationFailed' 'license status must prove activation'
Assert-Workflow ($saved.Status -eq 'failed' -and $events -contains 'task-remove') 'license failure is terminal'
Reset-WorkflowFixture; [void](Start-WorkflowFixture); $script:saved.StageIndex=1; $script:saved.Status='executing';$script:saved.StageKind='activation';$script:current.Build=26100;$script:current.BootId='boot-2';$script:events=@()
Assert-WorkflowError { Resume-WorkflowFixture } 'interruptedUnknown' 'unknown activation not replayed after boot'
Assert-Workflow ($events -notcontains 'activate') 'activation is not replayed'
foreach($terminal in @('failed','cancelled','completed')) {
    Reset-WorkflowFixture; [void](Start-WorkflowFixture);$script:saved.Status=$terminal;$script:events=@()
    Assert-Workflow ((Resume-WorkflowFixture) -eq $terminal) 'terminal resume preserves status'
    Assert-Workflow ($events -notcontains 'setup' -and $events -notcontains 'activate' -and $events -contains 'task-remove') 'terminal resume only removes recovery task'
}
# A second resume that never owns the mutex must not mutate the active run.
Reset-WorkflowFixture; [void](Start-WorkflowFixture); $script:events=@()
$originalEnterLock=${function:Enter-CTWorkflowLock}
try {
    function Enter-CTWorkflowLock($Context) { Throw-CT 'alreadyRunning' }
    Assert-WorkflowError { Resume-WorkflowFixture } 'alreadyRunning' 'second resume without mutex fails'
    Assert-Workflow ($events.Count -eq 0 -and $saved.Status -eq 'awaiting-restart') 'unowned run keeps checkpoint and recovery task intact'
} finally { Set-Item -Path Function:Enter-CTWorkflowLock -Value $originalEnterLock }
# A persisted read-only verification is resumable, but never skips final license checks.
Reset-WorkflowFixture; [void](Start-WorkflowFixture); $script:saved.Status='verifying';$script:current.Build=26100;$script:current.BootId='boot-2';$script:events=@()
Assert-Workflow ((Resume-WorkflowFixture) -eq 'completed') 'upgrade verifying checkpoint resumes after exact new boot'
Assert-Workflow ($events -notcontains 'setup') 'verifying upgrade is not installed twice'
Reset-WorkflowFixture; [void](Start-WorkflowFixture); $script:saved.StageIndex=2;$script:saved.StageKind='verify';$script:saved.Status='verifying';$script:current.Build=26100;$script:current.BootId='boot-2';$script:licensed=$false
Assert-WorkflowError { Resume-WorkflowFixture } 'finalVerification' 'persisted final verification still requires actual activation'
Reset-WorkflowFixture; [void](Start-WorkflowFixture); $script:saved.Status='verifying';$script:current.Build=26100
Assert-WorkflowError { Resume-WorkflowFixture } 'interruptedUnknown' 'same boot cannot prove an interrupted upgrade'

$proRelease=$script:release
$homeRelease=([xml]@'
<release status="verified"><target osVersion="10.0" build="26100" edition="Professional" architecture="x64"/>
<verifiedRoutes><route id="windows10-home-x64"><stages>
<stage id="convert" kind="conversion" conversionMode="native-ui" expectedVersion="10.0" expectedBuild="19045" expectedEdition="Professional"/>
<stage id="target" kind="upgrade" mediaId="win11-en-pro" expectedVersion="10.0" expectedBuild="26100" expectedEdition="Professional" scanSupported="true"/>
<stage id="activate" kind="activation" expectedVersion="10.0" expectedBuild="26100" expectedEdition="Professional"/>
<stage id="verify" kind="verify" expectedVersion="10.0" expectedBuild="26100" expectedEdition="Professional"/>
</stages></route></verifiedRoutes></release>
'@).release
Reset-WorkflowFixture; $script:release=$homeRelease; $script:current.Edition='Core';$script:current.RealEdition='Core'
$homeStart=Invoke-CTWorkflow -Release $homeRelease -Route 'windows10-home-x64' -PackageRoot '/fixture' -Language 'en' -FixtureMode -Adapter $adapter
Assert-Workflow ($homeStart -eq 'awaiting-restart' -and $events -contains 'convert' -and $events -notcontains 'setup') 'Home native conversion precedes installation'
$script:events=@();$script:current.BootId='boot-2'
Assert-WorkflowError { Invoke-CTResume -WorkPath '/fixture/run-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' -Release $homeRelease -PackageRoot '/fixture' -Language 'en' -FixtureMode -Adapter $adapter } 'interruptedUnknown' 'Home must really become Pro after restart'
Assert-Workflow ($events -notcontains 'setup' -and $events -notcontains 'activate') 'unconverted Home is never installed or activated'
Reset-WorkflowFixture; $script:current.Edition='Core';$script:current.RealEdition='Core'
[void](Invoke-CTWorkflow -Release $homeRelease -Route 'windows10-home-x64' -PackageRoot '/fixture' -Language 'en' -FixtureMode -Adapter $adapter)
$script:events=@();$script:current.BootId='boot-2';$script:current.Edition='Professional';$script:current.RealEdition='Professional'
$homeResume=Invoke-CTResume -WorkPath '/fixture/run-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' -Release $homeRelease -PackageRoot '/fixture' -Language 'en' -FixtureMode -Adapter $adapter
Assert-Workflow ($homeResume -eq 'awaiting-restart' -and $events -contains 'setup' -and $events -notcontains 'convert') 'confirmed Pro continues upgrade without repeating conversion'
$script:events=@();$script:current.BootId='boot-3';$script:current.Build=26100
Assert-Workflow ((Invoke-CTResume -WorkPath '/fixture/run-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' -Release $homeRelease -PackageRoot '/fixture' -Language 'en' -FixtureMode -Adapter $adapter) -eq 'completed') 'Home route requires both real edition and target verification'
$badHome=([xml]$homeRelease.OuterXml).release; $badHome.verifiedRoutes.route.stages.stage[0].conversionMode='registry-spoof'
Assert-WorkflowError { Get-CTStagePlan $badHome 'windows10-home-x64' } 'conversionUnverified' 'fake edition conversion is rejected'
$script:release=$proRelease
Write-Host "PowerShell workflow checks passed: $count assertions; parser, HMAC, exact media/stages, failure/restart fixtures only. Zero Windows installation/activation."
