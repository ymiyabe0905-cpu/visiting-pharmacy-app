import Tesseract from 'tesseract.js';
import { PixelCrop } from 'react-image-crop';

/**
 * TesseractのOSD (Orientation and Script Detection) を使って画像の傾きを判別し、
 * 必要に応じて回転させたCanvasを返す
 */
export async function autoRotateImage(imageUrl: string): Promise<HTMLCanvasElement> {
    const img = new Image();
    img.src = imageUrl;
    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Could not get 2d context");
    
    // 現代のブラウザ（Chrome 81+, Safari 13.1+等）はImageオブジェクト読み込み時に
    // 自動的にEXIFのOrientationを解釈して正位置でdrawImageするため、
    // ここで描画されるcanvasはすでに「EXIF補正済み」の状態となります。
    // その上で、Tesseract.jsのOSD機能を用いて「文字の向きに基づく再補正」を試みます。
    ctx.drawImage(img, 0, 0);

    try {
        // Tesseract OSDで傾きを検知
        const result = await Tesseract.recognize(imageUrl, 'osd');
        const degrees = (result.data as any).orientation_degrees;

        if (degrees === 90 || degrees === 180 || degrees === 270) {
            const rotCanvas = document.createElement('canvas');
            const rotCtx = rotCanvas.getContext('2d');
            if (!rotCtx) throw new Error("");

            if (degrees === 90 || degrees === 270) {
                rotCanvas.width = img.height;
                rotCanvas.height = img.width;
            } else {
                rotCanvas.width = img.width;
                rotCanvas.height = img.height;
            }

            rotCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
            rotCtx.rotate((degrees * Math.PI) / 180);
            rotCtx.drawImage(img, -img.width / 2, -img.height / 2);

            return rotCanvas;
        }
    } catch (err) {
        console.warn("OSD Auto-rotation classification failed. Defaulting to original orientation:", err);
    }
    
    return canvas;
}

export type PreprocessMode = 'none' | 'grayscale' | 'binarize';

/**
 * 画像を前処理する（モード切替対応）。
 * 背景の影を飛ばし、文字をくっきりさせる。
 */
export function preprocessCanvas(canvas: HTMLCanvasElement, mode: PreprocessMode = 'grayscale'): HTMLCanvasElement {
    if (mode === 'none') return canvas;

    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // threshold (影を白に飛ばし、文字を黒く残すための境界値)
    const threshold = 160; 
    const contrast = 1.2; // コントラスト強調係数（強すぎるとノイズが乗るため1.2程度に設定）

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        let gray = 0.299 * r + 0.587 * g + 0.114 * b;
        
        if (mode === 'binarize') {
            // コントラストを強調し、背景の影をより白く、文字をより黒く近づける
            gray = ((gray - 128) * contrast) + 128;
            gray = gray > threshold ? 255 : 0;
        }
        
        data[i] = gray;     // R
        data[i + 1] = gray; // G
        data[i + 2] = gray; // B
        // Alpha (data[i+3]) is kept
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

/**
 * 指定されたPixelCrop範囲でキャンバスを切り抜く
 */
export function getCroppedCanvas(source: HTMLImageElement | HTMLCanvasElement, crop: PixelCrop): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = crop.width;
    canvas.height = crop.height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return source instanceof HTMLCanvasElement ? source : canvas;

    ctx.drawImage(
        source,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        crop.width,
        crop.height
    );

    return canvas;
}

/**
 * Helper: CanvasをDataURLに変換
 */
export function canvasToDataUrl(canvas: HTMLCanvasElement): string {
    return canvas.toDataURL('image/jpeg', 0.9);
}
