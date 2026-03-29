import { NextResponse } from 'next/server';
import { getKintoneRecords, KINTONE_FIELDS } from '@/lib/kintone';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const patientName = searchParams.get('patientName');
        const birthDate = searchParams.get('birthDate');
        const excludeId = searchParams.get('excludeId');
        const baseDateStr = searchParams.get('baseDate'); // YYYY-MM-DD

        if (!patientName) {
            return NextResponse.json({ schedule: [] });
        }

        // 基準日がなければ今日にする
        const baseDate = baseDateStr ? new Date(baseDateStr) : new Date();

        // 基準日から14日間
        const futureDate = new Date(baseDate);
        futureDate.setDate(baseDate.getDate() + 14);

        const startStr = baseDate.toISOString().split('T')[0];
        const endStr = futureDate.toISOString().split('T')[0];

        // 第一条件: 患者名が一致し、日付が基準日～14日目以内のレコードを取得
        let query = `${KINTONE_FIELDS.PATIENT_NAME} = "${patientName}" and ${KINTONE_FIELDS.VISIT_DATE} >= "${startStr}" and ${KINTONE_FIELDS.VISIT_DATE} <= "${endStr}"`;

        // 可能なら生年月日も条件に加える
        if (birthDate) {
            query += ` and ${KINTONE_FIELDS.BIRTH_DATE} = "${birthDate}"`;
        }

        const kintoneResp = await getKintoneRecords(query);
        const records = kintoneResp.records || [];

        // 現在選択中のレコード自身は除外する＆必要な情報を抽出
        const schedule = records
            .filter((rec: any) => {
                const recId = rec.$id?.value || rec[KINTONE_FIELDS.RECORD_ID]?.value;
                return recId !== excludeId;
            })
            .map((rec: any) => {
                return {
                    id: rec.$id?.value,
                    visitDate: rec[KINTONE_FIELDS.VISIT_DATE]?.value,
                    clinicName: rec[KINTONE_FIELDS.CLINIC_NAME]?.value || '-',
                    status: rec[KINTONE_FIELDS.VISIT_STATUS]?.value || '未設定',
                    visitType: rec[KINTONE_FIELDS.VISIT_TYPE]?.value || '',
                    assignee: rec[KINTONE_FIELDS.ASSIGNEE]?.value || '',
                };
            })
            // 日付順にソート
            .sort((a: any, b: any) => {
                if (a.visitDate < b.visitDate) return -1;
                if (a.visitDate > b.visitDate) return 1;
                return 0;
            });

        return NextResponse.json({ schedule });

    } catch (error: any) {
        console.error('Patient Schedule API Error:', error);
        return NextResponse.json(
            { error: '患者スケジュールの取得に失敗しました。' },
            { status: 500 }
        );
    }
}
