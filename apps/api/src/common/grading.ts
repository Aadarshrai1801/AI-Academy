/**
 * Deterministic grading shared by the attempts and mastery modules
 * (mirrors `gradeAnswer` in `packages/shared`).
 */
export function gradeAnswer(type: string, correct: string, submitted: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  if (type === 'mcq') return norm(submitted) === norm(correct);
  if (!norm(submitted)) return false;
  return norm(correct).includes(norm(submitted)) || norm(submitted).includes(norm(correct));
}
