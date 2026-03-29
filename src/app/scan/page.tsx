"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Tesseract from "tesseract.js";
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { extractRecord } from "@/lib/ocr/extractor";
import { autoRotateImage, preprocessCanvas, getCroppedCanvas, canvasToDataUrl, PreprocessMode } from "@/lib/ocr/imageProcessing";

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

    // 画像処理・トリミング用ステート
    const [cropSrc, setCropSrc] = useState(""); // UI表示用のDataURL
    const [rawImage, setRawImage] = useState<HTMLImageElement | null>(null); // 自動補正直後の純粋画像
    const [preprocessMode, setPreprocessMode] = useState<PreprocessMode>('grayscale');
    const [rotationCorrection, setRotationCorrection] = useState<number>(0);
    const [skewAngle, setSkewAngle] = useState<number>(0); // 1度単位の微細傾き補正用
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const [isCropping, setIsCropping] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);
    const [advancedDebugInfo, setAdvancedDebugInfo] = useState<any>(null);

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

        // 自動回転とクロップ準備
        setStatus("loading");
        setErrorMessage("");
        setWarningMessage("");
        setIsCropping(true);

        try {
            const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            
            // OSD等を利用して自動傾き補正
            const rotatedCanvas = await autoRotateImage(dataUrl);
            
            // 手動回転用の純粋な画像を保持 (プレビュー用描画は useEffect に委譲)
            const img = new Image();
            img.onload = () => {
                setRawImage(img);
                setRotationCorrection(0);
                setSkewAngle(0);
            };
            img.src = canvasToDataUrl(rotatedCanvas);
            
            setStatus("idle");
        } catch (err) {
            console.error("Auto rotate / preprocess failed", err);
            setCropSrc(newPreviewUrl);
            setStatus("idle");
        }
    };

    /**
     * 回転・傾き・前処理を適用したCanvasを生成するヘルパー
     */
    const generateProcessedCanvas = (imgData: HTMLImageElement, mode: PreprocessMode, rt: number, sk: number): HTMLCanvasElement | null => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        const totalRotation = rt + sk;
        const rad = (totalRotation * Math.PI) / 180;
        
        // 回転後のバウンディングボックスサイズを計算（余白が切れないように）
        const absCos = Math.abs(Math.cos(rad));
        const absSin = Math.abs(Math.sin(rad));
        const newWidth = imgData.width * absCos + imgData.height * absSin;
        const newHeight = imgData.width * absSin + imgData.height * absCos;

        canvas.width = newWidth;
        canvas.height = newHeight;

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(rad);
        ctx.drawImage(imgData, -imgData.width / 2, -imgData.height / 2);

        return preprocessCanvas(canvas, mode);
    };

    /**
     * 回転・傾き適用時に再描画するEffect
     */
    useEffect(() => {
        if (!rawImage) return;
        const processed = generateProcessedCanvas(rawImage, preprocessMode, rotationCorrection, skewAngle);
        if (processed) {
            setCropSrc(canvasToDataUrl(processed));
        }
    }, [rotationCorrection, skewAngle, preprocessMode, rawImage]);

    /**
     * 手動90度回転
     */
    const handleManualRotate = () => {
        setRotationCorrection((prev) => (prev + 90) % 360);
    };

    /**
     * 手動微小角回転（スライダー等から）
     */
    const handleSkewChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSkewAngle(Number(e.target.value));
    };

    /**
     * 全文OCRテスト (切り分け用)
     */
    const handleFullOcrTest = async () => {
        if (!imgRef.current) return;
        setStatus("loading");
        
        let testCanvas: HTMLCanvasElement;
        if (completedCrop && completedCrop.width > 0 && completedCrop.height > 0) {
            testCanvas = getCroppedCanvas(imgRef.current, completedCrop);
        } else {
            testCanvas = document.createElement('canvas');
            testCanvas.width = imgRef.current.width;
            testCanvas.height = imgRef.current.height;
            const ctx = testCanvas.getContext('2d');
            ctx?.drawImage(imgRef.current, 0, 0);
        }
        
        try {
            const result = await Tesseract.recognize(canvasToDataUrl(testCanvas), 'jpn');
            setStatus("idle");
            alert(`【全文OCRテスト結果】\n（これでも読めない場合は前処理・画質の問題です）\n\n${result.data.text}`);
        } catch (e: any) {
            setStatus("idle");
            alert("全文OCRテスト中にエラーが発生しました: " + e.message);
        }
    };

    /**
     * トリミング完了後の処理
     */
    const handleCropComplete = async () => {
        if (!imgRef.current) return;
        setIsCropping(false);
        setStatus("loading");
        setAdvancedDebugInfo(null);
        
        // 切り抜き
        let finalCanvas: HTMLCanvasElement;
        
        if (completedCrop && completedCrop.width > 0 && completedCrop.height > 0) {
            finalCanvas = getCroppedCanvas(imgRef.current, completedCrop);
        } else {
            // トリミング枠が指定されなかった場合は画像全体を使用
            finalCanvas = document.createElement('canvas');
            finalCanvas.width = imgRef.current.width;
            finalCanvas.height = imgRef.current.height;
            const ctx = finalCanvas.getContext('2d');
            ctx?.drawImage(imgRef.current, 0, 0);
        }
        
        await performOCR(finalCanvas);
    };

    const performOCR = async (croppedCanvas: HTMLCanvasElement) => {
        // OCR処理開始
        setStatus("loading");
        setErrorMessage("");
        setWarningMessage("");

        try {
            // 【領域別部分OCR】
            // ズレを想定し、少し広めに4領域を切り取る
            const w = croppedCanvas.width;
            const h = croppedCanvas.height;

            const createRegionCanvas = (rx: number, ry: number, rw: number, rh: number) => {
                const rc = document.createElement('canvas');
                rc.width = rw;
                rc.height = rh;
                const ctx = rc.getContext('2d');
                ctx?.drawImage(croppedCanvas, rx, ry, rw, rh, 0, 0, rw, rh);
                return rc;
            };

            // 1. 患者名領域 (左上: x:0~75%, y:0~40%)
            const nameCanvas = createRegionCanvas(0, 0, w * 0.75, h * 0.40);
            // 2. 生年月日領域 (左中上: x:0~75%, y:15~60%)
            const birthCanvas = createRegionCanvas(0, h * 0.15, w * 0.75, h * 0.45);
            // 3. 医療機関名領域 (右上: x:35~100%, y:0~55%)
            const clinicCanvas = createRegionCanvas(w * 0.35, 0, w * 0.65, h * 0.55);
            // 4. 交付年月日領域 (左中: x:0~75%, y:25~85%)
            const visitDateCanvas = createRegionCanvas(0, h * 0.25, w * 0.75, h * 0.60);

            // 並行タスクで部分OCRを実行
            const nameUrl = canvasToDataUrl(nameCanvas);
            const birthUrl = canvasToDataUrl(birthCanvas);
            const clinicUrl = canvasToDataUrl(clinicCanvas);
            const visitDateUrl = canvasToDataUrl(visitDateCanvas);

            const [nameRes, birthRes, clinicRes, visitDateRes] = await Promise.all([
                Tesseract.recognize(nameUrl, 'jpn'),
                Tesseract.recognize(birthUrl, 'jpn'),
                Tesseract.recognize(clinicUrl, 'jpn'),
                Tesseract.recognize(visitDateUrl, 'jpn')
            ]);
            
            const nameText = nameRes.data.text;
            const birthText = birthRes.data.text;
            const clinicText = clinicRes.data.text;
            const visitDateText = visitDateRes.data.text;

            // 各領域ごとに抽出関数をかけ、該当項目のみを採用する
            const extractedNameStr = extractRecord(nameText);
            const extractedBirthStr = extractRecord(birthText);
            const extractedClinicStr = extractRecord(clinicText);
            const extractedVisitDateStr = extractRecord(visitDateText);

            let pName = extractedNameStr.patientName;
            let pBirth = extractedBirthStr.birthDate;
            let pClinic = extractedClinicStr.clinicName;
            let pVisit = extractedVisitDateStr.visitDate;

            // date input のために形式をチェック
            if (pVisit && !/^\d{4}-\d{2}-\d{2}$/.test(pVisit)) {
                pVisit = "";
            }
            
            let finalRawText = `[Name Region]\n${nameText}\n\n[Birth Region]\n${birthText}\n\n[Clinic Region]\n${clinicText}\n\n[VisitDate Region]\n${visitDateText}`;
            let finalCorrectedText = `[Name]\n${extractedNameStr.correctedText}\n[Birth]\n${extractedBirthStr.correctedText}\n[Clinic]\n${extractedClinicStr.correctedText}\n[VisitDate]\n${extractedVisitDateStr.correctedText}`;
            let finalDebugInfo = { 
                patientCandidates: extractedNameStr.debug.patientCandidates,
                birthDateCandidates: extractedBirthStr.debug.birthDateCandidates,
                clinicCandidates: extractedClinicStr.debug.clinicCandidates,
                visitDateCandidates: extractedVisitDateStr.debug.visitDateCandidates
            };

            // 全文OCRへのフォールバック（部分OCRで不足している場合のみ）
            let fallbackFullText = "";
            if (!pName || !pBirth || !pVisit || !pClinic) {
                console.log("不足項目あり。全文OCRで補助実装を実行します...");
                let fallbackCanvas = croppedCanvas;
                
                // 前処理が強すぎた可能性がある場合は、元のグレースケールで作り直して再検証する
                if (preprocessMode === 'binarize' && rawImage) {
                    const fallbackProcessed = generateProcessedCanvas(rawImage, 'grayscale', rotationCorrection, skewAngle);
                    if (fallbackProcessed) {
                        if (completedCrop && completedCrop.width > 0 && completedCrop.height > 0) {
                            fallbackCanvas = getCroppedCanvas(fallbackProcessed, completedCrop);
                        } else {
                            fallbackCanvas = fallbackProcessed;
                        }
                    }
                }

                const fullDataUrl = canvasToDataUrl(fallbackCanvas);
                const fullResult = await Tesseract.recognize(fullDataUrl, 'jpn');
                const fullText = fullResult.data.text;
                fallbackFullText = fullText;
                
                // 文字が極端に少ない場合は手打ち画面へ
                if (fullText.trim().length < 5) {
                    setStatus("error");
                    setErrorMessage("画質が不十分で読み取れません。手入力で検索を開始してください。");
                    
                    if (process.env.NODE_ENV === 'development') {
                        setAdvancedDebugInfo({
                            originalUrl: rawImage?.src,
                            preprocessedUrl: cropSrc,
                            croppedUrl: canvasToDataUrl(croppedCanvas),
                            regions: {
                                name: { url: nameUrl, text: nameText },
                                birth: { url: birthUrl, text: birthText },
                                clinic: { url: clinicUrl, text: clinicText },
                                visit: { url: visitDateUrl, text: visitDateText },
                            },
                            fallbackText: fallbackFullText
                        });
                    }
                    return;
                }

                const extractedFull = extractRecord(fullText);
                
                // 空のものだけ全文OCR結果で埋め直す
                if (!pName) pName = extractedFull.patientName;
                if (!pBirth) pBirth = extractedFull.birthDate;
                if (!pClinic) pClinic = extractedFull.clinicName;
                if (!pVisit) {
                    pVisit = extractedFull.visitDate;
                    if (pVisit && !/^\d{4}-\d{2}-\d{2}$/.test(pVisit)) pVisit = "";
                }
                
                finalRawText += `\n\n[Full Region Fallback]\n${fullText}`;
                finalCorrectedText += "\n\n[Full]\n" + extractedFull.correctedText;
            }

            setPatientName(pName);
            setBirthDate(pBirth);
            setClinicName(pClinic);
            setVisitDate(pVisit);
            setRawOcrText(finalRawText);
            setCorrectedOcrText(finalCorrectedText);
            setDebugInfo(finalDebugInfo);
            setAdvancedDebugInfo({
                originalUrl: rawImage?.src,
                preprocessedUrl: cropSrc,
                croppedUrl: canvasToDataUrl(croppedCanvas),
                regions: {
                    name: { url: nameUrl, text: nameText },
                    birth: { url: birthUrl, text: birthText },
                    clinic: { url: clinicUrl, text: clinicText },
                    visit: { url: visitDateUrl, text: visitDateText },
                },
                fallbackText: fallbackFullText
            });

            // 患者名と交付日のいずれかが空行の場合は警告を出し、プレビューを自動で開く
            if (!pName || !pVisit) {
                setWarningMessage("患者名または交付日の抽出に失敗しました。画像を確認しながら必要な項目（患者名・交付日）を手入力してください。");
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
        setCropSrc("");
        setIsCropping(false);
        setCrop(undefined);
        setSkewAngle(0);
        setShowRawOcrText(false);
        setErrorMessage("");
        setWarningMessage("");
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!patientName || !visitDate) {
            setErrorMessage("検索に必要な情報（患者名および交付日）が不足しています。");
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

            {status === 'error' && !isCropping && (
                <div style={{ padding: '16px', backgroundColor: '#fef2f2', color: 'var(--danger-color)', borderRadius: '8px', marginBottom: '24px' }}>
                    {errorMessage}
                </div>
            )}

            {isCropping && cropSrc && (
                <div style={{ marginBottom: '24px' }}>
                    <div style={{ padding: '16px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '8px', marginBottom: '16px' }}>
                        <strong>付箋や別紙が大きく写り込んでいる場合は除外してください。</strong>文字がまっすぐになるよう必要に応じて右回転やスライダーで微調整し、処方箋の本文領域だけを囲んでください。
                    </div>
                    <div style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>画質調整:</span>
                            <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                <input type="radio" value="grayscale" checked={preprocessMode === 'grayscale'} onChange={() => setPreprocessMode('grayscale')} />
                                白黒のみ
                            </label>
                            <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                <input type="radio" value="none" checked={preprocessMode === 'none'} onChange={() => setPreprocessMode('none')} />
                                元画像
                            </label>
                            <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                <input type="radio" value="binarize" checked={preprocessMode === 'binarize'} onChange={() => setPreprocessMode('binarize')} />
                                コントラスト強
                            </label>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button 
                                type="button"
                                onClick={handleManualRotate}
                                style={{ padding: '8px 16px', backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                                右に90度回転
                            </button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 auto', minWidth: '150px', backgroundColor: '#f8fafc', padding: '8px 16px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                <span style={{ fontSize: '0.9rem', color: '#475569', whiteSpace: 'nowrap' }}>微調整: {skewAngle}°</span>
                                <input 
                                    type="range" 
                                    min="-15" 
                                    max="15" 
                                    step="1" 
                                    value={skewAngle} 
                                    onChange={handleSkewChange}
                                    style={{ flex: 1, cursor: 'pointer' }}
                                />
                            </div>
                        </div>
                    </div>
                    <ReactCrop 
                        crop={crop} 
                        onChange={c => setCrop(c)} 
                        onComplete={c => setCompletedCrop(c)}
                    >
                        <img ref={imgRef} src={cropSrc} alt="Crop" style={{ maxWidth: '100%' }} />
                    </ReactCrop>
                    <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
                        <button 
                            type="button"
                            onClick={handleCropComplete}
                            className="btn-primary"
                            style={{ flex: 1 }}
                        >
                            この範囲でOCR実行
                        </button>
                        <button 
                            type="button"
                            onClick={handleFullOcrTest}
                            style={{ padding: '8px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' }}
                        >
                            全文OCRテスト
                        </button>
                    </div>
                </div>
            )}

            {(status === 'idle' || status === 'error') && !isCropping && (
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

            {(status === 'success' || status === 'error') && !isCropping && (
                <div>
                    {status === 'error' ? (
                        <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#fef2f2', color: 'var(--danger-color)', borderRadius: '8px', borderLeft: '4px solid #ef4444' }}>
                            <p style={{ margin: 0, fontWeight: 'bold' }}>{errorMessage}</p>
                            <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem' }}>そのまま手入力で必要な情報（患者名および交付日）を入力し、検索を続行できます。</p>
                        </div>
                    ) : warningMessage ? (
                        <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#fffbeb', color: '#b45309', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
                            {warningMessage}
                            <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem', fontWeight: 'bold' }}>※ 患者名・交付日だけでも検索可能です。</p>
                        </div>
                    ) : (
                        <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#ecfdf5', color: '#047857', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
                            読み取りが完了しました。内容を確認し、必要に応じて修正してください。
                            <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem' }}>※ 患者名・交付日だけでも検索可能です。</p>
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
                                type="date"
                                value={visitDate}
                                onChange={e => setVisitDate(e.target.value)}
                                style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '1.05rem', backgroundColor: '#fff', color: '#1e293b' }}
                                required
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

                    {/* OCR全文プレビュー (原因切り分け用・開発環境のみ) */}
                    {process.env.NODE_ENV === 'development' && (
                        <div style={{ marginTop: '32px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <div 
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontWeight: 600, color: 'var(--text-muted)' }}
                                onClick={() => setShowRawOcrText(!showRawOcrText)}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                                    OCR全文プレビュー (開発用)
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
                    )}
                    {process.env.NODE_ENV === 'development' && advancedDebugInfo && (
                        <div style={{ marginTop: '32px', padding: '16px', backgroundColor: '#fff1f2', borderRadius: '8px', border: '1px solid #fecdd3' }}>
                            <h3 style={{ fontSize: '1rem', color: '#be123c', marginBottom: '16px', borderBottom: '1px solid #fda4af', paddingBottom: '8px' }}>
                                🕵️‍♀️ 画像処理・OCR 詳細デバッグ情報
                            </h3>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)', gap: '16px', marginBottom: '24px' }}>
                                <div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>1. 元画像(自動回転後)</div>
                                    <img src={advancedDebugInfo.originalUrl} style={{ width: '100%', height: 'auto', border: '1px solid #ccc' }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>2. 前処理後(表示用)</div>
                                    <img src={advancedDebugInfo.preprocessedUrl} style={{ width: '100%', height: 'auto', border: '1px solid #ccc' }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>3. トリミング後</div>
                                    <img src={advancedDebugInfo.croppedUrl} style={{ width: '100%', height: 'auto', border: '1px solid #ccc' }} />
                                </div>
                            </div>

                            <h4 style={{ fontSize: '0.9rem', marginBottom: '8px' }}>4. 部分OCR 領域分割 と 生テキスト</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px', marginBottom: '16px' }}>
                                <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', padding: '8px', borderRadius: '4px' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>患者名 領域</div>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                        <div style={{ flex: '1', minWidth: '0' }}><img src={advancedDebugInfo.regions.name.url} style={{ width: '100%', border: '1px dashed #ccc' }} /></div>
                                        <div style={{ flex: '1', minWidth: '0', fontSize: '0.75rem', overflow: 'auto', maxHeight: '100px', backgroundColor: '#f8fafc', padding: '4px', fontFamily: 'monospace' }}>{advancedDebugInfo.regions.name.text || '(空)'}</div>
                                    </div>
                                </div>
                                <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', padding: '8px', borderRadius: '4px' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>生年月日 領域</div>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                        <div style={{ flex: '1', minWidth: '0' }}><img src={advancedDebugInfo.regions.birth.url} style={{ width: '100%', border: '1px dashed #ccc' }} /></div>
                                        <div style={{ flex: '1', minWidth: '0', fontSize: '0.75rem', overflow: 'auto', maxHeight: '100px', backgroundColor: '#f8fafc', padding: '4px', fontFamily: 'monospace' }}>{advancedDebugInfo.regions.birth.text || '(空)'}</div>
                                    </div>
                                </div>
                                <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', padding: '8px', borderRadius: '4px' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>医療機関名 領域</div>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                        <div style={{ flex: '1', minWidth: '0' }}><img src={advancedDebugInfo.regions.clinic.url} style={{ width: '100%', border: '1px dashed #ccc' }} /></div>
                                        <div style={{ flex: '1', minWidth: '0', fontSize: '0.75rem', overflow: 'auto', maxHeight: '100px', backgroundColor: '#f8fafc', padding: '4px', fontFamily: 'monospace' }}>{advancedDebugInfo.regions.clinic.text || '(空)'}</div>
                                    </div>
                                </div>
                                <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', padding: '8px', borderRadius: '4px' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>交付年月日 領域</div>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                        <div style={{ flex: '1', minWidth: '0' }}><img src={advancedDebugInfo.regions.visit.url} style={{ width: '100%', border: '1px dashed #ccc' }} /></div>
                                        <div style={{ flex: '1', minWidth: '0', fontSize: '0.75rem', overflow: 'auto', maxHeight: '100px', backgroundColor: '#f8fafc', padding: '4px', fontFamily: 'monospace' }}>{advancedDebugInfo.regions.visit.text || '(空)'}</div>
                                    </div>
                                </div>
                            </div>
                            
                            <h4 style={{ fontSize: '0.9rem', marginBottom: '8px' }}>5. 全文OCRフォールバック 結果</h4>
                            <div style={{ padding: '8px', backgroundColor: '#fff', fontSize: '0.8rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: '150px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                                {advancedDebugInfo.fallbackText ? advancedDebugInfo.fallbackText : '(フォールバック未実行)'}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
