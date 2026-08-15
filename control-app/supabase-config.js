// Public browser configuration only. The publishable key is intentionally safe
// for client use; authorization is enforced by Supabase Auth + RLS + Edge JWT verification.
export const SMART_OS_SUPABASE_URL = "https://vzfltlqmkvrlhuppeqmy.supabase.co";
export const SMART_OS_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_KvD7qy4lyK-DnyOs3DewOQ_CcEvPSzf";

globalThis.SMART_OS_SUPABASE_URL = SMART_OS_SUPABASE_URL;
globalThis.SMART_OS_SUPABASE_PUBLISHABLE_KEY = SMART_OS_SUPABASE_PUBLISHABLE_KEY;
queueMicrotask(()=>void import("./live-approval.js"));
