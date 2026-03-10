'use client';

import { useState } from 'react';
import { DashboardContent } from '@/components/dashboard/DashboardContent';

export default function App() {
    const [rowsPerPage, setRowsPerPage] = useState(10);

    return <DashboardContent rowsPerPage={rowsPerPage} setRowsPerPage={setRowsPerPage} />;
}
