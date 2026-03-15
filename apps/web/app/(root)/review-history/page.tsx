'use client';

import { useReviewHistory } from '@/lib/review';
import { cn } from '@/lib/utils';
import {
  ArrowRight, Calendar,
  ExternalLink,
  FileCode2,
  GitPullRequest,
  Github,
  Terminal
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';

const ReviewHistoryPage = () => {
  const { data: reviews, isLoading } = useReviewHistory();

  const MarkdownComponents = {
    h2: ({ children }: any) => (
      <div className="flex items-center gap-2 mb-4 mt-8 first:mt-0">
        <Terminal size={14} className="text-orange-400" />
        <h2 className="text-[13px] font-bold uppercase tracking-[0.15em] text-neutral-200 font-mono">
          {children}
        </h2>
        <div className="h-px flex-1 bg-neutral-800 ml-2" />
      </div>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-sm font-semibold text-neutral-100 mt-6 mb-2 flex items-center gap-2">
        <span className="w-1 h-4 bg-orange-500/50 rounded-full" />
        {children}
      </h3>
    ),
    p: ({ children }: any) => (
      <p className="text-[14px] leading-relaxed text-neutral-400 mb-4 selection:bg-orange-500/30">
        {children}
      </p>
    ),
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <div className="my-6 rounded-lg border border-neutral-800 overflow-hidden bg-[#0D0D0D]">
          <div className="flex items-center justify-between px-4 py-2 bg-neutral-900/50 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <FileCode2 size={12} className="text-neutral-500" />
              <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">{match[1]}</span>
            </div>
            <div className="flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-neutral-800" />
              <div className="w-2 h-2 rounded-full bg-neutral-800" />
            </div>
          </div>
          <SyntaxHighlighter
            style={vscDarkPlus}
            language={match[1]}
            PreTag="div"
            customStyle={{
              margin: 0,
              padding: '1.25rem',
              fontSize: '13px',
              backgroundColor: 'transparent',
              lineHeight: '1.6',
            }}
            {...props}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        </div>
      ) : (
        <code className="px-1.5 py-0.5 rounded bg-neutral-800 text-orange-300 text-[13px] font-mono" {...props}>
          {children}
        </code>
      );
    },
    ul: ({ children }: any) => <ul className="space-y-2 mb-6 ml-4">{children}</ul>,


    li: ({ children }: any) => (
      <li className="flex gap-3 text-sm text-neutral-400">
        <ArrowRight size={14} className="text-orange-500/50 mt-1 shrink-0" />
        <span>{children}</span>
      </li>
    ),
  };

  const formatDate = (dateString: string) => {
     return new Date(dateString).toLocaleDateString('en-US', {
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
            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Review Archive</span>
          </div>
          <h1 className="text-4xl font-medium tracking-tight text-white mb-4">Pipeline History</h1>
          <p className="text-neutral-500 font-mono text-xs tracking-tight uppercase opacity-60">
            System version 3.7.0 — Production Environment
          </p>
        </header>

        {isLoading ? (
          <div className="py-20 text-center font-mono text-xs text-neutral-600 tracking-[0.2em] animate-pulse">
            INITIALIZING_RECORDS...
          </div>
        ) : (
          <div className="space-y-24">
            {reviews?.map((review) => (
              <section key={review.id} className="relative">
                <div className="flex flex-wrap items-center justify-between gap-4 px-1 mb-3">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-neutral-400">
                        <Github size={14} />
                        <span className="text-xs font-mono">{review.repository.fullName}</span>
                      </div>
                      <span className="text-neutral-700">/</span>
                      <div className="flex items-center gap-2">
                        <GitPullRequest size={14} className="text-blue-500" />
                        <span className="text-sm font-medium text-neutral-200">PR #{review.prNumber}: {review.prTitle}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] font-mono text-neutral-500">
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-neutral-800 bg-neutral-900/50">
                          <div className={cn("w-1.5 h-1.5 rounded-full", review.status === 'completed' ? "bg-emerald-500" : "bg-amber-500")} />
                          {review.status.toUpperCase()}
                        </div>
                        <span className="flex items-center gap-1.5">
                          <Calendar size={12} />
                          {formatDate(review.createdAt as unknown as string)}
                        </span>
                    </div>
                  </div>


                <div className="bg-[#0A0A0A] border border-neutral-800/60 rounded-xl p-8 shadow-2xl">
                   <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={MarkdownComponents as any}
                   >
                    {review.review}
                  </ReactMarkdown>

                  {review.issues && review.issues.length > 0 && (
                    <div className="mt-12 pt-8 border-t border-neutral-900">
                      <div className="grid gap-3">
                        {review.issues.map((issue: string, i: number) => (
                          <div key={i} className="flex gap-4 p-4 rounded-lg bg-[#0D0D0D] border border-neutral-800/40 hover:border-amber-500/20 transition-colors group/issue">
                            <div className="shrink-0 flex items-center justify-center w-6 h-6 rounded bg-neutral-900 border border-neutral-800 text-[10px] font-mono text-neutral-500 group-hover/issue:text-amber-500">
                              {String(i + 1).padStart(2, '0')}
                            </div>
                            <p className="text-[13px] text-neutral-400 leading-relaxed font-mono">
                              {issue}
                            </p>
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
