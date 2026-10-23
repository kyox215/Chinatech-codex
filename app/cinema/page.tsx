import type { Metadata } from "next";
import { CinemaPage } from "@/components/home/cinema-page";
import { PublicAuthPage } from "@/components/home/public-auth-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "放映室",
  description: "浏览并观看开放授权影片，给忙碌的日常留一点休闲时间。",
};
export default function Page() {
  return <PublicAuthPage><CinemaPage /></PublicAuthPage>;
}
