'use client';

import { Red_Hat_Display } from 'next/font/google';
import { useRef } from 'react';
import { useCssFallback } from '@/hooks/useCssFallback';
import { useHeroWebGL } from '@/hooks/useHeroWebGL';
import { cn } from '@/lib/utils';

const redhat = Red_Hat_Display({
    variable: '--font-red-hat',
    subsets: ['latin'],
});

const HomePage = () => {
    const sectionRef = useRef<HTMLDivElement>(null);
    const cssOverlay = useRef<HTMLDivElement>(null);

    const css = useCssFallback(sectionRef, cssOverlay);
    const { canvasRef, onMouseMove, onMouseEnter, onMouseLeave } = useHeroWebGL({
        sectionRef,
        cssOverlay,
    });

    return (
        <div className={cn('relative bg-[#0A0A0A]', redhat.className)}>
            <div className="h-16 fixed z-10 w-full border-b border-neutral-500/20 flex justify-center">
                <div className="w-325 flex items-center pl-4">
                    <div className="text-base font-semibold tracking-tight text-white flex items-center gap-1">
                        <span>Open</span>
                        <span className="bg-orange-500 px-1.5 text-black mr-px font-bold rounded">Review</span>
                    </div>
                </div>
            </div>

            <div
                ref={sectionRef}
                className="relative h-dvh w-full max-w-325 mx-auto border-x border-neutral-500/20 overflow-hidden"
                onMouseMove={(e) => {
                    onMouseMove(e);
                    css.onMouseMove(e);
                }}
                onMouseEnter={() => {
                    onMouseEnter();
                    css.onMouseEnter();
                }}
                onMouseLeave={() => {
                    onMouseLeave();
                    css.onMouseLeave();
                }}
            >
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ display: 'block' }} />

                <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
                    style={{ backgroundImage: "url('/images/hero-dither.png')", display: 'none' }}
                />

                <div
                    ref={cssOverlay}
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
                    style={{ backgroundImage: "url('/images/hero.png')", opacity: 0, display: 'none' }}
                />

                <div className="relative z-10 p-6 flex flex-col gap-4 h-full">
                    <div className="flex flex-col items-center justify-center pt-32 gap-5 w-full">
                        <span className="uppercase text-white text-xs font-sans">Automated Code Review</span>
                        <div className="flex flex-col items-center justify-center gap-2">
                            <h1 className="text-white font-medium text-3xl">Review smarter. Ship faster with AI.</h1>
                            <p className="text-neutral-400 text-sm max-w-80 text-center">
                                Automate code reviews with AI. Get instant feedback on pull requests.
                            </p>
                        </div>
                        <div className="flex items-center justify-center gap-3 mt-2">
                            <button className="text-black bg-orange-500 px-4 py-1.75 text-sm font-medium hover:bg-orange-400 transition-colors">
                                Start Free
                            </button>
                            <button className="relative hover:bg-orange-900/30 text-white px-3 py-2 text-sm font-medium border border-orange-900/30 transition-colors">
                                <span className="absolute top-0 left-0 h-2 w-2 border-t border-l border-orange-500 transition-colors group-hover:border-white" />
                                <span className="absolute top-0 right-0 h-2 w-2 border-t border-r border-orange-500 transition-colors group-hover:border-white" />
                                <span className="absolute bottom-0 left-0 h-2 w-2 border-b border-l border-orange-500 transition-colors group-hover:border-white" />
                                <span className="absolute bottom-0 right-0 h-2 w-2 border-b border-r border-orange-500 transition-colors group-hover:border-white" />
                                Watch Demo
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HomePage;
