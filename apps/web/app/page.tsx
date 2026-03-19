import { Red_Hat_Display } from 'next/font/google';
import { cn } from '@/lib/utils';

const redhat = Red_Hat_Display({
    variable: '--font-red-hat',
    subsets: ['latin'],
});

const HomePage = () => {
    return (
        <div className={cn('relative bg-[#0A0A0A]', redhat.className)}>
            <div className="h-16 fixed z-10 w-full border-b border-neutral-500/20 flex justify-center">
                <div className="w-325"></div>
            </div>

            <div className="h-dvh w-full max-w-325 mx-auto border-x border-neutral-500/20 p-6 flex flex-col gap-4 bg-[url('/images/hero-dither.png')] bg-cover bg-center bg-no-repeat">
                <div className="flex flex-col items-center justify-center pt-32 gap-5 w-full">
                    <span className="uppercase text-white text-sm font-sans">Automated Code Review</span>
                    <div className="flex flex-col items-center justify-center gap-2">
                        <h1 className="text-white font-medium text-3xl">Review smarter. Ship faster with AI.</h1>
                        <p className="text-neutral-400 text-sm max-w-80 text-center">
                            Automate code reviews with AI. Get instant feedback on pull requests.
                        </p>
                    </div>
                    <div className="flex items-center justify-center gap-3 mt-2">
                        <button className="text-black bg-white px-4 py-1.75 text-sm font-medium hover:bg-neutral-200 transition-colors">
                            Start Free
                        </button>
                        <button className="relative hover:bg-neutral-900 text-white px-3 py-2 text-sm font-medium border border-neutral-900  transition-colors">
                            <span className="absolute top-0 left-0 h-2 w-2 border-t border-l border-neutral-500 transition-colors group-hover:border-white"></span>
                            <span className="absolute top-0 right-0 h-2 w-2 border-t border-r border-neutral-500 transition-colors group-hover:border-white"></span>
                            <span className="absolute bottom-0 left-0 h-2 w-2 border-b border-l border-neutral-500 transition-colors group-hover:border-white"></span>
                            <span className="absolute bottom-0 right-0 h-2 w-2 border-b border-r border-neutral-500 transition-colors group-hover:border-white"></span>
                            Watch Demo
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HomePage;
