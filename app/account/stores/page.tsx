import {isSupabaseMode} from '@/lib/supabase/config';
import {redirect} from 'next/navigation';
import {getAuthStatus} from '@/lib/server/auth-status';
import {MyStores} from '@/components/stores/my-stores';
export const dynamic='force-dynamic';
export const metadata={title:'我的门店',robots:{index:false,follow:false}};
export default async function StoresPage(){if(!isSupabaseMode())redirect('/login');const status=await getAuthStatus();if(!['account','workspace'].includes(status.state))redirect('/login');return <MyStores/>;}
