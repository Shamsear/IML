'use server';

import { prisma } from '@/lib/prisma';
import { revalidateStores } from '@/lib/revalidation';

import { requireAuth, requireAdmin } from '@/lib/auth-guard';
import { generateId, generateBatchIds } from '@/lib/idGenerator';

export async function getStores() {
  await requireAuth();
  return prisma.store.findMany({
    orderBy: { name: 'asc' },
  });
}

export async function createStore(formData) {
  await requireAuth();

  const name = formData.get('name');
  const region = formData.get('region');
  const location = formData.get('location');
  const isPublic = formData.get('isPublic') === 'true';

  if (!name) throw new Error('Store name is required');

  const id = await generateId('store', 'STOR', 3);

  await prisma.store.create({
    data: {
      id,
      name,
      region,
      location,
      isPublic,
    },
  });

  revalidateStores(id);
}

export async function updateStore(id, formData) {
  await requireAuth();

  const name = formData.get('name');
  const region = formData.get('region');
  const location = formData.get('location');
  const isPublic = formData.get('isPublic') === 'true';

  if (!name) throw new Error('Store name is required');

  await prisma.store.update({
    where: { id },
    data: {
      name,
      region,
      location,
      isPublic,
    },
  });

  revalidateStores(id);
}

export async function deleteStore(id) {
  await requireAdmin();

  await prisma.store.delete({
    where: { id },
  });

  revalidateStores(id);
}

export async function createBulkStores(formData) {
  await requireAuth();

  const count = parseInt(formData.get('count'), 10) || 0;
  if (count <= 0 || count > 500) {
    throw new Error('Store count must be between 1 and 500');
  }

  const ids = await generateBatchIds('store', 'STOR', count, 3);
  const storesList = [];
  for (let i = 0; i < count; i++) {
    const name = formData.get(`item_${i}_name`);
    const region = formData.get(`item_${i}_region`);
    const location = formData.get(`item_${i}_location`);
    const isPublic = formData.get(`item_${i}_isPublic`) === 'true';

    if (!name) throw new Error('Store name is required');
    
    const id = ids[i];
    storesList.push({ id, name, region, location, isPublic });
  }

  await prisma.store.createMany({
    data: storesList
  });

  revalidateStores();
  return { success: true, count: storesList.length };
}

