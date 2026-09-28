import { describe } from 'vitest';
import { noBrowserGlobals } from '../../src/rules/noBrowserGlobals';
import { fileIn, tester } from './tester';

describe('no-browser-globals', () => {
  tester.run('no-browser-globals', noBrowserGlobals, {
    valid: [
      { filename: fileIn('src/components/Header.tsx'), code: `const width = window.innerWidth;` },
      { filename: fileIn('src/use-cases/loadUseCase.ts'), code: `const window = { size: 1 }; export const size = window.size;` },
      { filename: fileIn('scripts/build.ts'), code: `localStorage.clear();` },
    ],
    invalid: [
      {
        filename: fileIn('src/use-cases/logOutUseCase.ts'),
        code: `window.location.href = '/'; history.back();`,
        errors: [{ messageId: 'browser', data: { name: 'window' } }, { messageId: 'browser', data: { name: 'history' } }],
      },
      {
        filename: fileIn('src/presenters/ThemePresenter.ts'),
        code: `export const dark = matchMedia('(prefers-color-scheme: dark)').matches;`,
        errors: [{ messageId: 'browser' }],
      },
      {
        filename: fileIn('src/components/Remember.tsx'),
        code: `localStorage.setItem('seen', 'yes');`,
        errors: [{ messageId: 'storage', data: { name: 'localStorage' } }],
      },
    ],
  });
});
