'use client';

import { Bell, Bookmark, ChevronDown, GitBranch, HelpCircle, LogOut, PanelLeft, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { useSidebar } from '@/components/ui/sidebar';

export function Navbar() {
    const { toggleSidebar } = useSidebar();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const { data: session } = authClient.useSession();
    const router = useRouter();
    const user = session?.user;
    return (
        <header
            className="flex items-center justify-between px-4 shrink-0"
            style={{
                height: 52,
                borderBottom: '1px solid #e4e4e7',
                background: '#ffffff',
            }}
        >
            <div className="flex items-center gap-3">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleSidebar();
                    }}
                    type="button"
                    className="flex items-center justify-center rounded"
                    style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#a1a1aa',
                        padding: 4,
                    }}
                >
                    <PanelLeft size={16} />
                </button>
                <div
                    className="flex items-center justify-center rounded"
                    style={{
                        width: 22,
                        height: 22,
                        background: '#f4f4f5',
                        border: '1px solid #e4e4e7',
                    }}
                >
                    <GitBranch size={12} color="#71717a" />
                </div>
                <span className="text-sm font-medium" style={{ color: '#3f3f46' }}>
                    Repositories
                </span>
            </div>

            <div className="flex items-center gap-1 relative">
                {[Search, Bell, HelpCircle, Bookmark].map((Icon, i) => (
                    <button
                        key={i}
                        type="button"
                        className="flex items-center justify-center rounded"
                        style={{
                            width: 32,
                            height: 32,
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#a1a1aa',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f4f4f5')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                        <Icon size={16} />
                    </button>
                ))}

                <button
                    className="flex items-center gap-1.5 rounded px-1.5 py-1 ml-1"
                    type="button"
                    style={{
                        background: dropdownOpen ? '#f4f4f5' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        setDropdownOpen(!dropdownOpen);
                    }}
                >
                    {user?.image ? (
                        <img
                            src={user.image}
                            alt={user.name || 'User'}
                            className="rounded-full"
                            style={{
                                width: 26,
                                height: 26,
                                flexShrink: 0,
                            }}
                        />
                    ) : (
                        <div
                            className="rounded-full flex items-center justify-center text-xs font-bold"
                            style={{
                                width: 26,
                                height: 26,
                                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                color: '#fff',
                                flexShrink: 0,
                            }}
                        >
                            {user?.name?.[0]?.toUpperCase() || 'U'}
                        </div>
                    )}
                    <ChevronDown size={13} color="#a1a1aa" />
                </button>

                {dropdownOpen && (
                    <div
                        className="absolute top-10 right-0 rounded-xl overflow-hidden z-50"
                        style={{
                            width: 240,
                            background: '#ffffff',
                            border: '1px solid #e4e4e7',
                            boxShadow: '0 16px 48px rgba(0,0,0,0.1)',
                        }}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.stopPropagation();
                            }
                        }}
                    >
                        <div
                            className="flex items-center gap-3 px-4 py-3"
                            style={{ borderBottom: '1px solid #e4e4e7' }}
                        >
                            {user?.image ? (
                                <img
                                    src={user.image}
                                    alt={user.name || 'User'}
                                    className="rounded-full shrink-0"
                                    style={{
                                        width: 36,
                                        height: 36,
                                    }}
                                />
                            ) : (
                                <div
                                    className="rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                                    style={{
                                        width: 36,
                                        height: 36,
                                        background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                        color: '#fff',
                                    }}
                                >
                                    {user?.name?.[0]?.toUpperCase() || 'U'}
                                </div>
                            )}
                            <div>
                                <p className="text-sm font-semibold" style={{ color: '#18181b' }}>
                                    {user?.name || 'User'}
                                </p>
                                <p className="text-xs" style={{ color: '#a1a1aa' }}>
                                    {user?.email || ''}
                                </p>
                            </div>
                        </div>

                        <button
                            className="flex items-center gap-2.5 w-full px-4 py-3 text-sm"
                            type="button"
                            style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#71717a',
                                textAlign: 'left',
                            }}
                            onClick={() => {
                                authClient.signOut();
                                router.push('/');
                                setDropdownOpen(false);
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#f4f4f5')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                            <LogOut size={14} />
                            Logout
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
}
