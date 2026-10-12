import { useEffect, useRef, useState } from 'react';
import type { FieldErrors } from '@/utils/formValidation';

/** Keep feedback inside its form and clear corrected fields or reopened dialogs. */
export function useFormFeedback(values: Record<string, unknown>, open: unknown) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const previous = useRef({ values, open });
  useEffect(() => {
    if (previous.current.open !== open) {
      setErrors({});
      setError('');
    } else {
      const changed = Object.keys(values).filter(
        key => values[key] !== previous.current.values[key]
      );
      if (changed.length) {
        setErrors(current => {
          const next = { ...current };
          changed.forEach(key => delete next[key]);
          return next;
        });
        setError('');
      }
    }
    previous.current = { values, open };
  }, [values, open]);
  return {
    errors,
    error,
    attempt,
    setErrors: (next: FieldErrors) => {
      setErrors(next);
      if (Object.values(next).some(Boolean)) setAttempt(value => value + 1);
    },
    setError: (message: string) => {
      setError(message);
      if (message) setAttempt(value => value + 1);
    },
  };
}
