#requires -Version 5.1
# Read-only payload preservation checks. These do not establish Authenticode trust.

function Stop-OfficePePayload { throw [InvalidOperationException]::new('PAYLOAD_CHANGED') }

function Read-OfficePePayloadHeader([IO.Stream]$Stream) {
    $reader = [IO.BinaryReader]::new($Stream,[Text.Encoding]::UTF8,$true)
    try {
        if ($Stream.Length -lt 256 -or $Stream.Length -gt 537919488) { Stop-OfficePePayload }
        $Stream.Position = 0
        if ($reader.ReadUInt16() -ne 0x5a4d) { Stop-OfficePePayload }
        $Stream.Position = 0x3c; $pe = [long]$reader.ReadUInt32()
        if ($pe -lt 64 -or $pe + 24 -gt $Stream.Length) { Stop-OfficePePayload }
        $Stream.Position = $pe
        if ($reader.ReadUInt32() -ne 0x4550) { Stop-OfficePePayload }
        $machine = $reader.ReadUInt16()
        if ($machine -notin @(0xaa64,0x8664)) { Stop-OfficePePayload }
        $Stream.Position = $pe + 20; $optionalLength = $reader.ReadUInt16(); $optional = $pe + 24
        if ($optionalLength -lt 152 -or $optional + $optionalLength -gt $Stream.Length) { Stop-OfficePePayload }
        $Stream.Position = $optional
        if ($reader.ReadUInt16() -ne 0x20b) { Stop-OfficePePayload }
        $Stream.Position = $optional + 108
        if ($reader.ReadUInt32() -lt 5) { Stop-OfficePePayload }
        $security = $optional + 144; $Stream.Position = $security
        $certificateOffset = [long]$reader.ReadUInt32(); $certificateSize = [long]$reader.ReadUInt32()
        return [pscustomobject]@{
            ChecksumOffset = $optional + 64; SecurityDirectoryOffset = $security
            CertificateOffset = $certificateOffset; CertificateSize = $certificateSize
            Machine = ('0x{0:x4}' -f $machine)
        }
    } finally { $reader.Dispose() }
}

function Get-OfficePeNormalizedHash([IO.Stream]$Stream,[long]$Length,[long]$ChecksumOffset,[long]$SecurityDirectoryOffset) {
    if ($Length -lt 256 -or $Length -gt $Stream.Length -or $ChecksumOffset -lt 0 -or $ChecksumOffset + 4 -gt $Length -or $SecurityDirectoryOffset -lt $ChecksumOffset + 4 -or $SecurityDirectoryOffset + 8 -gt $Length) { Stop-OfficePePayload }
    $hash = [Security.Cryptography.SHA256]::Create(); $buffer = [byte[]]::new(65536)
    try {
        $Stream.Position = 0; $offset = [long]0
        $ranges = @(@{ Start = $ChecksumOffset; End = $ChecksumOffset + 4 },@{ Start = $SecurityDirectoryOffset; End = $SecurityDirectoryOffset + 8 })
        while ($offset -lt $Length) {
            $count = [int][Math]::Min([long]$buffer.Length,$Length - $offset)
            $read = $Stream.Read($buffer,0,$count)
            if ($read -le 0) { Stop-OfficePePayload }
            foreach ($range in $ranges) {
                $start = [Math]::Max([long]$range.Start,$offset); $end = [Math]::Min([long]$range.End,$offset + $read)
                if ($end -gt $start) { [Array]::Clear($buffer,[int]($start - $offset),[int]($end - $start)) }
            }
            $null = $hash.TransformBlock($buffer,0,$read,$buffer,0); $offset += $read
        }
        $null = $hash.TransformFinalBlock([byte[]]::new(0),0,0)
        return ([BitConverter]::ToString($hash.Hash)).Replace('-','').ToLowerInvariant()
    } finally { $hash.Dispose() }
}

function Confirm-OfficePeZeroPadding([IO.Stream]$Stream,[long]$Start,[long]$End) {
    if ($Start -lt 0 -or $End -lt $Start -or $End -gt $Stream.Length -or $End - $Start -gt 7) { Stop-OfficePePayload }
    $Stream.Position = $Start
    for ($offset = $Start; $offset -lt $End; $offset++) { if ($Stream.ReadByte() -ne 0) { Stop-OfficePePayload } }
}

