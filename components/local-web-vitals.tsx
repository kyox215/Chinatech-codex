"use client";

import {useReportWebVitals} from "next/web-vitals";
import {localWebVital} from "@/lib/local-web-vitals";

// Stable across renders: Next replays available metrics to a new callback.
const report:Parameters<typeof useReportWebVitals>[0]=metric=>{
 const value=localWebVital(metric);
 if(value)console.info("[ct-local-web-vitals]",JSON.stringify(value));
};

/** Mounted only by the server's explicit local measurement gate; no product UI. */
export function LocalWebVitals(){useReportWebVitals(report);return null;}
