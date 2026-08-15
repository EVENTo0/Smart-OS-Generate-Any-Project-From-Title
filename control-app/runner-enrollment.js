import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/+esm';
import { SMART_OS_SUPABASE_URL, SMART_OS_SUPABASE_PUBLISHABLE_KEY } from './supabase-config.js';

const supabase = createClient(SMART_OS_SUPABASE_URL, SMART_OS_SUPABASE_PUBLISHABLE_KEY);
const endpoint = `${SMART_OS_SUPABASE_URL}/functions/v1/smart-os-runner`;

const statusEl = document.querySelector('#runnerEnrollmentStatus');
const outputEl = document.querySelector('#runnerPairingOutput');
const listEl = document.querySelector('#runnerEnrollmentList');
const androidButton = document.querySelector('#createAndroidRunnerPairing');
const iosButton = document.querySelector('#createIosRunnerPairing');
const refreshButton = document.querySelector('#refreshRunners');

function setStatus(message, good = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = `status ${good ? 'good' : 'warn'}`;
}

function fullToolchainReady(item) {
  const tools = new Set(Array.isArray(item.tools) ? item.tools : []);
  const sourceTools = tools.has('git') && tools.has('node') && tools.has('npm');
  if (item.lane === 'android') return sourceTools && (tools.has('gradle') || tools.has('./gradlew')) && tools.has('jarsigner');
  if (item.lane === 'ios') return sourceTools && item.host_platform === 'macos' && tools.has('xcodebuild') && tools.has('security');
  return false;
}

async function session() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

async function callRunner(body) {
  const active = await session();
  if (!active) throw new Error('Sign in to SMART OS Auth first.');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SMART_OS_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${active.access_token}`,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Runner gateway returned ${response.status}`);
  return payload;
}

function renderPairing(payload) {
  if (!outputEl) return;
  const expires = new Date(payload.expiresAt).toLocaleTimeString();
  outputEl.classList.remove('hidden');
  outputEl.textContent = [
    `${payload.lane.toUpperCase()} one-time pairing · expires ${expires}`,
    `Enrollment ID: ${payload.enrollmentId}`,
    `Pairing token: ${payload.pairingToken}`,
    '',
    'On the target runner, from this repository:',
    `export SMART_OS_ENROLLMENT_ID='${payload.enrollmentId}'`,
    `export SMART_OS_PAIRING_TOKEN='${payload.pairingToken}'`,
    'bash ./scripts/signing/enroll-runner.sh',
    '',
    'The pairing token is not a signing secret and is not stored by this page.',
  ].join('\n');
  const ttl = Math.max(0, new Date(payload.expiresAt).getTime() - Date.now());
  window.setTimeout(() => {
    outputEl.textContent = 'Pairing token expired. Create a new pairing only when the runner is ready.';
  }, ttl + 1000);
}

async function createPairing(lane) {
  setStatus('CREATING');
  if (outputEl) outputEl.classList.add('hidden');
  try {
    const payload = await callRunner({
      action: 'create-enrollment',
      projectId: 'snake-game',
      lane,
      runnerId: lane === 'ios' ? 'self-hosted-macos' : 'self-hosted-linux',
      providerHandleId: lane === 'ios' ? 'secure-local-ios' : 'secure-local-android',
    });
    renderPairing(payload);
    setStatus('PAIRING READY', true);
  } catch (error) {
    setStatus('BLOCKED');
    if (outputEl) {
      outputEl.classList.remove('hidden');
      outputEl.textContent = error instanceof Error ? error.message : 'Unable to create runner pairing.';
    }
  }
}

async function refreshStatus() {
  try {
    const payload = await callRunner({ action: 'status' });
    const attestations = Array.isArray(payload.attestations) ? payload.attestations : [];
    if (!listEl) return;
    if (!attestations.length) {
      listEl.textContent = 'No self-hosted runner has completed pairing yet.';
      setStatus('AWAITING RUNNER');
      return;
    }
    listEl.innerHTML = attestations.map((item) => {
      const heartbeat = item.last_heartbeat_at ? new Date(item.last_heartbeat_at).toLocaleString() : 'none';
      const blocker = item.blocker_category ? ` · blocker ${item.blocker_category}` : '';
      const toolchain = fullToolchainReady(item) ? 'source-bound signing ready' : 'toolchain incomplete';
      return `<div class="attempt"><strong>${item.runner_id}</strong> · ${item.lane} · ${item.state}${blocker}<br><span class="muted">${item.host_platform} · ${toolchain} · heartbeat ${heartbeat}</span></div>`;
    }).join('');
    const usable = attestations.some((item) => item.state === 'available' && fullToolchainReady(item));
    setStatus(usable ? 'RUNNER AVAILABLE' : 'RUNNER REGISTERED', usable);
  } catch (error) {
    if (listEl) listEl.textContent = error instanceof Error ? error.message : 'Runner status unavailable.';
    setStatus('SIGN IN REQUIRED');
  }
}

androidButton?.addEventListener('click', () => createPairing('android'));
iosButton?.addEventListener('click', () => createPairing('ios'));
refreshButton?.addEventListener('click', refreshStatus);
supabase.auth.onAuthStateChange((_event, activeSession) => {
  if (activeSession) refreshStatus();
  else {
    setStatus('SIGN IN REQUIRED');
    if (listEl) listEl.textContent = 'Sign in above to manage self-hosted runner pairing.';
    if (outputEl) outputEl.classList.add('hidden');
  }
});
refreshStatus();
