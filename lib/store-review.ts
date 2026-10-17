import type {Permission} from './staff';
/** Display selection and the explicit review body use the same live grantable set. */
export function reviewPermissions(requested:Permission[],allowed:readonly Permission[],owner:boolean){
 return requested.filter(permission=>allowed.includes(permission)&&(owner||permission!=='staff.manage'));
}
