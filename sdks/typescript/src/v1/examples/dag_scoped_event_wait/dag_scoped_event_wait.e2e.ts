import { randomUUID } from 'crypto';
import { makeE2EClient } from '../__e2e__/harness';
import {
  PRODUCT_APPROVAL_EVENT_KEY,
  ProductApprovalInput,
  productApprovalDag,
} from './workflow';

describe('dag-scoped-event-wait-e2e', () => {
  const hatchet = makeE2EClient();

  it('continues via event when scope and product match', async () => {
    const productId = `prod-${randomUUID().slice(0, 8)}`;
    const input: ProductApprovalInput = {
      productId,
      orderId: `ord-${randomUUID().slice(0, 8)}`,
      requestedBy: 'alice@example.com',
    };

    const ref = await productApprovalDag.runNoWait(input);

    await hatchet.events.push(
      PRODUCT_APPROVAL_EVENT_KEY,
      { productId, orderId: input.orderId, approvedBy: 'qa-bot' },
      { scope: `product:${productId}` }
    );

    const result = await ref.output;

    expect(result['prepare-order'].productId).toBe(productId);
    expect(result['wait-for-product-approval'].resolvedBy).toBe('event');
    expect(result['wait-for-product-approval'].scope).toBe(`product:${productId}`);
    expect(result['finalize-order'].state).toBe('approved');
  }, 120_000);

  it('times out when event has matching product but different order', async () => {
    const productId = `prod-${randomUUID().slice(0, 8)}`;
    const input: ProductApprovalInput = {
      productId,
      orderId: `ord-${randomUUID().slice(0, 8)}`,
      requestedBy: 'eve@example.com',
    };

    const ref = await productApprovalDag.runNoWait(input);

    await hatchet.events.push(
      PRODUCT_APPROVAL_EVENT_KEY,
      {
        productId,
        orderId: `ord-${randomUUID().slice(0, 8)}`,
        approvedBy: 'qa-bot',
      },
      { scope: `product:${productId}` }
    );

    const result = await ref.output;

    expect(result['prepare-order'].productId).toBe(productId);
    expect(result['wait-for-product-approval'].resolvedBy).toBe('timeout');
    expect(result['wait-for-product-approval'].scope).toBe(`product:${productId}`);
    expect(result['finalize-order'].state).toBe('timed_out');
  }, 120_000);

  it('times out when no matching scoped event arrives', async () => {
    const productId = `prod-${randomUUID().slice(0, 8)}`;
    const input: ProductApprovalInput = {
      productId,
      orderId: `ord-${randomUUID().slice(0, 8)}`,
      requestedBy: 'bob@example.com',
    };

    const result = await productApprovalDag.run(input);

    expect(result['prepare-order'].productId).toBe(productId);
    expect(result['wait-for-product-approval'].resolvedBy).toBe('timeout');
    expect(result['wait-for-product-approval'].scope).toBe(`product:${productId}`);
    expect(result['finalize-order'].state).toBe('timed_out');
  }, 120_000);
});
