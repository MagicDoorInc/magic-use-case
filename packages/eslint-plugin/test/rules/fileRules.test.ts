import { describe } from 'vitest';
import { noBusinessStringLiterals } from '../../src/rules/noBusinessStringLiterals';
import { noDtoNames } from '../../src/rules/noDtoNames';
import { noExportedTypes } from '../../src/rules/noExportedTypes';
import { noGatewayStubs } from '../../src/rules/noGatewayStubs';
import { noLooseAssertions } from '../../src/rules/noLooseAssertions';
import { noPollingInTests } from '../../src/rules/noPollingInTests';
import { noRawJson } from '../../src/rules/noRawJson';
import { noUiFormatting } from '../../src/rules/noUiFormatting';
import { optionalNotUndefined } from '../../src/rules/optionalNotUndefined';
import { tester } from './tester';

describe('optional-not-undefined', () => {
  tester.run('optional-not-undefined', optionalNotUndefined, {
    valid: [
      `interface Lease { endsOn?: string }`,
      `let pending: string | undefined;`,
      `type Maybe = string | undefined;`,
      `function find(id: string): Lease | undefined { return undefined; }`,
      `function clear(): Promise<undefined> { return Promise.resolve(undefined); }`,
    ],
    invalid: [
      { code: `interface Lease { endsOn: string | undefined }`, output: `interface Lease { endsOn?: string }`, errors: [{ messageId: 'optional' }] },
      { code: `class Form { error: Error | null | undefined; }`, output: `class Form { error?: Error | null; }`, errors: [{ messageId: 'optional' }] },
      { code: `function show(lease: Lease | undefined) {}`, output: null, errors: [{ messageId: 'optional' }] },
      { code: `function show(lease: Lease | undefined = current) {}`, output: null, errors: [{ messageId: 'optional' }] },
      { code: `type Handler = (value: string | undefined) => void;`, output: null, errors: [{ messageId: 'optional' }] },
    ],
  });
});

describe('no-dto-names', () => {
  tester.run('no-dto-names', noDtoNames, {
    valid: [`interface Lease { id: string }`, `const leaseDto = 1;`],
    invalid: [
      { code: `interface LeaseDto { id: string }`, errors: [{ messageId: 'dto' }] },
      { code: `type PaymentDto = { amount: number };`, errors: [{ messageId: 'dto' }] },
      { code: `class TenantDto {}`, errors: [{ messageId: 'dto' }] },
      { code: `enum LeaseStatusDto { Active }`, errors: [{ messageId: 'dto' }] },
    ],
  });
});

describe('no-business-string-literals', () => {
  tester.run('no-business-string-literals', noBusinessStringLiterals, {
    valid: [
      `if (typeof value === 'string') {}`,
      `if (status === LeaseStatus.Active) {}`,
      `const map = new Map<'a' | 'b', number>();`,
      `if (name === 'Ann Lee') {}`,
    ],
    invalid: [
      { code: `if (lease.status === 'active') {}`, errors: [{ messageId: 'literal' }] },
      { code: `switch (urgency) { case 'high': break; }`, errors: [{ messageId: 'literal' }] },
      { code: `type Mode = 'card' | 'bank';`, errors: [{ messageId: 'literal' }, { messageId: 'literal' }] },
    ],
  });
});

describe('no-ui-formatting', () => {
  tester.run('no-ui-formatting', noUiFormatting, {
    valid: [`const label = model().amountLabel;`, `const Intl = { x: 1 }; export const y = Intl.x;`],
    invalid: [
      { code: `const label = amount.toFixed(2);`, errors: [{ messageId: 'format' }] },
      { code: `const day = date.toLocaleDateString('en-US');`, errors: [{ messageId: 'format' }] },
      { code: `const f = new Intl.NumberFormat('en-US');`, errors: [{ messageId: 'format' }] },
      {
        code: `const f = new Intl.DateTimeFormat('en-US');`,
        languageOptions: { globals: { Intl: 'off' }, parserOptions: { lib: [] } },
        errors: [{ messageId: 'format' }],
      },
    ],
  });
});

