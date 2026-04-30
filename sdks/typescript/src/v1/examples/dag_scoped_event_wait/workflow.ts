import { Or, SleepCondition, UserEventCondition } from '@hatchet/v1/conditions';
import { durationToMs } from '@hatchet/v1/client/duration';
import { hatchet } from '../hatchet-client';

export const PRODUCT_APPROVAL_EVENT_KEY = 'wait_for_event:product_approved';
const WAIT_EVENT_LABEL = 'product-approval-event' as const;
const WAIT_TIMEOUT_LABEL = 'wait-timeout' as const;
const LOOKBACK_WINDOW = '5m' as const;
const WAIT_TIMEOUT = '5s' as const;

export type ProductApprovalInput = {
  productId: string;
  orderId: string;
  requestedBy: string;
};

export type ProductApprovalDagOutput = {
  'prepare-order': {
    orderId: string;
    productId: string;
    preparedBy: string;
  };
  'wait-for-product-approval': {
    productId: string;
    orderId: string;
    scope: string;
    resolvedBy: 'event' | 'timeout';
  };
  'finalize-order': {
    orderId: string;
    productId: string;
    state: 'approved' | 'timed_out';
  };
};

export const productApprovalDag = hatchet.workflow<ProductApprovalInput, ProductApprovalDagOutput>({
  name: 'product-approval-dag',
});

const prepareOrder = productApprovalDag.task({
  name: 'prepare-order',
  fn: async (input) => {
    return {
      orderId: input.orderId,
      productId: input.productId,
      preparedBy: input.requestedBy,
    };
  },
});

const waitForProductApproval = productApprovalDag.durableTask({
  name: 'wait-for-product-approval',
  parents: [prepareOrder],
  executionTimeout: '10m',
  fn: async (input, ctx) => {
    const now = await ctx.now();
    const scope = `product:${input.productId}`;
    const considerEventsSince = new Date(
      now.getTime() - durationToMs(LOOKBACK_WINDOW)
    ).toISOString();

    const waitResult = await ctx.waitFor(
      Or(
        new SleepCondition(WAIT_TIMEOUT, WAIT_TIMEOUT_LABEL),
        new UserEventCondition(
          PRODUCT_APPROVAL_EVENT_KEY,
          `has(input.productId) && input.productId == ${JSON.stringify(input.productId)}`,
          WAIT_EVENT_LABEL,
          undefined,
          scope,
          considerEventsSince
        )
      )
    );

    const create = (waitResult as Record<string, Record<string, unknown>>)['CREATE'] ?? waitResult;
    const resolvedLabel = Object.keys(create as Record<string, unknown>)[0] ?? '';

    return {
      productId: input.productId,
      orderId: input.orderId,
      scope,
      resolvedBy: resolvedLabel === WAIT_EVENT_LABEL ? ('event' as const) : ('timeout' as const),
    };
  },
});

productApprovalDag.task({
  name: 'finalize-order',
  parents: [waitForProductApproval],
  fn: async (input, ctx) => {
    const waitOutput = await ctx.parentOutput(waitForProductApproval);

    return {
      orderId: input.orderId,
      productId: input.productId,
      state: waitOutput.resolvedBy === 'event' ? ('approved' as const) : ('timed_out' as const),
    };
  },
});
