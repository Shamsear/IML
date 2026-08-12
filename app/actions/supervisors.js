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

export async function getSupervisors() {
  await checkAuth();
  return prisma.supervisor.findMany({
    orderBy: { name: 'asc' },
  });
}

export async function createSupervisor(formData) {
  await checkAuth();

  const name = formData.get('name');
  const email = formData.get('email');
  const phone = formData.get('phone');

  if (!name) throw new Error('Supervisor name is required');

  await prisma.supervisor.create({
    data: {
      name,
      email,
      phone,
    },
  });

  revalidatePath('/dashboard/supervisors');
}

export async function updateSupervisor(id, formData) {
  await checkAuth();

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
  await checkAuth();

  await prisma.supervisor.delete({
    where: { id },
  });

  revalidatePath('/dashboard/supervisors');
}
