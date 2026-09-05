import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '人生分枝 | 条件化经验探索',
  description: '围绕一个人生选择，对照不同路径的经历、条件与结果。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
