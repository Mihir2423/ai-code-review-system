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

            <div className="h-dvh w-full max-w-325 mx-auto border-x border-neutral-500/20 p-6 flex flex-col gap-4 bg-[url('/images/footer.png')] bg-cover bg-center bg-no-repeat">
                <div className="flex flex-col items-center justify-center pt-32 gap-5 w-full">
                    <span className="uppercase text-white text-sm font-sans">Automated Code Review</span>
                    <div className="flex flex-col items-center justify-center gap-2">
                        <h1 className="text-white font-medium text-3xl">Review smarter. Ship faster with AI.</h1>
                        <p className="text-neutral-400 text-sm max-w-80 text-center">
                            Automate code reviews with AI. Get instant feedback on pull requests.
                        </p>
                    </div>
                    <div className="flex items-center justify-center gap-3 mt-2">
                        <button className="text-black bg-white rounded-full px-4 py-1.75 text-sm font-medium hover:bg-neutral-200 transition-colors">
                            Start Free
                        </button>
                        <button className="text-white bg-neutral-800 rounded-full px-3 py-2 text-sm font-medium hover:bg-neutral-700 transition-colors">
                            Watch Demo
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HomePage;
