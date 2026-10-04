import type { Metadata } from 'next';
import './globals.css';
import './product.css';
import './locale.css';
import './assistant.css';
import { LocaleProvider } from './locale';
export const metadata: Metadata = {
  title: 'OCTAGON · UFC 智能助手',
  description:
    '查询 UFC 赛讯、官方排名、选手战绩，用可追溯的统计数据分析比赛。',
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
