import assert from 'node:assert/strict';
import {sourceLoader} from '../../tests/helpers/typescript-source.mjs';

export const projectionQueryModels=Object.freeze(['customer_directory','procurement_list','repair_list','retail_list','retail_form','customer_record','customer_device']);
const {projectionQueryRulesHash}=sourceLoader()('./lib/backend/query-rules-version');
// Operators may activate only the exact migration contract they independently
// verify. No CREATE/UPDATE of a rules hash or inferred compatibility is allowed.
export async function requireProjectionQueryContract(tx,storeId,model){
 assert(projectionQueryModels.includes(model),'Known projection family required');
 const[row]=await tx`select query_rules_hash from ${tx('chinatech_v2_private.'+model+'_models')} where store_id=${storeId}`;
 assert.equal(row?.query_rules_hash,projectionQueryRulesHash,'Exact reviewed Unicode query contract required before activation: '+model);
 return projectionQueryRulesHash;
}
