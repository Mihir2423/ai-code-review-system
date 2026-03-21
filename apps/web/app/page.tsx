'use client';

import { Red_Hat_Display } from 'next/font/google';
import { cn } from '@/lib/utils';
import { HeroSection } from './_components/hero';
import { SectionWrapper } from './_components/section-wrapper';
import { Separator } from './_components/separator';

const redhat = Red_Hat_Display({
    variable: '--font-red-hat',
    subsets: ['latin'],
});

const HomePage = () => {
    return (
        <div className={cn('relative bg-[#0A0A0A]', redhat.className)}>
            <div className="h-16 fixed z-90 w-full bg-[#0A0A0A] border-b border-neutral-500/20 flex justify-center">
                <div className="w-325 flex items-center pl-4 border-x border-neutral-500/20">
                    <div className="text-base font-semibold tracking-tight text-white flex items-center gap-1">
                        <span>Open</span>
                        <span className="bg-orange-500 px-1.5 text-black mr-px font-bold rounded">Review</span>
                    </div>
                </div>
            </div>

            <div className="w-full max-w-325 mx-auto border-x border-neutral-500/20  flex flex-col">
                <HeroSection />
                <Separator />
                <SectionWrapper
                    subtitle="Repository"
                    title="View and manage all your repositories"
                    description="Connect repositories to get AI-powered code reviews and automated quality checks for your
            projects."
                    src="/images/repo-list.png"
                    link="/repositories"
                />
                <SectionWrapper
                    subtitle="Review History"
                    title="Track all your code reviews in one place"
                    src="/images/review.png"
                    description="Review past code changes, see feedback provided, and track improvement over time across all your
            repositories."
                    link="/review-history"
                />
            </div>
        </div>
    );
};

export default HomePage;
