param([string]$Root=(Get-Location).Path)
$ErrorActionPreference='Stop';Set-StrictMode -Version 2
$errors=$null;$tokens=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $Root 'server-assets/office-desktop/runner.ps1.txt'),[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'Runner syntax invalid'}
foreach($name in @('Fail','SuiteProducts','NewOfficeConfiguration','MicrosoftSigned','LicenseStatus','PendingRestart','RunSetup','Prepare','VerifyRetainedProducts')){$fn=$ast.Find({param($a)$a -is [Management.Automation.Language.FunctionDefinitionAst] -and $a.Name -eq $name},$true);Invoke-Expression $fn.Extent.Text}
function Assert($ok,$name){if(-not $ok){throw $name};$script:checks++}
$script:checks=0
$ids=@('ProPlus2024Volume','O365HomePremRetail','VisioPro2024Volume','ProjectPro2024Volume')
Assert ((@(SuiteProducts $ids) -join ',') -eq 'ProPlus2024Volume,O365HomePremRetail') 'Visio/Project excluded from suite removal'
$JobDirectory=Join-Path $Root '.local/office-desktop/proof/runner-config';New-Item $JobDirectory -ItemType Directory -Force|Out-Null
$job=@{language='it'}
[xml]$config=Get-Content (NewOfficeConfiguration 'install.xml' -Install)
Assert ($config.Configuration.Add.OfficeClientEdition -eq '64') '64-bit target'
Assert ($config.Configuration.Add.AllowCdnFallback -eq 'FALSE') 'Prepared media required'
Assert ($config.Configuration.Add.Product.ID -eq 'ProPlus2024Volume') 'Specific SKU'
Assert (($config.Configuration.Add.Product.ExcludeApp.ID -join ',') -eq 'Lync,Groove,Teams') 'Intentional app exclusions'
Assert ($config.Configuration.Property.Value -eq 'FALSE') 'Do not force close Office'
Assert ($config.Configuration.Add.Product.Language.ID -eq 'it-it') 'Requested language'
[xml]$remove=Get-Content (NewOfficeConfiguration 'remove.xml' -RemoveIds @(SuiteProducts $ids));Assert (@($remove.Configuration.Remove.Product).Count -eq 2) 'Only detected suites removed'
$msi=$ast.Find({param($a)$a -is [Management.Automation.Language.AssignmentStatementAst] -and $a.Left.Extent.Text -eq '$msi'},$true)
$filter=$msi.Find({param($a)$a -is [Management.Automation.Language.CommandAst] -and $a.GetCommandName() -eq 'Where-Object'},$true).CommandElements[1].ScriptBlock.Extent.Text
$predicate=[scriptblock]::Create($filter.Substring(1,$filter.Length-2))
$records=@('Microsoft Office Professional Plus 2016','Microsoft Visio Professional 2016','Microsoft Project Professional 2016')|ForEach-Object{[pscustomobject]@{DisplayName=$_;WindowsInstaller=1}}
Assert (@($records|Where-Object $predicate).Count -eq 3) 'All conflicting MSI suites detected'
$script:certificate=@{Status='Valid';SignerCertificate=@{Subject='CN=Microsoft Corporation, O=Microsoft Corporation, C=US'}}
function Get-AuthenticodeSignature{param($LiteralPath) return $script:certificate}
MicrosoftSigned 'synthetic';$script:checks++
foreach($subject in @('CN=Third Party, O=Microsoft Corporation','CN=Microsoft Corporation, O=Third Party')){$certificate.SignerCertificate.Subject=$subject;try{MicrosoftSigned 'synthetic';throw 'Bad signature accepted'}catch{Assert ($_.Exception.Message -eq 'SOURCE_INVALID') 'Only Microsoft publisher accepted'}}
$script:records=@([pscustomobject]@{Name='Office 24, Office24ProPlus2024VL_KMS_Client_AE edition';PartialProductKey='TEST';LicenseStatus=0},[pscustomobject]@{Name='Office 24, Office24VisioPro2024VL edition';PartialProductKey='TEST';LicenseStatus=0})
$script:activated=@()
function Get-CimInstance{param($ClassName,$Filter,$ErrorAction) return $script:records}
function Invoke-CimMethod{param($InputObject,$MethodName,$ErrorAction) $script:activated+=,$InputObject.Name;$InputObject.LicenseStatus=1;return @{ReturnValue=0}}
Assert (-not (LicenseStatus)) 'Unlicensed is not success'
Assert (LicenseStatus -Activate) 'Existing target activation reread'
Assert ($activated.Count -eq 1 -and $activated[0] -match 'ProPlus2024VL') 'Visio license untouched'
$script:records=@([pscustomobject]@{Name='Office 24, Office24ProPlus2024VL_KMS_Client_AE edition';PartialProductKey=$null;LicenseStatus=0});Assert (-not (LicenseStatus)) 'Known unlicensed SKU without a key is unlicensed';try{LicenseStatus -Activate;throw 'Missing key accepted'}catch{Assert ($_.Exception.Message -eq 'LICENSE_REQUIRED') 'Installed key required for activation'}
$script:records=@();try{LicenseStatus;throw 'Missing status accepted'}catch{Assert ($_.Exception.Message -eq 'LICENSE_CHECK_FAILED') 'Unknown status is explicit'}
$certificate.SignerCertificate.Subject='CN=Microsoft Corporation, O=Microsoft Corporation, C=US'
$script:fake=[pscustomobject]@{HasExited=$false;ExitCode=1};$script:waited=$false;$script:disposed=$false
$fake|Add-Member ScriptMethod WaitForExit {param($milliseconds)if($null -ne $milliseconds){throw [IO.IOException]::new('Synthetic wait failure')};$this.HasExited=$true;$script:waited=$true}
$fake|Add-Member ScriptMethod Dispose {$script:disposed=$true}
function Start-Process{param($FilePath,$ArgumentList,[switch]$PassThru) return $script:fake}
$setup='synthetic';$script:result=@{exitCode=$null}
try{RunSetup '/download' 'synthetic.xml';throw 'Expected failure'}catch{Assert ($_.Exception.GetBaseException().Message -match 'Synthetic wait failure') 'Wait error preserved'}
Assert ($waited -and $disposed -and $fake.HasExited) 'Child must finish before failed runner returns'

