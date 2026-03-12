import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { DashboardContent } from '@/app/(root)/dashboard/_components/dashboard-content';
import { auth } from '@/lib/auth';

export default async function App() {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session) redirect('/login');
    return <DashboardContent />;
}
