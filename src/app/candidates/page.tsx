"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

type Candidate = {
    id: string;
    recordId: string;
    patientName: string;
    birthDate: string;
    clinicName: string;
    visitDate: string;
    facilityName: string;
    status: string;
    score: number;
    matchReasons: string[];
};

function CandidatesContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [isRescueSearch, setIsRescueSearch] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchCandidates = async () => {
            try {
                const query = searchParams.toString();
                const res = await fetch(`/api/kintone/search?${query}`);
                if (!res.ok) {
                    throw new Error('検索エラーが発生しました');
                }

                const data = await res.json();
                setCandidates(data.candidates || []);
                setIsRescueSearch(data.isRescueSearch || false);
            } catch (err: any) {
                setError('候補が見つかりませんでした。条件を確認してください。');
            } finally {
                setIsLoading(false);
            }
        };

        fetchCandidates();
    }, [searchParams]);

    if (isLoading) {
        return (
            <div style={{ textAlign: 'center', padding: '60px' }}>
                <p style={{ fontSize: '1.2rem', color: 'var(--primary-color)' }}>kintone から候補を検索しています...</p>
            </div>
        );
    }

    if (error || candidates.length === 0) {
        return (
            <div className="glass-card" style={{ padding: '32px', textAlign: 'center' }}>
                <h2 style={{ color: 'var(--danger-color)', marginBottom: '16px' }}>
                    {error || '一致する候補が見つかりませんでした'}
                </h2>
                <p style={{ marginBottom: '24px' }}>条件を変更するか、手入力で再度お試しください。</p>
                <button className="btn-primary" onClick={() => router.push('/scan')}>
                    スキャン画面に戻る
                </button>
            </div>
        );
    }

    return (
        <div>
            <h2 className="page-title">訪問予定の候補一覧</h2>

            {isRescueSearch && (
                <div style={{ padding: '16px', backgroundColor: '#fffbeb', color: 'var(--warning-color)', borderRadius: '8px', border: '1px solid #fde68a', marginBottom: '24px' }}>
                    <strong>【注意】</strong> 完全一致する候補が見つからなかったため、条件を緩めて広範囲から検索しました。<br />
                    必ず内容が正しいか確認して選択してください。
                </div>
            )}

            <p style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>
                上位 {candidates.length} 件を表示しています。対象の訪問予定を選択してください。
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {candidates.map((c, index) => {
                    const isTopMatch = candidates.length === 1 || (index === 0 && c.score >= 50);

                    return (
                        <div
                            key={c.id}
                            className="glass-card"
                            style={{
                                padding: '24px',
                                border: isTopMatch ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                                cursor: 'pointer',
                                transition: 'transform 0.2s',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                backgroundColor: isTopMatch ? '#eff6ff' : 'var(--card-bg)'
                            }}
                            onClick={() => router.push(`/candidates/${c.id}`)}
                            onMouseOver={(e) => e.currentTarget.style.transform = 'translateX(4px)'}
                            onMouseOut={(e) => e.currentTarget.style.transform = 'translateX(0)'}
                        >
                            <div>
                                {isTopMatch && (
                                    <span style={{ display: 'inline-block', backgroundColor: 'var(--primary-color)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 700, marginBottom: '12px' }}>
                                        最有力候補
                                    </span>
                                )}

                                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>{c.patientName} 様</h3>

                                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px', fontSize: '0.95rem', color: 'var(--text-main)' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>訪問予定日:</span>
                                    <span>{c.visitDate || '-'}</span>

                                    <span style={{ color: 'var(--text-muted)' }}>医療機関名:</span>
                                    <span>{c.clinicName || '-'}</span>

                                    <span style={{ color: 'var(--text-muted)' }}>施設・住所:</span>
                                    <span>{c.facilityName || '-'}</span>
                                </div>

                                {c.matchReasons && c.matchReasons.length > 0 && (
                                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                                        {c.matchReasons.map(reason => (
                                            <span key={reason} style={{ fontSize: '0.8rem', backgroundColor: '#e2e8f0', padding: '2px 8px', borderRadius: '12px' }}>
                                                {reason}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div style={{ color: 'var(--primary-color)' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div style={{ marginTop: '32px', textAlign: 'center' }}>
                <button className="btn-secondary" onClick={() => router.push('/scan')}>
                    戻って検索条件を変える
                </button>
            </div>
        </div>
    );
}

export default function CandidatesPage() {
    return (
        <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center' }}>読み込み中...</div>}>
            <CandidatesContent />
        </Suspense>
    );
}
