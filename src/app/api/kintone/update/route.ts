import { NextResponse } from 'next/server';
import { updateKintoneRecord, KINTONE_FIELDS } from '@/lib/kintone';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, visitDate, visitStatus } = body;

        if (!id || !visitStatus) {
            return NextResponse.json({ error: '必須パラメータが不足しています' }, { status: 400 });
        }

        // 更新用のレコードオブジェクトを作成
        const recordPayload: any = {
            [KINTONE_FIELDS.VISIT_STATUS]: {
                value: visitStatus
            }
        };

        // 訪問予定日の変更がある場合のみ追加
        if (visitDate) {
            recordPayload[KINTONE_FIELDS.VISIT_DATE] = {
                value: visitDate
            };
        }

        // 更新実行
        await updateKintoneRecord(id, recordPayload);

        // 更新成功、詳細は返さない（セキュリティ上、必要な情報のみ）
        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Update API Error:', error);
        // 詳細エラーはサーバーログへ。ユーザーには汎用メッセージを返す
        return NextResponse.json(
            { error: '更新に失敗しました。対象レコードを確認してください。' },
            { status: 500 }
        );
    }
}
