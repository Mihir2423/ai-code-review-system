'use client';

import { ArrowRight, Calendar, ExternalLink, FileCode2, Github, GitPullRequest, Terminal } from 'lucide-react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { type IssueWithMetadata, useReviewHistory } from '@/lib/review';
import { cn } from '@/lib/utils';

type MarkdownComponentProps = {
    children?: ReactNode;
};

type CodeComponentProps = ComponentPropsWithoutRef<'code'> & {
    node?: unknown;
    inline?: boolean;
    className?: string;
    children?: ReactNode;
};

const ReviewHistoryPage = () => {
    const { data: reviews, isLoading } = useReviewHistory();

    const MarkdownComponents: Components = {
        h2: ({ children }: MarkdownComponentProps) => (
            <div className="flex items-center gap-2 mb-4 mt-8 first:mt-0">
                <Terminal size={14} className="text-orange-400" />
                <h2 className="text-[13px] font-bold uppercase tracking-[0.15em] text-neutral-200 font-mono">
                    {children}
                </h2>
                <div className="h-px flex-1 bg-neutral-800 ml-2" />
            </div>
        ),
        h3: ({ children }: MarkdownComponentProps) => (
            <h3 className="text-sm font-semibold text-neutral-100 mt-6 mb-2 flex items-center gap-2">
                <span className="w-1 h-4 bg-orange-500/50 rounded-full" />
                {children}
            </h3>
        ),
        p: ({ children }: MarkdownComponentProps) => (
            <p className="text-[14px] font-mono leading-relaxed text-neutral-400 mb-4 selection:bg-orange-500/30 break-words">
                {children}
            </p>
        ),
        pre: ({ children }: MarkdownComponentProps) => (
            // Removed text-balance which can cause weird wrapping in code blocks
            <pre className="overflow-x-auto whitespace-pre-wrap my-2 p-2 rounded text-xs font-mono">
                {children}
            </pre>
        ),
        code({ node, inline, className, children, ...restProps }: CodeComponentProps) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
                // Added min-w-0 and changed overflow-hidden to overflow-x-auto to ensure accessibility
                <div className="my-6 rounded-lg border border-neutral-800 overflow-x-auto min-w-0">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800 sticky left-0">
                        <div className="flex items-center gap-2">
                            <FileCode2 size={12} className="text-neutral-500" />
                            <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
                                {match[1]}
                            </span>
                        </div>
                        <div className="flex gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-neutral-800" />
                            <div className="w-2 h-2 rounded-full bg-neutral-800" />
                        </div>
                    </div>
                    <SyntaxHighlighter
                        // @ts-expect-error - customStyle type mismatch in library types
                        style={vscDarkPlus}
                        language={match[1]}
                        PreTag="div"
                        wrapLongLines={true} // FIX: Ensures long lines wrap instead of pushing the container
                        customStyle={{
                            margin: 0,
                            padding: '1.25rem',
                            fontSize: '13px',
                            backgroundColor: 'transparent',
                            lineHeight: '1.6',
                        }}
                        {...restProps}
                    >
                        {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                </div>
            ) : (
                <code
                    className="px-1.5 py-0.5 rounded bg-neutral-800 text-orange-300 text-[13px] font-mono break-all"
                    {...restProps}
                >
                    {children}
                </code>
            );
        },
        ul: ({ children }: MarkdownComponentProps) => <ul className="space-y-2 mb-6 ml-4">{children}</ul>,

        li: ({ children }: MarkdownComponentProps) => (
            <li className="flex gap-3 text-sm text-neutral-400">
                <ArrowRight size={14} className="text-orange-500/50 mt-1 shrink-0" />
                <span className="font-mono min-w-0 flex-1">{children}</span>
            </li>
        ),
    };

    const formatDate = (dateValue: string | Date) => {
        return new Date(dateValue).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="min-h-screen bg-[#050505] text-neutral-300 selection:bg-orange-500/30">
            <div className="max-w-4xl mx-auto px-6 py-16">
                <header className="mb-16">
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-neutral-800 bg-neutral-900/50 mb-6">
                        <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                            Review Archive
                        </span>
                    </div>
                    <h1 className="text-4xl font-medium tracking-tight text-white mb-4">Review History</h1>
                    <p className="text-neutral-500 font-mono text-xs tracking-tight uppercase opacity-60">
                        List of all your PR on your Production Environment
                    </p>
                </header>

                {isLoading ? (
                    <div className="py-20 text-center font-mono text-xs text-neutral-600 tracking-[0.2em] animate-pulse">
                        INITIALIZING_RECORDS...
                    </div>
                ) : (
                    <div className="space-y-24">
                        {reviews?.map((review) => (
                            <section key={review.id} className="relative max-w-full overflow-hidden">
                                <div className="flex flex-wrap items-center justify-between gap-4 px-1 mb-3">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="flex items-center gap-2 text-neutral-400 shrink-0">
                                            <Github size={14} />
                                            <span className="text-xs font-mono">{review.repository.fullName}</span>
                                        </div>
                                        <span className="text-neutral-700 shrink-0">/</span>
                                        <div className="flex items-center gap-2 min-w-0">
                                            <GitPullRequest size={14} className="text-blue-500 shrink-0" />
                                            <span className="text-xs font-medium text-neutral-200 font-mono truncate">
                                                PR #{review.prNumber}: {review.prTitle}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 text-[11px] font-mono text-neutral-500">
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-neutral-800 bg-neutral-900/50">
                                            <div
                                                className={cn(
                                                    'w-1.5 h-1.5 rounded-full',
                                                    review.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500',
                                                )}
                                            />
                                            {review.status.toUpperCase()}
                                        </div>
                                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                                            <Calendar size={12} />
                                            {formatDate(review.createdAt)}
                                        </span>
                                    </div>
                                </div>

                                <div className="bg-[#0A0A0A] border border-neutral-800/60 rounded-xl p-4 md:p-8 shadow-2xl overflow-hidden">
                                    <div className="prose-neutral max-w-full overflow-hidden">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                                            {review.review}
                                        </ReactMarkdown>
                                    </div>

                                    {review.issues && review.issues.length > 0 && (
                                        <div className="mt-6 pt-2 border-t border-neutral-900">
                                            <div className="grid gap-3">
                                                {review.issues.map((issue: IssueWithMetadata, i: number) => (
                                                    <div key={i} className="p-4 flex gap-2 min-w-0">
                                                        <div className="shrink-0 flex items-center justify-center w-6 h-6 rounded bg-neutral-900 border border-neutral-800 text-[10px] font-mono text-neutral-500">
                                                            {String(i + 1).padStart(2, '0')}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <ReactMarkdown
                                                                remarkPlugins={[remarkGfm]}
                                                                components={MarkdownComponents}
                                                            >
                                                                {issue.commentBody}
                                                            </ReactMarkdown>
                                                            {(issue.diff.oldCode || issue.diff.newCode) && (
                                                                <div className="mt-3 p-3 rounded bg-neutral-900/50 border border-neutral-800 overflow-x-auto max-w-full">
                                                                    <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-2 sticky left-0">
                                                                        Diff
                                                                    </div>
                                                                    <div className="font-mono text-xs whitespace-pre-wrap break-words">
                                                                        {issue.diff.oldCode &&
                                                                            issue.diff.oldCode !== 'N/A' && (
                                                                                <div className="text-red-400 mb-1 flex gap-2">
                                                                                    <span className="text-neutral-500 shrink-0">
                                                                                        -
                                                                                    </span>
                                                                                    <span className="break-all">{issue.diff.oldCode}</span>
                                                                                </div>
                                                                            )}
                                                                        {issue.diff.newCode &&
                                                                            issue.diff.newCode !== 'N/A' && (
                                                                                <div className="text-green-400 flex gap-2">
                                                                                    <span className="text-neutral-500 shrink-0">
                                                                                        +
                                                                                    </span>
                                                                                    <span className="break-all">{issue.diff.newCode}</span>
                                                                                </div>
                                                                            )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-12 pt-6 border-t border-neutral-900 flex justify-end">
                                        <a
                                            href={review.prUrl}
                                            target="_blank"
                                            className="flex items-center gap-2 text-[11px] font-mono text-neutral-500 hover:text-white transition-colors uppercase tracking-widest"
                                        >
                                            Source Context <ExternalLink size={12} />
                                        </a>
                                    </div>
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReviewHistoryPage;
