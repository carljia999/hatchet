import { hatchet } from '../hatchet-client';
import { PRODUCT_APPROVAL_EVENT_KEY } from './workflow';

async function main() {
  const productId = process.argv[2] ?? 'prod-demo';
  const scope = `product:${productId}`;
  const event = await hatchet.events.push(
    PRODUCT_APPROVAL_EVENT_KEY,
    {
      productId,
      approvedBy: 'qa-user',
    },
    { scope }
  );

  console.log('Pushed event:', event.key, 'scope:', scope);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
}