function Get-OfficePePayloadSnapshot {
    [CmdletBinding()]
    param([IO.Stream]$Stream)
    $position = $null
    try {
        if ($null -eq $Stream -or -not $Stream.CanRead -or -not $Stream.CanSeek) { Stop-OfficePePayload }
        $position = $Stream.Position
        if ($Stream.Length -gt 536870912) { Stop-OfficePePayload }
        $header = Read-OfficePePayloadHeader $Stream
        if ($header.CertificateOffset -ne 0 -or $header.CertificateSize -ne 0) { Stop-OfficePePayload }
        $hash = Get-OfficePeNormalizedHash $Stream $Stream.Length $header.ChecksumOffset $header.SecurityDirectoryOffset
        return [pscustomobject]@{
            Scheme = 'office-pe-payload-v1'; OriginalBytes = $Stream.Length; OriginalContentSha256 = $hash
            ChecksumOffset = $header.ChecksumOffset; SecurityDirectoryOffset = $header.SecurityDirectoryOffset; Machine = $header.Machine
        }
    } catch { Stop-OfficePePayload }
    finally { if ($null -ne $position) { try { $Stream.Position = $position } catch {} } }
}

function Test-OfficePePayloadPreservation {
    [CmdletBinding()]
    param([IO.Stream]$Stream,$Snapshot)
    $position = $null
    try {
        if ($null -eq $Stream -or -not $Stream.CanRead -or -not $Stream.CanSeek -or $null -eq $Snapshot) { Stop-OfficePePayload }
        $position = $Stream.Position
        foreach ($name in @('Scheme','OriginalBytes','OriginalContentSha256','ChecksumOffset','SecurityDirectoryOffset','Machine')) {
            if ($null -eq $Snapshot.PSObject.Properties[$name]) { Stop-OfficePePayload }
        }
        if ($Snapshot.Scheme -cne 'office-pe-payload-v1' -or $Snapshot.OriginalContentSha256 -notmatch '^[a-f0-9]{64}$') { Stop-OfficePePayload }
        $originalLength = [long]$Snapshot.OriginalBytes
        if ($originalLength -lt 256 -or $originalLength -gt 536870912) { Stop-OfficePePayload }
        $header = Read-OfficePePayloadHeader $Stream
        if ($header.ChecksumOffset -ne $Snapshot.ChecksumOffset -or $header.SecurityDirectoryOffset -ne $Snapshot.SecurityDirectoryOffset -or $header.Machine -cne $Snapshot.Machine) { Stop-OfficePePayload }
        $alignedLength = $originalLength + ((8 - ($originalLength % 8)) % 8)
        if ($header.CertificateOffset -ne $alignedLength -or $header.CertificateSize -lt 16 -or $header.CertificateSize -gt 1048576 -or $header.CertificateOffset + $header.CertificateSize -ne $Stream.Length) { Stop-OfficePePayload }
        Confirm-OfficePeZeroPadding $Stream $originalLength $header.CertificateOffset
        $reader = [IO.BinaryReader]::new($Stream,[Text.Encoding]::UTF8,$true)
        try {
            $Stream.Position = $header.CertificateOffset
            $length = [long]$reader.ReadUInt32(); $revision = $reader.ReadUInt16(); $type = $reader.ReadUInt16()
            if ($length -lt 16 -or $length -gt $header.CertificateSize -or $revision -ne 0x0200 -or $type -ne 2) { Stop-OfficePePayload }
            $alignedCertificateLength = $length + ((8 - ($length % 8)) % 8)
            if ($alignedCertificateLength -ne $header.CertificateSize) { Stop-OfficePePayload }
            Confirm-OfficePeZeroPadding $Stream ($header.CertificateOffset + $length) $Stream.Length
        } finally { $reader.Dispose() }
        $actual = Get-OfficePeNormalizedHash $Stream $originalLength ([long]$Snapshot.ChecksumOffset) ([long]$Snapshot.SecurityDirectoryOffset)
        if ($actual -cne $Snapshot.OriginalContentSha256) { Stop-OfficePePayload }
        return [pscustomobject]@{
            PayloadPreserved = $true; Scheme = 'office-pe-payload-v1'; OriginalBytes = $originalLength
            OriginalContentSha256 = $actual; CertificateOffset = $header.CertificateOffset; CertificateBytes = $header.CertificateSize
        }
    } catch { Stop-OfficePePayload }
    finally { if ($null -ne $position) { try { $Stream.Position = $position } catch {} } }
}
