"use client";

import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();

  const handleStartScan = () => {
    router.push("/scan");
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '40px' }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '16px' }}>訪問予定の照合を開始</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
          iPadのカメラまたは画像から処方箋を読み取り、<br />
          kintoneの訪問予定と照合します。
        </p>
      </div>

      <button
        onClick={handleStartScan}
        style={{
          backgroundColor: 'var(--primary-color)',
          color: 'white',
          border: 'none',
          borderRadius: '24px',
          padding: '24px 48px',
          fontSize: '1.5rem',
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 10px 25px rgba(37, 99, 235, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          transition: 'transform 0.2s, box-shadow 0.2s'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 15px 35px rgba(37, 99, 235, 0.5)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 10px 25px rgba(37, 99, 235, 0.4)';
        }}
        onMouseDown={(e) => e.currentTarget.style.transform = 'translateY(2px)'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M8 13h2" />
          <path d="M8 17h2" />
          <path d="M14 13h2" />
          <path d="M14 17h2" />
        </svg>
        処方箋読み取り開始
      </button>

      <div style={{ marginTop: '40px', padding: '24px', backgroundColor: '#e0f2fe', borderRadius: '12px', color: '#0369a1', maxWidth: '600px', width: '100%' }}>
        <strong>注意事項</strong>
        <ul style={{ marginTop: '8px', paddingLeft: '24px', lineHeight: '1.6' }}>
          <li>撮影した画像はシステム上に保存されません。</li>
          <li>OCRの読み取り結果は必ずご自身の目で確認してください。</li>
          <li>候補が複数見つかった場合は、手動で対象を選択する必要があります。</li>
        </ul>
      </div>
    </div>
  );
}
