#requires -Version 5.1
[CmdletBinding()]
param([string]$InputManifest, [string]$Configuration, [string]$OutputDirectory)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2
$script:KnownErrors = @('INVALID_ARGUMENT','PATH_INVALID','REPARSE_PATH','MANIFEST_INVALID','INSPECTION_ONLY','VERSION_NOT_INCREMENTED','FORMAL_BUILD_REQUIRED','BUILD_METADATA_INVALID','INPUT_CHANGED','PAYLOAD_CHANGED','OUTPUT_NOT_EMPTY','OUTPUT_LOCATION_INVALID','CONFIGURATION_INVALID','SIGNTOOL_UNAVAILABLE','SIGNTOOL_UNTRUSTED','DLIB_UNTRUSTED','TOOL_ARCHITECTURE_MISMATCH','CERTIFICATE_UNAVAILABLE','CERTIFICATE_INVALID','PUBLIC_TRUST_UNCONFIRMED','AZURE_CLI_UNAVAILABLE','AZURE_CONTEXT_MISMATCH','SIGNING_FAILED','SIGNATURE_VERIFICATION_FAILED','RELEASE_PREPARATION_FAILED')

function Stop-Signing([string]$Code) { throw [InvalidOperationException]::new($Code) }
function Get-Property($Object, [string]$Name) {
    if ($null -eq $Object -or $null -eq $Object.PSObject.Properties[$Name]) { Stop-Signing 'MANIFEST_INVALID' }
    return $Object.PSObject.Properties[$Name].Value
}
function Get-OptionalProperty($Object, [string]$Name) {
    if ($null -eq $Object -or $null -eq $Object.PSObject.Properties[$Name]) { return $null }
    return $Object.PSObject.Properties[$Name].Value
}
function Confirm-NoReparse([string]$Value) {
    $full = [IO.Path]::GetFullPath($Value); $root = [IO.Path]::GetPathRoot($full)
    if ([IO.DriveInfo]::new($root).DriveType -notin @([IO.DriveType]::Fixed,[IO.DriveType]::Removable,[IO.DriveType]::Ram)) { Stop-Signing 'PATH_INVALID' }
    $current = $root
    foreach ($segment in $full.Substring($root.Length).Split([IO.Path]::DirectorySeparatorChar)) {
        if ($segment.Length -eq 0) { continue }
        $current = [IO.Path]::Combine($current,$segment)
        try { $attributes = [IO.File]::GetAttributes($current) }
        catch [IO.FileNotFoundException] { break }
        catch [IO.DirectoryNotFoundException] { break }
        if (($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { Stop-Signing 'REPARSE_PATH' }
    }
}
function Get-SafeFile([string]$Value) {
    if ([string]::IsNullOrWhiteSpace($Value) -or $Value -notmatch '^[a-zA-Z]:\\' -or $Value.Substring(2).Contains(':')) { Stop-Signing 'PATH_INVALID' }
    $full = [IO.Path]::GetFullPath($Value)
    Confirm-NoReparse $full
    if (-not [IO.File]::Exists($full)) { Stop-Signing 'PATH_INVALID' }
    return $full
}
function Get-Sha256([IO.Stream]$Stream) {
    $position = $Stream.Position; $hash = [Security.Cryptography.SHA256]::Create()
    try { $Stream.Position = 0; return ([BitConverter]::ToString($hash.ComputeHash($Stream))).Replace('-','').ToLowerInvariant() }
    finally { $Stream.Position = $position; $hash.Dispose() }
}
function Read-LockedJson([string]$File, [Collections.Generic.List[IO.Stream]]$Locks) {
    $stream = [IO.File]::Open($File,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read); $Locks.Add($stream)
    if ($stream.Length -lt 2 -or $stream.Length -gt 65536) { Stop-Signing 'MANIFEST_INVALID' }
    $digest = Get-Sha256 $stream
    $reader = [IO.StreamReader]::new($stream,[Text.UTF8Encoding]::new($false,$true),$true,1024,$true)
    try { $stream.Position = 0; $text = $reader.ReadToEnd(); $document = $text | ConvertFrom-Json; $stream.Position = 0 }
    finally { $reader.Dispose() }
    return [pscustomobject]@{ Document = $document; Sha256 = $digest; Stream = $stream }
}
function Get-Semver([string]$Value) {
    if ($Value -notmatch '^(0|[1-9][0-9]{0,4})\.(0|[1-9][0-9]{0,4})\.(0|[1-9][0-9]{0,4})$') { Stop-Signing 'MANIFEST_INVALID' }
    $parts = @($Value.Split('.') | ForEach-Object { [int]$_ })
    if (@($parts | Where-Object { $_ -gt 65535 }).Count -gt 0) { Stop-Signing 'MANIFEST_INVALID' }
    return $parts
}
function Confirm-VersionIncrement([string]$Version, [string]$Published) {
    $new = @(Get-Semver $Version); $old = @(Get-Semver $Published)
    for ($index = 0; $index -lt 3; $index++) {
        if ($new[$index] -gt $old[$index]) { return }
        if ($new[$index] -lt $old[$index]) { Stop-Signing 'VERSION_NOT_INCREMENTED' }
    }
    Stop-Signing 'VERSION_NOT_INCREMENTED'
}
function Get-Ekus([Security.Cryptography.X509Certificates.X509Certificate2]$Certificate) {
    $result = @()
    foreach ($extension in $Certificate.Extensions) {
        if ($extension.Oid.Value -eq '2.5.29.37') {
            $eku = [Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($extension,$extension.Critical)
            foreach ($oid in $eku.EnhancedKeyUsages) { $result += $oid.Value }
        }
    }
    return $result
}
function Get-PeMachine([string]$File) {
    $stream = [IO.File]::Open($File,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
    $reader = [IO.BinaryReader]::new($stream)
    try {
        if ($stream.Length -lt 256 -or $reader.ReadUInt16() -ne 0x5a4d) { Stop-Signing 'BUILD_METADATA_INVALID' }
        $stream.Position = 0x3c; $pe = [long]$reader.ReadUInt32()
        if ($pe -lt 64 -or $pe + 24 -gt $stream.Length) { Stop-Signing 'BUILD_METADATA_INVALID' }
        $stream.Position = $pe
        if ($reader.ReadUInt32() -ne 0x4550) { Stop-Signing 'BUILD_METADATA_INVALID' }
        return ('0x{0:x4}' -f $reader.ReadUInt16())
    } finally { $reader.Dispose(); $stream.Dispose() }
}
function Confirm-Unsigned([string]$File) {
    $stream = [IO.File]::Open($File,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
    $reader = [IO.BinaryReader]::new($stream)
    try {
        $stream.Position = 0x3c; $pe = [long]$reader.ReadUInt32(); $stream.Position = $pe + 20; $optionalLength = $reader.ReadUInt16()
        $optional = $pe + 24; $stream.Position = $optional
        if ($reader.ReadUInt16() -ne 0x20b -or $optionalLength -lt 152 -or $optional + $optionalLength -gt $stream.Length) { Stop-Signing 'BUILD_METADATA_INVALID' }
        $stream.Position = $optional + 108
        if ($reader.ReadUInt32() -lt 5) { Stop-Signing 'BUILD_METADATA_INVALID' }
        $stream.Position = $optional + 144
        if ($reader.ReadUInt32() -ne 0 -or $reader.ReadUInt32() -ne 0) { Stop-Signing 'BUILD_METADATA_INVALID' }
    } finally { $reader.Dispose(); $stream.Dispose() }
}
function Confirm-MicrosoftTool([string]$File, [string]$OriginalName, [string]$Code) {
    $signature = Get-AuthenticodeSignature -LiteralPath $File
    $version = [Diagnostics.FileVersionInfo]::GetVersionInfo($File)
    if ($signature.Status.ToString() -ne 'Valid' -or $signature.SignatureType.ToString() -ne 'Authenticode' -or $null -eq $signature.SignerCertificate -or $signature.SignerCertificate.Subject -notmatch '(^|,\s*)O=Microsoft Corporation(,|$)' -or $signature.SignerCertificate.Subject -notmatch '(^|,\s*)CN=Microsoft (Corporation|Windows)(,|$)' -or '1.3.6.1.5.5.7.3.3' -notin @(Get-Ekus $signature.SignerCertificate) -or [IO.Path]::GetFileName($File) -ine $OriginalName -or $version.OriginalFilename -ine $OriginalName) { Stop-Signing $Code }
}
function Confirm-PublicStoreCertificate([Security.Cryptography.X509Certificates.X509Certificate2]$Certificate) {
    $chain = [Security.Cryptography.X509Certificates.X509Chain]::new()
    $store = [Security.Cryptography.X509Certificates.X509Store]::new('AuthRoot',[Security.Cryptography.X509Certificates.StoreLocation]::LocalMachine)
    try {
        $chain.ChainPolicy.VerificationFlags = [Security.Cryptography.X509Certificates.X509VerificationFlags]::IgnoreNotTimeValid
        $chain.ChainPolicy.RevocationMode = [Security.Cryptography.X509Certificates.X509RevocationMode]::NoCheck
        $null = $chain.Build($Certificate)
        if ($chain.ChainElements.Count -lt 2) { Stop-Signing 'PUBLIC_TRUST_UNCONFIRMED' }
        $root = $chain.ChainElements[$chain.ChainElements.Count - 1].Certificate
        $store.Open([Security.Cryptography.X509Certificates.OpenFlags]::ReadOnly)
        $matches = $store.Certificates.Find([Security.Cryptography.X509Certificates.X509FindType]::FindByThumbprint,$root.Thumbprint,$false)
        if ($root.Subject -ne $root.Issuer -or $matches.Count -ne 1) { Stop-Signing 'PUBLIC_TRUST_UNCONFIRMED' }
    } finally { $store.Close(); $chain.Dispose() }
}
function Get-AzureCliContext([string]$Cli, [string]$Tenant, [string]$Subscription) {
    $raw = & $Cli account show --output json --only-show-errors 2>&1
    if ($LASTEXITCODE -ne 0) { Stop-Signing 'AZURE_CONTEXT_MISMATCH' }
    try { $context = ($raw -join [Environment]::NewLine) | ConvertFrom-Json }
    catch { Stop-Signing 'AZURE_CONTEXT_MISMATCH' }
    if ((Get-OptionalProperty $context 'tenantId') -ine $Tenant -or (Get-OptionalProperty $context 'id') -ine $Subscription) { Stop-Signing 'AZURE_CONTEXT_MISMATCH' }
}
function Confirm-InputUnchanged($Inputs, $ManifestRecord, $BuildRecords) {
    if ((Get-Sha256 $ManifestRecord.Stream) -ne $ManifestRecord.Sha256) { Stop-Signing 'INPUT_CHANGED' }
    foreach ($inputFile in $Inputs) { if ($inputFile.Stream.Length -ne $inputFile.Bytes -or (Get-Sha256 $inputFile.Stream) -ne $inputFile.UnsignedSha256) { Stop-Signing 'INPUT_CHANGED' } }
    foreach ($build in $BuildRecords) { if ((Get-Sha256 $build.Stream) -ne $build.Sha256) { Stop-Signing 'INPUT_CHANGED' } }
}

$locks = [Collections.Generic.List[IO.Stream]]::new()
$inputs = @(); $buildRecords = @(); $manifestRecord = $null; $outputCreated = $false
try {
    if ([string]::IsNullOrWhiteSpace($InputManifest) -or [string]::IsNullOrWhiteSpace($Configuration) -or [string]::IsNullOrWhiteSpace($OutputDirectory)) { Stop-Signing 'INVALID_ARGUMENT' }
    $manifestPath = Get-SafeFile $InputManifest; $configurationPath = Get-SafeFile $Configuration
    $manifestRecord = Read-LockedJson $manifestPath $locks; $manifest = $manifestRecord.Document
    if ((Get-Property $manifest 'schemaVersion') -isnot [int] -or (Get-Property $manifest 'schemaVersion') -ne 1 -or (Get-Property $manifest 'kind') -cne 'office-signing-input') { Stop-Signing 'MANIFEST_INVALID' }
    $inspection = Get-Property $manifest 'inspectionOnly'
    if ($inspection -isnot [bool]) { Stop-Signing 'MANIFEST_INVALID' }
    if ($inspection) { Stop-Signing 'INSPECTION_ONLY' }
    $formal = Get-Property $manifest 'formalBuildMetadataChecked'
    if ($formal -isnot [bool] -or -not $formal) { Stop-Signing 'FORMAL_BUILD_REQUIRED' }
    $version = Get-Property $manifest 'version'; $published = Get-Property $manifest 'publishedVersion'
    Confirm-VersionIncrement $version $published
    $commit = Get-Property $manifest 'sourceCommit'; $runner = Get-Property $manifest 'runnerSha256'
    if ($commit -isnot [string] -or $commit -notmatch '^[a-fA-F0-9]{40}$' -or $runner -isnot [string] -or $runner -notmatch '^[a-fA-F0-9]{64}$') { Stop-Signing 'MANIFEST_INVALID' }
    $entries = @(Get-Property $manifest 'files')
    if ($entries.Count -ne 2) { Stop-Signing 'MANIFEST_INVALID' }
    $payloadHelper = Get-SafeFile ([IO.Path]::Combine($PSScriptRoot,'OfficePePayload.ps1'))
    . $payloadHelper
    $inputDirectory = [IO.Path]::GetDirectoryName($manifestPath); $runtimes = @()
    foreach ($entry in $entries) {
        $runtime = Get-Property $entry 'runtime'
        if ($runtime -notin @('win-arm64','win-x64') -or $runtime -in $runtimes) { Stop-Signing 'MANIFEST_INVALID' }
        $runtimes += $runtime
        $name = Get-Property $entry 'name'; $machine = Get-Property $entry 'machine'
        $expectedName = if ($runtime -eq 'win-arm64') { 'ChinaTech-Office-Assistant-ARM64.exe' } else { 'ChinaTech-Office-Assistant-x64.exe' }
        $expectedMachine = if ($runtime -eq 'win-arm64') { '0xaa64' } else { '0x8664' }
        $hash = Get-Property $entry 'unsignedSha256'; $bytes = Get-Property $entry 'bytes'
        if ($name -cne $expectedName -or $machine -cne $expectedMachine -or $hash -isnot [string] -or $hash -notmatch '^[a-fA-F0-9]{64}$' -or $bytes -isnot [ValueType] -or $bytes -is [bool] -or [decimal]$bytes -ne [Math]::Floor([decimal]$bytes) -or $bytes -lt 256 -or $bytes -gt 536870912) { Stop-Signing 'MANIFEST_INVALID' }
        $file = Get-SafeFile ([IO.Path]::Combine($inputDirectory,$name))
        $stream = [IO.File]::Open($file,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read); $locks.Add($stream)
        if ($stream.Length -ne $bytes -or (Get-Sha256 $stream) -ine $hash -or (Get-PeMachine $file) -cne $machine) { Stop-Signing 'INPUT_CHANGED' }
        Confirm-Unsigned $file
        $payloadSnapshot = Get-OfficePePayloadSnapshot -Stream $stream
        $versionInfo = [Diagnostics.FileVersionInfo]::GetVersionInfo($file); $fileVersion = $versionInfo.ProductVersion
        if ($null -eq $fileVersion -or $fileVersion -notmatch ('^' + [Regex]::Escape($version) + '(\+[a-zA-Z0-9.-]+)?$') -or $versionInfo.ProductName -cne 'ChinaTech.OfficeAssistant' -or $versionInfo.OriginalFilename -cne 'ChinaTech.OfficeAssistant.dll') { Stop-Signing 'BUILD_METADATA_INVALID' }
        $buildName = Get-Property $entry 'buildManifestName'; $buildHash = Get-Property $entry 'buildManifestSha256'
        if ($buildName -cne ($runtime + '.build.json') -or $buildHash -isnot [string] -or $buildHash -notmatch '^[a-fA-F0-9]{64}$') { Stop-Signing 'BUILD_METADATA_INVALID' }
        $build = Read-LockedJson (Get-SafeFile ([IO.Path]::Combine($inputDirectory,$buildName))) $locks; $buildRecords += $build
        if ($build.Sha256 -ine $buildHash) { Stop-Signing 'BUILD_METADATA_INVALID' }
        $metadata = $build.Document; $development = Get-Property $metadata 'development'
        if ($development -isnot [bool] -or $development -or (Get-Property $metadata 'server') -cne 'https://www.chinatech.in/' -or (Get-Property $metadata 'version') -cne $version -or (Get-Property $metadata 'runtime') -cne $runtime -or (Get-Property $metadata 'runnerSha256') -ine $runner -or (Get-Property $metadata 'exeSha256') -ine $hash -or (Get-Property $metadata 'bytes') -ne $bytes) { Stop-Signing 'BUILD_METADATA_INVALID' }
        $inputs += [pscustomobject]@{ Runtime = $runtime; Name = $name; Machine = $machine; UnsignedSha256 = $hash.ToLowerInvariant(); Bytes = [long]$bytes; Stream = $stream; PayloadSnapshot = $payloadSnapshot }
    }
    $configurationRecord = Read-LockedJson $configurationPath $locks; $config = $configurationRecord.Document
    $mode = Get-OptionalProperty $config 'mode'; $subject = Get-OptionalProperty $config 'expectedSubject'; $timestampUrl = Get-OptionalProperty $config 'timestampUrl'
    if ($mode -cnotin @('store','artifact') -or $subject -isnot [string] -or [string]::IsNullOrWhiteSpace($subject) -or $timestampUrl -isnot [string]) { Stop-Signing 'CONFIGURATION_INVALID' }
    $timestamp = $null
    if (-not [Uri]::TryCreate($timestampUrl,[UriKind]::Absolute,[ref]$timestamp) -or $timestamp.Scheme -notin @('https','http') -or [string]::IsNullOrWhiteSpace($timestamp.Host) -or $timestamp.UserInfo -or $timestamp.Query -or $timestamp.Fragment) { Stop-Signing 'CONFIGURATION_INVALID' }
    $toolPath = Get-OptionalProperty $config 'signToolPath'
    if ([string]::IsNullOrWhiteSpace($toolPath)) { Stop-Signing 'SIGNTOOL_UNAVAILABLE' }
    $tool = Get-SafeFile $toolPath; Confirm-MicrosoftTool $tool 'signtool.exe' 'SIGNTOOL_UNTRUSTED'
    $thumbprint = $null; $storeLocation = $null; $profileEku = $null; $dlib = $null; $cli = $null; $serviceMetadata = $null
    if ($mode -eq 'store') {
        $thumbprint = Get-OptionalProperty $config 'certificateThumbprint'; $storeLocation = Get-OptionalProperty $config 'storeLocation'
        if ($thumbprint -isnot [string] -or $thumbprint -notmatch '^[a-fA-F0-9]{40}$' -or $storeLocation -cnotin @('CurrentUser','LocalMachine')) { Stop-Signing 'CONFIGURATION_INVALID' }
        $certificate = Get-Item -LiteralPath ('Cert:\' + $storeLocation + '\My\' + $thumbprint) -ErrorAction SilentlyContinue
        if ($null -eq $certificate) { Stop-Signing 'CERTIFICATE_UNAVAILABLE' }
        $ekus = @(Get-Ekus $certificate); $now = [DateTime]::UtcNow
        if (-not $certificate.HasPrivateKey -or -not [string]::Equals($certificate.Subject,$subject,[StringComparison]::Ordinal) -or $certificate.Subject -eq $certificate.Issuer -or '1.3.6.1.5.5.7.3.3' -notin $ekus -or $now -lt $certificate.NotBefore.ToUniversalTime() -or $now -gt $certificate.NotAfter.ToUniversalTime() -or @($ekus | Where-Object { $_.StartsWith('1.3.6.1.4.1.311.97.') }).Count -gt 0) { Stop-Signing 'CERTIFICATE_INVALID' }
        Confirm-PublicStoreCertificate $certificate
    } else {
        if (Get-OptionalProperty $config 'certificateThumbprint') { Stop-Signing 'CONFIGURATION_INVALID' }
        $endpointText = Get-OptionalProperty $config 'endpoint'; $endpoint = $null
        $account = Get-OptionalProperty $config 'accountName'; $profile = Get-OptionalProperty $config 'profileName'; $profileEku = Get-OptionalProperty $config 'profileEku'
        $tenant = Get-OptionalProperty $config 'tenantId'; $subscription = Get-OptionalProperty $config 'subscriptionId'; $guid = [Guid]::Empty
        $regions = @('brs','cus','eus','jpe','krc','ncus','neu','plc','scus','swn','wcus','weu','wus','wus2','wus3')
        if ($endpointText -isnot [string] -or -not [Uri]::TryCreate($endpointText,[UriKind]::Absolute,[ref]$endpoint) -or $endpoint.Scheme -ne 'https' -or $endpoint.UserInfo -or $endpoint.Query -or $endpoint.Fragment -or $endpoint.AbsolutePath -ne '/' -or $endpoint.Port -ne 443 -or $endpoint.Host -notmatch '^([a-z0-9]+)\.codesigning\.azure\.net$' -or $Matches[1] -notin $regions) { Stop-Signing 'CONFIGURATION_INVALID' }
        if ($account -isnot [string] -or $account -notmatch '^[a-zA-Z][a-zA-Z0-9-]{1,22}[a-zA-Z0-9]$' -or $account.Contains('--') -or $profile -isnot [string] -or $profile -notmatch '^[a-zA-Z][a-zA-Z0-9-]{3,98}[a-zA-Z0-9]$' -or $profile.Contains('--') -or $profileEku -isnot [string] -or $profileEku -notmatch '^1\.3\.6\.1\.4\.1\.311\.97\.[0-9]+(\.[0-9]+)+$' -or $profileEku -eq '1.3.6.1.4.1.311.97.1.0' -or $profileEku.StartsWith('1.3.6.1.4.1.311.97.1.3.1.') -or $profileEku.StartsWith('1.3.6.1.4.1.311.97.1.4.1.') -or -not [Guid]::TryParseExact($tenant,'D',[ref]$guid) -or -not [Guid]::TryParseExact($subscription,'D',[ref]$guid)) { Stop-Signing 'CONFIGURATION_INVALID' }
        $dlib = Get-SafeFile (Get-OptionalProperty $config 'dlibPath'); Confirm-MicrosoftTool $dlib 'Azure.CodeSigning.Dlib.dll' 'DLIB_UNTRUSTED'
        $toolMachine = Get-PeMachine $tool
        if ($toolMachine -notin @('0x014c','0x8664') -or (Get-PeMachine $dlib) -ne $toolMachine) { Stop-Signing 'TOOL_ARCHITECTURE_MISMATCH' }
        $cliCommand = Get-Command az -CommandType Application -ErrorAction SilentlyContinue
        if ($null -eq $cliCommand) { $cliCommand = Get-Command az.cmd -CommandType Application -ErrorAction SilentlyContinue }
        if ($null -eq $cliCommand) { Stop-Signing 'AZURE_CLI_UNAVAILABLE' }
        $cli = Get-SafeFile $cliCommand.Source; Get-AzureCliContext $cli $tenant $subscription
        $serviceMetadata = [ordered]@{
            Endpoint = $endpoint.GetLeftPart([UriPartial]::Authority); CodeSigningAccountName = $account; CertificateProfileName = $profile
            ExcludeCredentials = @('EnvironmentCredential','WorkloadIdentityCredential','ManagedIdentityCredential','SharedTokenCacheCredential','VisualStudioCredential','VisualStudioCodeCredential','AzurePowerShellCredential','AzureDeveloperCliCredential','InteractiveBrowserCredential')
        }
    }
    if ($OutputDirectory -notmatch '^[a-zA-Z]:\\' -or $OutputDirectory.Substring(2).Contains(':')) { Stop-Signing 'OUTPUT_LOCATION_INVALID' }
    if ([IO.Path]::GetFullPath($OutputDirectory) -eq [IO.Path]::GetPathRoot([IO.Path]::GetFullPath($OutputDirectory))) { Stop-Signing 'OUTPUT_LOCATION_INVALID' }
    $output = [IO.Path]::GetFullPath($OutputDirectory).TrimEnd([IO.Path]::DirectorySeparatorChar,[IO.Path]::AltDirectorySeparatorChar)
    Confirm-NoReparse $output
    $inputPrefix = $inputDirectory.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    if ($output.Equals($inputDirectory,[StringComparison]::OrdinalIgnoreCase) -or $output.StartsWith($inputPrefix,[StringComparison]::OrdinalIgnoreCase) -or [IO.File]::Exists($output)) { Stop-Signing 'OUTPUT_LOCATION_INVALID' }
    if ([IO.Directory]::Exists($output) -and [IO.Directory]::EnumerateFileSystemEntries($output).GetEnumerator().MoveNext()) { Stop-Signing 'OUTPUT_NOT_EMPTY' }
    $verifier = Get-SafeFile ([IO.Path]::Combine($PSScriptRoot,'Test-OfficeAuthenticode.ps1'))
    Confirm-InputUnchanged $inputs $manifestRecord $buildRecords
    $null = [IO.Directory]::CreateDirectory($output); $outputCreated = $true; Confirm-NoReparse $output
    $metadataPath = $null
    if ($mode -eq 'artifact') {
        $metadataPath = [IO.Path]::Combine($output,'artifact-metadata.json')
        $metadataFile = [IO.File]::Open($metadataPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
        $writer = [IO.StreamWriter]::new($metadataFile,[Text.UTF8Encoding]::new($false))
        try { $writer.Write(($serviceMetadata | ConvertTo-Json -Depth 6)) } finally { $writer.Dispose(); $metadataFile.Dispose() }
    }
    $results = @()
    foreach ($inputFile in $inputs) {
        Confirm-InputUnchanged $inputs $manifestRecord $buildRecords
        if ($mode -eq 'artifact') { Get-AzureCliContext $cli $tenant $subscription }
        $destination = [IO.Path]::Combine($output,$inputFile.Name)
        $copy = [IO.File]::Open($destination,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
        try { $inputFile.Stream.Position = 0; $inputFile.Stream.CopyTo($copy); $copy.Flush($true) } finally { $copy.Dispose() }
        $copyRead = [IO.File]::Open($destination,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
        try { if ($copyRead.Length -ne $inputFile.Bytes -or (Get-Sha256 $copyRead) -ne $inputFile.UnsignedSha256) { Stop-Signing 'INPUT_CHANGED' } } finally { $copyRead.Dispose() }
        $arguments = @('sign','/v','/fd','SHA256','/tr',$timestampUrl,'/td','SHA256')
        if ($mode -eq 'store') {
            $arguments += @('/s','My','/sha1',$thumbprint)
            if ($storeLocation -eq 'LocalMachine') { $arguments += '/sm' }
        } else { $arguments += @('/dlib',$dlib,'/dmdf',$metadataPath) }
        $arguments += $destination
        $null = & $tool @arguments 2>&1
        if ($LASTEXITCODE -ne 0) { Stop-Signing 'SIGNING_FAILED' }
        $signed = [IO.File]::Open($destination,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read); $locks.Add($signed)
        $preservation = Test-OfficePePayloadPreservation -Stream $signed -Snapshot $inputFile.PayloadSnapshot
        $parameters = @{ Path = $destination; ExpectedSubject = $subject; SignToolPath = $tool; ExpectedVersion = $version; ExpectedRuntime = $inputFile.Runtime }
        if ($mode -eq 'store') { $parameters.ExpectedThumbprint = $thumbprint } else { $parameters.ArtifactProfileEku = $profileEku }
        $verified = @(& $verifier @parameters)
        if ($LASTEXITCODE -ne 0 -or $verified.Count -ne 1 -or (Get-OptionalProperty $verified[0] 'signatureVerified') -ne $true) { Stop-Signing 'SIGNATURE_VERIFICATION_FAILED' }
        $finalHash = Get-Sha256 $signed
        if ($verified[0].sha256 -ne $finalHash -or $verified[0].bytes -ne $signed.Length) { Stop-Signing 'SIGNATURE_VERIFICATION_FAILED' }
        $results += [ordered]@{ runtime = $inputFile.Runtime; name = $inputFile.Name; machine = $inputFile.Machine; unsignedSha256 = $inputFile.UnsignedSha256; signedSha256 = $finalHash; bytes = $signed.Length; originalContentSha256 = $preservation.OriginalContentSha256; payloadPreservationScheme = $preservation.Scheme; authenticode = $verified[0] }
    }
    Confirm-InputUnchanged $inputs $manifestRecord $buildRecords
    if ((Get-Sha256 $configurationRecord.Stream) -ne $configurationRecord.Sha256) { Stop-Signing 'INPUT_CHANGED' }
    if ($mode -eq 'artifact') { Get-AzureCliContext $cli $tenant $subscription }
    if ($results.Count -ne 2) { Stop-Signing 'SIGNATURE_VERIFICATION_FAILED' }
    $record = [ordered]@{
        schemaVersion = 1; kind = 'office-signature-verification'; version = $version; publishedVersion = $published
        sourceCommit = $commit.ToLowerInvariant(); runnerSha256 = $runner.ToLowerInvariant(); inputManifestSha256 = $manifestRecord.Sha256
        signingMode = $mode; expectedSubject = $subject; verifiedAt = [DateTime]::UtcNow.ToString('o')
        releaseReady = $false; requiresAcceptance = $true; files = $results
    }
    $recordPath = [IO.Path]::Combine($output,'signature-verified.json')
    $temporaryRecord = [IO.Path]::Combine($output,('.signature-verification.' + [Guid]::NewGuid().ToString('N') + '.tmp'))
    $recordFile = [IO.File]::Open($temporaryRecord,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    $writer = [IO.StreamWriter]::new($recordFile,[Text.UTF8Encoding]::new($false))
    try { $writer.Write(($record | ConvertTo-Json -Depth 10)); $writer.Flush(); $recordFile.Flush($true) } finally { $writer.Dispose(); $recordFile.Dispose() }
    [IO.File]::Move($temporaryRecord,$recordPath)
    $facts = [pscustomobject]@{ signatureVerified = $true; version = $version; files = $results; releaseReady = $false; requiresAcceptance = $true }
} catch {
    $code = $_.Exception.Message
    if ($null -ne $manifestRecord -and $inputs.Count -gt 0) {
        try { Confirm-InputUnchanged $inputs $manifestRecord $buildRecords } catch { $code = 'INPUT_CHANGED' }
    }
    if ($code -notin $script:KnownErrors) { $code = 'RELEASE_PREPARATION_FAILED' }
    [Console]::Error.WriteLine($code)
    foreach ($stream in $locks) { $stream.Dispose() }
    exit 1
}
foreach ($stream in $locks) { $stream.Dispose() }
$facts
exit 0
