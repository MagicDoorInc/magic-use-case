import { describe, expect, it } from 'vitest';
import plugin, { architecture } from '../src/index';

const enabled = (configs: { rules?: Record<string, unknown> }[]) =>
  configs.flatMap((config) => Object.keys(config.rules ?? {})).filter((rule) => rule.startsWith('@magicdoor/'));

describe('the configs', () => {
  it('turn every rule on in exactly one of recommended, base and architecture', () => {
    const library = new Set(enabled([plugin.configs.recommended]));
    const turnedOn = [...library, ...enabled(plugin.configs.base), ...enabled(architecture()).filter((rule) => !library.has(rule))];

    expect(turnedOn.sort()).toEqual(Object.keys(plugin.rules).map((name) => `@magicdoor/${name}`).sort());
  });

  it('scope the architecture to the folders it is given', () => {
    const [layers, ui, presenters] = architecture({ src: 'app', folders: { ui: ['screens', 'App.tsx'], presenters: 'views' } });

    expect(layers?.files).toEqual(['**/app/**/*.{ts,tsx}']);
    expect(ui?.files).toEqual(['**/app/screens/**/*.{ts,tsx}', '**/app/App.tsx']);
    expect(presenters?.files).toEqual(['**/app/views/**/*.{ts,tsx}']);
    expect(presenters?.ignores).toEqual(['**/app/views/types/**']);
  });
});
