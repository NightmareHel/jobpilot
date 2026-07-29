'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import KanbanBoard from '@/components/pipeline/KanbanBoard';
import type { StagingJob } from '@/components/pipeline/StagingCard';
import { tailorJob } from '@/lib/tailor-client';
import { useToast } from '@/lib/toast';


interface Application {
  id: string;
  job_id: string;
  status: string;
  resume_text: string | null;
  cover_letter: string | null;
  keyword_gap: string | null;
  notes: string | null;
  created_at: string;
  applied_at: string | null;
}

interface Job {
  id: string;
  title: string;
  company: string;
  source: string;
  url: string;
  sponsor_status?: string | null;
  sponsor_evidence?: string | null;
  sponsor_lca_count?: number | null;
}

export default function PipelinePage() {
  const { addToast } = useToast();
  const searchParams = useSearchParams();
  const [apps, setApps] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Record<string, Job>>({});
  const [stagedJobs, setStagedJobs] = useState<StagingJob[]>([]);
  const [tailoringId, setTailoringId] = useState<string | null>(null);
  const [tailoringLabel, setTailoringLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [appsRes, stagedRes] = await Promise.all([
        fetch('/api/applications').then((r) => r.json()),
        fetch('/api/jobs?status=staged&limit=200').then((r) => r.json()),
      ]);
      setApps(appsRes.applications ?? []);
      // Jobs come joined onto the applications payload, so every application
      // (including freshly tailored ones) resolves its job here.
      const jobMap: Record<string, Job> = {};
      for (const j of appsRes.jobs ?? []) jobMap[j.id] = j;
      setJobs(jobMap);
      setStagedJobs(stagedRes.jobs ?? []);
    } catch {
      setError('Failed to load pipeline. Refresh to retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (searchParams.get('tailored') === 'true') {
      addToast('New draft ready for review', 'success');
    }
  }, [searchParams, addToast]);

  const handleStatusChange = async (id: string, status: string, notes?: string) => {
    const body: Record<string, string> = { status };
    if (notes !== undefined) body.notes = notes;

    const res = await fetch(`/api/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const { application } = await res.json();
      setApps((prev) => prev.map((a) => a.id === id ? application : a));
    } else {
      const { error: err } = await res.json().catch(() => ({}));
      addToast((err as string) ?? 'Status update failed', 'error');
    }
  };

  const handleRemove = async (id: string) => {
    const res = await fetch(`/api/applications/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setApps((prev) => prev.filter((a) => a.id !== id));
      addToast('Draft removed', 'success');
    } else {
      const { error: err } = await res.json().catch(() => ({}));
      addToast((err as string) ?? 'Remove failed', 'error');
    }
  };

  // Tailor a staged job: reuse the streaming tailor endpoint, then reload so the
  // new draft appears and the job drops out of staging (now has an application).
  const handleTailorStaged = async (jobId: string) => {
    if (tailoringId) return;
    setTailoringId(jobId);
    setTailoringLabel(null);
    const result = await tailorJob(jobId, setTailoringLabel);
    setTailoringId(null);
    setTailoringLabel(null);
    if (result.ok) {
      addToast('Tailored — draft ready for review', 'success');
      await load();
    } else {
      addToast(result.error, 'error');
    }
  };

  const handleUnstage = async (jobId: string) => {
    const res = await fetch(`/api/jobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'new' }),
    });
    if (res.ok) {
      setStagedJobs((prev) => prev.filter((j) => j.id !== jobId));
      addToast('Removed from staging', 'success');
    } else {
      addToast('Failed to remove from staging', 'error');
    }
  };

  // A staged job leaves the Staging column once it has an application (tailored).
  const appJobIds = new Set(apps.map((a) => a.job_id));
  const stagingJobs = stagedJobs.filter((j) => !appJobIds.has(j.id));

  const isEmpty = apps.length === 0 && stagingJobs.length === 0;

  return (
    <main className="min-h-screen">
      <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-graphite">Application Pipeline</h1>
        <p className="text-stone text-sm mt-1 tabular-nums">
          {stagingJobs.length} staged · {apps.length} application{apps.length === 1 ? '' : 's'}
        </p>
      </div>
      {loading ? (
        <p className="text-stone text-sm">Loading...</p>
      ) : error ? (
        <p className="text-red-700 text-sm">{error}</p>
      ) : isEmpty ? (
        <p className="text-stone text-sm">
          Nothing here yet. Go to <a href="/jobs" className="text-bronze-strong underline">/jobs</a>, click <span className="font-medium">Stage</span> on jobs you want, then tailor them here.
        </p>
      ) : (
        <KanbanBoard
          applications={apps}
          jobs={jobs}
          stagingJobs={stagingJobs}
          tailoringId={tailoringId}
          tailoringLabel={tailoringLabel}
          onStatusChange={handleStatusChange}
          onRemove={handleRemove}
          onTailorStaged={handleTailorStaged}
          onUnstage={handleUnstage}
        />
      )}
      </div>
    </main>
  );
}
