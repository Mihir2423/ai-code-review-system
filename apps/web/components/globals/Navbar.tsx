'use client';

import {
    Bell,
    Bookmark,
    ChevronDown,
    GitBranch,
    HelpCircle,
    LogOut,
    Monitor,
    Moon,
    PanelLeft,
    Search,
    Sun,
} from 'lucide-react';

import { useUIStore } from '@/lib/store/ui-store';

export function Navbar() {
    const { dropdownOpen, setDropdownOpen, theme, setTheme, toggleSidebar } = useUIStore();
    return (
        <header
            className="flex items-center justify-between px-4 shrink-0"
            style={{
                height: 52,
                borderBottom: '1px solid #1a1a1e',
                background: '#0e0e10',
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
                        color: '#606068',
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
                        background: '#1a1a20',
                        border: '1px solid #2a2a30',
                    }}
                >
                    <GitBranch size={12} color="#808088" />
                </div>
                <span className="text-sm font-medium" style={{ color: '#c0c0c8' }}>
                    Repositories
                </span>
            </div>

            <div className="flex items-center gap-1 relative">
                {[Search, Bell, HelpCircle, Bookmark].map((Icon, i) => (
                    <button
                        key={i}
                        className="flex items-center justify-center rounded"
                        style={{
                            width: 32,
                            height: 32,
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#606068',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#16161a')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                        <Icon size={16} />
                    </button>
                ))}

                <button
                    className="flex items-center gap-1.5 rounded px-1.5 py-1 ml-1"
                    style={{
                        background: dropdownOpen ? '#1a1a20' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        setDropdownOpen(!dropdownOpen);
                    }}
                >
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
                        M
                    </div>
                    <ChevronDown size={13} color="#606068" />
                </button>

                {dropdownOpen && (
                    <div
                        className="absolute top-10 right-0 rounded-xl overflow-hidden z-50"
                        style={{
                            width: 240,
                            background: '#13131a',
                            border: '1px solid #1e1e28',
                            boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            className="flex items-center gap-3 px-4 py-3"
                            style={{ borderBottom: '1px solid #1e1e28' }}
                        >
                            <div
                                className="rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                                style={{
                                    width: 36,
                                    height: 36,
                                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                    color: '#fff',
                                }}
                            >
                                M
                            </div>
                            <div>
                                <p className="text-sm font-semibold" style={{ color: '#e8e8ea' }}>
                                    Mihir2423
                                </p>
                                <p className="text-xs" style={{ color: '#606068' }}>
                                    Admin
                                </p>
                            </div>
                        </div>

                        <div
                            className="flex items-center justify-between px-4 py-3"
                            style={{ borderBottom: '1px solid #1e1e28' }}
                        >
                            <span className="text-sm" style={{ color: '#c0c0c8' }}>
                                Theme
                            </span>
                            <div
                                className="flex rounded-lg overflow-hidden"
                                style={{
                                    background: '#0e0e12',
                                    border: '1px solid #2a2a30',
                                }}
                            >
                                {[
                                    { icon: Sun, value: 'light' },
                                    { icon: Moon, value: 'dark' },
                                    { icon: Monitor, value: 'system' },
                                ].map(({ icon: Icon, value }) => (
                                    <button
                                        key={value}
                                        onClick={() => setTheme(value)}
                                        className="flex items-center justify-center"
                                        style={{
                                            width: 30,
                                            height: 26,
                                            background: theme === value ? '#2a2a34' : 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: theme === value ? '#e8e8ea' : '#505058',
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        <Icon size={13} />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            className="flex items-center gap-2.5 w-full px-4 py-3 text-sm"
                            style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#808088',
                                textAlign: 'left',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#16161e')}
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
