"use client";

import {
	BookOpen,
	ChevronRight,
	Clock,
	GitBranch,
	LayoutDashboard,
	ListChecks,
	Rocket,
	Settings,
	UserCog,
	Zap,
} from "lucide-react";

import { useUIStore } from "@/lib/store/ui-store";

const navItems = [
	{ icon: GitBranch, label: "Repositories", active: true },
	{ icon: LayoutDashboard, label: "Dashboard" },
	{ icon: Zap, label: "Integrations" },
	{ icon: Clock, label: "Reports" },
	{ icon: BookOpen, label: "Learnings" },
	{ icon: ListChecks, label: "Issue Planner", badge: "Beta" },
	{ icon: Settings, label: "Configuration" },
	{ icon: UserCog, label: "Account Settings" },
];

export function Sidebar() {
	const { sidebarOpen } = useUIStore();

	if (!sidebarOpen) return null;

	return (
		<aside
			className="flex flex-col h-full shrink-0"
			style={{
				width: 268,
				background: "#0e0e10",
				borderRight: "1px solid #1e1e22",
			}}
		>
			<div
				className="flex items-center gap-2 px-4 py-3"
				style={{ borderBottom: "1px solid #1e1e22", height: 52 }}
			>
				<div
					className="flex items-center justify-center rounded"
					style={{
						width: 28,
						height: 28,
						background: "#ff6240",
						borderRadius: 6,
						fontSize: 13,
						fontWeight: 700,
						color: "#fff",
						flexShrink: 0,
					}}
				>
					AI
				</div>
				<span
					className="flex-1 text-sm font-semibold"
					style={{ color: "#e8e8ea" }}
				>
					Mihir2423
				</span>
				<span
					className="text-xs font-semibold px-1.5 py-0.5 rounded"
					style={{
						background: "#1e1e22",
						color: "#a0a0a8",
						border: "1px solid #2e2e34",
						fontSize: 10,
					}}
				>
					PRO
				</span>
			</div>

			<nav className="flex-1 px-2 py-2 overflow-y-auto">
				{navItems.map(({ icon: Icon, label, active, badge }) => (
					<button
						key={label}
						type="button"
						className="flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-sm mb-0.5 transition-all"
						style={{
							background: active ? "#1a1a1f" : "transparent",
							color: active ? "#e8e8ea" : "#808088",
							fontWeight: active ? 500 : 400,
							border: "none",
							cursor: "pointer",
							textAlign: "left",
						}}
						onMouseEnter={(e) => {
							if (!active) e.currentTarget.style.background = "#16161a";
							e.currentTarget.style.color = "#e8e8ea";
						}}
						onMouseLeave={(e) => {
							if (!active) e.currentTarget.style.background = "transparent";
							e.currentTarget.style.color = active ? "#e8e8ea" : "#808088";
						}}
					>
						<Icon size={15} style={{ flexShrink: 0 }} />
						<span className="flex-1">{label}</span>
						{badge && (
							<span
								className="text-xs px-1.5 py-0.5 rounded"
								style={{
									background: "#1e2a1e",
									color: "#6bcf7f",
									border: "1px solid #2e3e2e",
									fontSize: 10,
									fontWeight: 500,
								}}
							>
								{badge}
							</span>
						)}
					</button>
				))}
			</nav>

			<div className="px-3 pb-3">
				<div
					className="rounded-lg p-3"
					style={{
						background: "#13131a",
						border: "1px solid #1e1e28",
					}}
				>
					<div className="flex items-start gap-2">
						<Rocket
							size={14}
							style={{ color: "#ff6240", marginTop: 1, flexShrink: 0 }}
						/>
						<div>
							<p className="text-xs mb-1" style={{ color: "#c0c0c8" }}>
								Get started with{" "}
								<span style={{ color: "#ff6240", fontWeight: 600 }}>
									AI Review
								</span>
							</p>
							<p className="text-xs" style={{ color: "#606068" }}>
								<span style={{ color: "#808088" }}>Up Next:</span> Checkout your
								first AI review
							</p>
						</div>
						<ChevronRight
							size={13}
							style={{ color: "#606068", marginTop: 1, flexShrink: 0 }}
						/>
					</div>
				</div>
			</div>
		</aside>
	);
}
