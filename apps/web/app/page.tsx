export default function Home() {
	return (
		<div className="flex min-h-screen font-mono items-center justify-center bg-zinc-50 dark:bg-black">
			<main className="flex flex-col items-center gap-8 text-center">
				<h1 className="text-4xl font-bold tracking-tight text-black dark:text-white">
					AI Code Review
				</h1>
				<p className="max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
					Get intelligent code reviews powered by AI. Improve your code quality
					with automated suggestions and insights.
				</p>
				<a
					className="flex py-2 items-center justify-center bg-black px-8 text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
					href="/dashboard"
				>
					Get Started
				</a>
			</main>
		</div>
	);
}
