'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

import { requireAuth } from '@/lib/auth-guard';
import { generateId } from '@/lib/idGenerator';

export async function getSupervisors() {
  await requireAuth();
  return prisma.supervisor.findMany({
    orderBy: { name: 'asc' },
  });
}

export async function createSupervisor(formData) {
  await requireAuth();

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

  revalidatePath('/dashboard/supervisors');
  return supervisor;
}

export async function createBulkSupervisors(formData) {
  await requireAuth();

  const items = [];
  for (const [key, value] of formData.entries()) {
    const match = key.match(/^item_(\d+)_(.+)$/);
    if (match) {
      const idx = parseInt(match[1]);
      if (!items[idx]) items[idx] = {};
      items[idx][match[2]] = value;
    }
  }

  const created = [];
  for (const item of items) {
    if (!item || !item.name?.trim()) continue;
    const id = await generateId('supervisor', 'SUPR', 3);
    const supervisor = await prisma.supervisor.create({
      data: {
        id,
        name: item.name.trim(),
        email: item.email?.trim() || '',
        phone: item.phone?.trim() || '',
      },
    });
    created.push(supervisor);
  }

  revalidatePath('/dashboard/supervisors');
  return created;
}

export async function updateSupervisor(id, formData) {
  await requireAuth();

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

  revalidatePath('/dashboard/supervisors');
}

export async function deleteSupervisor(id) {
  await requireAuth();

  await prisma.supervisor.delete({
    where: { id },
  });

  revalidatePath('/dashboard/supervisors');
}
