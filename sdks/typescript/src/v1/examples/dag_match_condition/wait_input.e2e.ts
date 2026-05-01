import sleep from '@hatchet/util/sleep';
import { Or, SleepCondition, UserEventCondition } from '@hatchet/v1/conditions';
import { randomUUID } from 'crypto';
import { makeE2EClient, stopWorker } from '../__e2e__/harness';

type WaitInput = {
  marker: string;
  nested: {
    orderId: string;
  };
};

type WaitOutput = {
  first: {
    ok: boolean;
  };
  'wait-step': {
    inputEcho: WaitInput;
    resolvedBy: 'event' | 'timeout';
    triggerKeys: string[];
  };
};

describe('dag-match-condition wait-step input e2e', () => {
  const hatchet = makeE2EClient();
  const suffix = randomUUID().slice(0, 8);
  const eventKey = `wait_input:event:${suffix}`;

  const workflow = hatchet.workflow<WaitInput, WaitOutput>({
    name: `wait-input-workflow-${suffix}`,
  });

  const first = workflow.task({
    name: 'first',
    fn: async () => ({ ok: true }),
  });

  workflow.task({
    name: 'wait-step',
    parents: [first],
    waitFor: [
      Or(
        new UserEventCondition(eventKey, 'true', 'event-path'),
        new SleepCondition('5s', 'timeout-path')
      ),
    ],
    fn: async (input, ctx) => {
      const triggerKeys = Object.keys(ctx.triggers());
      return {
        inputEcho: input,
        resolvedBy: triggerKeys.includes('event-path') ? ('event' as const) : ('timeout' as const),
        triggerKeys,
      };
    },
  });

  let worker: Awaited<ReturnType<typeof hatchet.worker>> | undefined;

  beforeAll(async () => {
    worker = await hatchet.worker(`wait-input-worker-${suffix}`, {
      workflows: [workflow],
      slots: 20,
    });
    void worker.start();
    await worker.waitUntilReady(30_000);
  });

  afterAll(async () => {
    await stopWorker(worker);
  });

  it('keeps wait-step input unchanged when wait resolves by timeout', async () => {
    const input: WaitInput = {
      marker: 'timeout-case',
      nested: { orderId: `ord-${randomUUID().slice(0, 8)}` },
    };

    const result = await workflow.run(input);
    const waitOutput = result['wait-step'];

    expect(waitOutput.inputEcho).toEqual(input);
    expect(waitOutput.resolvedBy).toBe('timeout');
  }, 120_000);

  it('keeps wait-step input unchanged when wait resolves by event', async () => {
    const input: WaitInput = {
      marker: 'event-case',
      nested: { orderId: `ord-${randomUUID().slice(0, 8)}` },
    };

    const ref = await workflow.runNoWait(input);

    let finished = false;
    const outputPromise = ref.output.finally(() => {
      finished = true;
    });

    const eventPusher = (async () => {
      await sleep(1200);
      for (let i = 0; i < 20 && !finished; i += 1) {
        await hatchet.events.push(eventKey, { iteration: i });
        await sleep(200);
      }
    })();

    const result = await outputPromise;
    await eventPusher.catch(() => undefined);
    const waitOutput = result['wait-step'];

    expect(waitOutput.inputEcho).toEqual(input);
    expect(waitOutput.resolvedBy).toBe('event');
    expect(waitOutput.triggerKeys).toContain('event-path');
  }, 120_000);
});
