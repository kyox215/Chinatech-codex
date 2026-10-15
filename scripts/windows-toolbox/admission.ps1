# This module is embedded in the hash-pinned runner; no downloaded code is executed.
# .NET Framework CNG is used so Windows PowerShell 5.1 needs no external runtime.
$script:CTToolboxOrigin = 'https://www.chinatech.in'
$script:CTToolboxToolId = 'windows-check'
$script:CTToolboxReleaseId = '__CLIENT_RELEASE_ID__'
$script:CTToolboxVersion = '__CLIENT_VERSION__'

function Initialize-CTToolboxCrypto {
    if ('ChinaTechToolboxCryptoV1' -as [type]) { return }
    Add-Type -TypeDefinition @'
using System;
using System.Security.Cryptography;
using System.Net;
using System.Threading;
public sealed class ChinaTechToolboxDeadlineV1 : IDisposable {
    private Timer timer;
    public ChinaTechToolboxDeadlineV1(WebRequest request,int milliseconds) { timer=new Timer(delegate(object ignored) { try { request.Abort(); } catch {} },null,milliseconds,Timeout.Infinite); }
    public void Dispose() { timer.Dispose(); }
}
public static class ChinaTechToolboxCryptoV1 {
    private static readonly byte[] Prefix = new byte[] {48,89,48,19,6,7,42,134,72,206,61,2,1,6,8,42,134,72,206,61,3,1,7,3,66,0,4};
    public static long Now() { return (long)(DateTime.UtcNow-new DateTime(1970,1,1,0,0,0,DateTimeKind.Utc)).TotalSeconds; }
    public static byte[] CreatePrivate() { using (var key = new ECDsaCng(256)) { return key.Key.Export(CngKeyBlobFormat.EccPrivateBlob); } }
    public static byte[] Public(byte[] secret) {
        using (var key = CngKey.Import(secret,CngKeyBlobFormat.EccPrivateBlob)) {
            byte[] blob=key.Export(CngKeyBlobFormat.EccPublicBlob);
            if(blob.Length!=72 || blob[0]!=69 || blob[1]!=67 || blob[2]!=83 || blob[3]!=49 || BitConverter.ToInt32(blob,4)!=32) throw new CryptographicException();
            byte[] spki=new byte[91];Buffer.BlockCopy(Prefix,0,spki,0,27);Buffer.BlockCopy(blob,8,spki,27,64);return spki;
        }
    }
    public static byte[] Sign(byte[] secret,byte[] message) {
        using(var key=CngKey.Import(secret,CngKeyBlobFormat.EccPrivateBlob)) using(var signer=new ECDsaCng(key)) {
            signer.HashAlgorithm=CngAlgorithm.Sha256;byte[] signature=signer.SignData(message);
            if(signature.Length!=64)throw new CryptographicException();return signature;
        }
    }
    public static bool Verify(byte[] spki,byte[] message,byte[] signature) {
        try {
            if(spki.Length!=91 || signature.Length!=64)return false;
            for(int i=0;i<Prefix.Length;i++)if(spki[i]!=Prefix[i])return false;
            byte[] blob=new byte[72];blob[0]=69;blob[1]=67;blob[2]=83;blob[3]=49;blob[4]=32;Buffer.BlockCopy(spki,27,blob,8,64);
            using(var key=CngKey.Import(blob,CngKeyBlobFormat.EccPublicBlob)) using(var verifier=new ECDsaCng(key)) {
                verifier.HashAlgorithm=CngAlgorithm.Sha256;return verifier.VerifyData(message,signature);
            }
        }catch{return false;}
    }
}
'@
}

function ConvertTo-CTBase64Url([byte[]]$Bytes) { return [Convert]::ToBase64String($Bytes).TrimEnd('=').Replace('+','-').Replace('/','_') }
function ConvertFrom-CTBase64Url([string]$Value) {
    if ($Value.Length -gt 65536 -or $Value -cnotmatch '^[A-Za-z0-9_-]+$') { throw 'toolbox.invalid' }
    try {
        $text=$Value.Replace('-','+').Replace('_','/')
        $bytes=[Convert]::FromBase64String($text+(''.PadRight((4-$text.Length%4)%4,'=')))
        if ((ConvertTo-CTBase64Url $bytes) -cne $Value) { throw 'toolbox.invalid' }
        return ,$bytes
    } catch { throw 'toolbox.invalid' }
}

