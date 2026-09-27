import { describe, it, expect, beforeEach } from 'vitest';
import { createScope, setScopeResolver } from '../../src/usecase/appScope';
import { UseCase } from '../../src/usecase/useCase';

class AppState {
  uploaded: string[] = [];
}

let held: Promise<void>;
let release: () => void;

beforeEach(() => {
  const scope = createScope();
  setScopeResolver(() => scope);
  held = new Promise<void>((resolve) => {
    release = resolve;
  });
});

abstract class Base<P = void> extends UseCase<AppState, P> {
  protected async initializeState() {
    return new AppState();
  }
  peek() {
    return this.getState();
  }
}

class Upload extends Base<{ files: Blob[] }> {
  protected async runLogic({ files }: { files: Blob[] }) {
    await held;
    for (const file of files) this.getState().uploaded.push(await file.text());
  }
}

class Tag extends Base<{ ids: Set<string>; labels: Map<string, string> }> {
  protected async runLogic({ ids, labels }: { ids: Set<string>; labels: Map<string, string> }) {
    await held;
    this.getState().uploaded.push(`${[...ids].join()}=${[...labels.values()].join()}`);
  }
}

describe('what makes two runs the same run', () => {
  it('runs uploads of different files separately', async () => {
    const first = new Upload().execute({ files: [new Blob(['a'])] });
    const second = new Upload().execute({ files: [new Blob(['b'])] });
    release();
    await Promise.all([first, second]);

    expect([...new Upload().peek().uploaded].sort()).toEqual(['a', 'b']);
  });

  it('still joins a second upload of the same file', async () => {
    const file = new Blob(['a']);
    const first = new Upload().execute({ files: [file] });
    const second = new Upload().execute({ files: [file] });
    release();
    await Promise.all([first, second]);

    expect(new Upload().peek().uploaded).toEqual(['a']);
  });

  it('tells sets and maps apart by what they hold', async () => {
    const first = new Tag().execute({ ids: new Set(['a']), labels: new Map([['a', 'x']]) });
    const same = new Tag().execute({ ids: new Set(['a']), labels: new Map([['a', 'x']]) });
    const otherSet = new Tag().execute({ ids: new Set(['b']), labels: new Map([['a', 'x']]) });
    const otherMap = new Tag().execute({ ids: new Set(['a']), labels: new Map([['a', 'y']]) });
    release();
    await Promise.all([first, same, otherSet, otherMap]);

    expect([...new Tag().peek().uploaded].sort()).toEqual(['a=x', 'a=y', 'b=x']);
  });
});
