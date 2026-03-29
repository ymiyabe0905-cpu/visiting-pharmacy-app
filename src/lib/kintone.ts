// src/lib/kintone.ts
// このファイルはバックエンドAPIルートからのみ読み込まれ、フロントエンドから参照されないようにします。
import 'server-only';

export const KINTONE_BASE_URL = process.env.KINTONE_BASE_URL || '';
export const KINTONE_API_TOKEN = process.env.KINTONE_API_TOKEN || '';
export const KINTONE_APP_ID = process.env.KINTONE_APP_ID || '';

// ユーザー指定のフィールドコード
export const KINTONE_FIELDS = {
    PATIENT_NAME: process.env.KINTONE_FIELD_PATIENT_NAME || '文字列__1行_',
    BIRTH_DATE: process.env.KINTONE_FIELD_BIRTH_DATE || '日付_0',
    CLINIC_NAME: process.env.KINTONE_FIELD_CLINIC_NAME || '文字列__1行__0',
    VISIT_DATE: process.env.KINTONE_FIELD_VISIT_DATE || '日付',
    FACILITY_NAME: process.env.KINTONE_FIELD_FACILITY_NAME || '文字列__1行__1',
    VISIT_STATUS: process.env.KINTONE_FIELD_VISIT_STATUS || 'ドロップダウン_0',
    RECORD_ID: process.env.KINTONE_FIELD_ID || 'レコード番号',
    VISIT_NOTES: process.env.KINTONE_FIELD_VISIT_NOTES || '訪問時注意',
    NEXT_NOTES: process.env.KINTONE_FIELD_NEXT_NOTES || '次回申し送り事項',
    VISIT_TYPE: process.env.KINTONE_FIELD_VISIT_TYPE || '訪問種類',
    ASSIGNEE: process.env.KINTONE_FIELD_ASSIGNEE || '担当者',
} as const;

export const TARGET_VISIT_STATUS = process.env.TARGET_VISIT_STATUS || '処方あり';

const USE_MOCK_DATA = process.env.USE_MOCK_DATA === 'true';

/**
 * モックデータを生成するヘルパー関数
 */
