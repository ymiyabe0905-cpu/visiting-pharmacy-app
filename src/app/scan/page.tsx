"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Tesseract from "tesseract.js";
import { extractRecord } from "@/lib/ocr/extractor";

type OcrStatus = "idle" | "loading" | "success" | "error";

export default function ScanPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

    const [status, setStatus] = useState<OcrStatus>("idle");
    const [errorMessage, setErrorMessage] = useState<string>("");
    const [warningMessage, setWarningMessage] = useState<string>("");

    // OCR結果・フォーム用ステート
    const [patientName, setPatientName] = useState("");
    const [birthDate, setBirthDate] = useState("");
    const [clinicName, setClinicName] = useState("");
    const [visitDate, setVisitDate] = useState(""); // 交付日として扱う

    // OCR全文プレビュー用ステート
    const [rawOcrText, setRawOcrText] = useState("");
    const [correctedOcrText, setCorrectedOcrText] = useState("");
    const [debugInfo, setDebugInfo] = useState<any>(null);
    const [showRawOcrText, setShowRawOcrText] = useState(false);

    // 画像が不要になった時点でメモリから速やかに破棄するための関数
    const cleanupImage = () => {
        if (imagePreviewUrl) {
            URL.revokeObjectURL(imagePreviewUrl);
            setImagePreviewUrl(null);
        }
    };

    // アンマウント時にも確実に破棄されるようにする
    useEffect(() => {
        return cleanupImage;
    }, [imagePreviewUrl]);

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        cleanupImage(); // 既存のプレビューがあれば破棄

        const newPreviewUrl = URL.createObjectURL(file);
        setImagePreviewUrl(newPreviewUrl);

        // OCR処理開始
        setStatus("loading");
        setErrorMessage("");
        setWarningMessage("");

        try {
            // 本来はjpnとするが、読み込みに時間がかかるため今回はモジュールの制限に注意しつつjpnを使用する想定
            const result = await Tesseract.recognize(file, 'jpn', {
                logger: m => console.log(m) // 進捗確認用。本番では削除してもよい
            });

            const text = result.data.text;

            // 文字が極端に少ない場合は再撮影を促す
            if (text.trim().length < 5) {
                setStatus("error");
                setErrorMessage("OCR結果が不十分です。もう一度撮影（選択）してください。");
                return;
            }

            // 新しい切り出しモジュールで抽出
            const extracted = extractRecord(text);

            setPatientName(extracted.patientName);
            setBirthDate(extracted.birthDate);
            setClinicName(extracted.clinicName);
            setVisitDate(extracted.visitDate);
            setRawOcrText(text);
            setCorrectedOcrText(extracted.correctedText);
            setDebugInfo(extracted.debug);

            // 必須項目が1つでも空行になった場合は警告を出し、プレビューを自動で開く
            if (!extracted.patientName || !extracted.clinicName || !extracted.visitDate) {
                setWarningMessage("一部項目の抽出に失敗しました。OCR全文を確認して修正してください。");
                setShowRawOcrText(true);
            } else {
                setShowRawOcrText(false);
            }

            setStatus("success");

        } catch (err: any) {
            console.error("OCR Error:", err);
            setStatus("error");
            setErrorMessage("OCR結果が不十分です。再撮影してください。");
        }
    };


    const handleRetake = () => {
        cleanupImage();
        setStatus("idle");
        setPatientName("");
        setBirthDate("");
        setClinicName("");
        setVisitDate("");
        setRawOcrText("");
        setCorrectedOcrText("");
        setDebugInfo(null);
        setShowRawOcrText(false);
        setErrorMessage("");
        setWarningMessage("");
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!patientName && !clinicName) {
            setErrorMessage("検索に必要な情報（患者名または医療機関名）が不足しています。");
            return;
        }

        // 検索開始時は元画像を必ず破棄する（セキュリティ・プライバシー要件）
        cleanupImage();

        // URLSearchParams を使って安全にクエリパラメータを構築
        const params = new URLSearchParams();
        if (patientName) params.append("patientName", patientName);
        if (birthDate) params.append("birthDate", birthDate);
        if (clinicName) params.append("clinicName", clinicName);
        if (visitDate) params.append("visitDate", visitDate);

        router.push(`/candidates?${params.toString()}`);
    };

    return (
        <div className="glass-card" style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
            <h2 className="page-title">処方箋の読み取り</h2>

            {status === 'loading' && (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--primary-color)' }}>
                    <div style={{ fontSize: '1.2rem', marginBottom: '16px' }}>OCR処理中... (この処理は端末上で行われます)</div>
                    <p style={{ color: 'var(--text-muted)' }}>画像からテキストを抽出しています。しばらくお待ちください。</p>
                </div>
            )}

            {status === 'error' && (
                <div style={{ padding: '16px', backgroundColor: '#fef2f2', color: 'var(--danger-color)', borderRadius: '8px', marginBottom: '24px' }}>
                    {errorMessage}
                </div>
            )}

            {(status === 'idle' || status === 'error') && (
                <div style={{ textAlign: 'center', margin: '40px 0' }}>
                    <input
                        type="file"
                        accept="image/*"
                        capture="environment" // iPad等の背面カメラを優先起動
                        onChange={handleImageChange}
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        id="camera-input"
                    />
                    <label
                        htmlFor="camera-input"
                        className="btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>
                        カメラ起動 / 画像選択
                    </label>
                </div>
            )}

            {status === 'success' && (
                <div>
                    {warningMessage ? (
                        <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#fffbeb', color: '#b45309', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
                            {warningMessage}
                        </div>
                    ) : (
                        <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#ecfdf5', color: '#047857', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
                            読み取りが完了しました。内容を確認し、必要に応じて修正してください。
                        </div>
                    )}

                    <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label htmlFor="patientName" style={{ fontWeight: 600 }}>患者名</label>
                            <input
                                id="patientName"
                                type="text"
                                value={patientName}
                                onChange={e => setPatientName(e.target.value)}
                                style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '1rem' }}
                                required
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label htmlFor="birthDate" style={{ fontWeight: 600 }}>生年月日</label>
                            <input
                                id="birthDate"
                                type="text"
                                value={birthDate}
                                onChange={e => setBirthDate(e.target.value)}
                                style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '1rem' }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label htmlFor="clinicName" style={{ fontWeight: 600 }}>医療機関名</label>
                            <input
                                id="clinicName"
                                type="text"
                                value={clinicName}
                                onChange={e => setClinicName(e.target.value)}
                                style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '1rem' }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label htmlFor="visitDate" style={{ fontWeight: 600 }}>交付日</label>
                            <input
                                id="visitDate"
                                type="text"
                                value={visitDate}
                                onChange={e => setVisitDate(e.target.value)}
                                style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '1rem' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '16px', marginTop: '32px' }}>
                            <button type="button" onClick={handleRetake} className="btn-secondary" style={{ flex: 1 }}>
                                再撮影する
                            </button>
                            <button type="submit" className="btn-primary" style={{ flex: 2 }}>
                                候補を検索する
                            </button>
                        </div>
                    </form>

                    {/* OCR全文プレビュー (原因切り分け用) */}
                    <div style={{ marginTop: '32px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div 
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontWeight: 600, color: 'var(--text-muted)' }}
                            onClick={() => setShowRawOcrText(!showRawOcrText)}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                                OCR全文プレビュー (原因調査用)
                            </span>
                            <span>{showRawOcrText ? '▲ 閉じる' : '▼ 開く'}</span>
                        </div>
                        {showRawOcrText && (
                            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>誤認識自動補正後テキスト（抽出対象）:</div>
                                    <div style={{ padding: '12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '4px', whiteSpace: 'pre-wrap', fontSize: '0.85rem', color: 'var(--text-main)', maxHeight: '150px', overflowY: 'auto', fontFamily: 'monospace' }}>
                                        {correctedOcrText || 'テキストなし'}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>OCR生テキスト（Tesseract.js出力）:</div>
                                    <div style={{ padding: '12px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '4px', whiteSpace: 'pre-wrap', fontSize: '0.85rem', color: 'var(--text-main)', maxHeight: '150px', overflowY: 'auto', fontFamily: 'monospace' }}>
                                        {rawOcrText || 'テキストなし'}
                                    </div>
                                </div>
                                
                                {debugInfo && (
                                <div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>内部抽出デバッグ情報（候補リストと実際の採用値）:</div>
                                    <div style={{ padding: '12px', backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '4px', whiteSpace: 'pre-wrap', fontSize: '0.85rem', color: '#9a3412', overflowY: 'auto', fontFamily: 'monospace', lineHeight: 1.6 }}>
                                        <strong>◆ 医療機関名候補</strong><br/>
                                        {debugInfo.clinicCandidates?.length > 0 ? debugInfo.clinicCandidates.join(', ') : 'なし'}<br/>
                                        <span style={{ color: '#ea580c' }}>→ 【採用】 {clinicName || 'なし'}</span><br/><br/>

                                        <strong>◆ 患者名候補</strong><br/>
                                        {debugInfo.patientCandidates?.length > 0 ? debugInfo.patientCandidates.join(', ') : 'なし'}<br/>
                                        <span style={{ color: '#ea580c' }}>→ 【採用】 {patientName || 'なし'}</span><br/><br/>
                                        
                                        <strong>◆ 生年月日候補</strong><br/>
                                        {debugInfo.birthDateCandidates?.length > 0 ? debugInfo.birthDateCandidates.join(', ') : 'なし'}<br/>
                                        <span style={{ color: '#ea580c' }}>→ 【採用】 {birthDate || 'なし'}</span><br/><br/>
                                        
                                        <strong>◆ 交付日候補</strong><br/>
                                        {debugInfo.visitDateCandidates?.length > 0 ? debugInfo.visitDateCandidates.join(', ') : 'なし'}<br/>
                                        <span style={{ color: '#ea580c' }}>→ 【採用】 {visitDate || 'なし'}</span>
                                    </div>
                                </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
