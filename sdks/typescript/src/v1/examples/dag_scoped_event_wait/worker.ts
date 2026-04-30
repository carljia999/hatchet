import { hatchet } from '../hatchet-client';
import { productApprovalDag } from './workflow';

async function main() {
  const worker = await hatchet.worker('dag-scoped-event-wait-worker', {
    workflows: [productApprovalDag],
  });

  await worker.start();
}

if (require.main === module) {
  main();
}
