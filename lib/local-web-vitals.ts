/** Local measurement is an explicit server choice, never a URL/query switch. */
export function localWebVitalsEnabled(environment:{enabled?:string;vercel?:string;origin?:string}) {
 if(environment.enabled!=="1"||environment.vercel==="1"||!environment.origin)return false;
 try{
  const origin=new URL(environment.origin);
  return ["http:","https:"].includes(origin.protocol)&&["localhost","127.0.0.1","[::1]"].includes(origin.hostname)
   &&origin.pathname==="/"&&!origin.search&&!origin.hash&&!origin.username&&!origin.password;
 }catch{return false;}
}

const names=new Set(["TTFB","FCP","LCP","FID","CLS","INP"]);
const ratings=new Set(["good","needs-improvement","poor"]);
const navigationTypes=new Set(["navigate","reload","prerender","back-forward","back-forward-cache","restore"]);
type MetricInput={name:unknown;value:unknown;delta:unknown;rating:unknown;navigationType:unknown};
/** Deliberately excludes id, entries, attribution, URLs and arbitrary fields. */
export function localWebVital(metric:MetricInput) {
 if(typeof metric.name!=="string"||!names.has(metric.name)||typeof metric.value!=="number"||!Number.isFinite(metric.value)||metric.value<0
  ||typeof metric.delta!=="number"||!Number.isFinite(metric.delta)||typeof metric.rating!=="string"||!ratings.has(metric.rating)
  ||typeof metric.navigationType!=="string"||!navigationTypes.has(metric.navigationType))return null;
 return {name:metric.name,value:metric.value,delta:metric.delta,rating:metric.rating,navigationType:metric.navigationType};
}
