param([string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot))
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'windows-toolbox.stderr.ps1')
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'Native Windows required for CNG/DPAPI admission checks' }
$entry=Join-Path $ProjectRoot 'public/toolbox/windows-current/ChinaTech-Windows.ps1.txt'
$copyRoot=Join-Path ([IO.Path]::GetTempPath()) ('ChinaTech-admission-'+[Guid]::NewGuid().ToString('D'))
[void][IO.Directory]::CreateDirectory($copyRoot)
$copy=Join-Path $copyRoot 'ChinaTech-Windows.ps1'
# Preserve the package's exact UTF-8 BOM and bytes for Windows PowerShell 5.1.
[IO.File]::WriteAllBytes($copy,[IO.File]::ReadAllBytes($entry))
[IO.File]::Copy((Join-Path $ProjectRoot 'public/toolbox/windows-current/release.xml'),(Join-Path $copyRoot 'release.xml'))
. $copy -LibraryOnly
. Import-CTAdmission
Initialize-CTToolboxCrypto
$script:count=0
function Assert-Admission($Condition,[string]$Label) { if (-not $Condition) { throw $Label };$script:count++ }
function Assert-AdmissionError([scriptblock]$Action,[string]$Code,[string]$Label) {
    $caught='';try { & $Action | Out-Null } catch { $caught=$_.Exception.Message }
    Assert-Admission ($caught -eq $Code) ($Label+': '+$caught)
}
function Invoke-AdmissionStage([string]$Name,[scriptblock]$Action) {
    Write-Output ('DIAGNOSTIC phase='+$Name+' state=begin')
    try { & $Action;Write-Output ('DIAGNOSTIC phase='+$Name+' state=ok') }
    catch {
        # Exception types and numeric line numbers only. Never print exception
        # messages, private keys, plaintext records or customer/file paths.
        $index=0
        foreach ($record in @($Error | Select-Object -First 5)) {
            $kinds=New-Object Collections.Generic.List[string]
            for ($exception=$record.Exception;$null -ne $exception;$exception=$exception.InnerException) { $kinds.Add($exception.GetType().FullName) }
            Write-Output ('DIAGNOSTIC phase='+$Name+' error='+$index+' types='+($kinds -join ',')+' line='+$record.InvocationInfo.ScriptLineNumber)
            $index++
        }
        throw
    }
}
$script:testRoot=Join-Path $copyRoot 'private-device'
function Get-CTToolboxRoot { return $script:testRoot }
$script:serverPrivate=[ChinaTechToolboxCryptoV1]::CreatePrivate()
$script:serverPublic=[ChinaTechToolboxCryptoV1]::Public($script:serverPrivate)
function Get-CTTrustedWebsiteKey { return [pscustomobject]@{kid='office-v3-20261013';spki=[Convert]::ToBase64String($script:serverPublic)} }
function Sign-AdmissionFixture($Claims) {
    $payload=ConvertTo-CTBase64Url ([Text.Encoding]::UTF8.GetBytes(($Claims | ConvertTo-Json -Depth 8 -Compress)))
    return [pscustomobject]@{kid='office-v3-20261013';payload=$payload;signature=(ConvertTo-CTBase64Url ([ChinaTechToolboxCryptoV1]::Sign($script:serverPrivate,[Text.Encoding]::UTF8.GetBytes("CT-OFFICE-V3-UPDATE`n"+$payload))))}
}
$script:status=[pscustomobject]@{activeReleaseId=$script:CTToolboxReleaseId;ready=$true;enabled=$true}
$script:mutatePermit=$null;$script:mutateEnvelope=$null;$script:outcomeOffline=$false
$script:seen=New-Object Collections.ArrayList;$script:accepted=@{};$script:completed=@{}
$script:updateClaims=$null;$script:lastProof=$null
function Invoke-CTToolboxHttp([string]$Method,[string]$Operation,[string]$Body='') {
    if ($Method -eq 'GET') {
        if ($Operation -eq 'status') { return $script:status }
        if ($Operation -eq 'update') { return (Sign-AdmissionFixture $script:updateClaims) }
        throw 'unexpected fixture GET'
    }
    $wire=$Body | ConvertFrom-Json;$bytes=ConvertFrom-CTBase64Url $wire.payload
    $request=[Text.Encoding]::UTF8.GetString($bytes) | ConvertFrom-Json
    [void]$script:seen.Add([pscustomobject]@{Operation=$Operation;Body=$request})
    $public=ConvertFrom-CTBase64Url $request.publicKey
    $path='/api/toolbox/client/v1/windows-check/'+$Operation
    $canonical=@('CT-TOOLBOX-V1','POST',$path,$request.requestId,$request.installationId,[string]$request.timestamp,$request.nonce,(Get-Sha256Bytes $bytes),(Get-Sha256Bytes (New-Object byte[] 0))) -join "`n"
    Assert-Admission ([ChinaTechToolboxCryptoV1]::Verify($public,[Text.Encoding]::UTF8.GetBytes($canonical),(ConvertFrom-CTBase64Url $wire.signature))) 'actual CNG request uses canonical path/body and P1363 signature'
    Assert-Admission (@($request.PSObject.Properties.Name | Where-Object { @('requestId','installationId','appVersion','releaseId','timestamp','nonce','publicKey','jobId','action','scopeHash','checkpointHash') -notcontains $_ }).Count -eq 0) 'only protocol metadata leaves the PC'
    if ($Operation -eq 'jobs/outcome') {
        if ($script:outcomeOffline) { throw 'toolbox.unavailable' }
        $original=$script:accepted[$request.jobId]
        Assert-Admission ($null -ne $original -and $original.releaseId -ceq $request.releaseId -and $original.appVersion -ceq $request.appVersion -and $original.scopeHash -ceq $request.scopeHash -and $request.checkpointHash -cmatch '^[a-f0-9]{64}$') 'outcome retains original task/release scope and sends only a result hash'
        $script:completed[$request.jobId]=$request.checkpointHash;return [pscustomobject]@{completed=$true}
    }
    $script:lastProof=[ordered]@{publicKey=$request.publicKey;payload=$wire.payload;signature=$wire.signature;canonical=$canonical}
    $script:accepted[$request.jobId]=$request
    $now=[ChinaTechToolboxCryptoV1]::Now()
    $claims=[ordered]@{iss='https://www.chinatech.in';aud='toolbox-v1-task';toolId='windows-check';releaseId=$request.releaseId;installationId=$request.installationId;jobId=$request.jobId;action='detect';scopeHash=$request.scopeHash;keyHash=(Get-Sha256Bytes $public);issuedAt=$now;expiresAt=$now+2592000}
    if ($null -ne $script:mutatePermit) { & $script:mutatePermit $claims }
    $permit=Sign-AdmissionFixture $claims
    if ($null -ne $script:mutateEnvelope) { & $script:mutateEnvelope $permit }
    return [pscustomobject]@{permit=$permit}
}

Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Net;
public sealed class CTFixtureResponse : WebResponse {
    private byte[] bytes;public int StatusCode {get;set;}
    public override long ContentLength {get;set;}
    public CTFixtureResponse(byte[] body,int status,long length){bytes=body;StatusCode=status;ContentLength=length;}
    public override Stream GetResponseStream(){return new MemoryStream(bytes,false);}
    public override void Close(){}
}
public sealed class CTFixtureRequest : WebRequest {
    private WebResponse response;public bool AllowAutoRedirect {get;set;}public int ReadWriteTimeout {get;set;}
    public override int Timeout {get;set;}
    public CTFixtureRequest(WebResponse result){response=result;}
    public override WebResponse GetResponse(){return response;}
    public override void Abort(){}
}
'@
$script:downloadBytes=[Text.Encoding]::UTF8.GetBytes('synthetic archive bytes; not an executable')
$script:downloadStatus=200;$script:downloadLength=-1
function New-CTToolboxDownloadRequest([string]$Url) {
    Assert-Admission ($Url -ceq 'https://www.chinatech.in/toolbox/windows-current/ChinaTech-Windows-Check.zip') 'update transport gets only the fixed current ZIP URL'
    $response=New-Object CTFixtureResponse($script:downloadBytes,$script:downloadStatus,$script:downloadLength)
    return (New-Object CTFixtureRequest($response))
}
try {
    foreach ($n in @(1,2,3,4,32,64,91)) {
        $bytes=New-Object byte[] $n
        for ($i=0;$i -lt $n;$i++) { $bytes[$i]=[byte]($i%251) }
        Assert-Admission ([Convert]::ToBase64String((ConvertFrom-CTBase64Url (ConvertTo-CTBase64Url $bytes))) -ceq [Convert]::ToBase64String($bytes)) 'base64url roundtrips each padding boundary'
    }
    foreach ($bad in @('','a=','ab+','ab/','!!!!')) { Assert-AdmissionError { ConvertFrom-CTBase64Url $bad } 'toolbox.invalid' 'noncanonical base64url rejects' }
    Invoke-AdmissionStage 'dpapi-existing-cng-type-early-return' {
        # A fresh process preloads the CNG type name without loading DPAPI, then
        # executes the real initializer's early-return branch from the pinned package.
        $encodedPath=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($copy))
        $childCode='$ProgressPreference="SilentlyContinue";$ErrorActionPreference="Stop";try{$p=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String("'+$encodedPath+'"));. $p -LibraryOnly;. Import-CTAdmission;$stage="fixture-type";Add-Type -TypeDefinition "public static class ChinaTechToolboxCryptoV1 { public static int FixtureMarker(){return 1;} }" -WarningAction Stop;$stage="real-initialize";Initialize-CTToolboxCrypto;$stage="real-dpapi";if(-not ("System.Security.Cryptography.ProtectedData" -as [type])){exit 2};$b=[Text.Encoding]::UTF8.GetBytes("public fixture");$e=[Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);$d=[Security.Cryptography.ProtectedData]::Unprotect($e,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);if([Convert]::ToBase64String($b) -cne [Convert]::ToBase64String($d)){exit 3};exit 0}catch{[Console]::WriteLine("DIAGNOSTIC childType="+$_.Exception.GetType().FullName+" line="+$_.InvocationInfo.ScriptLineNumber+" stage="+$stage);exit 1}'
        $start=New-Object Diagnostics.ProcessStartInfo
        $start.FileName=Join-Path ([Environment]::SystemDirectory) 'WindowsPowerShell\v1.0\powershell.exe'
        $start.Arguments='-NoLogo -NoProfile -NonInteractive -OutputFormat Text -EncodedCommand '+[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($childCode))
        $start.UseShellExecute=$false;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
        $process=New-Object Diagnostics.Process;$process.StartInfo=$start
        try {
            [void]$process.Start();$stdout=$process.StandardOutput.ReadToEndAsync();$stderr=$process.StandardError.ReadToEndAsync()
            if (-not $process.WaitForExit(30000)) { $process.Kill();throw 'owned diagnostic child timed out' }
            $outText=$stdout.Result.Trim();$errText=$stderr.Result
            $typesOnly=$outText -match '^DIAGNOSTIC childType=[A-Za-z_][A-Za-z0-9_.+]* line=[0-9]+ stage=(fixture-type|real-initialize|real-dpapi)$'
            Write-Output ('DIAGNOSTIC childExitCode='+$process.ExitCode+' stdoutTypeOnly='+$typesOnly+' stderrLength='+$errText.Length+' stderrClixml='+$errText.TrimStart().StartsWith('#< CLIXML'))
            if ($typesOnly) { Write-Output $outText }
            $parsed=[CTDiagnosticStderr]::Inspect($errText)
            Write-Output ('DIAGNOSTIC stderrRoot='+$parsed.Root+' childRecords='+$parsed.Records+' streams='+($parsed.Streams -join ','))
            Assert-Admission ($process.ExitCode -eq 0 -and $parsed.Allowed) 'real initializer loads DPAPI; stderr contains only an empty CLIXML wrapper or explicit progress'
        } finally { $process.Dispose() }
    }
    Invoke-AdmissionStage 'directory-acl' { New-CTPrivateDirectory $script:testRoot;New-CTPrivateDirectory $script:testRoot }
    Invoke-AdmissionStage 'file-lease' {
        $probe=Join-Path $script:testRoot 'diagnostic.lock'
        $stream=New-Object IO.FileStream($probe,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
        $stream.Dispose();[IO.File]::Delete($probe)
    }
    Invoke-AdmissionStage 'cng-generate-export-sign' {
        $secret=[ChinaTechToolboxCryptoV1]::CreatePrivate()
        try {
            $public=[ChinaTechToolboxCryptoV1]::Public($secret);$message=[Text.Encoding]::UTF8.GetBytes('public synthetic CNG fixture')
            $signature=[ChinaTechToolboxCryptoV1]::Sign($secret,$message)
            Assert-Admission ([ChinaTechToolboxCryptoV1]::Verify($public,$message,$signature)) 'independent CNG lifecycle works before protected device storage'
        } finally { [Array]::Clear($secret,0,$secret.Length) }
    }
    Invoke-AdmissionStage 'dpapi-protect-read' {
        Write-Output ('DIAGNOSTIC protectedDataTypePresent='+[bool]('System.Security.Cryptography.ProtectedData' -as [type]))
        $bytes=[Text.Encoding]::UTF8.GetBytes('public synthetic DPAPI fixture')
        $encrypted=[Security.Cryptography.ProtectedData]::Protect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
        $decoded=[Security.Cryptography.ProtectedData]::Unprotect($encrypted,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
        Assert-Admission ((Get-Sha256Bytes $decoded) -ceq (Get-Sha256Bytes $bytes)) 'independent DPAPI roundtrip works before device storage'
    }
    Invoke-AdmissionStage 'device-record-write-read' { $script:device=Get-CTToolboxDevice;$script:again=Get-CTToolboxDevice }
    Assert-Admission ($device.InstallationId -ceq $again.InstallationId -and (Get-Sha256Bytes $device.Public) -ceq (Get-Sha256Bytes $again.Public) -and $device.Public.Length -eq 91) 'random instance and P256 identity persist across launches'
    $protected=[IO.File]::ReadAllBytes((Join-Path $script:testRoot 'device.dat'))
    Assert-Admission (-not [Text.Encoding]::UTF8.GetString($protected).Contains($device.InstallationId)) 'device identity and private key are not plaintext on disk'
    $decrypted=[Security.Cryptography.ProtectedData]::Unprotect($protected,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    Assert-Admission ([Text.Encoding]::UTF8.GetString($decrypted).Contains($device.InstallationId)) 'actual CurrentUser DPAPI protects the device record'
    $acl=[IO.Directory]::GetAccessControl($script:testRoot)
    Assert-Admission ($acl.AreAccessRulesProtected -and $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -eq [Security.Principal.WindowsIdentity]::GetCurrent().User.Value) 'device directory has protected current-user ACL and ownership'
    $lease=New-Object IO.FileStream((Join-Path $script:testRoot 'device.lock'),[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
    try { Assert-AdmissionError { Get-CTToolboxDevice } 'toolbox.storage' 'competing process lease cannot replace the device identity' } finally { $lease.Dispose() }
    foreach ($id in @('windows-check-previous','Windows-check-20261015.3','windows-check-20261015.3 ')) {
        $script:status.activeReleaseId=$id;Assert-AdmissionError { Request-CTDetectPermit } 'toolbox.updateRequired' 'only the exact current release can ask for inspection'
    }
    $script:status.activeReleaseId=$script:CTToolboxReleaseId
    foreach ($value in @($false,'true',1)) {
        $script:status.enabled=$value;Assert-AdmissionError { Request-CTDetectPermit } 'toolbox.paused' 'pause and nonboolean controls deny before inspection'
    }
    $script:status.enabled=$true
    $context=Request-CTDetectPermit
    Assert-Admission ($context.JobId -cmatch '^[a-f0-9-]{36}$' -and $script:seen.Count -eq 1) 'new inspection obtains one task-bound verified permit'
    $interop=Join-Path $copyRoot 'public-proof-fixture.json';[IO.File]::WriteAllText($interop,($script:lastProof | ConvertTo-Json -Compress),(New-Object Text.UTF8Encoding($false)))
    $verifier=Join-Path $copyRoot 'proof-verifier.cjs'
    [IO.File]::WriteAllText($verifier,'const fs=require("fs"),c=require("crypto"),p=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));if(!c.verify("sha256",Buffer.from(p.canonical),{key:c.createPublicKey({key:Buffer.from(p.publicKey,"base64url"),format:"der",type:"spki"}),dsaEncoding:"ieee-p1363"},Buffer.from(p.signature,"base64url")))process.exit(1)',(New-Object Text.UTF8Encoding($false)))
    & node $verifier $interop
    Assert-Admission ($LASTEXITCODE -eq 0) 'independent Node verifier accepts the actual Framework CNG P1363/SPKI proof'
    foreach ($field in @('iss','aud','toolId','releaseId','installationId','jobId','action','scopeHash','keyHash')) {
        $script:mutatePermit={param($claims)$claims[$field]='wrong'}
        Assert-AdmissionError { Request-CTDetectPermit } 'toolbox.invalid' ('signed wrong '+$field+' cannot authorize inspection')
    }
    $script:mutatePermit={param($claims)$claims['expiresAt']=[ChinaTechToolboxCryptoV1]::Now()-1};Assert-AdmissionError { Request-CTDetectPermit } 'toolbox.invalid' 'expired task permit rejects'
    $script:mutatePermit={param($claims)$claims['expiresAt']=$claims.issuedAt+2592001};Assert-AdmissionError { Request-CTDetectPermit } 'toolbox.invalid' 'permit cannot extend beyond thirty days'
    $script:mutatePermit=$null
    $script:mutateEnvelope={param($permit)$permit.kid='unknown'};Assert-AdmissionError { Request-CTDetectPermit } 'toolbox.invalid' 'website-supplied unknown key never establishes trust'
    $script:mutateEnvelope={param($permit)$signature=ConvertFrom-CTBase64Url $permit.signature;$signature[0]=$signature[0] -bxor 1;$permit.signature=ConvertTo-CTBase64Url $signature};Assert-AdmissionError { Request-CTDetectPermit } 'toolbox.invalid' 'wrong permit signature rejects'
    $script:mutateEnvelope=$null
    $script:outcomeOffline=$true;Complete-CTDetection $context ([pscustomobject]@{Caption='Synthetic Windows';PrivateSentinel='NEVER_UPLOAD_RAW_FACTS'})
    $pending=Join-Path $script:testRoot ('outcome-'+$context.JobId+'.dat')
    Assert-Admission ([IO.File]::Exists($pending)) 'offline outcome retains a durable encrypted retry record without changing local completion'
    $plain=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($pending),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    Assert-Admission (-not [Text.Encoding]::UTF8.GetString($plain).Contains('NEVER_UPLOAD_RAW_FACTS')) 'even decrypted pending outcomes contain no original detection facts'
    $script:CTToolboxReleaseId='windows-check-20261015.4';$script:CTToolboxVersion='2026.10.15-preview.4'
    $script:outcomeOffline=$false;Sync-CTPendingOutcomes
    Assert-Admission (-not [IO.File]::Exists($pending) -and $script:completed.ContainsKey($context.JobId)) 'new client reports an old completed job with its original release binding'
    $script:status.activeReleaseId=$script:CTToolboxReleaseId
    $next=Request-CTDetectPermit
    Assert-Admission ($next.JobId -cne $context.JobId) 'a later inspection always requests a fresh job rather than reusing the completed permit'

    $now=[ChinaTechToolboxCryptoV1]::Now()
    $script:updateClaims=[ordered]@{iss='https://www.chinatech.in';aud='toolbox-v1-update';toolId='windows-check';activeReleaseId='windows-check-20261015.5';releaseId='windows-check-20261015.5';issuedAt=$now;expiresAt=$now+300;
        files=@([ordered]@{architecture='any';href='https://www.chinatech.in/toolbox/windows-current/ChinaTech-Windows-Check.zip';bytes=$script:downloadBytes.Length;sha256=(Get-Sha256Bytes $script:downloadBytes)})}
    $file=Get-CTVerifiedToolboxUpdate
    foreach ($bad in @('http://www.chinatech.in/toolbox/windows-current/ChinaTech-Windows-Check.zip','https://example.test/current.zip','https://www.chinatech.in/toolbox/windows/ChinaTech-Windows-Check.zip',($file.href+'?other=1'))) {
        Assert-Admission ($bad -cne 'https://www.chinatech.in/toolbox/windows-current/ChinaTech-Windows-Check.zip') 'each negative update URI fixture differs from the sole allowed URI'
        $original=$script:updateClaims.files[0].href;$script:updateClaims.files[0].href=$bad
        Assert-AdmissionError { Get-CTVerifiedToolboxUpdate } 'toolbox.invalid' 'even signed updates cannot choose an old or arbitrary URL'
        $script:updateClaims.files[0].href=$original
    }
    $sentinel=Join-Path $script:testRoot 'personal-sentinel.txt';[IO.File]::WriteAllText($sentinel,'KEEP_UNRELATED')
    $saved=Receive-CTToolboxUpdate $file
    Assert-Admission ([IO.File]::Exists($saved) -and (Get-Sha256 $saved) -ceq $file.sha256) 'download publishes only the exact signed byte count and SHA to a new private directory'
    $script:downloadStatus=302;Assert-AdmissionError { Receive-CTToolboxUpdate $file } 'toolbox.invalid' 'redirect response is never followed or published';$script:downloadStatus=200
    $correct=$script:downloadBytes
    $script:downloadBytes=$correct[0..($correct.Length-2)];Assert-AdmissionError { Receive-CTToolboxUpdate $file } 'toolbox.invalid' 'short update cannot be published'
    $script:downloadBytes=$correct+@([byte]0);Assert-AdmissionError { Receive-CTToolboxUpdate $file } 'toolbox.invalid' 'overlong update cannot be published'
    $script:downloadBytes=[byte[]]$correct.Clone();$script:downloadBytes[0]=$script:downloadBytes[0] -bxor 1
    Assert-AdmissionError { Receive-CTToolboxUpdate $file } 'toolbox.invalid' 'same-length corrupt update cannot be published'
    Assert-Admission ([IO.File]::ReadAllText($sentinel) -ceq 'KEEP_UNRELATED') 'update cleanup preserves unrelated local files'

    # Import is stubbed only in this isolated library fixture, so real entry ordering
    # can be checked without WMI, system operations, real website calls or UAC.
    function Import-CTAdmission { }
    function Assert-CTEntryHost { return 'synthetic trusted host' }
    $script:factCalls=0
    function Get-SystemFacts { $script:factCalls++;return [pscustomobject]@{Version='10.0';Build=26100;Caption='Synthetic Windows';Edition='Professional';Architecture='x64';InstallLanguage='en-US';FreeBytes=80GB;Power='ac';PendingReboot=$false;Encryption='unencrypted';ExistingHook=$false} }
    $script:status.activeReleaseId='retired'
    Assert-AdmissionError { Invoke-Inspection } 'toolbox.updateRequired' 'retired entry stops before obtaining system facts'
    Assert-Admission ($script:factCalls -eq 0) 'denied entry performs no inspection'
    $script:status.activeReleaseId=$script:CTToolboxReleaseId
    $result=Invoke-Inspection
    Assert-Admission ($script:factCalls -eq 1 -and $result.Release.status -eq 'inspection-only' -and -not $script:AutomationEnabled) 'admitted read-only inspection completes once without enabling upgrade or activation'
    Write-Output ($script:count.ToString()+' native admission checks passed; CNG/DPAPI real, HTTP/files synthetic, OS/Office/UAC operations=0')
} finally {
    if ($null -ne $device) { [Array]::Clear($device.Private,0,$device.Private.Length) }
    if ($null -ne $again) { [Array]::Clear($again.Private,0,$again.Private.Length) }
    [Array]::Clear($script:serverPrivate,0,$script:serverPrivate.Length)
    if ([IO.Directory]::Exists($copyRoot)) { [IO.Directory]::Delete($copyRoot,$true) }
}
