import { productApprovalDag, ProductApprovalInput } from './workflow';

async function main() {
  const input: ProductApprovalInput = {
    productId: 'prod-123',
    orderId: 'order-001',
    requestedBy: 'demo-user',
  };

  const result = await productApprovalDag.run(input);
  console.log(result);
}

if (require.main === module) {
  main()
    .catch(console.error)
    .finally(() => process.exit(0));
}
