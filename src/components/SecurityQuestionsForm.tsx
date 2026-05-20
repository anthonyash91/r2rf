import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  SECURITY_QUESTION_KEYS,
  pickRandomQuestionKeys,
  questionLabel,
} from "@/lib/security-questions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type SecurityAnswerInput = { key: string; value: string };

type Props = {
  /** Called whenever the user's selections change. Returns up to 2 valid answers. */
  onChange: (answers: SecurityAnswerInput[]) => void;
  /** Show 2 or 3 rows. Defaults to 3 (pick any 2). */
  rows?: 2 | 3;
};

/**
 * Renders question-selectors + answer inputs. Each row uses a question
 * dropdown (so users can swap if a random pick doesn't apply) plus a
 * free-text answer. Reports the first up-to-2 fully-filled distinct rows.
 */
export function SecurityQuestionsForm({ onChange, rows = 3 }: Props) {
  const { t } = useI18n();
  const initialKeys = useMemo(() => pickRandomQuestionKeys(rows), [rows]);
  const [questionKeys, setQuestionKeys] = useState<string[]>(initialKeys);
  const [answers, setAnswers] = useState<string[]>(Array(rows).fill(""));

  function emitChange(nextKeys: string[], nextAnswers: string[]) {
    const seen = new Set<string>();
    const out: SecurityAnswerInput[] = [];
    for (let i = 0; i < nextKeys.length; i++) {
      const k = nextKeys[i];
      const v = (nextAnswers[i] ?? "").trim();
      if (!k || v.length < 2) continue;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ key: k, value: v });
      if (out.length === 2) break;
    }
    onChange(out);
  }

  function setKey(i: number, key: string) {
    const next = [...questionKeys];
    next[i] = key;
    setQuestionKeys(next);
    emitChange(next, answers);
  }
  function setAnswer(i: number, val: string) {
    const next = [...answers];
    next[i] = val;
    setAnswers(next);
    emitChange(questionKeys, next);
  }

  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => {
        const usedElsewhere = new Set(questionKeys.filter((_, j) => j !== i));
        return (
          <div key={i} className="space-y-1.5">
            <Select value={questionKeys[i]} onValueChange={(v) => setKey(i, v)}>
              <SelectTrigger className="w-full text-xs">
                <SelectValue placeholder={t("security.chooseQuestion")} />
              </SelectTrigger>
              <SelectContent>
                {SECURITY_QUESTION_KEYS.map((k) => (
                  <SelectItem key={k} value={k} disabled={usedElsewhere.has(k)}>
                    {questionLabel(t, k)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              type="text"
              value={answers[i]}
              onChange={(e) => setAnswer(i, e.target.value)}
              placeholder={t("security.yourAnswer")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              maxLength={200}
            />
          </div>
        );
      })}
    </div>
  );
}
