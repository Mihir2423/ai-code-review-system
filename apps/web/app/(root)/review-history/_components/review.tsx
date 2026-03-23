'use client';

import { ArrowRight, Calendar, ExternalLink, FileCode2, Github, GitPullRequest, Terminal } from 'lucide-react';
import Link from 'next/link';
import { type ComponentPropsWithoutRef, type ReactNode, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import type { IssueWithMetadata, ReviewHistoryItem } from '@/lib/review';
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

export const Review = ({ review }: { review: ReviewHistoryItem }) => {
    const [open, setOpen] = useState(false);

    const MarkdownComponents: Components = {
        h2: ({ children }: MarkdownComponentProps) => (
            <div className="flex items-center gap-2 mb-4 mt-8 first:mt-0">
                <Terminal size={14} className="text-orange-400" />
                <h2 className="text-[13px] font-bold uppercase tracking-[0.15em] text-neutral-200 font-mono">
                    {children}
                </h2>
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
            <pre className="overflow-x-auto whitespace-pre-wrap my-2 p-2 rounded text-xs font-mono">{children}</pre>
        ),
        code({ node, inline, className, children, ...restProps }: CodeComponentProps) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
                <div className="my-6 rounded-lg bg-black border border-neutral-800 overflow-x-auto min-w-0">
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
                        wrapLongLines={true}
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
        <section key={review.id} className="relative max-w-full">
            <div
                onClick={() => setOpen(!open)}
                className={cn(
                    'cursor-pointer transition-all shadow-[0px_0.75px_0px_0px_rgba(255,252,252,0.3)_inset] rounded-t-lg ease-in-out duration-200 border border-black gap-3 px-3 py-4 bg-[#292929]',
                )}
            >
                <div className="flex flex-wrap items-center justify-between gap-4 px-1">
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="flex items-center gap-2 text-neutral-400 shrink-0">
                            <Github size={14} />
                            <span className="text-xs font-mono">{review.repository.fullName}</span>
                        </div>
                        <span className="text-neutral-700 shrink-0">/</span>
                        <div className="flex items-center gap-2 min-w-0">
                            <GitPullRequest size={14} className="text-orange-500 shrink-0" />
                            <span className="text-xs font-medium text-neutral-200 font-mono truncate">
                                PR #{review.prNumber}: {review.prTitle}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] font-mono text-neutral-500">
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-black bg-neutral-900/50">
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
        </div>
        <div className=' px-3 py-4 bg-[#292929] border border-black border-t-0 rounded-b-lg'>

            <div className="flex justify-between items-center">
                <Link
                    href={`/review-history/${review.id}`}
                    className="flex items-center gap-2 text-[11px] font-mono text-neutral-500 hover:text-white transition-colors uppercase tracking-widest"
                >
                    View Details <ArrowRight size={12} />
                </Link>
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
    );
};
