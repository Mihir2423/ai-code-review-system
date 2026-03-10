"use client";

import {
	ArrowUpDown,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
	Search,
} from "lucide-react";
import { useState } from "react";

export function DashboardContent() {
	const [rowsPerPage, setRowsPerPage] = useState(10);
	return (
		<main className="flex-1 overflow-y-auto px-8 py-6">
			<h1 className="text-2xl font-bold mb-1" style={{ color: "#e8e8ea" }}>
				Repositories
			</h1>
			<p className="text-sm mb-5" style={{ color: "#606068" }}>
				List of repositories accessible to CodeRabbit.
			</p>

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

			<div
				className="rounded-xl overflow-hidden"
				style={{ border: "1px solid #1a1a20" }}
			>
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

				<div
					className="flex items-center px-4 py-3.5 cursor-pointer transition-colors"
					style={{ borderBottom: "1px solid #13131a" }}
					onMouseEnter={(e) => (e.currentTarget.style.background = "#0e0e14")}
					onMouseLeave={(e) =>
						(e.currentTarget.style.background = "transparent")
					}
				>
					<span className="text-sm font-medium" style={{ color: "#7ab4f5" }}>
						ai-code-review-system
					</span>
				</div>
			</div>

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
	);
}
