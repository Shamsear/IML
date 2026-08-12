'use server';

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

async function checkAuth() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('Unauthorized');
  return session;
}

export async function getStores() {
  await checkAuth();
  return prisma.store.findMany({
    orderBy: { name: 'asc' },
  });
}

export async function createStore(formData) {
  await checkAuth();

  const name = formData.get('name');
  const region = formData.get('region');
  const location = formData.get('location');
  const isPublic = formData.get('isPublic') === 'true';

  if (!name) throw new Error('Store name is required');

  await prisma.store.create({
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

export async function updateStore(id, formData) {
  await checkAuth();

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
  await checkAuth();

  await prisma.store.delete({
    where: { id },
  });

  revalidatePath('/dashboard/stores');
  revalidatePath('/');
}
