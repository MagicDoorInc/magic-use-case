import { afterAll, describe, it } from 'vitest';
import { RuleTester } from '@typescript-eslint/rule-tester';
import * as parser from '@typescript-eslint/parser';
import { noCatchOnExecute } from '../src/rules/noCatchOnExecute';
import { noDeepReadonly } from '../src/rules/noDeepReadonly';
import { noUseCaseOutsideUseCase } from '../src/rules/noUseCaseOutsideUseCase';
import { purePresentations } from '../src/rules/purePresentations';

Object.assign(RuleTester, { afterAll, describe, it, itOnly: it.only });

const tester = new RuleTester({
  languageOptions: { parser, parserOptions: { ecmaFeatures: { jsx: true } } },
});

describe('no-use-case-outside-use-case', () => {
  tester.run('no-use-case-outside-use-case', noUseCaseOutsideUseCase, {
    valid: [
      `class PayRentUseCase extends BaseUseCase<PaymentRequest> {
        protected async runLogic(request: PaymentRequest) {
          await new PayUseCase().execute(request);
        }
      }`,
      `class Refresh extends MagicUseCase {
        protected async runLogic() {
          const load = () => new GetChatsUseCase().execute();
          await load();
        }
      }`,
      `const date = new Date();`,
    ],
    invalid: [
      {
        code: `const Pay = () => { void new PayUseCase().execute(request); };`,
        errors: [{ messageId: 'construct', data: { name: 'PayUseCase' } }],
      },
      {
        code: `export const state = { boot: new InitializeAppUseCase() };`,
        errors: [{ messageId: 'construct' }],
      },
      {
        code: `class Helper { run() { return new PayUseCase(); } }`,
        errors: [{ messageId: 'construct' }],
      },
    ],
  });
});

describe('pure-presentations', () => {
  tester.run('pure-presentations', purePresentations, {
    valid: [
      `export const presentLeases = (state: MainAppState) => ({ names: state.leases.map((lease) => lease.name) });`,
      `export function presentChat(state: MainAppState) { return { title: state.chat.title }; }`,
      `const Screen = () => { const { execute } = useUseCase(PayUseCase); return execute; };`,
      `export default function () { const { execute } = useUseCase(PayUseCase); return <button onClick={() => execute()} />; }`,
      `export const presentLease = (lease: Lease) => ({ startsOn: new Date(lease.startsOn) });`,
    ],
    invalid: [
      {
        code: `export const presentLeases = (state: MainAppState) => { void new GetLeasesUseCase().execute(); return state.leases; };`,
        errors: [{ messageId: 'run', data: { name: 'execute' } }, { messageId: 'run', data: { name: 'new GetLeasesUseCase()' } }],
      },
      {
        code: `export function presentChat(state: MainAppState) { const { execute } = useUseCase(OpenChatUseCase); return { open: execute }; }`,
        errors: [{ messageId: 'run', data: { name: 'useUseCase' } }],
      },
      {
        code: `export const chatList: Presentation<MainAppState, ChatList> = (state) => { createUseCase(RefreshUseCase); return state.chats; };`,
        errors: [{ messageId: 'run', data: { name: 'createUseCase' } }],
      },
    ],
  });
});

describe('no-catch-on-execute', () => {
  tester.run('no-catch-on-execute', noCatchOnExecute, {
    valid: [
      `const Button = () => {
        const { execute: getSetup } = useUseCase(StartSetupUseCase);
        const click = async () => { if (await getSetup({ mode })) setVisible(true); };
      };`,
      `const Page = () => {
        const { execute: load } = useUseCase(LoadUseCase);
        const run = async () => { try { await load(); } finally { setBusy(false); } };
      };`,
      `const parse = () => { try { return JSON.parse(text); } catch { return undefined; } };`,
      `const Upload = () => {
        const { execute: save, isLoading } = useUseCase(SaveUploadUseCase);
        upload.catch(() => setFailed(true));
        return isLoading ? null : save;
      };`,
      `const Pinata = () => {
        const { execute: mint } = useUseCase(MintTokenUseCase);
        const open = async () => {
          try {
            if (!(await mint(id))) return;
            await loadWidgetScript();
          } catch {
            toast.error('unavailable');
          }
        };
      };`,
    ],
    invalid: [
      {
        code: `const AddCardButton = () => {
          const { execute: getSetup } = useUseCase(StartPaymentMethodSetupUseCase);
          const handleClick = async () => {
            try {
              await getSetup({ mode: 'card' });
              setModalVisible(true);
            } catch {
              toast.error('failed');
            }
          };
        };`,
        errors: [{ messageId: 'catch', data: { name: 'getSetup' } }],
      },
      {
        code: `const Modal = () => {
          const { execute: getSetup } = useUseCase(StartPaymentMethodSetupUseCase);
          getSetup({ mode }).catch(() => close());
        };`,
        errors: [{ messageId: 'catch', data: { name: 'getSetup' } }],
      },
      {
        code: `const Form = () => {
          const submit = useUseCase(SubmitUseCase);
          const send = async () => { try { await submit.execute(values); } catch (error) { show(error); } };
        };`,
        errors: [{ messageId: 'catch', data: { name: 'submit.execute' } }],
      },
    ],
  });
});

describe('no-deep-readonly', () => {
  tester.run('no-deep-readonly', noDeepReadonly, {
    valid: [
      `import type { Presentation } from '@magicdoor/magic-use-case-solid';`,
      `const Lease = (props: { lease: PresentableLease }) => props.lease.name;`,
    ],
    invalid: [
      {
        code: `import type { DeepReadonly } from '@magicdoor/magic-use-case-solid';
        const Lease = (props: { lease: DeepReadonly<PresentableLease> }) => props.lease.name;`,
        errors: [{ messageId: 'deepReadonly' }, { messageId: 'deepReadonly' }],
      },
      {
        code: `type DeepReadonly<T> = { readonly [K in keyof T]: DeepReadonly<T[K]> };`,
        errors: [{ messageId: 'deepReadonly' }, { messageId: 'deepReadonly' }],
      },
    ],
  });
});