const getMockRecords = (query: string) => {
    // $id = "xxx" (単一レコード取得) の場合
    if (query.includes('$id =')) {
        const idMatch = query.match(/\$id = "([^"]+)"/);
        const id = idMatch ? idMatch[1] : '1';
        return {
            records: [{
                $id: { value: id },
                [KINTONE_FIELDS.RECORD_ID]: { value: `REC-${id}` },
                [KINTONE_FIELDS.PATIENT_NAME]: { value: '山田 太郎' },
                [KINTONE_FIELDS.BIRTH_DATE]: { value: '1945-05-15' },
                [KINTONE_FIELDS.CLINIC_NAME]: { value: '〇〇クリニック' },
                [KINTONE_FIELDS.VISIT_DATE]: { value: new Date().toISOString().split('T')[0] },
                [KINTONE_FIELDS.FACILITY_NAME]: { value: 'さくら介護施設' },
                [KINTONE_FIELDS.VISIT_STATUS]: { value: '未処理' },
            }]
        };
    }

    // 施設スケジュール取得の場合
    if (query.includes(KINTONE_FIELDS.FACILITY_NAME) && !query.includes(KINTONE_FIELDS.PATIENT_NAME)) {
        const today = new Date();
        const futureStr1 = new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const futureStr2 = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        return {
            records: [
                { [KINTONE_FIELDS.VISIT_DATE]: { value: futureStr1 } },
                { [KINTONE_FIELDS.VISIT_DATE]: { value: futureStr1 } },
                { [KINTONE_FIELDS.VISIT_DATE]: { value: futureStr2 } },
            ]
        };
    }

    // 患者スケジュール取得の場合 (患者名での検索で、$id指定がなく施設名検索でもない)
    if (query.includes(KINTONE_FIELDS.PATIENT_NAME) && !query.includes('$id =') && !query.includes('like')) {
        const today = new Date();
        const future1 = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const future2 = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        return {
            records: [
                {
                    $id: { value: '901' },
                    [KINTONE_FIELDS.RECORD_ID]: { value: 'REC-901' },
                    [KINTONE_FIELDS.PATIENT_NAME]: { value: '山田 太郎' },
                    [KINTONE_FIELDS.VISIT_DATE]: { value: future1 },
                    [KINTONE_FIELDS.CLINIC_NAME]: { value: '別の内科クリニック' },
                    [KINTONE_FIELDS.VISIT_STATUS]: { value: '処方あり' },
                    [KINTONE_FIELDS.VISIT_TYPE]: { value: '定期訪問' },
                    [KINTONE_FIELDS.ASSIGNEE]: { value: '鈴木 薬剤師' }
                },
                {
                    $id: { value: '902' },
                    [KINTONE_FIELDS.RECORD_ID]: { value: 'REC-902' },
                    [KINTONE_FIELDS.PATIENT_NAME]: { value: '山田 太郎' },
                    [KINTONE_FIELDS.VISIT_DATE]: { value: future2 },
                    [KINTONE_FIELDS.CLINIC_NAME]: { value: '〇〇クリニック' },
                    [KINTONE_FIELDS.VISIT_STATUS]: { value: '未処理' },
                    [KINTONE_FIELDS.VISIT_TYPE]: { value: '臨時訪問' },
                    [KINTONE_FIELDS.ASSIGNEE]: { value: '佐藤 薬剤師' }
                }
            ]
        };
    }

    // 検索の場合 (候補リスト)
    const todayDate = new Date().toISOString().split('T')[0];
    return {
        records: [
            {
                $id: { value: '101' },
                [KINTONE_FIELDS.RECORD_ID]: { value: 'REC-101' },
                [KINTONE_FIELDS.PATIENT_NAME]: { value: '山田 太郎' },
                [KINTONE_FIELDS.BIRTH_DATE]: { value: '1945-05-15' },
                [KINTONE_FIELDS.CLINIC_NAME]: { value: '〇〇クリニック' },
                [KINTONE_FIELDS.VISIT_DATE]: { value: todayDate },
                [KINTONE_FIELDS.FACILITY_NAME]: { value: 'さくら介護施設' },
                [KINTONE_FIELDS.VISIT_STATUS]: { value: '未処理' },
            },
            {
                $id: { value: '102' },
                [KINTONE_FIELDS.RECORD_ID]: { value: 'REC-102' },
                [KINTONE_FIELDS.PATIENT_NAME]: { value: '山田 花子' },
                [KINTONE_FIELDS.BIRTH_DATE]: { value: '1950-10-20' },
                [KINTONE_FIELDS.CLINIC_NAME]: { value: '△△医院' },
                [KINTONE_FIELDS.VISIT_DATE]: { value: todayDate },
                [KINTONE_FIELDS.FACILITY_NAME]: { value: 'ひまわりホーム' },
                [KINTONE_FIELDS.VISIT_STATUS]: { value: '未処理' },
            }
        ]
    };
};

/**
 * kintone REST APIの共通ヘッダーを生成する
 */
export const getKintoneHeaders = () => {
    if (!USE_MOCK_DATA && !KINTONE_API_TOKEN) {
        console.error('KINTONE_API_TOKEN is not set');
        throw new Error('500: Server configuration error');
    }

    return {
        'X-Cybozu-API-Token': KINTONE_API_TOKEN,
        'Content-Type': 'application/json',
    };
};

/**
 * kintoneのレコード検索関数 (共通)
 */
export async function getKintoneRecords(query: string) {
    if (USE_MOCK_DATA) {
        console.log('[MOCK] getKintoneRecords called with query:', query);
        // モックの遅延をシミュレート
        await new Promise(resolve => setTimeout(resolve, 800));
        return getMockRecords(query);
    }

    const url = `${KINTONE_BASE_URL}/k/v1/records.json?app=${KINTONE_APP_ID}&query=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
        method: 'GET',
        headers: getKintoneHeaders(),
        cache: 'no-store', // 常に最新状態を取得
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error('kintone get records error:', response.status, errorBody);
        throw new Error('kintone接続に失敗しました。時間をおいて再度お試しください。');
    }

    return response.json();
}

/**
 * kintoneの1レコード更新関数 (共通)
 */
export async function updateKintoneRecord(id: string, record: any) {
    if (USE_MOCK_DATA) {
        console.log(`[MOCK] updateKintoneRecord called for ID: ${id}`, record);
        // モックの遅延をシミュレート
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { revision: '2' };
    }

    const url = `${KINTONE_BASE_URL}/k/v1/record.json`;
    const response = await fetch(url, {
        method: 'PUT',
        headers: getKintoneHeaders(),
        body: JSON.stringify({
            app: KINTONE_APP_ID,
            id: id,
            record: record,
        }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`kintone update record error (ID: ${id}):`, response.status, errorBody);
        throw new Error('更新に失敗しました。対象レコードを確認してください。');
    }

    return response.json();
}
