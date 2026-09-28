import path from 'node:path';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { afterAll, describe, it } from 'vitest';

Object.assign(RuleTester, { afterAll, describe, it, itOnly: it.only });

export const tester = new RuleTester();

export const fileIn = (relative: string) => path.join(process.cwd(), relative);
