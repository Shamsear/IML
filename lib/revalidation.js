import { revalidatePath } from 'next/cache';

/**
 * Revalidate all inventory, stock, and ledger-dependent paths.
 * Used whenever a transaction, stock change, or product mutation occurs.
 */
/**
 * Revalidate inventory, stock, and ledger-dependent paths.
 * Scoped by module to prevent flushing unrelated route caches on every mutation.
 */
export function revalidateInventory(options = {}) {
  const { module = null, productId, brandId, storeId, secretKey, extraPaths = [] } = options;

  // 1. Core overview & ledger pages (always updated on stock/transaction mutation)
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/transactions');
  revalidatePath('/dashboard/products');

  // 2. Module-specific path revalidations
  switch (module) {
    case 'inbound':
      revalidatePath('/dashboard/inbound');
      revalidatePath('/dashboard/expiry');
      break;
    case 'outbound':
      revalidatePath('/dashboard/outbound');
      revalidatePath('/dashboard/expiry');
      break;
    case 'returns':
      revalidatePath('/dashboard/returns');
      break;
    case 'damage':
    case 'loss':
    case 'used':
      revalidatePath('/dashboard/damage');
      revalidatePath('/dashboard/loss');
      revalidatePath('/dashboard/used');
      break;
    case 'rebrand':
      revalidatePath('/dashboard/rebrand');
      revalidatePath('/dashboard/rebrand/give-back');
      revalidatePath('/dashboard/rebrand/receive');
      revalidatePath('/dashboard/rebrand/revert');
      break;
    case 'client-returns':
      revalidatePath('/dashboard/client-returns');
      revalidatePath('/dashboard/client-returns/balances');
      break;
    default:
      // Broad fallback when module is unspecified or 'all'
      revalidatePath('/dashboard/reports');
      revalidatePath('/dashboard/expiry');
      revalidatePath('/dashboard/inbound');
      revalidatePath('/dashboard/outbound');
      break;
  }

  // 3. Specific dynamic entity paths if provided
  if (productId) revalidatePath(`/dashboard/products/${productId}`);
  if (brandId) revalidatePath(`/dashboard/brands/${brandId}`);
  if (storeId) revalidatePath(`/dashboard/stores/${storeId}`);
  if (secretKey) revalidatePath(`/portal/brand/${secretKey}`);

  // 4. Any custom extra paths passed
  if (Array.isArray(extraPaths)) {
    for (const p of extraPaths) {
      if (p) revalidatePath(p);
    }
  } else if (typeof extraPaths === 'string' && extraPaths) {
    revalidatePath(extraPaths);
  }
}

/**
 * Revalidate brand portfolio, detail, and showcase pages.
 */
export function revalidateBrands(brandId = null) {
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/brands');
  revalidatePath('/dashboard/products');
  revalidatePath('/');
  if (brandId) {
    revalidatePath(`/dashboard/brands/${brandId}`);
  }
  try {
    revalidatePath('/dashboard/brands/[id]', 'page');
    revalidatePath('/portal/brand/[secretKey]', 'page');
  } catch (e) {}
}

/**
 * Revalidate store/outlet pages and stock tables.
 */
export function revalidateStores(storeId = null) {
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/stores');
  revalidatePath('/dashboard/outbound');
  revalidatePath('/');
  if (storeId) {
    revalidatePath(`/dashboard/stores/${storeId}`);
  }
  try {
    revalidatePath('/dashboard/stores/[id]', 'page');
  } catch (e) {}
}

/**
 * Revalidate staff, promoter allocations, and store staff listings.
 */
export function revalidateStaff() {
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/staff');
  revalidatePath('/dashboard/outbound');
  try {
    revalidatePath('/dashboard/stores/[id]', 'page');
  } catch (e) {}
}

/**
 * Revalidate supervisors and outbound dropdown options.
 */
export function revalidateSupervisors() {
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/supervisors');
  revalidatePath('/dashboard/outbound');
  try {
    revalidatePath('/dashboard/brands/[id]', 'page');
  } catch (e) {}
}
