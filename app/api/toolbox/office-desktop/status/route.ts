import {NextResponse} from 'next/server';
import {officeResponse} from '@/lib/toolbox/office-server';
import {officeDesktopRelease} from '@/lib/toolbox/office-desktop-release';
export const runtime='nodejs';export const dynamic='force-dynamic';
export function GET(){return officeResponse(NextResponse.json({acceptingNewSessions:false,minimumVersion:officeDesktopRelease.version,currentVersion:officeDesktopRelease.version,code:'UPDATE_REQUIRED',updateUrl:'https://www.chinatech.in/toolbox/office'}));}
