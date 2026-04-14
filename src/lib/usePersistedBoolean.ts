import { useCallback, useEffect, useState } from "react";

import {
  getStoredFlagOneIsTrue,
  getStoredFlagZeroIsFalse,
  setStoredBooleanFlag,
} from "@/lib/clientStorage";

type PersistedBooleanMode = "one-is-true" | "zero-is-false";

type UsePersistedBooleanOptions = {
  defaultValue: boolean;
  mode?: PersistedBooleanMode;
};

type SetterArg = boolean | ((prev: boolean) => boolean);

function readStoredValue(key: string, defaultValue: boolean, mode: PersistedBooleanMode): boolean {
  return mode === "zero-is-false"
    ? getStoredFlagZeroIsFalse(key, defaultValue)
    : getStoredFlagOneIsTrue(key, defaultValue);
}

export function usePersistedBoolean(
  key: string,
  { defaultValue, mode = "one-is-true" }: UsePersistedBooleanOptions,
): [boolean, (value: SetterArg) => void] {
  const [value, setValue] = useState(() => readStoredValue(key, defaultValue, mode));

  useEffect(() => {
    setValue(readStoredValue(key, defaultValue, mode));
  }, [defaultValue, key, mode]);

  const setPersistedValue = useCallback(
    (nextValue: SetterArg) => {
      setValue((prev) => {
        const resolved =
          typeof nextValue === "function"
            ? (nextValue as (previous: boolean) => boolean)(prev)
            : nextValue;
        setStoredBooleanFlag(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  return [value, setPersistedValue];
}