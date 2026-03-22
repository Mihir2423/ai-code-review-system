'use client';

import { GitBranch, Settings } from 'lucide-react';
import { Red_Hat_Display } from 'next/font/google';
import Image from 'next/image';
import Link from 'next/link';
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
                <div className="relative h-[200dvh]">
                    <div className="left-0 w-full h-dvh sticky top-16 z-20">
                        <SectionWrapper
                            subtitle="Repository"
                            title="View and manage all your repositories"
                            description="Connect repositories to get AI-powered code reviews and automated quality checks for your
            projects."
                            src="/images/repo-list.png"
                            link="/repositories"
                            icon={GitBranch}
                        />
                    </div>
                    <div className="left-0 w-full h-dvh sticky top-16 z-30">
                        <SectionWrapper
                            subtitle="Review History"
                            title="Track all your code reviews in one place"
                            src="/images/review.png"
                            description="Review past code changes, see feedback provided, and track improvement over time across all your
            repositories."
                            link="/review-history"
                            icon={Settings}
                        />
                    </div>
                </div>
                <Separator />
                <div className="min-h-dvh p-1 py-20 flex items-center justify-center">
                    <div className="w-full relative gap-12 pt-20 overflow-hidden h-full bg-[url('/images/cta.png')] bg-blend-multiply bg-black/50 text-center justify-between bg-no-repeat bg-cover bg-center flex items-center flex-col">
                        <div className="flex flex-col justify-center items-center gap-6 z-10">
                            <div className="flex flex-col gap-2 items-center">
                                <span className="text-white text-4xl font-semibold">Review code like a pro</span>
                                <p className="text-base font-medium text-white max-w-120 text-center">
                                    Get instant, AI-powered code reviews on every pull request. Catch bugs early and
                                    ship with confidence{' '}
                                </p>
                            </div>
                            <div className="flex items-center justify-center gap-3 mt-2 z-10">
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
                        <img src="/images/cta-section.png" alt="cta-section" className="w-[70%] h-auto bg-cover z-10" />
                        <div
                            className="top-0 left-0 z-[9] absolute w-full h-1/2 rotate-[180deg]"
                            style={{
                                maskImage: 'linear-gradient(transparent, black 85%)',
                                backgroundColor: 'rgb(12, 12, 12)',
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HomePage;
