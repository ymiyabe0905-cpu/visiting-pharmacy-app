import { NextResponse } from 'next/server';
import { getKintoneRecords, KINTONE_FIELDS } from '@/lib/kintone';
import { normalizePatientName, normalizeClinicName, normalizeDate } from '@/lib/normalize';

// レコードの型定義
type KintoneRecord = {
    $id: { value: string };
    [key: string]: { value: string };
};

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const patientNameRaw = searchParams.get('patientName') || '';
        const birthDateRaw = searchParams.get('birthDate') || '';
        const clinicNameRaw = searchParams.get('clinicName') || '';
        const visitDateRaw = searchParams.get('visitDate') || '';

        const patientName = normalizePatientName(patientNameRaw);
        const birthDate = normalizeDate(birthDateRaw);
        const clinicName = normalizeClinicName(clinicNameRaw);

        // 未処理条件の定義（「処方あり」以外）
        const statusQuery = `${KINTONE_FIELDS.VISIT_STATUS} not in ("処方あり")`;

        // 1次検索（広めに取得）
        // 患者名が "山田太郎" の場合、"山田"や"太郎"でもヒットするように likes を使用（または完全一致を緩和）
        // 今回は名前の一部が含まれていればOKとする
        let query = statusQuery;
        if (patientName) {
            // kintoneの like 演算子を使用（本来は1文字ずつのN-gram等が必要だが、ここでは like で代用）
            query += ` and ${KINTONE_FIELDS.PATIENT_NAME} like "${patientName}"`;
        }

        // 今後14日以内の日付条件（本日～14日後）
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(today.getDate() + 14);

        // YYYY-MM-DD
        const todayStr = today.toISOString().split('T')[0];
        const futureStr = futureDate.toISOString().split('T')[0];

        query += ` and ${KINTONE_FIELDS.VISIT_DATE} >= "${todayStr}" and ${KINTONE_FIELDS.VISIT_DATE} <= "${futureStr}"`;

        // 取得
        console.log('Primary Query:', query);
        let kintoneResp = await getKintoneRecords(query);
        let records: KintoneRecord[] = kintoneResp.records || [];
        let isRescueSearch = false;

        // 救済検索 (0件の場合、患者名の like 条件を外して、日付範囲のみで全取得してスコアリングにかける。※レコード数が多い場合は注意が必要)
        if (records.length === 0) {
            isRescueSearch = true;
            const rescueQuery = `${statusQuery} and ${KINTONE_FIELDS.VISIT_DATE} >= "${todayStr}" and ${KINTONE_FIELDS.VISIT_DATE} <= "${futureStr}"`;
            console.log('Rescue Query:', rescueQuery);
            kintoneResp = await getKintoneRecords(rescueQuery);
            records = kintoneResp.records || [];
        }

        // 事前に全体の集計を行う（スコアリング用）
        const facilityDateCounts: Record<string, number> = {};
        const patientCounts: Record<string, number> = {};
        
        records.forEach(rec => {
            const fName = rec[KINTONE_FIELDS.FACILITY_NAME]?.value;
            const vDate = rec[KINTONE_FIELDS.VISIT_DATE]?.value;
            const pName = normalizePatientName(rec[KINTONE_FIELDS.PATIENT_NAME]?.value || '');
            
            if (fName && vDate) {
                const key = `${fName}_${vDate}`;
                facilityDateCounts[key] = (facilityDateCounts[key] || 0) + 1;
            }
            if (pName) {
                patientCounts[pName] = (patientCounts[pName] || 0) + 1;
            }
        });

        // スコアリング
        const scoredRecords = records.map(record => {
            let score = 0;
            let matchReasons = [];

            const recPatientName = normalizePatientName(record[KINTONE_FIELDS.PATIENT_NAME]?.value || '');
            const recBirthDate = record[KINTONE_FIELDS.BIRTH_DATE]?.value || '';
            const recClinicName = normalizeClinicName(record[KINTONE_FIELDS.CLINIC_NAME]?.value || '');
            const recVisitDate = record[KINTONE_FIELDS.VISIT_DATE]?.value || '';
            const recFacilityName = record[KINTONE_FIELDS.FACILITY_NAME]?.value || '';

            // 1. 患者名一致
            if (patientName && (recPatientName.includes(patientName) || patientName.includes(recPatientName))) {
                score += 50;
                matchReasons.push('患者名一致');
            }

            // 2. 生年月日一致
            if (birthDate && recBirthDate === birthDate) {
                score += 30;
                matchReasons.push('生年月日一致');
            }

            // 3. 交付日に近い訪問日（visitDateRaw がある場合）
            if (visitDateRaw && recVisitDate) {
                const targetTime = new Date(visitDateRaw).getTime();
                const recTime = new Date(recVisitDate).getTime();
                const diffDays = Math.abs((recTime - targetTime) / (1000 * 60 * 60 * 24));
                
                if (diffDays === 0) {
                    score += 25; // 完全同日
                    matchReasons.push('指定日と同日');
                } else if (diffDays <= 3) {
                    score += 15;
                    matchReasons.push('指定日に近い');
                } else if (diffDays <= 7) {
                    score += 5;
                }
            }

            // 4. 医療機関名一致度
            if (clinicName && recClinicName && (recClinicName.includes(clinicName) || clinicName.includes(recClinicName))) {
                score += 20;
                matchReasons.push('医療機関名一致');
            }

            // 5. 同一施設の同日訪問人数 (加点: 1人につき2点、最大10点)
            if (recFacilityName && recVisitDate) {
                const count = facilityDateCounts[`${recFacilityName}_${recVisitDate}`] || 1;
                if (count > 1) { // 自分以外がいる場合
                    score += Math.min((count - 1) * 2, 10);
                    matchReasons.push(`同施設同日訪問あり`);
                }
            }

            // 6. 同一患者の既存予定有無 (加点: 別の予定があれば加点)
            if (recPatientName) {
                const pCount = patientCounts[recPatientName] || 1;
                if (pCount > 1) { // 自分のこのレコード以外に予定がある
                    score += 10;
                    matchReasons.push('別予定あり');
                }
            }

            return {
                id: record.$id.value,
                recordId: record[KINTONE_FIELDS.RECORD_ID]?.value,
                patientName: record[KINTONE_FIELDS.PATIENT_NAME]?.value,
                birthDate: record[KINTONE_FIELDS.BIRTH_DATE]?.value,
                clinicName: record[KINTONE_FIELDS.CLINIC_NAME]?.value,
                visitDate: record[KINTONE_FIELDS.VISIT_DATE]?.value,
                facilityName: record[KINTONE_FIELDS.FACILITY_NAME]?.value,
                status: record[KINTONE_FIELDS.VISIT_STATUS]?.value,
                score,
                matchReasons
            };
        });

        // 並び替え (スコア降順)
        scoredRecords.sort((a, b) => b.score - a.score);

        // 上位5件
        const top5 = scoredRecords.slice(0, 5);

        return NextResponse.json({
            candidates: top5,
            isRescueSearch
        });

    } catch (error: any) {
        console.error('Search API Error:', error);
        // 詳細エラーはサーバーログのみ、クライアントには安全なメッセージ
        return NextResponse.json(
            { error: '候補が見つかりませんでした。条件を確認してください。' },
            { status: 500 }
        );
    }
}
