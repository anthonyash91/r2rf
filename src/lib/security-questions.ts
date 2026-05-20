// Client-safe shared constants + helpers for security questions.

export const SECURITY_QUESTION_KEYS = [
  "first_pet",
  "birth_city",
  "mothers_maiden",
  "first_car",
  "elementary_school",
  "favorite_food",
  "childhood_nickname",
  "street_grew_up",
  "favorite_color",
  "favorite_movie",
] as const;

export type SecurityQuestionKey = (typeof SECURITY_QUESTION_KEYS)[number];

export function isSecurityQuestionKey(v: string): v is SecurityQuestionKey {
  return (SECURITY_QUESTION_KEYS as readonly string[]).includes(v);
}

/** Pick `n` distinct random keys from the bank. */
export function pickRandomQuestionKeys(n: number): SecurityQuestionKey[] {
  const pool = [...SECURITY_QUESTION_KEYS];
  const out: SecurityQuestionKey[] = [];
  for (let i = 0; i < n && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

/** Normalize an answer for hashing/comparison. */
export function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase();
}

/** Translate a question key via the existing i18n `t` function. */
export function questionLabel(t: (k: string) => string, key: string): string {
  return t(`security.q.${key}`);
}
