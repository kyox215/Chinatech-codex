#!/usr/bin/env python3
"""Build inside the current project. Never emits signing keys or private license data."""
import argparse,hashlib,json,os,pathlib,subprocess,xml.etree.ElementTree as ET
root=pathlib.Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--dotnet',default=str(root/'.local/office-desktop/toolchain/dotnet/dotnet'));p.add_argument('--rid',choices=['win-x64','win-arm64'],default='win-x64');p.add_argument('--development-server');a=p.parse_args()
server=a.development_server or 'https://www.chinatech.in/'
if a.development_server:
 from urllib.parse import urlparse
 u=urlparse(server);assert u.scheme=='http' and u.hostname in ('127.0.0.1','localhost') and u.path=='/' and not u.query and not u.fragment and not u.username and u.port,'Only an explicit loopback test origin is allowed'
runner=root/'server-assets/office-desktop/runner.ps1.txt';digest=hashlib.sha256(runner.read_bytes()).hexdigest()
(root/'desktop/office-assistant/Client/Fingerprint.cs').write_text('namespace ChinaTech.OfficeAssistant;\npublic static class Fingerprint { public const string RunnerSha256="'+digest+'"; public const string Server="'+server+'"; public const bool Development='+str(bool(a.development_server)).lower()+'; }\n')
env=os.environ.copy();env['DOTNET_CLI_HOME']=str(root/'.local/office-desktop/dotnet-home');env['NUGET_PACKAGES']=str(root/'.local/office-desktop/nuget');env['DOTNET_SKIP_FIRST_TIME_EXPERIENCE']='1';env['DOTNET_CLI_TELEMETRY_OPTOUT']='1';env['DOTNET_GENERATE_ASPNET_CERTIFICATE']='false'
out=root/'.local/office-desktop/dist'/('dev-'+a.rid if a.development_server else a.rid);out.mkdir(parents=True,exist_ok=True)
subprocess.run([a.dotnet,'publish',str(root/'desktop/office-assistant/Client/ChinaTech.OfficeAssistant.csproj'),'-c','Release','-r',a.rid,'-o',str(out),'-p:OfficeDevelopment='+str(bool(a.development_server)).lower(),'-p:RestoreConfigFile='+str(root/'desktop/office-assistant/NuGet.Config')],check=True,env=env)
exe=out/'ChinaTech.OfficeAssistant.exe'
if a.development_server:
 exe.rename(out/'ChinaTech.OfficeAssistant.DEV.exe');exe=out/'ChinaTech.OfficeAssistant.DEV.exe'
manifest={'server':server,'development':bool(a.development_server),'version':ET.parse(root/'desktop/office-assistant/Client/ChinaTech.OfficeAssistant.csproj').findtext('.//Version'),'runtime':a.rid,'runnerSha256':digest,'exeSha256':hashlib.sha256(exe.read_bytes()).hexdigest(),'bytes':exe.stat().st_size,'authenticodeSigned':False}
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps(manifest))
