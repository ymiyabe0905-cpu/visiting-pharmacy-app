import { NextResponse } from 'next/server';
import { getKintoneRecords, KINTONE_FIELDS } from '@/lib/kintone';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const facilityName = searchParams.get('facilityName');

        // 施設名がない場合や空白の場合は検索不要
        if (!facilityName || facilityName.trim() === '') {
            return NextResponse.json({ schedule: {} });
        }

        // 本日から14日間の範囲
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(today.getDate() + 14);

        const todayStr = today.toISOString().split('T')[0];
        const futureStr = futureDate.toISOString().split('T')[0];

        // 施設名が一致し、今日から14日目以内のレコードを取得
        const query = `${KINTONE_FIELDS.FACILITY_NAME} = "${facilityName}" and ${KINTONE_FIELDS.VISIT_DATE} >= "${todayStr}" and ${KINTONE_FIELDS.VISIT_DATE} <= "${futureStr}"`;

        const kintoneResp = await getKintoneRecords(query);
        const records = kintoneResp.records || [];

        // 日付別に人数を集計
        const schedule: Record<string, number> = {};

        records.forEach((rec: any) => {
            const vDate = rec[KINTONE_FIELDS.VISIT_DATE]?.value;
            if (vDate) {
                schedule[vDate] = (schedule[vDate] || 0) + 1;
            }
        });

        return NextResponse.json({ schedule });

    } catch (error: any) {
        console.error('Facility Schedule API Error:', error);
        return NextResponse.json(
            { error: '施設スケジュールの取得に失敗しました。' },
            { status: 500 }
        );
    }
}
