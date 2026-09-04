import { onNavigation } from '@magicdoor/magic-use-case-core';
import { useEffect, type FC } from 'react';

interface NavigatorProps {
  onNavigate?: (url: string) => void;
}

export const Navigator: FC<NavigatorProps> = (props: NavigatorProps) => {
  useEffect(() => {
    return onNavigation((url) => {
      if (url) {
        props.onNavigate?.(url);
      }
    });
  }, [props.onNavigate]);

  return null;
};
