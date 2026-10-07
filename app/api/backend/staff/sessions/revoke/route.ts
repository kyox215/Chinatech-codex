import type { NextRequest } from "next/server";
import { manageDevices } from "@/lib/server/device-management";
export function POST(request: NextRequest) { return manageDevices(request, true, true); }
