import { useEffect, useRef } from 'react';

function clamp(x: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, x));
}

function bayerThreshold(x: number, y: number): number {
    const bayer4 = [
        [0, 8, 2, 10],
        [12, 4, 14, 6],
        [3, 11, 1, 9],
        [15, 7, 13, 5],
    ];
    return bayer4[y % 4][x % 4] / 15;
}

function ditherImage(
    img: HTMLImageElement,
    ctx: CanvasRenderingContext2D,
    outW: number,
    outH: number,
    Q: number,
    grayscale: boolean,
    brightness: number,
): void {
    ctx.clearRect(0, 0, outW, outH);
    ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, outW, outH);
    const srcData = ctx.getImageData(0, 0, outW, outH);
    const { data } = srcData;
    const q = clamp(Math.floor(Q), 1, 16);

    for (let y = 0; y < outH; y++) {
        for (let x = 0; x < outW; x++) {
            const idx = (y * outW + x) * 4;
            const r = data[idx],
                g = data[idx + 1],
                b = data[idx + 2];
            const threshold = bayerThreshold(x, y);

            if (grayscale) {
                const v = clamp(0.299 * r + 0.587 * g + 0.114 * b + brightness, 0, 255);
                const step = clamp(Math.round((v / 255) * (q - 1) + threshold), 0, q - 1);
                const gray = Math.round((step * 255) / (q - 1));
                data[idx] = data[idx + 1] = data[idx + 2] = gray;
            } else {
                ([r, g, b] as number[]).forEach((c, i) => {
                    data[idx + i] = clamp(
                        (Math.round((clamp(c + brightness, 0, 255) / 255) * (q - 1) + threshold) / (q - 1)) * 255,
                        0,
                        255,
                    );
                });
            }
        }
    }
    ctx.putImageData(srcData, 0, 0);
}

export interface DitherImageProps {
    /** Image URL */
    src: string;
    /** Pixel block size 1–24 (default 1) */
    pixelation?: number;
    /** Brightness offset -128–128 (default 0) */
    brightness?: number;
    /** Gray/color levels 2–16 (default 6) */
    quantization?: number;
    /** Processing resolution 16–2048 (default 500) */
    resolution?: number;
    /** Grayscale or color dither (default true) */
    grayscale?: boolean;
    /** CSS object-fit (default "cover") */
    objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
    /** Wrapper width (default "100%") */
    width?: string | number;
    /** Wrapper height (default "100%") */
    height?: string | number;
    className?: string;
    style?: React.CSSProperties;
}

export function DitherImage({
    src,
    pixelation = 1,
    brightness = 0,
    quantization = 6,
    resolution = 500,
    grayscale = true,
    objectFit = 'cover',
    width = '100%',
    height = '100%',
    className = '',
    style = {},
}: DitherImageProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const procRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));

    useEffect(() => {
        if (!src) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const px = Math.max(1, Math.floor(pixelation));
        const Q = clamp(quantization, 2, 16);
        const R = clamp(resolution, 16, 2048);

        const imgEl = new Image();
        imgEl.crossOrigin = 'anonymous';
        imgEl.src = src;

        imgEl.onload = () => {
            const { naturalWidth: iw, naturalHeight: ih } = imgEl;
            const scale = Math.max(iw, ih) > R ? R / Math.max(iw, ih) : 1;
            const procW = Math.round(iw * scale);
            const procH = Math.round(ih * scale);

            const proc = procRef.current;
            proc.width = procW;
            proc.height = procH;
            const procCtx = proc.getContext('2d')!;
            procCtx.imageSmoothingEnabled = false;
            ditherImage(imgEl, procCtx, procW, procH, Q, grayscale, brightness);

            canvas.width = procW * px;
            canvas.height = procH * px;
            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(proc, 0, 0, procW, procH, 0, 0, procW * px, procH * px);
        };

        imgEl.onerror = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, [src, pixelation, brightness, quantization, resolution, grayscale]);

    return (
        // position: relative so the absolutely-positioned canvas is contained.
        // The wrapper itself sizes from the parent — the canvas never contributes
        // to layout, so it can't cause overflow.
        <div className={className} style={{ position: 'relative', width, height, ...style }}>
            <canvas
                ref={canvasRef}
                style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit,
                    display: 'block',
                }}
                aria-label="Dithered image"
            />
        </div>
    );
}