function Assert-CTPrivatePath([string]$Path) {
    $current=[IO.Path]::GetFullPath($Path)
    while ($current) {
        if ([IO.File]::Exists($current) -or [IO.Directory]::Exists($current)) {
            if (([IO.File]::GetAttributes($current) -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'toolbox.storage' }
        }
        $parent=[IO.Path]::GetDirectoryName($current)
        if ($parent -eq $current) { break };$current=$parent
    }
}

function New-CTPrivateDirectory([string]$Path) {
    Assert-CTPrivatePath $Path
    $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User
    if ([IO.Directory]::Exists($Path)) {
        $acl=[IO.Directory]::GetAccessControl($Path)
        if (-not $acl.AreAccessRulesProtected -or $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid.Value) { throw 'toolbox.storage' }
        foreach ($rule in $acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])) {
            if ($rule.AccessControlType -eq [Security.AccessControl.AccessControlType]::Allow -and $rule.IdentityReference.Value -ne $sid.Value) { throw 'toolbox.storage' }
        }
        return
    }
    $acl=New-Object Security.AccessControl.DirectorySecurity
    $acl.SetOwner($sid);$acl.SetAccessRuleProtection($true,$false)
    $rule=New-Object Security.AccessControl.FileSystemAccessRule($sid,[Security.AccessControl.FileSystemRights]::FullControl,([Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [Security.AccessControl.InheritanceFlags]::ObjectInherit),[Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow)
    [void]$acl.AddAccessRule($rule);[void][IO.Directory]::CreateDirectory($Path,$acl)
}

function Get-CTToolboxRoot { return (Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'ChinaTech.WindowsCheckV1') }

function Get-CTToolboxDevice([string]$Root = (Get-CTToolboxRoot)) {
    Initialize-CTToolboxCrypto
    try {
        New-CTPrivateDirectory $Root
        $lock=Join-Path $Root 'device.lock';Assert-CTPrivatePath $lock
        $lease=New-Object IO.FileStream($lock,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
        try {
            $path=Join-Path $Root 'device.dat';Assert-CTPrivatePath $path
            if (-not [IO.File]::Exists($path)) {
                $record=[ordered]@{installationId=[Guid]::NewGuid().ToString('D');privateKey=[Convert]::ToBase64String([ChinaTechToolboxCryptoV1]::CreatePrivate())}
                $plain=[Text.Encoding]::UTF8.GetBytes(($record | ConvertTo-Json -Compress))
                $cipher=[Security.Cryptography.ProtectedData]::Protect($plain,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
                $temporary=Join-Path $Root ([Guid]::NewGuid().ToString('D')+'.new');Assert-CTPrivatePath $temporary
                try { [IO.File]::WriteAllBytes($temporary,$cipher);[IO.File]::Move($temporary,$path) }
                finally { if ([IO.File]::Exists($temporary)) { [IO.File]::Delete($temporary) };[Array]::Clear($plain,0,$plain.Length) }
            }
            if ((New-Object IO.FileInfo($path)).Length -gt 16384) { throw 'toolbox.storage' }
            $plain=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($path),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
            try { $record=[Text.Encoding]::UTF8.GetString($plain) | ConvertFrom-Json }
            finally { [Array]::Clear($plain,0,$plain.Length) }
            if ([string]$record.installationId -cnotmatch '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$') { throw 'toolbox.storage' }
            $private=[Convert]::FromBase64String([string]$record.privateKey)
            $public=[ChinaTechToolboxCryptoV1]::Public($private)
            return [pscustomobject]@{InstallationId=[string]$record.installationId;Private=$private;Public=$public}
        } finally { $lease.Dispose() }
    } catch { throw 'toolbox.storage' }
}

function Invoke-CTToolboxHttp([string]$Method,[string]$Operation,[string]$Body='') {
    if ($Operation -cnotmatch '^(status|update|jobs/start|jobs/outcome)$' -or @('GET','POST') -cnotcontains $Method) { throw 'toolbox.invalid' }
    $url=$script:CTToolboxOrigin+'/api/toolbox/client/v1/windows-check/'+$Operation
    Initialize-CTToolboxCrypto
    $response=$null;$deadline=$null
    try {
        [Net.ServicePointManager]::SecurityProtocol=[Net.ServicePointManager]::SecurityProtocol -bor 3072
        $request=[Net.HttpWebRequest]::Create($url);$request.Method=$Method;$request.AllowAutoRedirect=$false;$request.Timeout=15000;$request.ReadWriteTimeout=15000
        $deadline=New-Object ChinaTechToolboxDeadlineV1($request,15000)
        if ($Method -eq 'POST') {
            $bytes=[Text.Encoding]::UTF8.GetBytes($Body);$request.ContentType='application/json';$request.ContentLength=$bytes.Length
            $stream=$request.GetRequestStream();try { $stream.Write($bytes,0,$bytes.Length) } finally { $stream.Dispose() }
        }
        $response=$request.GetResponse()
        if ([int]$response.StatusCode -lt 200 -or [int]$response.StatusCode -ge 300 -or $response.ContentLength -gt 65536) { throw 'toolbox.unavailable' }
        $stream=$response.GetResponseStream();$buffer=New-Object byte[] 8192;$memory=New-Object IO.MemoryStream
        try {
            while (($read=$stream.Read($buffer,0,$buffer.Length)) -gt 0) {
                if ($memory.Length + $read -gt 65536) { throw 'toolbox.invalid' };$memory.Write($buffer,0,$read)
            }
            return ([Text.Encoding]::UTF8.GetString($memory.ToArray()) | ConvertFrom-Json)
        } finally { $stream.Dispose();$memory.Dispose() }
    } catch {
        if ($_.Exception.Message -like 'toolbox.*') { throw }
        $errorResponse=$_.Exception.Response
        if ($null -ne $errorResponse) {
            try { if ([int]$errorResponse.StatusCode -eq 426) { throw 'toolbox.updateRequired' } } finally { $errorResponse.Dispose() }
        }
        throw 'toolbox.unavailable'
    } finally { if ($null -ne $deadline) { $deadline.Dispose() };if ($null -ne $response) { $response.Dispose() } }
}

function Assert-CTToolboxStatus {
    $status=Invoke-CTToolboxHttp 'GET' 'status'
    if ([string]$status.activeReleaseId -cne $script:CTToolboxReleaseId) { throw 'toolbox.updateRequired' }
    if (-not ($status.ready -is [bool]) -or -not ($status.enabled -is [bool]) -or -not $status.ready -or -not $status.enabled) { throw 'toolbox.paused' }
}

function Get-CTTrustedWebsiteKey {
    return [pscustomobject]@{kid='office-v3-20261013';spki='MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEoHieiLBa/Im3OqTwwDEMtygbpqs0U18RkelP70y3ERAFiJDZrVSkQKXNN3dp73VJPouyS2fgAcn0qL16RyMxhA=='}
}

function Read-CTSignedEnvelope($Envelope,[string]$Audience) {
    Initialize-CTToolboxCrypto
    $trust=Get-CTTrustedWebsiteKey
    if ([string]$Envelope.kid -cne $trust.kid) { throw 'toolbox.invalid' }
    $payload=[string]$Envelope.payload;$signature=ConvertFrom-CTBase64Url ([string]$Envelope.signature)
    if (-not [ChinaTechToolboxCryptoV1]::Verify([Convert]::FromBase64String($trust.spki),[Text.Encoding]::UTF8.GetBytes("CT-OFFICE-V3-UPDATE`n"+$payload),$signature)) { throw 'toolbox.invalid' }
    $data=[Text.Encoding]::UTF8.GetString((ConvertFrom-CTBase64Url $payload)) | ConvertFrom-Json
    $now=[ChinaTechToolboxCryptoV1]::Now()
    if ([string]$data.iss -cne $script:CTToolboxOrigin -or [string]$data.aud -cne $Audience -or [string]$data.toolId -cne $script:CTToolboxToolId -or
        -not ($data.issuedAt -is [int] -or $data.issuedAt -is [long]) -or -not ($data.expiresAt -is [int] -or $data.expiresAt -is [long]) -or
        $data.issuedAt -gt $now + 300 -or $data.expiresAt -le $now -or $data.expiresAt -le $data.issuedAt) { throw 'toolbox.invalid' }
    return $data
}

function Assert-CTDetectPermit($Envelope,$Device,[string]$JobId,[string]$ScopeHash) {
    $data=Read-CTSignedEnvelope $Envelope 'toolbox-v1-task'
    if ([string]$data.releaseId -cne $script:CTToolboxReleaseId -or [string]$data.installationId -cne $Device.InstallationId -or
        [string]$data.jobId -cne $JobId -or [string]$data.action -cne 'detect' -or [string]$data.scopeHash -cne $ScopeHash -or
        [string]$data.keyHash -cne (Get-Sha256Bytes $Device.Public) -or $data.expiresAt - $data.issuedAt -gt 2592000) { throw 'toolbox.invalid' }
}

function Request-CTDetectPermit {
    Assert-CTToolboxStatus
    $device=Get-CTToolboxDevice
    try {
        $jobId=[Guid]::NewGuid().ToString('D')
        $scope=[ordered]@{schema=1;action='detect';mode='inspection-only';language=$Language;releasePolicySha256=$script:ExpectedReleaseHash}
        $scopeHash=Get-Sha256Bytes ([Text.Encoding]::UTF8.GetBytes(($scope | ConvertTo-Json -Compress)))
        $context=[pscustomobject]@{JobId=$jobId;ScopeHash=$scopeHash;ReleaseId=$script:CTToolboxReleaseId;AppVersion=$script:CTToolboxVersion}
        $response=Send-CTToolboxProof 'start' $device $context
        Assert-CTDetectPermit $response.permit $device $jobId $scopeHash
        return $context
    } finally { [Array]::Clear($device.Private,0,$device.Private.Length) }
}

function Send-CTToolboxProof([string]$Operation,$Device,$Context,[string]$CheckpointHash='') {
    if (@('start','outcome') -cnotcontains $Operation) { throw 'toolbox.invalid' }
    $nonce=New-Object byte[] 32;$random=[Security.Cryptography.RandomNumberGenerator]::Create();try { $random.GetBytes($nonce) } finally { $random.Dispose() }
    $body=[ordered]@{requestId=[Guid]::NewGuid().ToString('D');installationId=$Device.InstallationId;appVersion=$Context.AppVersion;releaseId=$Context.ReleaseId;
        timestamp=[ChinaTechToolboxCryptoV1]::Now();nonce=(ConvertTo-CTBase64Url $nonce);publicKey=(ConvertTo-CTBase64Url $Device.Public);jobId=$Context.JobId;action='detect';scopeHash=$Context.ScopeHash}
    if ($Operation -ceq 'outcome') { $body['checkpointHash']=$CheckpointHash }
    $bytes=[Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Compress));$path='/api/toolbox/client/v1/windows-check/jobs/'+$Operation
    $canonical=@('CT-TOOLBOX-V1','POST',$path,$body.requestId,$body.installationId,$body.timestamp.ToString([Globalization.CultureInfo]::InvariantCulture),$body.nonce,(Get-Sha256Bytes $bytes),(Get-Sha256Bytes (New-Object byte[] 0))) -join "`n"
    $envelope=[ordered]@{payload=(ConvertTo-CTBase64Url $bytes);signature=(ConvertTo-CTBase64Url ([ChinaTechToolboxCryptoV1]::Sign($Device.Private,[Text.Encoding]::UTF8.GetBytes($canonical))))}
    return (Invoke-CTToolboxHttp 'POST' ('jobs/'+$Operation) ($envelope | ConvertTo-Json -Compress))
}

function Write-CTPendingOutcome($Context,[string]$CheckpointHash) {
    $root=Get-CTToolboxRoot;New-CTPrivateDirectory $root
    $path=Join-Path $root ('outcome-'+$Context.JobId+'.dat');Assert-CTPrivatePath $path
    $record=[ordered]@{JobId=$Context.JobId;ScopeHash=$Context.ScopeHash;ReleaseId=$Context.ReleaseId;AppVersion=$Context.AppVersion;CheckpointHash=$CheckpointHash}
    $plain=[Text.Encoding]::UTF8.GetBytes(($record | ConvertTo-Json -Compress))
    $cipher=[Security.Cryptography.ProtectedData]::Protect($plain,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    $temporary=Join-Path $root ([Guid]::NewGuid().ToString('D')+'.new');Assert-CTPrivatePath $temporary
    try { [IO.File]::WriteAllBytes($temporary,$cipher);[IO.File]::Move($temporary,$path) }
    finally { [Array]::Clear($plain,0,$plain.Length);if ([IO.File]::Exists($temporary)) { [IO.File]::Delete($temporary) } }
    return $path
}

function Send-CTPendingOutcome([string]$Path,$Device) {
    Assert-CTPrivatePath $Path
    if ((New-Object IO.FileInfo($Path)).Length -gt 16384) { throw 'toolbox.storage' }
    $plain=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($Path),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    try { $record=[Text.Encoding]::UTF8.GetString($plain) | ConvertFrom-Json } finally { [Array]::Clear($plain,0,$plain.Length) }
    if ([string]$record.JobId -cnotmatch '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' -or
        [IO.Path]::GetFileName($Path) -cne ('outcome-'+$record.JobId+'.dat') -or [string]$record.ScopeHash -cnotmatch '^[a-f0-9]{64}$' -or
        [string]$record.ReleaseId -cnotmatch '^[a-z0-9][a-z0-9.-]{0,95}$' -or [string]$record.AppVersion -cnotmatch '^.{1,96}$' -or
        [string]$record.CheckpointHash -cnotmatch '^[a-f0-9]{64}$') { throw 'toolbox.storage' }
    $response=Send-CTToolboxProof 'outcome' $Device $record ([string]$record.CheckpointHash)
    if (-not ($response.completed -is [bool]) -or -not $response.completed) { throw 'toolbox.invalid' }
    [IO.File]::Delete($Path)
}

function Sync-CTPendingOutcomes {
    $root=Get-CTToolboxRoot
    if (-not [IO.Directory]::Exists($root)) { return }
    Assert-CTPrivatePath $root
    $pending=@([IO.Directory]::GetFiles($root,'outcome-*.dat') | Sort-Object | Select-Object -First 2)
    if (-not $pending.Count) { return }
    $device=$null
    try {
        $device=Get-CTToolboxDevice
        foreach ($path in $pending) { Send-CTPendingOutcome $path $device }
    } catch { Write-CTMessage (Get-Message 'toolbox.pendingRetry') }
    finally { if ($null -ne $device) { [Array]::Clear($device.Private,0,$device.Private.Length) } }
}

function Complete-CTDetection($Context,$Facts) {
    # Only a task-bound digest leaves the PC; raw facts are never in the request or pending file.
    $snapshot=[ordered]@{jobId=$Context.JobId;result='completed';facts=$Facts}
    $hash=Get-Sha256Bytes ([Text.Encoding]::UTF8.GetBytes(($snapshot | ConvertTo-Json -Compress -Depth 6)))
    $device=$null;$saved=$false
    try {
        $path=Write-CTPendingOutcome $Context $hash;$saved=$true
        $device=Get-CTToolboxDevice;Send-CTPendingOutcome $path $device
    } catch { if ($saved) { Write-CTMessage (Get-Message 'toolbox.outcomePending') } else { Write-CTMessage (Get-Message 'toolbox.outcomeUnrecorded') } }
    finally { if ($null -ne $device) { [Array]::Clear($device.Private,0,$device.Private.Length) } }
}

function Get-CTVerifiedToolboxUpdate {
    $envelope=Invoke-CTToolboxHttp 'GET' 'update'
    $data=Read-CTSignedEnvelope $envelope 'toolbox-v1-update'
    if ([string]$data.activeReleaseId -cnotmatch '^[a-z0-9][a-z0-9.-]{0,95}$' -or [string]$data.releaseId -cne [string]$data.activeReleaseId -or
        $data.activeReleaseId -ceq $script:CTToolboxReleaseId -or $data.expiresAt - $data.issuedAt -gt 300) { throw 'toolbox.invalid' }
    $files=@($data.files)
    if ($files.Count -ne 1) { throw 'toolbox.invalid' };$file=$files[0]
    Assert-CTToolboxUpdateFile $file
    return $file
}

function Assert-CTToolboxUpdateFile($File) {
    if ([string]$File.architecture -cne 'any' -or [string]$File.href -cne ($script:CTToolboxOrigin+'/toolbox/windows-current/ChinaTech-Windows-Check.zip') -or
        [string]$File.sha256 -cnotmatch '^[a-f0-9]{64}$' -or -not ($File.bytes -is [int] -or $File.bytes -is [long]) -or $File.bytes -le 0 -or $File.bytes -gt 20971520) { throw 'toolbox.invalid' }
}

function New-CTToolboxDownloadRequest([string]$Url) {
    if ($Url -cne ($script:CTToolboxOrigin+'/toolbox/windows-current/ChinaTech-Windows-Check.zip')) { throw 'toolbox.invalid' }
    return [Net.HttpWebRequest]::Create($Url)
}

function Receive-CTToolboxUpdate($File,[string]$Root = (Get-CTToolboxRoot)) {
    Initialize-CTToolboxCrypto;Assert-CTToolboxUpdateFile $File
    New-CTPrivateDirectory $Root
    $directory=Join-Path $Root ('update-'+[Guid]::NewGuid().ToString('D'));New-CTPrivateDirectory $directory
    $destination=Join-Path $directory 'ChinaTech-Windows-Check.zip';Assert-CTPrivatePath $destination
    $response=$null;$deadline=$null;$complete=$false
    try {
        $request=New-CTToolboxDownloadRequest ([string]$File.href);$request.AllowAutoRedirect=$false;$request.Timeout=15000;$request.ReadWriteTimeout=15000
        $deadline=New-Object ChinaTechToolboxDeadlineV1($request,600000)
        $response=$request.GetResponse()
        if ([int]$response.StatusCode -ne 200 -or ($response.ContentLength -ge 0 -and $response.ContentLength -ne [long]$File.bytes)) { throw 'toolbox.invalid' }
        $input=$response.GetResponseStream();$output=New-Object IO.FileStream($destination,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
        $buffer=New-Object byte[] 65536;$total=0L
        try {
            while (($read=$input.Read($buffer,0,$buffer.Length)) -gt 0) {
                if ($total + $read -gt [long]$File.bytes) { throw 'toolbox.invalid' };$output.Write($buffer,0,$read);$total+=$read
                Write-CTMessage ((Get-Message 'toolbox.downloadBytes') -f $total,$File.bytes)
            }
            $output.Flush($true)
        } finally { $input.Dispose();$output.Dispose() }
        if ($total -ne [long]$File.bytes -or (Get-Sha256 $destination) -cne [string]$File.sha256) { throw 'toolbox.invalid' }
        $complete=$true;return $destination
    } finally {
        if ($null -ne $deadline) { $deadline.Dispose() };if ($null -ne $response) { $response.Dispose() }
        if (-not $complete) { if ([IO.File]::Exists($destination)) { [IO.File]::Delete($destination) };if ([IO.Directory]::Exists($directory)) { [IO.Directory]::Delete($directory,$false) } }
    }
}

function Invoke-CTGuidedUpdate {
    Write-CTMessage (Get-Message 'toolbox.updatePrompt')
    if ([Console]::ReadLine() -cnotin @('Y','y')) { return }
    $file=Get-CTVerifiedToolboxUpdate;$path=Receive-CTToolboxUpdate $file
    Write-CTMessage ((Get-Message 'toolbox.updateSaved') -f $path)
    # The ZIP is data. Do not execute its scripts, bypass prompts or delete old files.
    $explorer=Join-Path ([Environment]::GetFolderPath('Windows')) 'explorer.exe';Assert-MicrosoftSetup $explorer
    Start-Process -FilePath $explorer -ArgumentList ('/select,"'+$path+'"') | Out-Null
}
