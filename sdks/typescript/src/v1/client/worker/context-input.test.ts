import { createAction } from '@hatchet/clients/dispatcher/action-listener';
import { ActionType } from '@hatchet/protoc/dispatcher';
import { Context } from './context';

type WaitStepPayload = {
  input: Record<string, unknown>;
  triggers: Record<string, unknown>;
  triggered_by: string;
  user_data: Record<string, unknown>;
  parents: Record<string, unknown>;
  step_run_errors: Record<string, string>;
};

function makeContext(payload: WaitStepPayload) {
  const action = createAction({
    tenantId: 'tenant-1',
    workflowRunId: 'workflow-run-1',
    getGroupKeyRunId: '',
    jobId: 'job-1',
    jobName: 'dag-match-condition',
    jobRunId: 'job-run-1',
    taskId: 'task-1',
    taskRunExternalId: 'task-run-1',
    actionId: 'action-1',
    actionType: ActionType.START_STEP_RUN,
    actionPayload: JSON.stringify(payload),
    taskName: 'wait-step',
    retryCount: 0,
    priority: 1,
  });

  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    green: jest.fn(),
  };

  const fakeClient = {
    config: {
      logger: () => logger,
      log_level: 'INFO',
    },
  };

  return new Context(action, fakeClient as any, {} as any);
}

describe('Context wait-step input content', () => {
  it('keeps workflow input unchanged when wait resolves by timeout', () => {
    const waitStepInput = { marker: 'timeout-case', orderId: 'ord-123' };
    const triggers = {
      'sleep-10s': {
        'sleep-event-id': {
          timestamp: '2026-05-01T00:00:00Z',
        },
      },
    };

    const ctx = makeContext({
      input: waitStepInput,
      triggers,
      triggered_by: 'cron',
      user_data: {},
      parents: {},
      step_run_errors: {},
    });

    expect(ctx.input).toEqual(waitStepInput);
    expect(ctx.triggers()).toEqual(triggers);
    expect(ctx.triggeredByEvent()).toBe(false);
  });

  it('keeps workflow input unchanged when wait resolves by event', () => {
    const waitStepInput = { marker: 'event-case', orderId: 'ord-456' };
    const triggers = {
      'user:event': {
        'event-id': {
          data: { approvedBy: 'qa' },
        },
      },
      filter_payload: {
        data: { approvedBy: 'qa' },
      },
    };

    const ctx = makeContext({
      input: waitStepInput,
      triggers,
      triggered_by: 'event',
      user_data: {},
      parents: {},
      step_run_errors: {},
    });

    expect(ctx.input).toEqual(waitStepInput);
    expect(ctx.triggers()).toEqual(triggers);
    expect(ctx.triggeredByEvent()).toBe(true);
  });
});
