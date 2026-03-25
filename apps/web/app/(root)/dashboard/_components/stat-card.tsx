'use client';

import { useEffect, useState } from 'react';
import { MiniSparkline } from './mini-sparkline';
import type { Stat } from './types';

interface StatCardProps {
    stat: Stat;
    index: number;
}

export function StatCard({ stat, index }: StatCardProps) {
    const [count, setCount] = useState(0);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setVisible(true), index * 120);
        return () => clearTimeout(t);
    }, [index]);

    useEffect(() => {
        if (!visible) return;
        const duration = 900;
        const steps = 40;
        const target = stat.value;
        let step = 0;
        const interval = setInterval(() => {
            step++;
            const progress = step / steps;
            const eased = 1 - (1 - progress) ** 3;
            setCount(Math.round(eased * target));
            if (step >= steps) clearInterval(interval);
        }, duration / steps);
        return () => clearInterval(interval);
    }, [visible, stat.value]);

    const connectedPct = stat.id === 'STAT-003' ? Math.round((31 / 48) * 100) : null;

    return (
        <div
            className={`relative overflow-hidden flex flex-col gap-3.5 justify-between rounded-md border border-neutral-200 bg-white p-5 transition-all duration-500 ease-out ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
            }`}
            style={{ minWidth: 0 }}
        >
            <div className="flex flex-col gap-3.5">
                <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                        <span className="font-mono text-[10px] text-neutral-400 tracking-wider">{stat.id}</span>
                        <span className="font-mono text-xs text-neutral-500 tracking-wide">{stat.label}</span>
                    </div>

                    <div className="flex items-center gap-1.5 rounded border border-neutral-200 bg-neutral-50 px-2 py-1">
                        <div
                            className="h-1.5 w-1.5 rounded-full"
                            style={{
                                background: stat.statusColor,
                                boxShadow: `0 0 6px ${stat.statusColor}88`,
                            }}
                        />
                        <span className="font-mono text-[10px] tracking-wider" style={{ color: stat.statusColor }}>
                            {stat.status}
                        </span>
                    </div>
                </div>

                <div className="flex justify-between items-end">
                    <div>
                        <div className="font-mono text-[38px] font-bold leading-none tracking-wide text-neutral-900">
                            {count.toLocaleString()}
                        </div>
                        <div className="mt-1.5 font-mono text-[11px]" style={{ color: stat.accentColor }}>
                            {stat.change}
                        </div>
                    </div>
                    <MiniSparkline data={stat.trend} color={stat.accentColor} />
                </div>

                {connectedPct !== null && (
                    <div>
                        <div className="mb-1.5 flex justify-between">
                            <span className="font-mono text-[10px] text-neutral-400">coverage</span>
                            <span className="font-mono text-[10px]" style={{ color: stat.accentColor }}>
                                {connectedPct}%
                            </span>
                        </div>
                        <div className="h-0.5 overflow-hidden rounded bg-neutral-200">
                            <div
                                className="h-full rounded transition-all duration-1000 ease-out"
                                style={{
                                    width: visible ? `${connectedPct}%` : '0%',
                                    background: `linear-gradient(90deg, ${stat.accentColor}, ${stat.accentColor}88)`,
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between border-t border-neutral-200 pt-2">
                <div className="flex items-center gap-1.5">
                    <span style={{ color: stat.tagColor }} className="text-[11px]">
                        {stat.tagIcon}
                    </span>
                    <span className="font-mono text-[10px] text-neutral-400 tracking-wider">{stat.tag}</span>
                </div>
                <span className="font-mono text-[10px] text-neutral-400">Updated just now</span>
            </div>
        </div>
    );
}
