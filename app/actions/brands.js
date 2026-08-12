'use server';

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import fs from 'fs';
import path from 'path';

import { uploadToImageKit } from '@/lib/imagekit';

async function saveFile(file) {
  return uploadToImageKit(file);
}

async function checkAuth() {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function getBrands() {
  await checkAuth();
  return prisma.brand.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

export async function createBrand(formData) {
  await checkAuth();

  const name = formData.get('name');
  const description = formData.get('description');
  const imageFile = formData.get('imageFile');
  let imageUrl = formData.get('imageUrl') || null;

  if (imageFile && imageFile.size > 0) {
    const savedPath = await saveFile(imageFile);
    if (savedPath) imageUrl = savedPath;
  }

  const isPublic = formData.get('isPublic') === 'true';

  if (!name) throw new Error('Brand name is required');

  await prisma.brand.create({
    data: {
      name,
      description,
      imageUrl,
      isPublic,
    },
  });

  revalidatePath('/dashboard/brands');
  revalidatePath('/'); // Revalidate public showcase page too
}

export async function updateBrand(id, formData) {
  await checkAuth();

  const name = formData.get('name');
  const description = formData.get('description');
  const imageFile = formData.get('imageFile');
  let imageUrl = formData.get('imageUrl') || null;

  if (imageFile && imageFile.size > 0) {
    const savedPath = await saveFile(imageFile);
    if (savedPath) imageUrl = savedPath;
  }

  const isPublic = formData.get('isPublic') === 'true';

  if (!name) throw new Error('Brand name is required');

  await prisma.brand.update({
    where: { id },
    data: {
      name,
      description,
      imageUrl,
      isPublic,
    },
  });

  revalidatePath('/dashboard/brands');
  revalidatePath('/');
}

export async function deleteBrand(id) {
  await checkAuth();

  // Cascade delete handles cascade to Products and Projects
  await prisma.brand.delete({
    where: { id },
  });

  revalidatePath('/dashboard/brands');
  revalidatePath('/');
}

export async function getBrandWithDetails(id) {
  await checkAuth();

  const brand = await prisma.brand.findUnique({
    where: { id },
    include: {
      stores: {
        orderBy: { name: 'asc' },
      },
      products: {
        select: {
          id: true,
          name: true,
          itemCode: true,
          category: true,
          isSerialized: true,
          _count: {
            select: { serialNumbers: true },
          },
          transactions: {
            select: {
              transactionType: true,
              quantity: true,
              fromEntityType: true,
              toEntityType: true,
            }
          }
        },
        orderBy: { name: 'asc' },
      }
    }
  });

  return brand;
}

export async function connectStoreToBrand(brandId, storeId) {
  await checkAuth();

  await prisma.brand.update({
    where: { id: brandId },
    data: {
      stores: {
        connect: { id: storeId }
      }
    }
  });

  revalidatePath(`/dashboard/brands/${brandId}`);
  revalidatePath('/dashboard/brands');
}

export async function disconnectStoreFromBrand(brandId, storeId) {
  await checkAuth();

  await prisma.brand.update({
    where: { id: brandId },
    data: {
      stores: {
        disconnect: { id: storeId }
      }
    }
  });

  revalidatePath(`/dashboard/brands/${brandId}`);
  revalidatePath('/dashboard/brands');
}

export async function createStoreAndLinkToBrand(brandId, formData) {
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
      brands: {
        connect: { id: brandId }
      }
    }
  });

  revalidatePath(`/dashboard/brands/${brandId}`);
  revalidatePath('/dashboard/brands');
  revalidatePath('/dashboard/stores');
}

export async function getBrandPortalDetails(secretKey) {
  if (!secretKey) {
    throw new Error('Brand Portal Secret Key is required');
  }

  // Fetch the brand and all associated product structures & transaction logs
  const brand = await prisma.brand.findUnique({
    where: { secretKey },
    include: {
      products: {
        select: {
          id: true,
          name: true,
          itemCode: true,
          category: true,
          isSerialized: true,
          transactions: {
            select: {
              id: true,
              transactionType: true,
              quantity: true,
              fromEntityType: true,
              toEntityType: true,
              timestamp: true,
              notes: true,
            },
            orderBy: { timestamp: 'desc' }
          }
        },
        orderBy: { name: 'asc' }
      }
    }
  });

  return brand;
}
