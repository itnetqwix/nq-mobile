import type { TFunction } from "i18next";
import { getSystemStatePreset } from "../features/system-states/presets/systemStateRegistry";
import type { SystemStateId, SystemStatePreset } from "../features/system-states/presets/types";

export function getLocalizedSystemStatePreset(
  stateId: SystemStateId,
  t: TFunction
): SystemStatePreset {
  const base = getSystemStatePreset(stateId);
  const ns = `systemStates.${stateId}`;
  return {
    ...base,
    title: t(`${ns}.title`, { defaultValue: base.title }),
    description: base.description
      ? t(`${ns}.description`, { defaultValue: base.description })
      : undefined,
    primary: base.primary
      ? {
          ...base.primary,
          label: t(`${ns}.primary`, { defaultValue: base.primary.label }),
        }
      : undefined,
    secondary: base.secondary
      ? {
          ...base.secondary,
          label: t(`${ns}.secondary`, { defaultValue: base.secondary.label }),
        }
      : undefined,
  };
}
