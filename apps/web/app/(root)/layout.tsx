import { Navbar } from "@/components/globals/Navbar";
import { Sidebar } from "@/components/globals/Sidebar";

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<div className="flex h-screen w-full overflow-hidden">
			<Sidebar />

			<div
				className="flex flex-col flex-1 min-w-0"
				style={{ background: "#0a0a0c" }}
			>
				<Navbar />

				{children}
			</div>
		</div>
	);
}
