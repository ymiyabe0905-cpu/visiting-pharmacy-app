"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function ConfirmContent({ id }: { id: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const newVisitDate = searchParams.get('visitDate');

    const [record, setRecord] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchRecord = async () => {
            try {
                const res = await fetch(`/api/kintone/record?id=${id}`);
                if (!res.ok) throw new Error('レコードの取得に失敗しました');
                const data = await res.json();
                setRecord(data.record);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchRecord();
    }, [id]);

    const handleUpdate = async () => {
        setIsUpdating(true);
        setError('');
        try {
            // 訪問状況を「処方あり」へ更新
            const payload = {
                id: id,
                visitStatus: '処方あり',
                visitDate: newVisitDate || undefined // 元と同じならundefinedやそのままでもOK
            };

            const res = await fetch('/api/kintone/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                throw new Error('更新に失敗しました。対象レコードを確認してください。');
            }

            // 完了画面へ
            router.push('/complete');

        } catch (err: any) {
            setError(err.message || '予期せぬエラーが発生しました');
            setIsUpdating(false);
        }
    };

    if (isLoading) {
        return <div style={{ textAlign: 'center', padding: '60px' }}>確認データを読み込み中...</div>;
    }

    if (error || !record) {
        return (
            <div className="glass-card" style={{ padding: '32px', textAlign: 'center' }}>
                <h2 style={{ color: 'var(--danger-color)', marginBottom: '16px' }}>エラー</h2>
                <p style={{ marginBottom: '24px' }}>{error}</p>
                <button className="btn-secondary" onClick={() => router.back()}>戻る</button>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h2 className="page-title">更新内容の最終確認</h2>

            <div className="glass-card" style={{ padding: '32px', marginBottom: '32px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '24px', textAlign: 'center' }}>
                    {record.patientName} 様 の予定を更新します
                </h3>

                <div style={{ backgroundColor: '#f8fafc', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '24px' }}>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 1fr', alignItems: 'center', marginBottom: '16px' }}>
                        <div style={{ textAlign: 'right', paddingRight: '16px' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>変更前 (現在)</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{record.visitDate || '未設定'}</div>
                        </div>
                        <div style={{ textAlign: 'center', color: 'var(--primary-color)' }}>
                            →
                        </div>
                        <div style={{ paddingLeft: '16px' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>変更後</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                                {newVisitDate || record.visitDate || '未設定'}
                            </div>
                        </div>
                    </div>

                    <div style={{ borderTop: '1px solid #e2e8f0', margin: '16px 0' }}></div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 1fr', alignItems: 'center' }}>
                        <div style={{ textAlign: 'right', paddingRight: '16px' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>訪問状況 (変更前)</div>
                            <div style={{ fontSize: '1rem', fontWeight: 600 }}>{record.status || '未設定'}</div>
                        </div>
                        <div style={{ textAlign: 'center', color: 'var(--primary-color)' }}>
                            →
                        </div>
                        <div style={{ paddingLeft: '16px' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>訪問状況 (変更後)</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white', backgroundColor: 'var(--success-color)', padding: '4px 12px', borderRadius: '20px', display: 'inline-block' }}>
                                処方あり
                            </div>
                        </div>
                    </div>

                </div>

                <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '24px', display: 'grid', gap: '12px', fontSize: '0.95rem' }}>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '8px' }}>対象患者の情報</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr' }}>
                        <span style={{ color: 'var(--text-muted)' }}>患者名:</span>
                        <span style={{ fontWeight: 600 }}>{record.patientName}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr' }}>
                        <span style={{ color: 'var(--text-muted)' }}>医療機関名:</span>
                        <span>{record.clinicName || '-'}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr' }}>
                        <span style={{ color: 'var(--text-muted)' }}>施設・住所:</span>
                        <span>{record.facilityName || '-'}</span>
                    </div>
                    {record.visitNotes && (
                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', marginTop: '8px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>訪問時注意:</span>
                            <span style={{ whiteSpace: 'pre-wrap', backgroundColor: '#fffbeb', padding: '8px', borderRadius: '4px', borderLeft: '3px solid #f59e0b', fontSize: '0.9rem' }}>{record.visitNotes}</span>
                        </div>
                    )}
                    {record.nextNotes && (
                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', marginTop: '8px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>次回申し送り:</span>
                            <span style={{ whiteSpace: 'pre-wrap', backgroundColor: '#f0fdf4', padding: '8px', borderRadius: '4px', borderLeft: '3px solid #22c55e', fontSize: '0.9rem' }}>{record.nextNotes}</span>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '16px', marginTop: '40px' }}>
                    <button
                        className="btn-secondary"
                        style={{ flex: 1 }}
                        onClick={() => router.back()}
                        disabled={isUpdating}
                    >
                        戻る
                    </button>
                    <button
                        className="btn-primary"
                        style={{ flex: 2, display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center' }}
                        onClick={handleUpdate}
                        disabled={isUpdating}
                    >
                        {isUpdating ? (
                            <>
                                <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                                更新中...
                            </>
                        ) : (
                            '確定する'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function ConfirmPage({ params }: { params: { id: string } }) {
    return (
        <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center' }}>読み込み中...</div>}>
            <ConfirmContent id={params.id} />
        </Suspense>
    );
}
