"use client";

import { useState } from "react";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { Navbar } from "@/components/globals/Navbar";
import { Sidebar } from "@/components/globals/Sidebar";

export default function App() {
	const [dropdownOpen, setDropdownOpen] = useState(true);
	const [theme, setTheme] = useState("dark");
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [rowsPerPage, setRowsPerPage] = useState(10);

	return (
		<div
			className="flex h-screen w-full overflow-hidden"
			onClick={() => setDropdownOpen(false)}
		>
			<Sidebar isOpen={sidebarOpen} />

			<div
				className="flex flex-col flex-1 min-w-0"
				style={{ background: "#0a0a0c" }}
			>
				<Navbar
					dropdownOpen={dropdownOpen}
					setDropdownOpen={setDropdownOpen}
					theme={theme}
					setTheme={setTheme}
					sidebarOpen={sidebarOpen}
					setSidebarOpen={setSidebarOpen}
				/>

				<DashboardContent
					rowsPerPage={rowsPerPage}
					setRowsPerPage={setRowsPerPage}
				/>
			</div>
		</div>
	);
}
