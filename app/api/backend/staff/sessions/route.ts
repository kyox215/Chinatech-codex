import type { NextRequest } from "next/server";
import { manageDevices } from "@/lib/server/device-management";
export function GET(request: NextRequest) { return manageDevices(request, true, false); }
