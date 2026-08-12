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

export async function getStaff() {
  await checkAuth();
  return prisma.staff.findMany({
    orderBy: { name: 'asc' },
    include: {
      store: { select: { id: true, name: true } },
    }
  });
}

export async function createStaff(formData) {
  await checkAuth();

  const name = formData.get('name');
  const phone = formData.get('phone');
  const shirtSize = formData.get('shirtSize');
  const storeId = formData.get('storeId') || null;

  if (!name) throw new Error('Staff name is required');

  await prisma.staff.create({
    data: {
      name,
      phone,
      shirtSize,
      storeId,
    },
  });

  revalidatePath('/dashboard/staff');
}

export async function updateStaff(id, formData) {
  await checkAuth();

  const name = formData.get('name');
  const phone = formData.get('phone');
  const shirtSize = formData.get('shirtSize');
  const storeId = formData.get('storeId') || null;

  if (!name) throw new Error('Staff name is required');

  await prisma.staff.update({
    where: { id },
    data: {
      name,
      phone,
      shirtSize,
      storeId,
    },
  });

  revalidatePath('/dashboard/staff');
}

export async function deleteStaff(id) {
  await checkAuth();

  await prisma.staff.delete({
    where: { id },
  });

  revalidatePath('/dashboard/staff');
}
