param([switch]$LibraryOnly)
$ErrorActionPreference='Stop'
if (-not ('CTDiagnosticStderr' -as [type])) {
    Add-Type -TypeDefinition ([IO.File]::ReadAllText((Join-Path $PSScriptRoot 'windows-toolbox.stderr.cs'))) -ReferencedAssemblies System.dll,System.Core.dll,System.Xml.dll
}
if (-not $LibraryOnly) {
    $open='#< CLIXML'+"`n"+'<Objs Version="1.1.0.1" xmlns="http://schemas.microsoft.com/powershell/2004/04">'
    $close='</Objs>'
    $cases=@(
        @('', $true),
        @(($open+$close), $true),
        @(($open+'<Obj S="progress"><MS><S N="Activity">public fixture</S></MS></Obj>'+$close),$true),
        @(($open+'<S S="Error">must not be ignored</S>'+$close),$false),
        @(($open+'<Obj S="warning" />'+$close),$false),
        @(($open+'<Obj />'+$close),$false),
        @(($open+'<Obj S="progress"><Obj S="Error" /></Obj>'+$close),$false),
        @(($open+'<Obj S="unknown" />'+$close),$false),
        @($open,$false),
        @(('#< CLIXML'+"`n"+'<Other />'),$false),
        @('plain stderr must fail',$false),
        @(('#< CLIXML'+"`n"+'<!DOCTYPE Objs [<!ENTITY x "forbidden">]><Objs Version="1.1.0.1" xmlns="http://schemas.microsoft.com/powershell/2004/04">&x;</Objs>'),$false)
    )
    $stderrCases=0
    foreach ($case in $cases) {
        if ([CTDiagnosticStderr]::Inspect([string]$case[0]).Allowed -ne [bool]$case[1]) { throw ('diagnostic stderr parser case '+$stderrCases+' failed') }
        $stderrCases++
    }
    Write-Output ($stderrCases.ToString()+' pure diagnostic stderr parser checks passed; no stream message bodies printed')
}
