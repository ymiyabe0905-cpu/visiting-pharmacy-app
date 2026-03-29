"use client";

import { useRouter } from 'next/navigation';

export default function CompletePage() {
    const router = useRouter();

    const handleNextScan = () => {
        // 状態を完全にリセットするために、ハードナビゲーション（window.location.href 等）にするか、
        // Next.jsの router.push を使うが、/scan 内で state が初期化されるので push で問題なし
        router.push('/scan');
    };

    const handleHome = () => {
        router.push('/');
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
            <div className="glass-card" style={{ padding: '48px', textAlign: 'center', maxWidth: '600px', width: '100%' }}>

                <div style={{ color: 'var(--success-color)', marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                </div>

                <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '16px', color: 'var(--text-main)' }}>
                    更新が完了しました
                </h2>

                <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '40px' }}>
                    kintone の訪問状況を「処方あり」に更新しました。
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <button
                        className="btn-primary"
                        style={{ padding: '16px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        onClick={handleNextScan}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>
                        次の処方箋を読み取る
                    </button>

                    <button
                        className="btn-secondary"
                        style={{ padding: '16px', fontSize: '1.1rem' }}
                        onClick={handleHome}
                    >
                        ダッシュボードへ戻る
                    </button>
                </div>

            </div>
        </div>
    );
}
