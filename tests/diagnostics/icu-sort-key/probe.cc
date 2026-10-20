#include <node_api.h>
#include <cstdint>
#include <vector>

// Diagnostic only: these are the exact public ICU78 C symbols of the measured
// Node24 binary. This is not an ABI-stable product dependency or DB function.
struct UCollator;
extern "C" UCollator* ucol_open_78(const char*, int32_t*);
extern "C" void ucol_close_78(UCollator*);
extern "C" void ucol_setAttribute_78(UCollator*, int32_t, int32_t, int32_t*);
extern "C" int32_t ucol_getSortKey_78(const UCollator*, const char16_t*, int32_t, uint8_t*, int32_t);
extern "C" void ucol_getVersion_78(const UCollator*, uint8_t*);
extern "C" void ucol_getUCAVersion_78(const UCollator*, uint8_t*);

static napi_value Key(napi_env env, napi_callback_info info) {
  napi_value args[2]; size_t argc=2, length=0; bool numeric=false;
  if(napi_get_cb_info(env,info,&argc,args,nullptr,nullptr)!=napi_ok || argc!=2 ||
     napi_get_value_string_utf16(env,args[0],nullptr,0,&length)!=napi_ok || length>20000 ||
     napi_get_value_bool(env,args[1],&numeric)!=napi_ok) {
    napi_throw_error(env,nullptr,"Expected public string <=20000UTF16 and name-mode boolean");return nullptr;
  }
  std::vector<char16_t> input(length+1);size_t written=0;
  if(napi_get_value_string_utf16(env,args[0],input.data(),input.size(),&written)!=napi_ok || written!=length){
    napi_throw_error(env,nullptr,"Input length changed");return nullptr;
  }
  int32_t status=0;UCollator* collator=ucol_open_78(numeric?"en":"en-US",&status);
  if(status>0 || !collator){napi_throw_error(env,nullptr,"ICU78 collator unavailable");return nullptr;}
  // ICU stable enums: NORMALIZATION_MODE4/ON17, NUMERIC_COLLATION7,
  // STRENGTH5/PRIMARY0/TERTIARY2, OFF16. Original Intl name comparator
  // uses en sensitivity:base numeric:true; key.localeCompare uses en-US.
  ucol_setAttribute_78(collator,4,17,&status);
  ucol_setAttribute_78(collator,7,numeric?17:16,&status);
  ucol_setAttribute_78(collator,5,numeric?0:2,&status);
  if(status>0){ucol_close_78(collator);napi_throw_error(env,nullptr,"ICU78 attributes unavailable");return nullptr;}
  int32_t size=ucol_getSortKey_78(collator,input.data(),static_cast<int32_t>(length),nullptr,0);
  if(size<1 || size>200000){ucol_close_78(collator);napi_throw_error(env,nullptr,"Unexpected key size");return nullptr;}
  std::vector<uint8_t> key(static_cast<size_t>(size));
  int32_t actual=ucol_getSortKey_78(collator,input.data(),static_cast<int32_t>(length),key.data(),size);
  uint8_t version[4],uca[4];ucol_getVersion_78(collator,version);ucol_getUCAVersion_78(collator,uca);
  ucol_close_78(collator);
  if(actual!=size){napi_throw_error(env,nullptr,"Key length changed");return nullptr;}
  napi_value result,buffer,array,number;napi_create_object(env,&result);
  napi_create_buffer_copy(env,key.size(),key.data(),nullptr,&buffer);napi_set_named_property(env,result,"key",buffer);
  for(int field=0;field<2;field++){
    napi_create_array_with_length(env,4,&array);
    for(uint32_t i=0;i<4;i++){napi_create_uint32(env,field?uca[i]:version[i],&number);napi_set_element(env,array,i,number);}
    napi_set_named_property(env,result,field?"ucaVersion":"collatorVersion",array);
  }
  return result;
}
NAPI_MODULE_INIT(){napi_value function;napi_create_function(env,"key",NAPI_AUTO_LENGTH,Key,nullptr,&function);napi_set_named_property(env,exports,"key",function);return exports;}
