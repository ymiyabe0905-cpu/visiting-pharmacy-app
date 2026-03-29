import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '訪問薬局 処方箋照合アプリ',
  description: 'OCRと連携した在宅訪問薬局向けツール',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <div className="layout-container">
          {/* 簡易ヘッダー */}
          <header style={{
            background: 'white',
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            position: 'sticky',
            top: 0,
            zIndex: 10
          }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--primary-color)' }}>
              処方箋照合スキャナー
            </h1>
          </header>

          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
