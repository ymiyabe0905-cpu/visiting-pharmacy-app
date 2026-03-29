import { NextResponse } from 'next/server';
import { getKintoneRecords, KINTONE_FIELDS } from '@/lib/kintone';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        // kintoneの実際のレコード番号($id)で1件取得
        const query = `$id = "${id}"`;
        const kintoneResp = await getKintoneRecords(query);
        const records = kintoneResp.records || [];

        if (records.length === 0) {
            return NextResponse.json({ error: '対象レコードが見つかりません。' }, { status: 404 });
        }

        const record = records[0];

        return NextResponse.json({
            record: {
                id: record.$id.value,
                recordId: record[KINTONE_FIELDS.RECORD_ID]?.value,
                patientName: record[KINTONE_FIELDS.PATIENT_NAME]?.value,
                birthDate: record[KINTONE_FIELDS.BIRTH_DATE]?.value,
                clinicName: record[KINTONE_FIELDS.CLINIC_NAME]?.value,
                visitDate: record[KINTONE_FIELDS.VISIT_DATE]?.value,
                facilityName: record[KINTONE_FIELDS.FACILITY_NAME]?.value,
                status: record[KINTONE_FIELDS.VISIT_STATUS]?.value,
                visitNotes: record[KINTONE_FIELDS.VISIT_NOTES]?.value,
                nextNotes: record[KINTONE_FIELDS.NEXT_NOTES]?.value,
            }
        });

    } catch (error: any) {
        console.error('Record Fetch API Error:', error);
        return NextResponse.json(
            { error: 'レコードの取得に失敗しました。' },
            { status: 500 }
        );
    }
}
