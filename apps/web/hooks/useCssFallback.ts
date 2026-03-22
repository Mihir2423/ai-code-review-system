import { useCallback, useEffect, useRef } from 'react';

export function useCssFallback(
    sectionRef: React.RefObject<HTMLDivElement | null>,
    overlayRef: React.RefObject<HTMLDivElement | null>,
) {
    const isHover = useRef(false);
    const revealRef = useRef(0);
    const rafId = useRef<number | null>(null);
    const mouseRef = useRef({ x: 0, y: 0 });
    const maskYRef = useRef(0);
    const initializedRef = useRef(false);

    useEffect(() => {
        const el = sectionRef.current;
        if (!el) return;

        const observer = new ResizeObserver((entries) => {
            const rect = entries[0]?.contentRect;
            if (rect && rect.height > 0 && !isHover.current) {
                maskYRef.current = rect.height / 2;
                initializedRef.current = true;
            }
        });
        observer.observe(el);

        const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
        const tick = () => {
            rafId.current = requestAnimationFrame(tick);
            revealRef.current = lerp(revealRef.current, isHover.current ? 1 : 0, 0.055);
            const overlay = overlayRef.current;
            if (!overlay) return;
            const { x } = mouseRef.current;
            overlay.style.opacity = String(revealRef.current);
            overlay.style.webkitMaskImage = `radial-gradient(ellipse 65% 60% at ${x}px ${maskYRef.current}px, black 0%, black 40%, transparent 100%)`;
            overlay.style.maskImage = `radial-gradient(ellipse 65% 60% at ${x}px ${maskYRef.current}px, black 0%, black 40%, transparent 100%)`;
        };
        tick();

        return () => {
            observer.disconnect();
            if (rafId.current) cancelAnimationFrame(rafId.current);
        };
    }, [overlayRef, sectionRef]);

    const onMouseMove = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            const r = sectionRef.current?.getBoundingClientRect();
            if (!r) return;
            const y = e.clientY - r.top;
            const centerY = r.height / 2;

            if (!initializedRef.current) {
                maskYRef.current = centerY;
                initializedRef.current = true;
            }

            if (y >= centerY) {
                maskYRef.current = y;
            }

            mouseRef.current = { x: e.clientX - r.left, y };
        },
        [sectionRef],
    );
    const onMouseEnter = useCallback(() => {
        isHover.current = true;
    }, []);
    const onMouseLeave = useCallback(() => {
        isHover.current = false;
    }, []);

    return { onMouseMove, onMouseEnter, onMouseLeave };
}
