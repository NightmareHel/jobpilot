'use client';

import { useRouter } from 'next/navigation';
import JobBoard from '@/components/jobs/JobBoard';
import ManualJobsSection from '@/components/jobs/ManualJobsSection';
import { useToast } from '@/lib/toast';


export default function JobsPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const handleTailor = async (jobId: string) => {
    const res = await fetch(`/api/jobs/${jobId}/tailor`, { method: 'POST' });
    if (res.ok) {
      router.push('/pipeline?tailored=true');
    } else {
      const body = await res.json().catch(() => ({}));
      addToast((body as { error?: string }).error ?? `Tailoring failed (${res.status}). Check your profile and GROQ_API_KEY.`, 'error');
    }
  };

  return (
    <main className="min-h-screen bg-zinc-900">
      <div className="p-6 flex flex-col gap-10">
        <ManualJobsSection onTailor={handleTailor} />
        <hr className="border-zinc-700" />
        <JobBoard onTailor={handleTailor} />
      </div>
    </main>
  );
}
