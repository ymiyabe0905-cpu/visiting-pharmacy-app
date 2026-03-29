// src/lib/normalize.ts

/**
 * 全ての数字を半角に変換する
 */
export function toHalfWidthNumbers(str: string): string {
    if (!str) return '';
    return str.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
}

/**
 * 全ての英字を半角・大文字に変換する
 */
export function toHalfWidthUpperCaseLetters(str: string): string {
    if (!str) return '';
    return str.replace(/[ａ-ｚＡ-Ｚ]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0)).toUpperCase();
}

/**
 * カタカナを全角に、濁点・半濁点を結合するなどの正規化処理は今回は簡易的に空白除去のみとします
 */

/**
 * 文字列の正規化（全角半角の統一、大文字小文字の統一、空白除去）
 */
export function normalizeString(str: string): string {
    if (!str) return '';

    // 1. 全角英数字を半角へ
    let normalized = toHalfWidthNumbers(toHalfWidthUpperCaseLetters(str));

    // 2. 全角・半角スペースの除去
    normalized = normalized.replace(/[\s　]+/g, '');

    // 3. 小文字大文字の統一 (すでに上でやっているが念のため)
    normalized = normalized.toUpperCase();

    return normalized;
}

/**
 * 患者名比較用の正規化
 * 姓と名の間のスペースや、全角半角の違いを吸収する
 */
export function normalizePatientName(name: string): string {
    if (!name) return '';
    return normalizeString(name);
}

/**
 * 医療機関名比較用の正規化
 * 法人種別（医療法人社団など）や、接尾語（クリニック、医院、診療所など）を除去して
 * コアな名前部分だけで比較しやすくする
 */
export function normalizeClinicName(name: string): string {
    if (!name) return '';

    let normalized = normalizeString(name);

    // よくある接頭・接尾語、法人格の除去
    const prefixesAndSuffixes = [
        '医療法人社団',
        '医療法人財団',
        '医療法人',
        '特定医療法人',
        '社会医療法人',
        'クリニック',
        '医院',
        '診療所',
        '病院',
        '歯科',
        '内科',
        '小児科',
        '整形外科',
        '眼科',
        '耳鼻咽喉科',
        '皮膚科'
    ];

    for (const word of prefixesAndSuffixes) {
        // 正規表現で単語ごとに置換（空白はすでに除去済み）
        const regex = new RegExp(word, 'g');
        normalized = normalized.replace(regex, '');
    }

    return normalized;
}

/**
 * 日付文字列の正規化 (YYYY-MM-DD 形式に揃えようとする簡易なもの)
 * OCR結果向け（"2023年4月1日", "2023/04/01", "2023.4.1" などを YYYY-MM-DD に）
 */
export function normalizeDate(dateStr: string): string {
    if (!dateStr) return '';

    let normalized = toHalfWidthNumbers(dateStr).replace(/[\s　]+/g, '');
    normalized = normalized.replace(/[年月/\.]/g, '-').replace(/日/g, '');

    // "2023-4-1" -> "2023-04-01" のようなゼロ埋め
    const parts = normalized.split('-');
    if (parts.length === 3) {
        const year = parts[0];
        const month = parts[1].padStart(2, '0');
        const day = parts[2].padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    return normalized;
}
