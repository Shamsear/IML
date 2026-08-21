'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

import { requireAuth } from '@/lib/auth-guard';
import { generateId } from '@/lib/idGenerator';

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

  revalidatePath('/dashboard/stores');
  revalidatePath('/');
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

  revalidatePath('/dashboard/stores');
  revalidatePath('/');
}

export async function deleteStore(id) {
  await requireAuth();

  await prisma.store.delete({
    where: { id },
  });

  revalidatePath('/dashboard/stores');
  revalidatePath('/');
}

export async function createBulkStores(formData) {
  await requireAuth();

  const count = parseInt(formData.get('count'), 10) || 0;
  if (count === 0) {
    throw new Error('No stores provided for creation');
  }

  const lastRecord = await prisma.store.findFirst({
    where: { id: { startsWith: 'STOR' } },
    orderBy: { id: 'desc' },
    select: { id: true }
  });

  let nextNum = 1;
  if (lastRecord) {
    const parts = lastRecord.id.split('-');
    const numPart = parts[parts.length - 1];
    const parsed = parseInt(numPart, 10);
    if (!isNaN(parsed)) {
      nextNum = parsed + 1;
    }
  }

  const storesList = [];
  for (let i = 0; i < count; i++) {
    const name = formData.get(`item_${i}_name`);
    const region = formData.get(`item_${i}_region`);
    const location = formData.get(`item_${i}_location`);
    const isPublic = formData.get(`item_${i}_isPublic`) === 'true';

    if (!name) throw new Error('Store name is required');
    
    const padded = String(nextNum).padStart(3, '0');
    const id = `STOR-${padded}`;
    nextNum++;

    storesList.push({ id, name, region, location, isPublic });
  }

  await prisma.store.createMany({
    data: storesList
  });

  revalidatePath('/dashboard/stores');
  revalidatePath('/');
  return { success: true, count: storesList.length };
}

