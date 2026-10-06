'use server';

import { prisma } from '@/lib/prisma';
import { revalidateSupervisors } from '@/lib/revalidation';

import { requireAuth, requireAdmin, requireWritePermission } from '@/lib/auth-guard';
import { generateId, generateBatchIds } from '@/lib/idGenerator';

export async function getSupervisors() {
  await requireAuth();
  return prisma.supervisor.findMany({
    orderBy: { name: 'asc' },
  });
}

export async function createSupervisor(formData) {
  await requireWritePermission();

  const name = formData.get('name');
  const email = formData.get('email');
  const phone = formData.get('phone');

  if (!name) throw new Error('Supervisor name is required');

  const id = await generateId('supervisor', 'SUPR', 3);

  const supervisor = await prisma.supervisor.create({
    data: {
      id,
      name,
      email,
      phone,
    },
  });

  revalidateSupervisors();
  return supervisor;
}

export async function createBulkSupervisors(formData) {
  await requireWritePermission();

  const items = [];
  for (const [key, value] of formData.entries()) {
    const match = key.match(/^item_(\d+)_(.+)$/);
    if (match) {
      const idx = parseInt(match[1]);
      if (!items[idx]) items[idx] = {};
      items[idx][match[2]] = value;
    }
  }

  const validItems = items.filter(item => item && item.name?.trim());
  if (validItems.length === 0) {
    return [];
  }

  const ids = await generateBatchIds('supervisor', 'SUPR', validItems.length, 3);
  const data = validItems.map((item, idx) => ({
    id: ids[idx],
    name: item.name.trim(),
    email: item.email?.trim() || '',
    phone: item.phone?.trim() || '',
  }));

  await prisma.supervisor.createMany({
    data,
  });

  revalidateSupervisors();
  return data;
}

export async function updateSupervisor(id, formData) {
  await requireWritePermission();

  const name = formData.get('name');
  const email = formData.get('email');
  const phone = formData.get('phone');

  if (!name) throw new Error('Supervisor name is required');

  await prisma.supervisor.update({
    where: { id },
    data: {
      name,
      email,
      phone,
    },
  });

  revalidateSupervisors();
}

export async function deleteSupervisor(id) {
  await requireAdmin();

  await prisma.supervisor.delete({
    where: { id },
  });

  revalidateSupervisors();
}
