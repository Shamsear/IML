'use server';

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import fs from 'fs';
import path from 'path';

import { uploadToImageKit } from '@/lib/imagekit';

import { generateId } from '@/lib/idGenerator';
import { generateBrandJWT, verifyBrandJWT } from '@/lib/jwt';
import crypto from 'crypto';

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
  const brands = await prisma.brand.findMany({
    orderBy: { createdAt: 'desc' },
  });

  let needsRevalidate = false;
  for (const brand of brands) {
    const payload = verifyBrandJWT(brand.secretKey);
    if (!payload || payload.brandId !== brand.id) {
      const newSecretKey = generateBrandJWT(brand.id, brand.name);
      await prisma.brand.update({
        where: { id: brand.id },
        data: { secretKey: newSecretKey },
      });
      brand.secretKey = newSecretKey;
      needsRevalidate = true;
    }
  }

  if (needsRevalidate) {
    revalidatePath('/dashboard/brands');
  }

  return brands;
}

export async function createBrand(formData) {
  await checkAuth();

  const name = formData.get('name');
  const description = formData.get('description');
  const imageFile = formData.get('imageFile');
  let imageUrl = formData.get('imageUrl') || null;
  const rack = formData.get('rack') || null;
  const shelf = formData.get('shelf') || null;

  if (imageFile && imageFile.size > 0) {
    const savedPath = await saveFile(imageFile);
    if (savedPath) imageUrl = savedPath;
  }

  const isPublic = formData.get('isPublic') === 'true';

  if (!name) throw new Error('Brand name is required');

  const id = await generateId('brand', 'BRND', 3);
  const secretKey = generateBrandJWT(id, name);

  await prisma.brand.create({
    data: {
      id,
      name,
      description,
      imageUrl,
      rack,
      shelf,
      isPublic,
      secretKey,
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
  const rack = formData.get('rack') || null;
  const shelf = formData.get('shelf') || null;

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
      rack,
      shelf,
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
          imageUrl: true,
          rack: true,
          shelf: true,
          isSerialized: true,
          stockCap: true,
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

  if (brand) {
    const payload = verifyBrandJWT(brand.secretKey);
    if (!payload || payload.brandId !== brand.id) {
      const newSecretKey = generateBrandJWT(brand.id, brand.name);
      await prisma.brand.update({
        where: { id: brand.id },
        data: { secretKey: newSecretKey },
      });
      brand.secretKey = newSecretKey;
    }
  }

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

  // Verify that the secretKey is a valid signed JWT token for the brand
  const payload = verifyBrandJWT(secretKey);
  if (!payload || !payload.brandId) {
    console.warn("Unauthorized access attempt with invalid Brand JWT secretKey.");
    return null;
  }

  // Fetch the brand and all associated product structures & transaction logs
  const brand = await prisma.brand.findUnique({
    where: { id: payload.brandId, secretKey },
    include: {
      stores: {
        select: {
          id: true,
          name: true
        }
      },
      products: {
        select: {
          id: true,
          name: true,
          itemCode: true,
          category: true,
          imageUrl: true,
          isSerialized: true,
          transactions: {
            select: {
              id: true,
              transactionType: true,
              quantity: true,
              fromEntityType: true,
              fromEntityId: true,
              toEntityType: true,
              toEntityId: true,
              timestamp: true,
              notes: true,
              returnStatus: true,
            },
            orderBy: { timestamp: 'desc' }
          }
        },
        orderBy: { name: 'asc' }
      }
    }
  });

  if (!brand) return null;

  // Let's resolve store names for transactions so the client has them pre-populated
  const storeMap = {};
  brand.stores.forEach(s => {
    storeMap[s.id] = s.name;
  });

  // Let's fetch all staff members in the system to build a staff map
  const staffList = await prisma.staff.findMany({
    select: { id: true, name: true }
  });
  const staffMap = {};
  staffList.forEach(st => {
    staffMap[st.id] = st.name;
  });

  // Map transactions to include the resolved source and destination names
  brand.products.forEach(p => {
    p.transactions.forEach(t => {
      let fromName = 'N/A';
      if (t.fromEntityType === 'WAREHOUSE') fromName = 'Warehouse';
      else if (t.fromEntityType === 'SUPPLIER') fromName = t.fromEntityId || 'Supplier';
      else if (t.fromEntityType === 'STORE' && t.fromEntityId) fromName = storeMap[t.fromEntityId] || t.fromEntityId;
      else if (t.fromEntityType === 'STAFF' && t.fromEntityId) fromName = staffMap[t.fromEntityId] || t.fromEntityId;

      let toName = 'N/A';
      if (t.toEntityType === 'WAREHOUSE') toName = 'Warehouse';
      else if (t.toEntityType === 'STORE' && t.toEntityId) toName = storeMap[t.toEntityId] || t.toEntityId;
      else if (t.toEntityType === 'STAFF' && t.toEntityId) toName = staffMap[t.toEntityId] || t.toEntityId;
      else if (t.toEntityType === 'CLIENT') toName = 'Client';

      t.fromEntityName = fromName;
      t.toEntityName = toName;
    });
  });

  return brand;
}

export async function createBulkBrands(formData) {
  await checkAuth();

  const count = parseInt(formData.get('count'), 10) || 0;
  if (count === 0) {
    throw new Error('No brands provided for creation');
  }

  // Parse details
  const brandsList = [];
  for (let i = 0; i < count; i++) {
    const name = formData.get(`item_${i}_name`);
    const description = formData.get(`item_${i}_description`);
    const imageFile = formData.get(`item_${i}_imageFile`);
    let imageUrl = formData.get(`item_${i}_imageUrl`) || null;
    const rack = formData.get(`item_${i}_rack`) || null;
    const shelf = formData.get(`item_${i}_shelf`) || null;

    if (imageFile && imageFile.size > 0) {
      const savedPath = await saveFile(imageFile);
      if (savedPath) imageUrl = savedPath;
    }

    const isPublic = formData.get(`item_${i}_isPublic`) === 'true';

    if (!name) throw new Error('Brand name is required');
    brandsList.push({ name, description, imageUrl, isPublic, rack, shelf });
  }

  // Save all in a transaction
  const results = await prisma.$transaction(async (tx) => {
    const createdBrands = [];
    for (let i = 0; i < brandsList.length; i++) {
      const b = brandsList[i];
      
      const id = await generateId('brand', 'BRND', 3);
      const secretKey = generateBrandJWT(id, b.name);

      const created = await tx.brand.create({
        data: {
          id,
          name: b.name,
          description: b.description,
          imageUrl: b.imageUrl,
          rack: b.rack,
          shelf: b.shelf,
          isPublic: b.isPublic,
          secretKey,
        }
      });
      createdBrands.push(created);
    }
    return createdBrands;
  }, { timeout: 20000 });

  revalidatePath('/dashboard/brands');
  revalidatePath('/');
  return results;
}

