import Link from 'next/link';
import { useRef } from 'react';
import { useCssFallback } from '@/hooks/useCssFallback';

export const HeroSection = () => {
    const sectionRef = useRef<HTMLDivElement>(null);
    const cssOverlay = useRef<HTMLDivElement>(null);

    const css = useCssFallback(sectionRef, cssOverlay);
    return (
        <div
            ref={sectionRef}
            className="relative h-dvh overflow-hidden"
            onMouseMove={css.onMouseMove}
            onMouseEnter={css.onMouseEnter}
            onMouseLeave={css.onMouseLeave}
        >
            <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: "url('/images/hero-dither.png')" }}
            />

            <div
                ref={cssOverlay}
                className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
                style={{ backgroundImage: "url('/images/hero.png')", opacity: 0 }}
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
                        <Link
                            href="/repositories"
                            className="text-black bg-orange-500 px-4 py-1.75 text-sm font-medium hover:bg-orange-400 transition-colors"
                        >
                            Start Free
                        </Link>
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
    );
};
