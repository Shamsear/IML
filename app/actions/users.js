'use server';

import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';
import { hashPassword } from '@/lib/password';
import { revalidatePath } from 'next/cache';

/**
 * Fetch all users (Admin only)
 */
export async function getUsers() {
  await requireAdmin();

  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      role: true,
      clearPassword: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return users;
}

/**
 * Create a new user account (Admin only)
 */
export async function createUser(data) {
  const session = await requireAdmin();

  const username = data.username?.trim();
  const name = data.name?.trim();
  const email = data.email?.trim() || null;
  const password = data.password?.trim();
  const role = (data.role?.trim() || 'VIEWER').toUpperCase();

  if (!username || !name || !password) {
    throw new Error('Name, username, and password are required.');
  }

  if (password.length < 4) {
    throw new Error('Password must be at least 4 characters long.');
  }

  // Check uniqueness
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { username: { equals: username, mode: 'insensitive' } },
        ...(email ? [{ email: { equals: email, mode: 'insensitive' } }] : []),
      ],
    },
  });

  if (existing) {
    if (existing.username.toLowerCase() === username.toLowerCase()) {
      throw new Error(`Username "${username}" is already in use.`);
    }
    if (email && existing.email && existing.email.toLowerCase() === email.toLowerCase()) {
      throw new Error(`Email "${email}" is already in use.`);
    }
  }

  const hashedPassword = await hashPassword(password);

  const newUser = await prisma.user.create({
    data: {
      username,
      name,
      email,
      password: hashedPassword,
      clearPassword: password, // Retain clear password for admin visibility
      role,
      isActive: true,
    },
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      role: true,
      clearPassword: true,
      isActive: true,
      createdAt: true,
    },
  });

  revalidatePath('/dashboard/settings');
  return newUser;
}

/**
 * Update an existing user (Admin only)
 */
export async function updateUser(id, data) {
  const session = await requireAdmin();

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new Error('User not found.');
  }

  const updateData = {};

  if (data.name !== undefined) {
    updateData.name = data.name.trim();
  }

  if (data.username !== undefined) {
    const newUsername = data.username.trim();
    if (newUsername.toLowerCase() !== user.username.toLowerCase()) {
      const existing = await prisma.user.findFirst({
        where: {
          username: { equals: newUsername, mode: 'insensitive' },
          id: { not: id },
        },
      });
      if (existing) throw new Error(`Username "${newUsername}" is already taken.`);
      updateData.username = newUsername;
    }
  }

  if (data.email !== undefined) {
    const newEmail = data.email?.trim() || null;
    if (newEmail && newEmail.toLowerCase() !== (user.email || '').toLowerCase()) {
      const existing = await prisma.user.findFirst({
        where: {
          email: { equals: newEmail, mode: 'insensitive' },
          id: { not: id },
        },
      });
      if (existing) throw new Error(`Email "${newEmail}" is already in use.`);
    }
    updateData.email = newEmail;
  }

  if (data.role !== undefined) {
    // Prevent removing own admin role
    if (id === session.user?.id && data.role !== 'ADMIN') {
      throw new Error('Cannot change your own role away from Admin.');
    }
    updateData.role = data.role.toUpperCase();
  }

  if (data.isActive !== undefined) {
    if (id === session.user?.id && !data.isActive) {
      throw new Error('Cannot deactivate your own account.');
    }
    updateData.isActive = Boolean(data.isActive);
  }

  if (data.password && data.password.trim()) {
    const newPassword = data.password.trim();
    if (newPassword.length < 4) {
      throw new Error('Password must be at least 4 characters long.');
    }
    updateData.password = await hashPassword(newPassword);
    updateData.clearPassword = newPassword;
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      role: true,
      clearPassword: true,
      isActive: true,
      updatedAt: true,
    },
  });

  revalidatePath('/dashboard/settings');
  return updated;
}

/**
 * Delete a user account (Admin only)
 */
export async function deleteUser(id) {
  const session = await requireAdmin();

  if (id === session.user?.id) {
    throw new Error('Cannot delete your own account.');
  }

  await prisma.user.delete({ where: { id } });

  revalidatePath('/dashboard/settings');
  return { success: true };
}
