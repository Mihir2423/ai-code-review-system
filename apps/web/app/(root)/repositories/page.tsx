import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { auth } from "@/lib/auth";

export default async function App() {
	const session = await auth.api.getSession({ headers: await headers() });

	if (!session) redirect("/login");
	return <DashboardContent />;
}
