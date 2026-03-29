/**
 * OCR特有の誤認識を事前に補正するルール
 * 今後必要に応じて配列にルールを追加できます。
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
    // 例: 令和6年3月29日, 平成30年10月1日, 令和元年5月1日
    const warekiMatch = normalized.match(/(令和|平成|昭和|大正|明治)([元0-9０-９]+)年([0-9０-９]{1,2})月([0-9０-９]{1,2})日?/);
    if (warekiMatch) {
        const era = warekiMatch[1];
        let yearStr = warekiMatch[2];
        
        // 「元」は1年に置換し、全角数字は半角に置換
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

    // どのパターンにも一致しない場合は元の文字列を返す
    return dateStr;
}

/**
 * テキストから「患者名」を抽出する
 */
export function extractPatientName(text: string): string {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    
    // パターン1: 見出し付き
    const headerPatterns = [
        /(?:氏名|患者名|受給者氏名)\s*[:：]?\s*([^\n]+)/,
    ];
    for (const pattern of headerPatterns) {
        const match = text.match(pattern);
        if (match) {
            const name = match[1].replace(/様$/, '').trim();
            if (name.length > 0 && name.length < 30) return name;
        }
    }

    // パターン2: 「様」で終わる行
    for (const line of lines) {
        if (line.endsWith('様') && line.length < 30) {
            return line.replace(/様$/, '').trim();
        }
    }
    
    // パターン3: 見出しなし補助ロジック (姓名の間にスペースがあり、数字を含まない2〜15文字の行)
    for (const line of lines) {
        if (line.length >= 2 && line.length <= 15) {
            if (!line.includes('医院') && !line.includes('クリニック') && !line.includes('病院') && !line.match(/[0-9〇]/)) {
                // 平仮名、カタカナ、漢字、スペースの組み合わせだけなら名前の可能性が高い
                if (line.match(/^[ぁ-んァ-ン一-龥a-zA-Z]+(?:[\s　]+[ぁ-んァ-ン一-龥a-zA-Z]+)?$/)) {
                    return line;
                }
            }
        }
    }
    return "";
}

/**
 * テキストから「生年月日」を抽出する
 */
export function extractBirthDate(text: string): string {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // パターン1: 見出し付き
    const match = text.match(/(?:生年月日|生年)\s*[:：]?\s*([^\n]+)/);
    if (match) {
        return normalizeDateString(match[1].trim());
    }

    // パターン2: 見出しなし補助ロジック (おそらく過去の日付、特に昭和や平成など)
    for (const line of lines) {
        // 昭和か平成が含まれていて、日付フォーマットの場合
        if (line.match(/(昭和|大正|明治|平成)([元0-9０-９]+)年([0-9０-９]{1,2})月([0-9０-９]{1,2})日/)) {
            return normalizeDateString(line);
        }
        // 古い西暦（例: 19XX年、200X年）
        if (line.match(/(19[0-9]{2}|200[0-9]|201[0-9])[年\/\.\-]([0-9]{1,2})[月\/\.\-]([0-9]{1,2})/)) {
            return normalizeDateString(line);
        }
    }
    return "";
}

/**
 * テキストから「医療機関名」を抽出する
 */
export function extractClinicName(text: string): string {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    
    // パターン1: 見出し付き
    const match = text.match(/(?:医療機関名|保険医療機関|名称)\s*[:：]?\s*([^\n]+)/);
    if (match) {
        let clinic = match[1].trim();
        // 見出し行そのものがマッチしてしまうケースを防ぐ
        if (clinic !== "医療機関名" && clinic !== "保険医療機関") {
            return clinic;
        }
    }
    
    // パターン2: 見出しなし補助ロジック (行末が「医院」「クリニック」「病院」「診療所」)
    for (const line of lines) {
        if (line.match(/(医院|クリニック|病院|診療所)$/)) {
            return line;
        }
    }

    // パターン3: 見出しなし補助ロジック (行の途中に「医院」「クリニック」「病院」「診療所」を含む)
    for (const line of lines) {
        if (line.match(/(医院|クリニック|病院|診療所)/)) {
            return line.split(/\s+/)[0]; // スペース等で区切られた最初の語彙を返す
        }
    }
    
    return "";
}

/**
 * テキストから「交付日（訪問日）」を抽出する
 */
export function extractVisitDate(text: string): string {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // パターン1: 見出し付き
    const match = text.match(/(?:交付|処方|発行)[年月日]*\s*[:：]?\s*([^\n]+)/);
    if (match) {
        return normalizeDateString(match[1].trim());
    }

    // パターン2: 見出しなし補助ロジック (最近の日付、特に令和か今年度に近い西暦)
    for (const line of lines) {
        // 令和が含まれていて、日付フォーマットの場合
        if (line.match(/令和([元0-9０-９]+)年([0-9０-９]{1,2})月([0-9０-９]{1,2})日/)) {
            return normalizeDateString(line);
        }
        // 最近の西暦（例: 202X年）
        if (line.match(/202[0-9][年\/\.\-]([0-9]{1,2})[月\/\.\-]([0-9]{1,2})/)) {
            return normalizeDateString(line);
        }
    }
    return "";
}

/**
 * OCRテキストを受け取り、すべての項目を抽出してオブジェクトで返す
 */
export function extractRecord(rawText: string) {
    const text = applyCorrections(rawText);

    return {
        correctedText: text,
        patientName: extractPatientName(text),
        birthDate: extractBirthDate(text),
        clinicName: extractClinicName(text),
        visitDate: extractVisitDate(text),
    };
}