# Exercise the actual Prepare function with harmless download/extraction doubles.
$script:cancelSignal=$false;$script:officeDownloads=0;$script:extractions=0
function Event {param($Stage,$Code='RUNNING')}
function CheckCancel {if($script:cancelSignal){Fail 'CANCELLED'}}
function New-Object {param($TypeName,$ArgumentList) if($TypeName -like 'IO.DriveInfo*'){return @{AvailableFreeSpace=21474836480}};Microsoft.PowerShell.Utility\New-Object @PSBoundParameters}
function Invoke-WebRequest {param([switch]$UseBasicParsing,$MaximumRedirection,$Uri,$OutFile,$TimeoutSec) [IO.File]::WriteAllBytes($OutFile,(New-Object byte[] 32));if($script:cancelAt -eq 'odt-download'){$script:cancelSignal=$true}}
function Start-Process {param($FilePath,$ArgumentList,[switch]$PassThru,[switch]$Wait) $script:extractions++;if($script:cancelAt -eq 'extract'){$script:cancelSignal=$true};$p=[pscustomobject]@{ExitCode=0};$p|Add-Member ScriptMethod Dispose {};return $p}
function RunSetup {param($Mode,$Config) $script:officeDownloads++;throw 'Unexpected next download'}
foreach($step in @('odt-download','extract')){
 $script:cancelAt=$step;$script:cancelSignal=$false;$script:officeDownloads=0;$script:extractions=0
 try{Prepare;throw 'Cancellation not honored'}catch{Assert ($_.Exception.Message -eq 'CANCELLED') ('Cancel during '+$step+' stops at boundary')}
 Assert ($script:officeDownloads -eq 0) ('Cancel during '+$step+' must not start Office download')
 Assert ($script:extractions -eq $(if($step -eq 'extract'){1}else{0})) ('No unnecessary next preparation step after '+$step)
}
$script:retainedProducts=@('VisioPro2024Volume','ProjectPro2024Volume');$script:retainedFiles=@();$script:productRows=@('ProPlus2024Volume','VisioPro2024Volume','ProjectPro2024Volume')
function Products {return $script:productRows}
VerifyRetainedProducts;$script:checks++
$script:productRows=@('ProPlus2024Volume','ProjectPro2024Volume')
try{VerifyRetainedProducts;throw 'Lost Visio accepted'}catch{Assert ($_.Exception.Message -eq 'PRESERVATION_VERIFY_FAILED') 'Retained product loss stops further steps'}
$script:productRows=@('VisioPro2024Volume','ProjectPro2024Volume');$script:retainedFiles=@((Join-Path $JobDirectory 'missing-retained-application.exe'))
try{VerifyRetainedProducts;throw 'Lost application accepted'}catch{Assert ($_.Exception.Message -eq 'PRESERVATION_VERIFY_FAILED') 'Retained application loss is explicit'}

Write-Output ('Runner checks passed: '+$checks+'; AST-derived functions and synthetic fixtures; no Office execution.')