describe('no-exported-types', () => {
  tester.run('no-exported-types', noExportedTypes, {
    valid: [
      { code: `interface Local { a: string }`, options: [{ interface: 'Move it.' }] },
      { code: `export type Model = { a: string };`, options: [{ interface: 'Move it.' }] },
      { code: `export const presentLease = (lease: Lease) => lease.name;`, options: [{ interface: 'Move it.' }] },
    ],
    invalid: [
      { code: `export interface LeaseModel { name: string }`, options: [{ interface: 'Move it.' }], errors: [{ messageId: 'exported', data: { message: 'Move it.' } }] },
      { code: `export enum Status { Active }`, options: [{ enum: 'Types module.' }], errors: [{ messageId: 'exported', data: { message: 'Types module.' } }] },
    ],
  });
});

describe('no-raw-json', () => {
  tester.run('no-raw-json', noRawJson, {
    valid: [
      `async function get() { const json: LeaseJson = await response.json(); return toLease(json); }`,
      `interface LeaseJson { id: string }`,
    ],
    invalid: [
      { code: `async function get() { return response.json(); }`, errors: [{ messageId: 'returned' }] },
      { code: `async function get() { return await response.json(); }`, errors: [{ messageId: 'returned' }] },
      { code: `const get = () => response.json();`, errors: [{ messageId: 'returned' }] },
      { code: `async function get() { const json = await response.json(); return json; }`, errors: [{ messageId: 'untyped' }] },
      { code: `export interface LeaseJson { id: string }`, errors: [{ messageId: 'exported' }] },
      { code: `export type PaymentJson = { amount: number };`, errors: [{ messageId: 'exported' }] },
    ],
  });
});

describe('no-gateway-stubs', () => {
  tester.run('no-gateway-stubs', noGatewayStubs, {
    valid: [
      `vi.spyOn(console, 'error');`,
      `vi.mock('~/utils/env');`,
      `afterEach(() => { vi.restoreAllMocks(); });`,
      `vi.spyOn(createClient().auth, 'getSession');`,
      `it.each(['advanceTimersByTime', 'advanceTimersToNextTimer'] as const)('retries after %s', (advance) => { vi[advance](1000); });`,
    ],
    invalid: [
      { code: `vi.spyOn(leaseGateway, 'list');`, errors: [{ messageId: 'stub' }] },
      { code: `vi.spyOn(LeaseGateway.prototype, 'list');`, errors: [{ messageId: 'stub' }] },
      { code: `vi.mock('~/gateways/leaseGateway');`, errors: [{ messageId: 'stub' }] },
    ],
  });
});

describe('no-loose-assertions', () => {
  tester.run('no-loose-assertions', noLooseAssertions, {
    valid: [
      `expect(total).toBe(3);`,
      `expect(model).toEqual({ name: 'A' });`,
      `it.each(['toBe', 'toStrictEqual'] as const)('%s the total', (matcher) => { expect(total)[matcher](3); });`,
      `it.each([String, Number])('ids are %o', (type) => { expect(lease.id).toEqual(expect[helper](type)); });`,
    ],
    invalid: [
      { code: `expect(model).toBeTruthy();`, errors: [{ messageId: 'loose' }] },
      { code: `expect(list).toContain('a');`, errors: [{ messageId: 'loose' }] },
      { code: `expect(model).toEqual(expect.objectContaining({ a: 1 }));`, errors: [{ messageId: 'loose' }] },
    ],
  });
});

describe('no-polling-in-tests', () => {
  tester.run('no-polling-in-tests', noPollingInTests, {
    valid: [
      `await vi.advanceTimersByTimeAsync(1000);`,
      `it.each(['runAllTimers', 'runOnlyPendingTimers'] as const)('%s settles the retry', (flush) => { vi[flush](); });`,
    ],
    invalid: [{ code: `await vi.waitFor(() => expect(x).toBe(1));`, errors: [{ messageId: 'poll' }] }],
  });
});
