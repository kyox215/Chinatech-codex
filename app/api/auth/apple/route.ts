import type { NextRequest } from "next/server";
import { startAccountOAuth } from "@/lib/server/account-oauth";

export function POST(request: NextRequest) { return startAccountOAuth(request, "apple"); }
