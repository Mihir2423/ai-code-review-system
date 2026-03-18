'use client';

import { ChevronLeft } from 'lucide-react';
import { Red_Hat_Display } from 'next/font/google';
import Image from 'next/image';
import Link from 'next/link';
import { signIn } from '@/lib/auth-client';

const redhat = Red_Hat_Display({
    variable: '--font-red-hat',
    subsets: ['latin'],
});

const SignInPage = () => {
    const date = new Date();
    const currentYear = date.getFullYear();
    return (
        <div className={`h-dvh flex flex-col bg-[#121212] ${redhat.className}`}>
            <div className="h-16 w-full border-b border-neutral-500/20 flex justify-center">
                <div className="w-5xl border-x border-neutral-500/20"></div>
            </div>
            <div className="min-h-0 flex-1 w-full max-w-5xl mx-auto border-x border-neutral-500/20 p-6 grid grid-cols-2 gap-5">
                <div className="col-span-1 h-full flex flex-col justify-between py-3">
                    <div className="flex flex-col gap-10">
                        <Link
                            href={'/'}
                            className="flex items-center gap-1 transition-colors ease-in-out duration-150 pr-3 py-2 text-neutral-500 hover:text-white w-fit text-sm font-medium"
                        >
                            <ChevronLeft size={16} className="" />
                            Back
                        </Link>
                        <header className="space-y-1">
                            <h1 className="text-2xl font-semibold tracking-tight text-white">
                                Open{' '}
                                <span className="bg-orange-500 px-1.5 text-black mr-px h-3 font-bold rounded text-xl">
                                    R
                                </span>
                                eview
                            </h1>
                            <p className="text-zinc-400 text-sm md:text-base">
                                Real-time AI reviews for your pull requests
                            </p>
                        </header>
                        <div className="flex items-center gap-4 w-fit">
                            <div className="flex items-center bg-orange-500/30 rounded px-2 border border-orange-500 py-1">
                                <div className="relative flex h-2 w-2 mr-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                                </div>
                                <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">
                                    Early Access
                                </span>
                            </div>
                            <p className="text-zinc-400 text-sm">
                                Be one of the first <span className="font-bold text-white">100</span> founding users.
                            </p>
                        </div>
                        <div className="flex flex-col gap-5">
                            <h2 className="text-white text-4xl font-bold leading-[1.1]">
                                Your Code Is Ready.
                                <br /> Ship Better Code, Faster.
                            </h2>
                            <p className="text-zinc-400 text-sm">
                                Sign in to automate code reviews, catch bugs early, and ship with confidence. Get
                                started now.
                            </p>
                        </div>
                        <button
                            onClick={() => signIn.social({ provider: 'github' })}
                            className="flex border border-black shadow-[inset_0_0.1rem_0.1rem_rgba(255,255,255,0.4),inset_0_0_0_0.1rem_rgba(255,255,255,0.3),0_0.1rem_0.1rem_rgba(0,0,0,0.08),0_0.2rem_0.4rem_rgba(0,0,0,0.04)] bg-linear-to-b from-white/10 to-transparent items-center gap-3 px-3 py-2 bg-orange-500 rounded-md hover:bg-orange-400 text-black w-fit transition-colors ease-in-out duration-150 text-sm font-bold"
                        >
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                            </svg>
                            Continue with Github
                        </button>
                    </div>
                    <footer className="">
                        <p className="text-zinc-500 text-sm">© {currentYear} Open Review. All rights reserved.</p>
                    </footer>
                </div>
                <div className="relative col-span-1 w-full h-full rounded-2xl overflow-hidden">
                    <Image
                        alt="auth"
                        src="/images/auth.webp"
                        width={600}
                        height={1000}
                        className="w-full h-full object-cover"
                    />
                    <div
                        className="absolute inset-0 w-full h-full z-2 pointer-events-none"
                        style={{
                            WebkitMaskImage: 'linear-gradient(to top, black, transparent)',
                            maskImage: 'linear-gradient(to top, black, transparent)',
                        }}
                    />
                    <div className="absolute inset-0 z-9 w-full h-full pointer-events-none flex flex-col justify-end p-6">
                        <div className="max-w-xs">
                            <p className="text-orange-500 font-mono text-xs mb-2 tracking-tighter">Open Review</p>
                            <h3 className="text-white text-3xl font-bold tracking-tight mb-4">
                                Automate the <span className="text-orange-500">Tedious.</span> <br />
                                Focus on the <span className="text-orange-500">Creative.</span>
                            </h3>
                            <div className="h-px w-12 bg-orange-500/50 mb-4" />
                            <p className="text-zinc-300 text-sm leading-relaxed">
                                Join the next generation of engineers shipping high-integrity code without the manual
                                overhead.
                            </p>
                        </div>
                    </div>

                    <div
                        className="absolute inset-0 w-full h-full backdrop-blur-[5px] pointer-events-none flex flex-col justify-end p-12"
                        style={{
                            WebkitMaskImage: 'linear-gradient(to top, black, transparent)',
                            maskImage: 'linear-gradient(to top, black, transparent)',
                        }}
                    />
                </div>
            </div>
            <div className="h-16 w-full border-t border-neutral-500/20 flex justify-center">
                <div className="w-5xl border-x border-neutral-500/20"></div>
            </div>
        </div>
    );
};

export default SignInPage;
