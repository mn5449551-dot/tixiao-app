import type { Metadata } from "next";
import { IBM_Plex_Mono, Noto_Sans_SC, Noto_Serif_SC } from "next/font/google";
import "./globals.css";

const sans = Noto_Sans_SC({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const serif = Noto_Serif_SC({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "图文提效工作流 · 洋葱学园",
  description: "面向运营同学的 AI 图文生产控制台 — 项目列表、三栏工作区、需求卡、方向卡、文案卡与图片配置。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth" className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-5 focus:py-3 focus:text-sm focus:font-medium focus:text-[var(--brand-700)] focus:shadow-[var(--shadow-elevated)] focus:outline-2 focus:outline-[var(--brand-400)] focus:outline-offset-2"
        >
          跳转到主要内容
        </a>
        {children}
      </body>
    </html>
  );
}
