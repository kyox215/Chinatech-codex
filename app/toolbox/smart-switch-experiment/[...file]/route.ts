import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export function GET(){return NextResponse.json({code:'UPDATE_REQUIRED',retired:true,updateUrl:'https://www.chinatech.in/toolbox'},{status:410,headers:{'Cache-Control':'private, no-store'}});}
