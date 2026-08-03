import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "霁光 · 朝晚霞机会预报",
  description: "融合 ECMWF、CMA 与 CAMS 数据，提前发现中国城市的朝霞与晚霞窗口。",
  keywords: ["朝霞", "晚霞", "天气预报", "摄影", "ECMWF", "CMA"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f4efe8",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
