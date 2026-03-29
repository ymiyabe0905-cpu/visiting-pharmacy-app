// src/lib/normalize.test.ts
import { normalizePatientName, normalizeClinicName, normalizeDate } from './normalize';

describe('normalizePatientName', () => {
    it('spaces and cases should be ignored', () => {
        expect(normalizePatientName('山田 太郎')).toBe('山田太郎');
        expect(normalizePatientName('山田　太郎')).toBe('山田太郎');
        expect(normalizePatientName('YAMADA TARO')).toBe('YAMADATARO');
        expect(normalizePatientName('yamada taro')).toBe('YAMADATARO');
    });
});

describe('normalizeClinicName', () => {
    it('suffixes and prefixes should be removed', () => {
        expect(normalizeClinicName('医療法人社団 テストクリニック')).toBe('テスト');
        expect(normalizeClinicName('テスト医院')).toBe('テスト');
        expect(normalizeClinicName('医療法人 テスト診療所')).toBe('テスト');
        expect(normalizeClinicName('テスト内科病院')).toBe('テスト');
    });
});

describe('normalizeDate', () => {
    it('should normalize various date formats', () => {
        expect(normalizeDate('2023年4月1日')).toBe('2023-04-01');
        expect(normalizeDate('2023/4/1')).toBe('2023-04-01');
        expect(normalizeDate('2023.04.01')).toBe('2023-04-01');
        expect(normalizeDate('２０２３年４月１日')).toBe('2023-04-01'); // 全角
    });
});
