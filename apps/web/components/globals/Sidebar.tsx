'use client';

import { ChevronRight, GitBranch, LayoutDashboard, Rocket, Settings, UserCog } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Sidebar as ShadcnSidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

const navItems = [
    { icon: GitBranch, label: 'Repositories', route: 'repositories' },
    { icon: LayoutDashboard, label: 'Dashboard', route: 'dashboard' },
    { icon: Settings, label: 'Review history', route: 'review-history' },
    { icon: UserCog, label: 'Account Settings', route: 'settings' },
];

const lightVars = {
    '--sidebar-background': '0 0% 100%',
    '--sidebar-foreground': '240 5.9% 10%',
    '--sidebar-border': '240 5.9% 89.8%',
    '--sidebar-accent': '240 4.8% 95.9%',
    '--sidebar-accent-foreground': '240 5.9% 10%',
    '--sidebar-primary': '240 5.9% 10%',
    '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-ring': '217.2 91.2% 59.8%',
} as React.CSSProperties;

export function Sidebar() {
    const pathname = usePathname();
    const { state } = useSidebar();
    const { data: session } = authClient.useSession();
    const user = session?.user;

    return (
        <ShadcnSidebar collapsible="icon" style={lightVars}>
            <SidebarHeader
                className={cn('border-b border-[#e4e4e7] px-3', {
                    'px-2': state !== 'expanded',
                })}
                style={{ height: 52, justifyContent: 'center' }}
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    <div
                        className="shrink-0 flex items-center justify-center"
                        style={{
                            width: 28,
                            height: 28,
                            background: '#ff6240',
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 700,
                            color: '#fff',
                        }}
                    >
                        AI
                    </div>

                    {state === 'expanded' && (
                        <span
                            className="flex-1 text-sm font-semibold truncate group-data-[collapsible=icon]:hidden"
                            style={{ color: '#18181b' }}
                        >
                            {user?.name}
                        </span>
                    )}
                    {state === 'expanded' && (
                        <span
                            className="shrink-0 font-semibold px-1.5 py-0.5 rounded group-data-[collapsible=icon]:hidden"
                            style={{
                                background: '#f4f4f5',
                                color: '#71717a',
                                border: '1px solid #e4e4e7',
                                fontSize: 10,
                            }}
                        >
                            PRO
                        </span>
                    )}
                </div>
            </SidebarHeader>

            <SidebarContent className="px-1 py-2">
                <SidebarMenu>
                    {navItems.map(({ icon: Icon, label, route }) => {
                        const active = pathname.includes(route);
                        return (
                            <SidebarMenuItem key={label}>
                                <SidebarMenuButton
                                    render={<Link href={`/${route}`} />}
                                    isActive={active}
                                    tooltip={label}
                                    className="mb-0.5 rounded-md transition-all"
                                    style={{
                                        background: active ? '#f4f4f5' : 'transparent',
                                        color: active ? '#18181b' : '#71717a',
                                        fontWeight: active ? 500 : 400,
                                    }}
                                >
                                    <Icon size={15} style={{ flexShrink: 0 }} />
                                    <span>{label}</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        );
                    })}
                </SidebarMenu>
            </SidebarContent>

            {state === 'expanded' && (
                <SidebarFooter className="px-3 pb-3">
                    <div
                        className="rounded-lg p-3 group-data-[collapsible=icon]:hidden"
                        style={{ background: '#fafafa', border: '1px solid #e4e4e7' }}
                    >
                        <div className="flex items-start gap-2">
                            <Rocket size={14} style={{ color: '#ff6240', marginTop: 1, flexShrink: 0 }} />
                            <div>
                                <p className="text-xs mb-1 line-clamp-1" style={{ color: '#3f3f46' }}>
                                    Get started with{' '}
                                    <span style={{ color: '#ff6240', fontWeight: 600 }}>AI Review</span>
                                </p>
                                <p className="text-xs line-clamp-2" style={{ color: '#a1a1aa' }}>
                                    <span style={{ color: '#71717a' }}>Up Next:</span> Checkout your first AI review
                                </p>
                            </div>
                            <ChevronRight size={13} style={{ color: '#a1a1aa', marginTop: 1, flexShrink: 0 }} />
                        </div>
                    </div>
                </SidebarFooter>
            )}
        </ShadcnSidebar>
    );
}
