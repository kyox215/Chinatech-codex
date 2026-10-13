#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$Path,
    [string]$ExpectedSubject,
    [string]$ExpectedThumbprint,
    [string]$ArtifactProfileEku,
    [string]$SignToolPath,
    [string]$ExpectedVersion,
    [string]$ExpectedRuntime
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2
$script:KnownErrors = @('INVALID_ARGUMENT','PATH_INVALID','REPARSE_PATH','PE_INVALID','RUNTIME_MISMATCH','VERSION_MISMATCH','DEVELOPMENT_ARTIFACT','SIGNATURE_MISSING','SIGNATURE_INVALID','SIGNATURE_FORMAT_INVALID','SIGNATURE_ALGORITHM_INVALID','SIGNER_MISMATCH','SIGNER_EKU_INVALID','TIMESTAMP_MISSING','TIMESTAMP_INVALID','PUBLIC_TRUST_UNCONFIRMED','ARTIFACT_PROFILE_INVALID','SIGNTOOL_UNAVAILABLE','SIGNTOOL_UNTRUSTED','SIGNTOOL_FAILED','FILE_CHANGED','VERIFICATION_FAILED')

function Stop-Verification([string]$Code) { throw [InvalidOperationException]::new($Code) }
function Get-SafeFile([string]$Value) {
    if ([string]::IsNullOrWhiteSpace($Value) -or $Value -notmatch '^[a-zA-Z]:\\' -or $Value.Substring(2).Contains(':')) { Stop-Verification 'PATH_INVALID' }
    $full = [IO.Path]::GetFullPath($Value)
    $root = [IO.Path]::GetPathRoot($full)
    if ([IO.DriveInfo]::new($root).DriveType -notin @([IO.DriveType]::Fixed,[IO.DriveType]::Removable,[IO.DriveType]::Ram)) { Stop-Verification 'PATH_INVALID' }
    # Inspect each ancestor before probing its child; a link to a network path is rejected first.
    $current = $root
    foreach ($segment in $full.Substring($root.Length).Split([IO.Path]::DirectorySeparatorChar)) {
        if ($segment.Length -eq 0) { continue }
        $current = [IO.Path]::Combine($current,$segment)
        try { $attributes = [IO.File]::GetAttributes($current) } catch { Stop-Verification 'PATH_INVALID' }
        if (($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { Stop-Verification 'REPARSE_PATH' }
    }
    if (-not [IO.File]::Exists($full)) { Stop-Verification 'PATH_INVALID' }
    return $full
}
function Get-Sha256([IO.Stream]$Stream) {
    $position = $Stream.Position
    $hash = [Security.Cryptography.SHA256]::Create()
    try { $Stream.Position = 0; return ([BitConverter]::ToString($hash.ComputeHash($Stream))).Replace('-','').ToLowerInvariant() }
    finally { $Stream.Position = $position; $hash.Dispose() }
}
function Get-Ekus([Security.Cryptography.X509Certificates.X509Certificate2]$Certificate) {
    $result = @()
    foreach ($extension in $Certificate.Extensions) {
        if ($extension.Oid.Value -eq '2.5.29.37') {
            $eku = [Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($extension, $extension.Critical)
            foreach ($oid in $eku.EnhancedKeyUsages) { $result += $oid.Value }
        }
    }
    return $result
}
function Get-PeSignature([IO.Stream]$Stream) {
    $reader = [IO.BinaryReader]::new($Stream, [Text.Encoding]::UTF8, $true)
    try {
        if ($Stream.Length -lt 256 -or $Stream.Length -gt 536870912) { Stop-Verification 'PE_INVALID' }
        $Stream.Position = 0
        if ($reader.ReadUInt16() -ne 0x5a4d) { Stop-Verification 'PE_INVALID' }
        $Stream.Position = 0x3c; $pe = [long]$reader.ReadUInt32()
        if ($pe -lt 64 -or $pe + 256 -gt $Stream.Length) { Stop-Verification 'PE_INVALID' }
        $Stream.Position = $pe
        if ($reader.ReadUInt32() -ne 0x4550) { Stop-Verification 'PE_INVALID' }
        $machine = $reader.ReadUInt16()
        if ($machine -eq 0xaa64) { $runtime = 'win-arm64' } elseif ($machine -eq 0x8664) { $runtime = 'win-x64' } else { Stop-Verification 'PE_INVALID' }
        $Stream.Position = $pe + 20; $optionalLength = $reader.ReadUInt16()
        $optional = $pe + 24; $Stream.Position = $optional
        if ($reader.ReadUInt16() -ne 0x20b -or $optionalLength -lt 152) { Stop-Verification 'PE_INVALID' }
        $Stream.Position = $optional + 108
        if ($reader.ReadUInt32() -lt 5) { Stop-Verification 'PE_INVALID' }
        $Stream.Position = $optional + 144; $offset = [long]$reader.ReadUInt32(); $size = [long]$reader.ReadUInt32()
        if ($offset -eq 0 -or $size -eq 0) { Stop-Verification 'SIGNATURE_MISSING' }
        if ($offset -lt $optional + $optionalLength -or ($offset % 8) -ne 0 -or $size -lt 16 -or $size -gt 1048576 -or $offset + $size -gt $Stream.Length) { Stop-Verification 'SIGNATURE_FORMAT_INVALID' }
        $Stream.Position = $offset; $length = [long]$reader.ReadUInt32(); $revision = $reader.ReadUInt16(); $type = $reader.ReadUInt16()
        # Releases produced by this pipeline have exactly one embedded PKCS#7 signature.
        if ($revision -ne 0x0200 -or $type -ne 2 -or $length -lt 16 -or $length -gt $size -or ([long][Math]::Ceiling($length / 8.0) * 8) -ne $size) { Stop-Verification 'SIGNATURE_FORMAT_INVALID' }
        $cms = $reader.ReadBytes([int]($length - 8))
        if ($cms.Length -ne $length - 8) { Stop-Verification 'SIGNATURE_FORMAT_INVALID' }
        return [pscustomobject]@{ Runtime = $runtime; Machine = ('0x{0:x4}' -f $machine); Cms = $cms }
    } finally { $reader.Dispose() }
}
function Get-DerNode([byte[]]$Data, [int]$Offset, [int]$Limit) {
    if ($Limit -gt $Data.Length -or $Offset -lt 0 -or $Offset + 2 -gt $Limit) { Stop-Verification 'SIGNATURE_FORMAT_INVALID' }
    $tag = [int]$Data[$Offset]; $cursor = $Offset + 1; $first = [int]$Data[$cursor]; $cursor++
    if ($first -lt 128) { $length = [long]$first }
    else {
        $count = $first -band 127
        if ($count -lt 1 -or $count -gt 4 -or $cursor + $count -gt $Limit -or $Data[$cursor] -eq 0) { Stop-Verification 'SIGNATURE_FORMAT_INVALID' }
        $length = [long]0
        for ($index = 0; $index -lt $count; $index++) { $length = $length * 256 + $Data[$cursor]; $cursor++ }
        if ($length -lt 128) { Stop-Verification 'SIGNATURE_FORMAT_INVALID' }
    }
    if ($cursor + $length -gt $Limit) { Stop-Verification 'SIGNATURE_FORMAT_INVALID' }
    return [pscustomobject]@{ Tag = $tag; Start = $Offset; Content = $cursor; Length = [int]$length; End = [int]($cursor + $length) }
}
function Get-DerChildren([byte[]]$Data, $Node) {
    $children = @(); $cursor = $Node.Content
    while ($cursor -lt $Node.End) { $child = Get-DerNode $Data $cursor $Node.End; $children += $child; $cursor = $child.End }
    return $children
}
function Test-Sha256Algorithm([byte[]]$Data, $Algorithm) {
    if ($Algorithm.Tag -ne 0x30) { return $false }
    $children = @(Get-DerChildren $Data $Algorithm)
    if ($children.Count -lt 1 -or $children.Count -gt 2 -or $children[0].Tag -ne 6) { return $false }
    $oid = $children[0]
    $bytes = [byte[]]::new($oid.Length); [Array]::Copy($Data, $oid.Content, $bytes, 0, $oid.Length)
    if ([BitConverter]::ToString($bytes) -ne '60-86-48-01-65-03-04-02-01') { return $false }
    return $children.Count -eq 1 -or ($children[1].Tag -eq 5 -and $children[1].Length -eq 0)
}
function Get-SignatureDetails([byte[]]$Data, $Signature) {
    Add-Type -AssemblyName System.Security
    $cms = [Security.Cryptography.Pkcs.SignedCms]::new(); $cms.Decode($Data)
    if ($cms.ContentInfo.ContentType.Value -ne '1.3.6.1.4.1.311.2.1.4' -or $cms.SignerInfos.Count -ne 1) { Stop-Verification 'SIGNATURE_FORMAT_INVALID' }
    $signer = $cms.SignerInfos[0]
    if ($null -eq $signer.Certificate -or $signer.Certificate.Thumbprint -ne $Signature.SignerCertificate.Thumbprint) { Stop-Verification 'SIGNER_MISMATCH' }
    if ($signer.DigestAlgorithm.Value -ne '2.16.840.1.101.3.4.2.1') { Stop-Verification 'SIGNATURE_ALGORITHM_INVALID' }
    $content = $cms.ContentInfo.Content
    $root = Get-DerNode $content 0 $content.Length
    $indirect = @(Get-DerChildren $content $root)
    if ($root.Tag -ne 0x30 -or $root.End -ne $content.Length -or $indirect.Count -ne 2 -or $indirect[1].Tag -ne 0x30) { Stop-Verification 'SIGNATURE_FORMAT_INVALID' }
    $digest = @(Get-DerChildren $content $indirect[1])
    if ($digest.Count -ne 2 -or -not (Test-Sha256Algorithm $content $digest[0]) -or $digest[1].Tag -ne 4 -or $digest[1].Length -ne 32) { Stop-Verification 'SIGNATURE_ALGORITHM_INVALID' }
    $timestamps = @()
    foreach ($attribute in $signer.UnsignedAttributes) {
        if ($attribute.Oid.Value -eq '1.3.6.1.4.1.311.2.4.1') { Stop-Verification 'SIGNATURE_FORMAT_INVALID' }
        if ($attribute.Oid.Value -in @('1.3.6.1.4.1.311.3.3.1','1.2.840.113549.1.9.16.2.14')) {
            foreach ($value in $attribute.Values) { $timestamps += ,$value.RawData }
        }
    }
    if ($timestamps.Count -ne 1 -or $null -eq $Signature.TimeStamperCertificate) { Stop-Verification 'TIMESTAMP_MISSING' }
    $token = [Security.Cryptography.Pkcs.SignedCms]::new(); $token.Decode($timestamps[0])
    if ($token.ContentInfo.ContentType.Value -ne '1.2.840.113549.1.9.16.1.4' -or $token.SignerInfos.Count -ne 1 -or $null -eq $token.SignerInfos[0].Certificate -or $token.SignerInfos[0].Certificate.Thumbprint -ne $Signature.TimeStamperCertificate.Thumbprint) { Stop-Verification 'TIMESTAMP_INVALID' }
    if ($token.SignerInfos[0].DigestAlgorithm.Value -notin @('2.16.840.1.101.3.4.2.1','2.16.840.1.101.3.4.2.2','2.16.840.1.101.3.4.2.3')) { Stop-Verification 'SIGNATURE_ALGORITHM_INVALID' }
    $token.CheckSignature($true)
    $tst = $token.ContentInfo.Content; $tstRoot = Get-DerNode $tst 0 $tst.Length; $fields = @(Get-DerChildren $tst $tstRoot)
    if ($tstRoot.Tag -ne 0x30 -or $tstRoot.End -ne $tst.Length -or $fields.Count -lt 5 -or $fields[2].Tag -ne 0x30 -or $fields[4].Tag -ne 0x18) { Stop-Verification 'TIMESTAMP_INVALID' }
    $imprint = @(Get-DerChildren $tst $fields[2])
    if ($imprint.Count -ne 2 -or -not (Test-Sha256Algorithm $tst $imprint[0]) -or $imprint[1].Tag -ne 4 -or $imprint[1].Length -ne 32) { Stop-Verification 'SIGNATURE_ALGORITHM_INVALID' }
    $timeText = [Text.Encoding]::ASCII.GetString($tst, $fields[4].Content, $fields[4].Length)
    if ($timeText -notmatch '^\d{14}(\.\d{1,7})?Z$') { Stop-Verification 'TIMESTAMP_INVALID' }
    $formats = @("yyyyMMddHHmmss'Z'","yyyyMMddHHmmss.FFFFFFF'Z'")
    $time = [DateTime]::ParseExact($timeText, $formats, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::AssumeUniversal -bor [Globalization.DateTimeStyles]::AdjustToUniversal)
    if ($time -lt $signer.Certificate.NotBefore.ToUniversalTime() -or $time -gt $signer.Certificate.NotAfter.ToUniversalTime() -or $time -lt $Signature.TimeStamperCertificate.NotBefore.ToUniversalTime() -or $time -gt $Signature.TimeStamperCertificate.NotAfter.ToUniversalTime()) { Stop-Verification 'TIMESTAMP_INVALID' }
    $tsaAlgorithm = @{ '2.16.840.1.101.3.4.2.1' = 'SHA256'; '2.16.840.1.101.3.4.2.2' = 'SHA384'; '2.16.840.1.101.3.4.2.3' = 'SHA512' }
    return [pscustomobject]@{ TimestampUtc = $time.ToString('o'); FileDigest = 'SHA256'; TimestampMessageImprintDigest = 'SHA256'; TimestampSignatureDigest = $tsaAlgorithm[$token.SignerInfos[0].DigestAlgorithm.Value] }
}
function Confirm-AuthRoot([Security.Cryptography.X509Certificates.X509Certificate2]$Certificate) {
    # Auxiliary chain only finds the root. WinTrust and SignTool, below, decide signature validity.
    $chain = [Security.Cryptography.X509Certificates.X509Chain]::new()
    $store = [Security.Cryptography.X509Certificates.X509Store]::new('AuthRoot',[Security.Cryptography.X509Certificates.StoreLocation]::LocalMachine)
    try {
        $chain.ChainPolicy.VerificationFlags = [Security.Cryptography.X509Certificates.X509VerificationFlags]::IgnoreNotTimeValid
        $chain.ChainPolicy.RevocationMode = [Security.Cryptography.X509Certificates.X509RevocationMode]::NoCheck
        $null = $chain.Build($Certificate)
        if ($chain.ChainElements.Count -lt 2) { Stop-Verification 'PUBLIC_TRUST_UNCONFIRMED' }
        $root = $chain.ChainElements[$chain.ChainElements.Count - 1].Certificate
        $store.Open([Security.Cryptography.X509Certificates.OpenFlags]::ReadOnly)
        $matches = $store.Certificates.Find([Security.Cryptography.X509Certificates.X509FindType]::FindByThumbprint,$root.Thumbprint,$false)
        if ($root.Subject -ne $root.Issuer -or $matches.Count -ne 1) { Stop-Verification 'PUBLIC_TRUST_UNCONFIRMED' }
    } finally { $store.Close(); $chain.Dispose() }
}
function Get-VerifiedSignTool([string]$Value) {
    if ([string]::IsNullOrWhiteSpace($Value)) {
        $command = Get-Command signtool.exe -CommandType Application -ErrorAction SilentlyContinue
        if ($null -eq $command) { Stop-Verification 'SIGNTOOL_UNAVAILABLE' }
        $Value = $command.Source
    }
    $full = Get-SafeFile $Value
    $tool = Get-AuthenticodeSignature -LiteralPath $full
    $version = [Diagnostics.FileVersionInfo]::GetVersionInfo($full)
    if ([IO.Path]::GetFileName($full) -ine 'signtool.exe' -or $version.OriginalFilename -ine 'signtool.exe' -or $tool.Status.ToString() -ne 'Valid' -or $tool.SignatureType.ToString() -ne 'Authenticode' -or $null -eq $tool.SignerCertificate -or $tool.SignerCertificate.Subject -notmatch '(^|,\s*)O=Microsoft Corporation(,|$)' -or $tool.SignerCertificate.Subject -notmatch '(^|,\s*)CN=Microsoft (Corporation|Windows)(,|$)' -or '1.3.6.1.5.5.7.3.3' -notin @(Get-Ekus $tool.SignerCertificate)) { Stop-Verification 'SIGNTOOL_UNTRUSTED' }
    return $full
}

$lockedFile = $null
try {
    if ([string]::IsNullOrWhiteSpace($ExpectedSubject) -or ($ExpectedThumbprint -and $ExpectedThumbprint -notmatch '^[a-fA-F0-9]{40}$') -or ($ExpectedVersion -and $ExpectedVersion -notmatch '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$') -or ($ExpectedRuntime -and $ExpectedRuntime -notin @('win-arm64','win-x64'))) { Stop-Verification 'INVALID_ARGUMENT' }
    if ($ArtifactProfileEku -and ($ExpectedThumbprint -or $ArtifactProfileEku -notmatch '^1\.3\.6\.1\.4\.1\.311\.97\.[0-9]+(\.[0-9]+)+$' -or $ArtifactProfileEku -eq '1.3.6.1.4.1.311.97.1.0' -or $ArtifactProfileEku.StartsWith('1.3.6.1.4.1.311.97.1.3.1.') -or $ArtifactProfileEku.StartsWith('1.3.6.1.4.1.311.97.1.4.1.'))) { Stop-Verification 'ARTIFACT_PROFILE_INVALID' }
    $file = Get-SafeFile $Path
    if ([IO.Path]::GetExtension($file) -ine '.exe') { Stop-Verification 'PE_INVALID' }
    $version = [Diagnostics.FileVersionInfo]::GetVersionInfo($file)
    if ([IO.Path]::GetFileName($file) -match '(?i)(^|[._-])dev([._-]|$)' -or $version.ProductVersion -match '(?i)dev') { Stop-Verification 'DEVELOPMENT_ARTIFACT' }
    $productVersion = $version.ProductVersion
    if ($ExpectedVersion -and ($null -eq $productVersion -or $productVersion -notmatch ('^' + [Regex]::Escape($ExpectedVersion) + '(\+[a-zA-Z0-9.-]+)?$') -or $version.ProductName -cne 'ChinaTech.OfficeAssistant' -or $version.OriginalFilename -cne 'ChinaTech.OfficeAssistant.dll')) { Stop-Verification 'VERSION_MISMATCH' }
    $lockedFile = [IO.File]::Open($file,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
    $before = Get-Sha256 $lockedFile; $pe = Get-PeSignature $lockedFile
    if ($ExpectedRuntime -and $pe.Runtime -ne $ExpectedRuntime) { Stop-Verification 'RUNTIME_MISMATCH' }
    $signature = Get-AuthenticodeSignature -LiteralPath $file
    if ($signature.SignatureType.ToString() -ne 'Authenticode' -or $null -eq $signature.SignerCertificate) { Stop-Verification 'SIGNATURE_MISSING' }
    if ($signature.Status.ToString() -ne 'Valid') { Stop-Verification 'SIGNATURE_INVALID' }
    $signer = $signature.SignerCertificate; $ekus = @(Get-Ekus $signer)
    if (-not [string]::Equals($signer.Subject,$ExpectedSubject,[StringComparison]::Ordinal) -or ($ExpectedThumbprint -and $signer.Thumbprint -ine $ExpectedThumbprint)) { Stop-Verification 'SIGNER_MISMATCH' }
    if ('1.3.6.1.5.5.7.3.3' -notin $ekus) { Stop-Verification 'SIGNER_EKU_INVALID' }
    if ($signer.Subject -eq $signer.Issuer) { Stop-Verification 'PUBLIC_TRUST_UNCONFIRMED' }
    if ($null -eq $signature.TimeStamperCertificate) { Stop-Verification 'TIMESTAMP_MISSING' }
    if ($signature.TimeStamperCertificate.Subject -eq $signature.TimeStamperCertificate.Issuer -or '1.3.6.1.5.5.7.3.8' -notin @(Get-Ekus $signature.TimeStamperCertificate)) { Stop-Verification 'TIMESTAMP_INVALID' }
    $details = Get-SignatureDetails $pe.Cms $signature
    if ($ArtifactProfileEku) {
        if ('1.3.6.1.4.1.311.97.1.0' -notin $ekus -or $ArtifactProfileEku -notin $ekus) { Stop-Verification 'ARTIFACT_PROFILE_INVALID' }
        $trust = 'WindowsArtifactPublicTrust'
    } else {
        if (@($ekus | Where-Object { $_.StartsWith('1.3.6.1.4.1.311.97.') }).Count -gt 0) { Stop-Verification 'ARTIFACT_PROFILE_INVALID' }
        Confirm-AuthRoot $signer; Confirm-AuthRoot $signature.TimeStamperCertificate; $trust = 'WindowsAuthRootConservative'
    }
    $tool = Get-VerifiedSignTool $SignToolPath
    $null = & $tool verify /pa /all /v /tw $file 2>&1
    if ($LASTEXITCODE -ne 0) { Stop-Verification 'SIGNTOOL_FAILED' }
    if ((Get-Sha256 $lockedFile) -ne $before) { Stop-Verification 'FILE_CHANGED' }
    $facts = [pscustomobject]@{
        signatureVerified = $true; file = [IO.Path]::GetFileName($file); runtime = $pe.Runtime; machine = $pe.Machine
        version = $productVersion; sha256 = $before; bytes = $lockedFile.Length; subject = $signer.Subject
        issuer = $signer.Issuer; certificateThumbprint = $signer.Thumbprint; artifactProfileEku = $ArtifactProfileEku
        publicTrustBasis = $trust; fileDigest = $details.FileDigest; timestampMessageImprintDigest = $details.TimestampMessageImprintDigest; timestampSignatureDigest = $details.TimestampSignatureDigest
        timestampUtc = $details.TimestampUtc; timestampSubject = $signature.TimeStamperCertificate.Subject
        verificationPolicy = 'signtool:/pa,/all,/v,/tw'; signToolVersion = [Diagnostics.FileVersionInfo]::GetVersionInfo($tool).FileVersion
    }
} catch {
    $code = $_.Exception.Message
    if ($code -notin $script:KnownErrors) { $code = 'VERIFICATION_FAILED' }
    [Console]::Error.WriteLine($code)
    if ($null -ne $lockedFile) { $lockedFile.Dispose() }
    exit 1
}
if ($null -ne $lockedFile) { $lockedFile.Dispose() }
$facts
exit 0
