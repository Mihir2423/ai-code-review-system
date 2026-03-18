'use client';

import { Red_Hat_Display } from 'next/font/google';
import Image from 'next/image';
import { signIn } from '@/lib/auth-client';
import { AuthLayout } from './_components/auth-layout';

const redhat = Red_Hat_Display({
    variable: '--font-red-hat',
    subsets: ['latin'],
});

const SignInPage = () => {
    const avatars = [
        'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
        'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
        'https://api.dicebear.com/7.x/avataaars/svg?seed=James',
        'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
    ];
    const date = new Date();
    const currentYear = date.getFullYear();
    return (
        <div className={`h-dvh flex flex-col bg-[#000000] ${redhat.className}`}>
            <div className="h-16 w-full border-b border-neutral-500/20 flex justify-center">
                <div className="w-5xl border-x border-neutral-500/20"></div>
            </div>
            <div className="min-h-0 flex-1 w-full max-w-5xl mx-auto border-x border-neutral-500/20 p-6 grid grid-cols-2 gap-5">
                <div className="col-span-1 h-full flex flex-col justify-between py-3">
                    <div className="flex flex-col gap-10">
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
                            <div className="flex items-center bg-[#151515] border border-zinc-800 rounded-full px-2 py-1.5">
                                <div className="flex -space-x-3">
                                    {avatars.map((url, i) => (
                                        <img
                                            key={i}
                                            src={url}
                                            alt="User"
                                            className="w-8 h-8 rounded-full border-2 border-[#151515] object-cover bg-zinc-700"
                                        />
                                    ))}
                                    <div className="w-8 h-8 rounded-full border-2 border-[#151515] bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400">
                                        +
                                    </div>
                                </div>
                            </div>
                            <p className="text-zinc-400 text-sm">
                                Become one of <span className="font-bold text-white">4000+</span> happy users
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
                            className="flex items-center gap-3 px-3 py-3.5 border border-zinc-800 rounded-md hover:bg-zinc-900 text-white w-fit transition-colors text-sm font-medium"
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
                <div className="col-span-1 w-full h-full  rounded-2xl overflow-hidden">
                    <Image alt="auth" src="/images/auth.webp" width={600} height={1000} className="w-full h-full" />
                </div>
            </div>
            <div className="h-16 w-full border-t border-neutral-500/20 flex justify-center">
                <div className="w-5xl border-x border-neutral-500/20"></div>
            </div>
        </div>
    );
};

export default SignInPage;
