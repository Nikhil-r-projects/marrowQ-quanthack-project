import { PatientProgress } from '../types';

/** Actual engraftment day from the completed milestone, else the projected day. */
export function engraftmentDay(progress: PatientProgress, kind: 'anc' | 'plt'): number {
  const re = kind === 'anc' ? /neutrophil|anc/i : /platelet|plt/i;
  const done = progress.milestones.find(m => re.test(`${m.id} ${m.name}`) && m.status === 'COMPLETED');
  return done?.actual_day ?? (kind === 'anc' ? progress.expected_anc_engraft_day : progress.expected_plt_engraft_day);
}

/** Two letters from the words that start with a letter or digit ("Example · UCI-017" → "EU"). */
export const initials = (name: string) =>
  name.split(/\s+/).filter(w => /^[\p{L}\p{N}]/u.test(w)).map(w => w[0]).slice(0, 2).join('').toUpperCase();

const AVATAR_TONES = ['', 'violet', 'green', 'amber'];

/** Stable avatar colour per id, so a patient keeps the same colour everywhere. */
export const avatarTone = (id: string) =>
  AVATAR_TONES[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length];
