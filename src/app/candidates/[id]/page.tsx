"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CandidateDetailPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [record, setRecord] = useState<any>(null);
    const [facilitySchedule, setFacilitySchedule] = useState<Record<string, number>>({});
    const [patientSchedule, setPatientSchedule] = useState<any[]>([]);
    const [newVisitDate, setNewVisitDate] = useState('');

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                // レコード取得
                const recRes = await fetch(`/api/kintone/record?id=${params.id}`);
                if (!recRes.ok) throw new Error('レコードの取得に失敗しました');
                const recData = await recRes.json();

                const currentRecord = recData.record;
                setRecord(currentRecord);
                setNewVisitDate(currentRecord.visitDate || '');

                // 施設スケジュール取得
                if (currentRecord.facilityName) {
                    const schedRes = await fetch(`/api/kintone/facility-schedule?facilityName=${encodeURIComponent(currentRecord.facilityName)}`);
                    if (schedRes.ok) {
                        const schedData = await schedRes.json();
                        setFacilitySchedule(schedData.schedule || {});
                    }
                }

                // 同一患者スケジュール取得
                if (currentRecord.patientName) {
                    const pParams = new URLSearchParams();
                    pParams.append('patientName', currentRecord.patientName);
                    if (currentRecord.birthDate) pParams.append('birthDate', currentRecord.birthDate);
                    pParams.append('excludeId', params.id);
                    if (currentRecord.visitDate) pParams.append('baseDate', currentRecord.visitDate);

                    const patientRes = await fetch(`/api/kintone/patient-schedule?${pParams.toString()}`);
                    if (patientRes.ok) {
                        const patientData = await patientRes.json();
                        setPatientSchedule(patientData.schedule || []);
                    }
                }
            } catch (err: any) {
                setError(err.message || 'データ取得エラーが発生しました');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [params.id]);

    if (isLoading) {
        return (
            <div style={{ textAlign: 'center', padding: '60px' }}>
                <p style={{ fontSize: '1.2rem', color: 'var(--primary-color)' }}>詳細データを読み込み中...</p>
            </div>
        );
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

    // 14日間の日付リスト生成
    const today = new Date();
    const dateList = Array.from({ length: 14 }).map((_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        return d.toISOString().split('T')[0];
    });

    const handleNext = () => {
        if (!newVisitDate) {
            alert("訪問日を設定してください。");
            return;
        }
        // 確認画面へ変更後の訪問日を渡す
        router.push(`/confirm/${params.id}?visitDate=${newVisitDate}`);
    };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h2 className="page-title">訪問予定の詳細確認</h2>

            <div className="glass-card" style={{ padding: '24px', marginBottom: '32px' }}>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
                    {record.patientName} 様
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '16px', fontSize: '1.05rem' }}>
                    <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>生年月日:</div>
                    <div>{record.birthDate || '-'}</div>

                    <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>医療機関名:</div>
                    <div>{record.clinicName || '-'}</div>

                    <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>施設・住所:</div>
                    <div>{record.facilityName || '-'}</div>

                    <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>現在の訪問状況:</div>
                    <div>
                        <span style={{
                            backgroundColor: '#f1f5f9',
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontWeight: 600,
                            fontSize: '0.9rem'
                        }}>
                            {record.status || '未設定'}
                        </span>
                    </div>

                    {record.visitNotes && (
                        <>
                            <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>訪問時注意:</div>
                            <div style={{ whiteSpace: 'pre-wrap', backgroundColor: '#fffbeb', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #f59e0b', fontSize: '0.95rem' }}>
                                {record.visitNotes}
                            </div>
                        </>
                    )}

                    {record.nextNotes && (
                        <>
                            <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>次回申し送り:</div>
                            <div style={{ whiteSpace: 'pre-wrap', backgroundColor: '#f0fdf4', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #22c55e', fontSize: '0.95rem' }}>
                                {record.nextNotes}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="glass-card" style={{ padding: '24px', marginBottom: '32px', borderLeft: '4px solid var(--primary-color)' }}>
                <h4 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '16px' }}>訪問日の変更（必要な場合のみ）</h4>
                <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.95rem' }}>
                    現在の訪問予定日は <strong>{record.visitDate || '未設定'}</strong> です。変更する場合は以下で選択してください。
                </p>

                <input
                    type="date"
                    value={newVisitDate}
                    onChange={(e) => setNewVisitDate(e.target.value)}
                    style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '1.1rem', width: '100%', maxWidth: '300px' }}
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', marginBottom: '32px' }}>

                {patientSchedule.length > 0 && (
                    <div className="glass-card" style={{ padding: '24px', border: '2px solid #3b82f6', backgroundColor: '#eff6ff' }}>
                        <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><polyline points="16 11 18 13 22 9" /></svg>
                            同一患者の別予定 (今後14日間)
                        </h4>
                        <p style={{ fontSize: '0.9rem', color: '#3b82f6', marginBottom: '16px' }}>
                            同じ日に訪問を合わせられるか確認してください。クリックで訪問予定日を変更できます。
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {patientSchedule.map((ps, idx) => {
                                const isSelected = newVisitDate === ps.visitDate;
                                return (
                                    <div
                                        key={idx}
                                        onClick={() => setNewVisitDate(ps.visitDate)}
                                        style={{
                                            padding: '16px',
                                            borderRadius: '8px',
                                            backgroundColor: 'white',
                                            border: isSelected ? '2px solid var(--primary-color)' : '1px solid #bfdbfe',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            boxShadow: isSelected ? '0 4px 6px -1px rgba(59, 130, 246, 0.2)' : 'none'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <span style={{ fontWeight: 700, fontSize: '1.1rem', color: isSelected ? 'var(--primary-color)' : 'inherit' }}>
                                                {ps.visitDate}
                                            </span>
                                            <span style={{ fontSize: '0.85rem', backgroundColor: '#e2e8f0', padding: '2px 8px', borderRadius: '12px' }}>
                                                {ps.status}
                                            </span>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(100px, max-content) 1fr', gap: '4px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                            <span>医療機関:</span> <span>{ps.clinicName}</span>
                                            {ps.visitType && <><span>訪問種類:</span> <span>{ps.visitType}</span></>}
                                            {ps.assignee && <><span>担当者:</span> <span>{ps.assignee}</span></>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {record.facilityName && (
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                            施設スケジュールの集計 ( {record.facilityName} )
                        </h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {dateList.map(dateStr => {
                                const count = facilitySchedule[dateStr] || 0;
                                // 患者さんの予定がある日は強制的に目立たせる
                                const hasPatientSchedule = patientSchedule.some(ps => ps.visitDate === dateStr);
                                const isSelected = newVisitDate === dateStr;

                                return (
                                    <div
                                        key={dateStr}
                                        onClick={() => setNewVisitDate(dateStr)}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: '8px',
                                            border: isSelected ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                                            backgroundColor: isSelected ? '#eff6ff' :
                                                hasPatientSchedule ? '#dbeafe' : // 患者予定あり＝青背景
                                                    count > 0 ? '#f0fdf4' : 'white', // 施設予定あり＝緑背景
                                            cursor: 'pointer',
                                            minWidth: '80px',
                                            textAlign: 'center',
                                            transition: 'all 0.2s',
                                            position: 'relative'
                                        }}
                                    >
                                        {hasPatientSchedule && (
                                            <div style={{ position: 'absolute', top: '-4px', right: '-4px', width: '10px', height: '10px', backgroundColor: '#3b82f6', borderRadius: '50%' }}></div>
                                        )}
                                        <div style={{ fontSize: '0.8rem', color: hasPatientSchedule ? '#1d4ed8' : 'var(--text-muted)', marginBottom: '4px', fontWeight: hasPatientSchedule ? 700 : 400 }}>
                                            {dateStr.substring(5).replace('-', '/')}
                                        </div>
                                        <div style={{ fontWeight: 700, color: hasPatientSchedule ? '#1d4ed8' : (count > 0 ? 'var(--success-color)' : 'var(--text-main)') }}>
                                            {count} 件
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ marginTop: '16px', display: 'flex', gap: '16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '12px', height: '12px', backgroundColor: '#dbeafe', border: '1px solid #bfdbfe' }}></div> 患者の別予定あり</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '12px', height: '12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}></div> 他患者の施設予定あり</div>
                        </div>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => router.back()}>
                    戻る
                </button>
                <button className="btn-primary" style={{ flex: 2 }} onClick={handleNext}>
                    更新確認へ進む
                </button>
            </div>

        </div>
    );
}
