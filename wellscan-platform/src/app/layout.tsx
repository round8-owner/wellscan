import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WellScan — 식품 성분 분석",
  description: "식품 라벨을 읽고 개인의 관심 프로필에 맞춰 성분 정보를 확인합니다."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
