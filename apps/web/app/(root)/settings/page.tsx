'use client';

import { CalendarDays, Github, LogOut, MailCheck, ShieldCheck, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ComponentType, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { authClient } from '@/lib/auth-client';

function getUserInitials(name?: string | null) {
    if (!name) return 'U';

    const initials = name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');

    return initials || 'U';
}

function formatDate(value?: string | Date) {
    if (!value) return 'Unavailable';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return 'Unavailable';

    return new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    }).format(date);
}

function SectionCard({
    title,
    description,
    children,
}: {
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="px-5 py-4 sm:px-6">
                <div className="mb-4">
                    <h2 className="text-sm font-semibold tracking-wide text-neutral-900">{title}</h2>
                    <p className="mt-1 font-mono text-[11px] text-neutral-400">{description}</p>
                </div>
                {children}
            </div>
        </section>
    );
}

function DetailItem({
    label,
    value,
    icon: Icon,
}: {
    label: string;
    value: ReactNode;
    icon: ComponentType<{ className?: string }>;
}) {
    return (
        <div className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 py-3">
            <div className="mt-0.5 rounded-lg border border-neutral-200 bg-white p-2 text-neutral-400">
                <Icon className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-400">{label}</p>
                <div className="mt-1 break-words text-sm font-medium text-neutral-900">{value}</div>
            </div>
        </div>
    );
}

function SettingsPageSkeleton() {
    return (
        <div className="min-h-screen bg-neutral-50 p-0 text-neutral-700">
            <div className="mx-auto max-w-5xl px-7 py-8">
                <div className="mb-7">
                    <Skeleton className="h-7 w-52 bg-neutral-200" />
                    <Skeleton className="mt-3 h-3 w-72 bg-neutral-200" />
                </div>

                <div className="space-y-5">
                    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center gap-4">
                            <Skeleton className="h-[72px] w-[72px] rounded-full bg-neutral-200" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-5 w-40 bg-neutral-200" />
                                <Skeleton className="h-4 w-56 bg-neutral-200" />
                            </div>
                        </div>
                    </div>

                    {Array.from({ length: 2 }).map((_, index) => (
                        <div key={index} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                            <Skeleton className="h-5 w-44 bg-neutral-200" />
                            <Skeleton className="mt-2 h-3 w-64 bg-neutral-200" />
                            <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                <Skeleton className="h-24 rounded-xl bg-neutral-200" />
                                <Skeleton className="h-24 rounded-xl bg-neutral-200" />
                            </div>
                        </div>
                    ))}

                    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                        <Skeleton className="h-5 w-32 bg-neutral-200" />
                        <Skeleton className="mt-2 h-3 w-52 bg-neutral-200" />
                        <Skeleton className="mt-5 h-10 w-32 bg-neutral-200" />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function SettingsPage() {
    const router = useRouter();
    const { data: session, isPending } = authClient.useSession();
    const user = session?.user;

    if (isPending) {
        return <SettingsPageSkeleton />;
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-neutral-50 p-0 text-neutral-700">
                <div className="mx-auto max-w-5xl px-7 py-8">
                    <div className="mb-7">
                        <h1 className="mb-1.5 text-[22px] font-semibold tracking-wide text-neutral-900">
                            Account Settings
                        </h1>
                        <p className="font-mono text-xs text-neutral-400">Manage your profile and preferences.</p>
                    </div>

                    <section className="rounded-2xl border border-neutral-200 bg-white px-6 py-10 text-center shadow-sm">
                        <p className="text-sm font-medium text-neutral-900">Unable to load your account details.</p>
                        <p className="mt-2 font-mono text-xs text-neutral-400">
                            Your session may have expired. Sign in again to continue.
                        </p>
                        <Button
                            className="mt-5 bg-[#ff6240] text-white hover:bg-[#ff6240]/90"
                            onClick={() => router.push('/')}
                        >
                            Return Home
                        </Button>
                    </section>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-50 p-0 text-neutral-700 selection:bg-[#ff6240]/20">
            <div className="mx-auto max-w-5xl px-7 py-8">
                <div className="mb-7">
                    <h1 className="mb-1.5 text-[22px] font-semibold tracking-wide text-neutral-900">Account Settings</h1>
                    <p className="font-mono text-xs text-neutral-400">Manage your profile and preferences.</p>
                </div>

                <div className="space-y-5">
                    <SectionCard title="Profile" description="Your GitHub account details synced through OAuth.">
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                            <div className="flex items-center gap-4">
                                {user.image ? (
                                    <img
                                        src={user.image}
                                        alt={user.name || 'User'}
                                        className="h-[72px] w-[72px] rounded-full border border-neutral-200 object-cover"
                                    />
                                ) : (
                                    <div
                                        className="flex h-[72px] w-[72px] items-center justify-center rounded-full border border-neutral-200 text-lg font-semibold text-white"
                                        style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
                                    >
                                        {getUserInitials(user.name)}
                                    </div>
                                )}

                                <div>
                                    <p className="text-lg font-semibold text-neutral-900">{user.name}</p>
                                    <p className="mt-1 text-sm text-neutral-400">{user.email}</p>
                                </div>
                            </div>

                            <div className="grid flex-1 gap-3 sm:grid-cols-2">
                                <DetailItem label="Display name" value={user.name} icon={UserRound} />
                                <DetailItem label="Email address" value={user.email} icon={MailCheck} />
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard title="Account information" description="Read-only account metadata from your authenticated session.">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <DetailItem label="Member since" value={formatDate(user.createdAt)} icon={CalendarDays} />
                            <DetailItem
                                label="Email verification"
                                value={
                                    <span
                                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                                            user.emailVerified
                                                ? 'bg-emerald-50 text-emerald-700'
                                                : 'bg-neutral-100 text-neutral-700'
                                        }`}
                                    >
                                        {user.emailVerified ? 'Verified' : 'Not verified'}
                                    </span>
                                }
                                icon={ShieldCheck}
                            />
                        </div>
                    </SectionCard>

                    <SectionCard title="Connected accounts" description="Authentication providers linked to your workspace access.">
                        <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 py-4">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-xl border border-neutral-200 bg-white p-2.5 text-neutral-900">
                                        <Github className="size-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-neutral-900">GitHub</p>
                                        <p className="mt-1 font-mono text-[11px] text-neutral-400">
                                            Connected via OAuth for sign-in.
                                        </p>
                                    </div>
                                </div>

                                <span className="inline-flex items-center rounded-full bg-[#ff6240]/10 px-2.5 py-1 text-xs font-semibold text-[#ff6240]">
                                    Connected
                                </span>
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard title="Session" description="Sign out from your current workspace session.">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm font-medium text-neutral-900">Current session</p>
                                <p className="mt-1 font-mono text-[11px] text-neutral-400">
                                    Signing out will return you to the landing page.
                                </p>
                            </div>

                            <Button
                                variant="outline"
                                className="border-neutral-200 text-neutral-700 hover:bg-neutral-100"
                                onClick={() => {
                                    authClient.signOut();
                                    router.push('/');
                                }}
                            >
                                <LogOut className="size-4" />
                                Sign out
                            </Button>
                        </div>
                    </SectionCard>
                </div>
            </div>
        </div>
    );
}
