import {NextResponse} from 'next/server';
import {officeResponse} from './office-server';
export function retiredTool(){return officeResponse(NextResponse.json({code:'UPDATE_REQUIRED',retired:true,updateUrl:'https://www.chinatech.in/toolbox/office'},{status:410}));}
