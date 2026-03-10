"use client";

import {
	ArrowUpDown,
	Bell,
	Bookmark,
	BookOpen,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
	Clock,
	GitBranch,
	HelpCircle,
	LayoutDashboard,
	ListChecks,
	LogOut,
	Monitor,
	Moon,
	PanelLeft,
	Rocket,
	Search,
	Settings,
	Sun,
	UserCog,
	Zap,
} from "lucide-react";
import { useState } from "react";

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

export default function App() {
	const [dropdownOpen, setDropdownOpen] = useState(true);
	const [theme, setTheme] = useState("dark");
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [rowsPerPage, setRowsPerPage] = useState(10);

	return (
		<div
			style={{ fontFamily: "'Geist', 'DM Sans', sans-serif" }}
			className="flex h-screen w-full overflow-hidden"
			onClick={() => setDropdownOpen(false)}
		>
			{/* Sidebar */}
			{sidebarOpen && (
				<aside
					className="flex flex-col h-full shrink-0"
					style={{
						width: 268,
						background: "#0e0e10",
						borderRight: "1px solid #1e1e22",
					}}
				>
					{/* Logo / workspace */}
					<div
						className="flex items-center gap-2 px-4 py-3"
						style={{ borderBottom: "1px solid #1e1e22", height: 52 }}
					>
						{/* CodeRabbit logo placeholder */}
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

					{/* Nav */}
					<nav className="flex-1 px-2 py-2 overflow-y-auto">
						{navItems.map(({ icon: Icon, label, active, badge }) => (
							<button
								key={label}
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

					{/* Get started card */}
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
										<span style={{ color: "#808088" }}>Up Next:</span> Checkout
										your first CodeRabbit review
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
			)}

			{/* Main */}
			<div
				className="flex flex-col flex-1 min-w-0"
				style={{ background: "#0a0a0c" }}
			>
				{/* Top bar */}
				<header
					className="flex items-center justify-between px-4 shrink-0"
					style={{
						height: 52,
						borderBottom: "1px solid #1a1a1e",
						background: "#0e0e10",
					}}
				>
					<div className="flex items-center gap-3">
						<button
							onClick={(e) => {
								e.stopPropagation();
								setSidebarOpen((v) => !v);
							}}
							className="flex items-center justify-center rounded"
							style={{
								background: "transparent",
								border: "none",
								cursor: "pointer",
								color: "#606068",
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
								background: "#1a1a20",
								border: "1px solid #2a2a30",
							}}
						>
							<GitBranch size={12} color="#808088" />
						</div>
						<span className="text-sm font-medium" style={{ color: "#c0c0c8" }}>
							Repositories
						</span>
					</div>

					{/* Right icons */}
					<div className="flex items-center gap-1 relative">
						{[Search, Bell, HelpCircle, Bookmark].map((Icon, i) => (
							<button
								key={i}
								className="flex items-center justify-center rounded"
								style={{
									width: 32,
									height: 32,
									background: "transparent",
									border: "none",
									cursor: "pointer",
									color: "#606068",
								}}
								onMouseEnter={(e) =>
									(e.currentTarget.style.background = "#16161a")
								}
								onMouseLeave={(e) =>
									(e.currentTarget.style.background = "transparent")
								}
							>
								<Icon size={16} />
							</button>
						))}

						{/* Avatar + chevron */}
						<button
							className="flex items-center gap-1.5 rounded px-1.5 py-1 ml-1"
							style={{
								background: dropdownOpen ? "#1a1a20" : "transparent",
								border: "none",
								cursor: "pointer",
							}}
							onClick={(e) => {
								e.stopPropagation();
								setDropdownOpen((v) => !v);
							}}
						>
							<div
								className="rounded-full flex items-center justify-center text-xs font-bold"
								style={{
									width: 26,
									height: 26,
									background: "linear-gradient(135deg, #667eea, #764ba2)",
									color: "#fff",
									flexShrink: 0,
								}}
							>
								M
							</div>
							<ChevronDown size={13} color="#606068" />
						</button>

						{/* Dropdown */}
						{dropdownOpen && (
							<div
								className="absolute top-10 right-0 rounded-xl overflow-hidden z-50"
								style={{
									width: 240,
									background: "#13131a",
									border: "1px solid #1e1e28",
									boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
								}}
								onClick={(e) => e.stopPropagation()}
							>
								{/* User info */}
								<div
									className="flex items-center gap-3 px-4 py-3"
									style={{ borderBottom: "1px solid #1e1e28" }}
								>
									<div
										className="rounded-full flex items-center justify-center text-sm font-bold shrink-0"
										style={{
											width: 36,
											height: 36,
											background: "linear-gradient(135deg, #667eea, #764ba2)",
											color: "#fff",
										}}
									>
										M
									</div>
									<div>
										<p
											className="text-sm font-semibold"
											style={{ color: "#e8e8ea" }}
										>
											Mihir2423
										</p>
										<p className="text-xs" style={{ color: "#606068" }}>
											Admin
										</p>
									</div>
								</div>

								{/* Theme */}
								<div
									className="flex items-center justify-between px-4 py-3"
									style={{ borderBottom: "1px solid #1e1e28" }}
								>
									<span className="text-sm" style={{ color: "#c0c0c8" }}>
										Theme
									</span>
									<div
										className="flex rounded-lg overflow-hidden"
										style={{
											background: "#0e0e12",
											border: "1px solid #2a2a30",
										}}
									>
										{[
											{ icon: Sun, value: "light" },
											{ icon: Moon, value: "dark" },
											{ icon: Monitor, value: "system" },
										].map(({ icon: Icon, value }) => (
											<button
												key={value}
												onClick={() => setTheme(value)}
												className="flex items-center justify-center"
												style={{
													width: 30,
													height: 26,
													background:
														theme === value ? "#2a2a34" : "transparent",
													border: "none",
													cursor: "pointer",
													color: theme === value ? "#e8e8ea" : "#505058",
													transition: "all 0.15s",
												}}
											>
												<Icon size={13} />
											</button>
										))}
									</div>
								</div>

								{/* Logout */}
								<button
									className="flex items-center gap-2.5 w-full px-4 py-3 text-sm"
									style={{
										background: "transparent",
										border: "none",
										cursor: "pointer",
										color: "#808088",
										textAlign: "left",
									}}
									onMouseEnter={(e) =>
										(e.currentTarget.style.background = "#16161e")
									}
									onMouseLeave={(e) =>
										(e.currentTarget.style.background = "transparent")
									}
								>
									<LogOut size={14} />
									Logout
								</button>
							</div>
						)}
					</div>
				</header>

				{/* Page content */}
				<main className="flex-1 overflow-y-auto px-8 py-6">
					<h1 className="text-2xl font-bold mb-1" style={{ color: "#e8e8ea" }}>
						Repositories
					</h1>
					<p className="text-sm mb-5" style={{ color: "#606068" }}>
						List of repositories accessible to CodeRabbit.
					</p>

					{/* Search */}
					<div
						className="flex items-center gap-2 rounded-lg px-3 mb-4"
						style={{
							background: "#0e0e12",
							border: "1px solid #1e1e24",
							height: 38,
							maxWidth: 320,
						}}
					>
						<Search size={14} color="#505058" />
						<input
							placeholder="Search repositories"
							className="flex-1 bg-transparent text-sm outline-none"
							style={{ color: "#c0c0c8", caretColor: "#e8e8ea" }}
						/>
					</div>

					{/* Table */}
					<div
						className="rounded-xl overflow-hidden"
						style={{ border: "1px solid #1a1a20" }}
					>
						{/* Table header */}
						<div
							className="flex items-center px-4 py-2.5"
							style={{
								background: "#0e0e12",
								borderBottom: "1px solid #1a1a20",
							}}
						>
							<button
								className="flex items-center gap-1.5 text-xs font-medium"
								style={{
									background: "transparent",
									border: "none",
									cursor: "pointer",
									color: "#808088",
								}}
							>
								Repository
								<ArrowUpDown size={12} color="#505058" />
							</button>
						</div>

						{/* Row */}
						<div
							className="flex items-center px-4 py-3.5 cursor-pointer transition-colors"
							style={{ borderBottom: "1px solid #13131a" }}
							onMouseEnter={(e) =>
								(e.currentTarget.style.background = "#0e0e14")
							}
							onMouseLeave={(e) =>
								(e.currentTarget.style.background = "transparent")
							}
						>
							<span
								className="text-sm font-medium"
								style={{ color: "#7ab4f5" }}
							>
								ai-code-review-system
							</span>
						</div>
					</div>

					{/* Pagination */}
					<div
						className="flex items-center justify-end gap-3 mt-3"
						style={{ color: "#606068", fontSize: 13 }}
					>
						<div className="flex items-center gap-2">
							<span>Rows per page</span>
							<div
								className="flex items-center gap-1 rounded px-2 py-1"
								style={{
									background: "#0e0e12",
									border: "1px solid #1e1e24",
									cursor: "pointer",
								}}
							>
								<span style={{ color: "#c0c0c8" }}>{rowsPerPage}</span>
								<ChevronDown size={12} color="#505058" />
							</div>
						</div>
						<span style={{ color: "#808088" }}>Page 1 of 1</span>
						<div className="flex items-center gap-0.5">
							{[ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight].map(
								(Icon, i) => (
									<button
										key={i}
										type="button"
										className="flex items-center justify-center rounded"
										style={{
											width: 26,
											height: 26,
											background: "transparent",
											border: "none",
											cursor: "pointer",
											color: "#404048",
										}}
									>
										<Icon size={14} />
									</button>
								),
							)}
						</div>
					</div>
				</main>
			</div>
		</div>
	);
}
