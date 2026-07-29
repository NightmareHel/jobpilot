'use client';

import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import ApplicationCard from './ApplicationCard';
import StagingCard, { type StagingJob } from './StagingCard';
import { STATUS_DOT } from '@/lib/ui';

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

interface Props {
  applications: Application[];
  jobs: Record<string, Job>;
  stagingJobs: StagingJob[];
  tailoringId: string | null;
  tailoringLabel: string | null;
  onStatusChange: (id: string, status: string, notes?: string) => void;
  onRemove: (id: string) => void;
  onTailorStaged: (id: string) => void;
  onMarkStagedSubmitted: (id: string) => void;
  onUnstage: (id: string) => void;
}

// Application-status columns (post-tailoring). Staging is rendered separately
// from the jobs list, ahead of these. Pending was the old auto-apply queue and
// is gone on the manual path.
const COLUMNS = ['draft', 'submitted', 'replied', 'screen', 'interview', 'offer', 'rejected', 'withdrawn'];
const ALWAYS_SHOW = ['draft', 'submitted'];
const COL = 'flex-shrink-0 w-80 bg-sunken rounded-[14px] p-2';

export default function KanbanBoard({
  applications, jobs, stagingJobs, tailoringId, tailoringLabel,
  onStatusChange, onRemove, onTailorStaged, onMarkStagedSubmitted, onUnstage,
}: Props) {
  const byStatus: Record<string, Application[]> = {};
  for (const col of COLUMNS) byStatus[col] = [];
  for (const app of applications) {
    if (byStatus[app.status]) byStatus[app.status].push(app);
    else byStatus['draft']?.push(app);
  }

  const nonEmpty = COLUMNS.filter((c) => byStatus[c].length > 0 || ALWAYS_SHOW.includes(c));
  const spring = { type: 'spring' as const, stiffness: 400, damping: 35 };

  return (
    <LayoutGroup>
      <div className="flex gap-4 overflow-x-auto pb-4 items-start">
        {/* Staging column — jobs flagged from the Jobs board, pre-tailoring */}
        <div className={COL}>
          <div className="flex items-center gap-2 px-1.5 py-2">
            <span className={`w-2 h-2 rounded-full ${STATUS_DOT.staging}`} />
            <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone">
              staging <span className="text-faint tabular-nums">({stagingJobs.length})</span>
            </h3>
          </div>
          <div className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {stagingJobs.map((job) => (
                <motion.div
                  key={job.id}
                  layoutId={`stage-${job.id}`}
                  layout
                  transition={spring}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                >
                  <StagingCard
                    job={job}
                    onTailor={onTailorStaged}
                    onMarkSubmitted={onMarkStagedSubmitted}
                    onUnstage={onUnstage}
                    tailoring={tailoringId === job.id}
                    tailoringLabel={tailoringId === job.id ? tailoringLabel ?? undefined : undefined}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
            {stagingJobs.length === 0 && (
              <p className="text-faint text-xs px-1.5 pb-1">Stage jobs from the Jobs board to tailor them here.</p>
            )}
          </div>
        </div>

        {/* Application columns */}
        {nonEmpty.map((col) => (
          <div key={col} className={COL}>
            <div className="flex items-center gap-2 px-1.5 py-2">
              <span className={`w-2 h-2 rounded-full ${STATUS_DOT[col] ?? 'bg-stone-400'}`} />
              <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone">
                {col.replace('_', ' ')} <span className="text-faint tabular-nums">({byStatus[col].length})</span>
              </h3>
            </div>
            <div className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {byStatus[col].map((app) => (
                  <motion.div
                    key={app.id}
                    layoutId={app.id}
                    layout
                    transition={spring}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                  >
                    <ApplicationCard
                      application={app}
                      job={jobs[app.job_id] ?? null}
                      onStatusChange={onStatusChange}
                      onRemove={onRemove}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
              {byStatus[col].length === 0 && (
                <p className="text-faint text-xs px-1.5 pb-1">Empty</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </LayoutGroup>
  );
}
