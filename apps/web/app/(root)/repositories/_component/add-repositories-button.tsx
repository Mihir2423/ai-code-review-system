'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

const GITHUB_APP_INSTALL_URL = `https://github.com/apps/${process.env.NEXT_PUBLIC_GITHUB_APP_SLUG}/installations/new`;

export function AddRepositoriesButton() {
    return (
        <Button onClick={() => window.open(GITHUB_APP_INSTALL_URL, '_blank')}>
            <Plus size={16} />
            Add Repositories
        </Button>
    );
}
