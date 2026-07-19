import { onNavigation } from '@magic-use-case/core';
import { onCleanup } from 'solid-js';

export interface NavigatorProps {
  onNavigate?: (url: string) => void;
}

export const Navigator = (props: NavigatorProps) => {
  const unsubscribe = onNavigation((url) => {
    if (url) {
      props.onNavigate?.(url);
    }
  });

  onCleanup(unsubscribe);

  return null;
};
