/**
 * OCR特有の誤認識を事前に補正するルール
 */
export const OCR_CORRECTIONS = [
    { from: /信和/g, to: '令和' },
    { from: /会和/g, to: '令和' },
];

/**
 * 生のOCRテキストに補正ルールを適用して返す
 */
export function applyCorrections(text: string): string {
    if (!text) return "";
    let corrected = text;
    for (const rule of OCR_CORRECTIONS) {
        corrected = corrected.replace(rule.from, rule.to);
    }
    return corrected;
}

/**
 * 和暦・西暦、および揺らぎのある日付文字列を YYYY-MM-DD に正規化する
 */
export function normalizeDateString(dateStr: string): string {
    if (!dateStr) return "";
    
    // 空白除去
    let normalized = dateStr.replace(/\s+/g, '');

    // 和暦の変換 (令和・平成・昭和・大正・明治)
    const warekiMatch = normalized.match(/(令和|平成|昭和|大正|明治)([元0-9０-９]+)年([0-9０-９]{1,2})月([0-9０-９]{1,2})日?/);
    if (warekiMatch) {
        const era = warekiMatch[1];
        let yearStr = warekiMatch[2];
        if (yearStr === '元') yearStr = '1';
        else yearStr = yearStr.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
        
        const monthStr = warekiMatch[3].replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
        const dayStr = warekiMatch[4].replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
        
        let yearNum = parseInt(yearStr, 10);
        if (era === '令和') yearNum += 2018;
        if (era === '平成') yearNum += 1988;
        if (era === '昭和') yearNum += 1925;
        if (era === '大正') yearNum += 1911;
        if (era === '明治') yearNum += 1867;
        
        const m = monthStr.padStart(2, '0');
        const d = dayStr.padStart(2, '0');
        return `${yearNum}-${m}-${d}`;
    }

    // YYYY年MM月DD日 のフォールバック
    const ymdMatch = normalized.match(/([0-9]{4})年([0-9]{1,2})月([0-9]{1,2})日?/);
    if (ymdMatch) {
        const y = ymdMatch[1];
        const m = ymdMatch[2].padStart(2, '0');
        const d = ymdMatch[3].padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // YYYY/MM/DD または YYYY-MM-DD または YYYY.MM.DD のフォールバック
    const slSlashMatch = normalized.match(/([0-9]{4})[\/\.\-]([0-9]{1,2})[\/\.\-]([0-9]{1,2})/);
    if (slSlashMatch) {
        const y = slSlashMatch[1];
        const m = slSlashMatch[2].padStart(2, '0');
        const d = slSlashMatch[3].padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    return dateStr;
}

export interface OcrExtractionResult {
    correctedText: string;
    patientName: string;
    birthDate: string;
    clinicName: string;
    visitDate: string;
    debug: {
        patientCandidates: string[];
        birthDateCandidates: string[];
        clinicCandidates: string[];
        visitDateCandidates: string[];
    };
}

/**
 * OCRテキストを受け取り、すべての候補を独立抽出し、排他ルールのもと最終値を決定して返す統合ロジック
 */
export function extractRecord(rawText: string): OcrExtractionResult {
    const text = applyCorrections(rawText);
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // 候補リスト
    let patientCandidates: string[] = [];
    let clinicCandidates: string[] = [];
    let birthDateCandidates: string[] = [];
    let visitDateCandidates: string[] = [];

    // 患者名として絶対に見なさない禁止語（これを含む行は患者名から外す）
    const excludeFromPatient = ['クリニック', '医院', '病院', '診療所', '薬局', 'センター', '医療法人'];
    // 医療機関名として優先的に拾う語彙
    const clinicKeywords = ['クリニック', '医院', '病院', '診療所', '医療法人'];

    // --- STEP 1: 各行の走査と候補抽出 ---
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // ▼医療機関名の候補
        const clinicMatch = line.match(/(?:医療機関名|保険医療機関|医療機関|病院名)\s*[:：]?\s*(.*)/);
        if (clinicMatch && clinicMatch[1].trim()) {
            clinicCandidates.push(clinicMatch[1].trim());
        } else if (clinicKeywords.some(k => line.includes(k))) {
            const cleanLine = line.split(/\s+/)[0]; // スペースで区切られるケース対策
            clinicCandidates.push(cleanLine);
        } else if (line.match(/^(医療機関名|保険医療機関|医療機関|病院名)\s*[:：]?$/)) {
            // 見出しの次行にあるケース
            if (i + 1 < lines.length) clinicCandidates.push(lines[i + 1].trim());
        }

        // ▼患者名の候補
        const patientMatch = line.match(/(?:氏名|患者名|受給者氏名)\s*[:：]?\s*(.*)/);
        if (patientMatch && patientMatch[1].trim()) {
            patientCandidates.push(patientMatch[1].replace(/様$/, '').trim());
        } else if (line.match(/^(氏名|患者名|受給者氏名)\s*[:：]?$/)) {
            if (i + 1 < lines.length) patientCandidates.push(lines[i + 1].replace(/様$/, '').trim());
        } else if (line.endsWith('様') && line.length < 30) {
            patientCandidates.push(line.replace(/様$/, '').trim());
        } else if (line.length >= 2 && line.length <= 15) {
            // 見出しなしの救済: 数字などを含まない姓名っぽいもの
            if (line.match(/^[ぁ-んァ-ン一-龥a-zA-Z]+(?:[\s　]+[ぁ-んァ-ン一-龥a-zA-Z]+)?$/) && !line.match(/[0-9〇]/)) {
                // ただし禁止語が含まれていたら無視
                if (!excludeFromPatient.some(k => line.includes(k))) {
                    patientCandidates.push(line);
                }
            }
        }

        // ▼生年月日の候補
        const bDateMatch = line.match(/(?:生年月日|生年)\s*[:：]?\s*(.*)/);
        if (bDateMatch && bDateMatch[1].trim()) {
            birthDateCandidates.push(bDateMatch[1].trim());
        } else if (line.match(/^(生年月日|生年)\s*[:：]?$/)) {
            if (i + 1 < lines.length) birthDateCandidates.push(lines[i + 1].trim());
        } else if (line.match(/(昭和|大正|明治|平成)([元0-9０-９]+)年([0-9０-９]{1,2})月([0-9０-９]{1,2})日/)) {
            birthDateCandidates.push(line);
        } else if (line.match(/(19[0-9]{2}|200[0-9]|201[0-9])[年\/\.\-]([0-9]{1,2})[月\/\.\-]([0-9]{1,2})/)) {
            birthDateCandidates.push(line);
        }

        // ▼交付日の候補
        const vDateMatch = line.match(/(?:交付日|処方日|発行日)\s*[:：]?\s*(.*)/);
        if (vDateMatch && vDateMatch[1].trim()) {
            visitDateCandidates.push(vDateMatch[1].trim());
        } else if (line.match(/^(交付日|処方日|発行日)\s*[:：]?$/)) {
            if (i + 1 < lines.length) visitDateCandidates.push(lines[i + 1].trim());
        } else if (line.match(/令和([元0-9０-９]+)年([0-9０-９]{1,2})月([0-9０-９]{1,2})日?/)) {
            visitDateCandidates.push(line);
        } else if (line.match(/202[0-9][年\/\.\-]([0-9]{1,2})[月\/\.\-]([0-9]{1,2})/)) {
            visitDateCandidates.push(line);
        }
    }

    // --- STEP 2: 排他ルールに基づく項目確定 ---
    let finalPatientName = "";
    let finalClinicName = "";
    let finalBirthDate = "";
    let finalVisitDate = "";

    // 1. 生年月日
    if (birthDateCandidates.length > 0) {
        finalBirthDate = normalizeDateString(birthDateCandidates[0]);
    }

    // 2. 交付日 (生年月日と被っているものは回避)
    for (const cand of visitDateCandidates) {
        const norm = normalizeDateString(cand);
        if (norm !== finalBirthDate && norm !== "") {
            finalVisitDate = norm;
            break;
        }
    }

    // 3. 医療機関名 (必ず先にアサインして保護)
    for (const cand of clinicCandidates) {
        if (cand && cand.length > 0) {
            finalClinicName = cand;
            break;
        }
    }

    // 4. 患者名 (医療機関名と被ったり、禁止語を含むものは厳密に除外)
    for (const cand of patientCandidates) {
        if (!cand) continue;
        if (cand === finalClinicName) continue;
        if (excludeFromPatient.some(k => cand.includes(k))) continue;
        
        finalPatientName = cand;
        break;
    }

    return {
        correctedText: text,
        patientName: finalPatientName,
        birthDate: finalBirthDate,
        clinicName: finalClinicName,
        visitDate: finalVisitDate,
        debug: {
            patientCandidates,
            clinicCandidates,
            birthDateCandidates,
            visitDateCandidates
        }
    };
}
