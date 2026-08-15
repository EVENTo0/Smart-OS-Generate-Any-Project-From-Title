import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/+esm';
import { SMART_OS_SUPABASE_URL, SMART_OS_SUPABASE_PUBLISHABLE_KEY } from './supabase-config.js';

const supabase = createClient(SMART_OS_SUPABASE_URL, SMART_OS_SUPABASE_PUBLISHABLE_KEY);
const statusEndpoint = `${SMART_OS_SUPABASE_URL}/functions/v1/smart-os-signing-control`;
const jobsEndpoint = `${SMART_OS_SUPABASE_URL}/functions/v1/smart-os-signing-jobs`;
const statusEl = document.querySelector('#signingJobStatus');
const candidateEl = document.querySelector('#signingCandidate');
const jobsEl = document.querySelector('#signingJobsList');
const androidButton = document.querySelector('#issueAndroidSigningJob');
const iosButton = document.querySelector('#issueIosSigningJob');
const refreshButton = document.querySelector('#refreshSigningJobs');
let latestCandidates = [];

function setStatus(message, good = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = `status ${good ? 'good' : 'warn'}`;
}

async function activeSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

async function authenticatedCall(url, body = {}) {
  const session = await activeSession();
  if (!session) throw new Error('Sign in to SMART OS Auth first.');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SMART_OS_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Signing backend returned ${response.status}`);
  return payload;
}

function mobileCandidateFor(lane) {
  return latestCandidates.find((item) => Array.isArray(item.target_lanes) && item.target_lanes.includes(lane));
}

function renderCandidate() {
  if (!candidateEl) return;
  const candidate = latestCandidates.find((item) => Array.isArray(item.target_lanes) && (item.target_lanes.includes('android') || item.target_lanes.includes('ios')));
  if (!candidate) {
    candidateEl.textContent = 'No promoted mobile release candidate is available for this account.';
    return;
  }
  const lanes = candidate.target_lanes.join(' + ');
  candidateEl.innerHTML = `<strong>${candidate.project_id} · ${candidate.version}</strong><br><span class="muted">${lanes} · ${candidate.candidate_fingerprint.slice(0, 22)}…</span>`;
}

function renderJobs(jobs) {
  if (!jobsEl) return;
  if (!jobs.length) {
    jobsEl.textContent = 'No signing jobs have been issued. A job can only be issued after a matching self-hosted runner is available.';
    return;
  }
  jobsEl.innerHTML = jobs.map((job) => {
    const digest = job.artifact_sha256 ? `<br><span class="mono">${job.artifact_sha256}</span>` : '';
    const finished = job.completed_at ? ` · ${new Date(job.completed_at).toLocaleString()}` : '';
    return `<div class="attempt"><strong>${job.version} · ${job.lane}</strong> · ${job.status}<br><span class="muted">${job.runner_id}${finished}</span>${digest}</div>`;
  }).join('');
}

async function refreshSigning() {
  setStatus('CHECKING');
  try {
    const payload = await authenticatedCall(statusEndpoint, { action: 'status' });
    latestCandidates = Array.isArray(payload.candidates) ? payload.candidates : [];
    renderCandidate();
    renderJobs(Array.isArray(payload.jobs) ? payload.jobs : []);
    setStatus('READY', true);
  } catch (error) {
    latestCandidates = [];
    if (candidateEl) candidateEl.textContent = error instanceof Error ? error.message : 'Signing status unavailable.';
    if (jobsEl) jobsEl.textContent = 'Sign in above to view signing jobs.';
    setStatus('SIGN IN REQUIRED');
  }
}

async function issue(lane) {
  const candidate = mobileCandidateFor(lane);
  if (!candidate) {
    setStatus('NO RC');
    if (jobsEl) jobsEl.textContent = `No promoted ${lane} release candidate is available.`;
    return;
  }
  setStatus('ISSUING');
  try {
    const payload = await authenticatedCall(jobsEndpoint, {
      action: 'issue-job',
      releaseCandidateId: candidate.release_candidate_id,
      lane,
    });
    setStatus('JOB QUEUED', true);
    if (jobsEl) jobsEl.textContent = `${lane.toUpperCase()} signing job ${payload.jobId} queued for ${payload.runnerId}. Store and production publishing remain locked.`;
    await refreshSigning();
  } catch (error) {
    setStatus('BLOCKED');
    if (jobsEl) jobsEl.textContent = error instanceof Error ? error.message : 'Unable to issue signing job.';
  }
}

androidButton?.addEventListener('click', () => issue('android'));
iosButton?.addEventListener('click', () => issue('ios'));
refreshButton?.addEventListener('click', refreshSigning);
supabase.auth.onAuthStateChange((_event, session) => {
  if (session) refreshSigning();
  else {
    latestCandidates = [];
    setStatus('SIGN IN REQUIRED');
    if (candidateEl) candidateEl.textContent = 'Sign in above to load promoted release candidates.';
    if (jobsEl) jobsEl.textContent = 'No signing status loaded.';
  }
});
refreshSigning();
