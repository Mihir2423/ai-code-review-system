// apps/web/src/app/api/github/installation/route.ts

import prisma from '@repo/db';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function GET() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ installed: false });

    const installation = await prisma.installation.findFirst({
        where: { userId: session.user.id },
    });

    return NextResponse.json({ installed: !!installation });
}
