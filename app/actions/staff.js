'use server';

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

import { generateId } from '@/lib/idGenerator';
import { generateCustomRef } from '@/app/actions/transactions';

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
      allocations: {
        orderBy: { givenDate: 'desc' },
        include: {
          store: { select: { id: true, name: true } },
          supervisor: { select: { id: true, name: true } },
        }
      }
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

  const id = await generateId('staff', 'STAF', 3);

  await prisma.staff.create({
    data: {
      id,
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

export async function allocateUniform(formData) {
  await checkAuth();

  const staffId = formData.get('staffId');
  const storeId = formData.get('storeId');
  const uniformQty = parseInt(formData.get('uniformQty') || '0', 10);
  const capQty = parseInt(formData.get('capQty') || '0', 10);
  const workingPeriod = formData.get('workingPeriod') || '';
  const supervisorId = formData.get('supervisorId') || null;
  const notes = formData.get('notes') || '';

  if (!staffId || !storeId) {
    throw new Error('Staff and Store are required for allocation');
  }

  const id = await generateId('staffUniformAllocation', 'ALOC', 5);

  await prisma.staffUniformAllocation.create({
    data: {
      id,
      staffId,
      storeId,
      uniformQty,
      capQty,
      workingPeriod,
      supervisorId,
      notes,
    }
  });

  revalidatePath('/dashboard/staff');
}

export async function deleteAllocation(allocationId) {
  await checkAuth();

  await prisma.staffUniformAllocation.delete({
    where: { id: allocationId }
  });

  revalidatePath('/dashboard/staff');
}

export async function returnUniformItem(allocationId, payload, notes = '') {
  await checkAuth();

  await prisma.$transaction(async (tx) => {
    const allocation = await tx.staffUniformAllocation.findUnique({
      where: { id: allocationId }
    });

    if (!allocation) throw new Error('Allocation record not found');

    // Payload format: { legacyUniform: boolean, legacyCap: boolean, itemIds: string[] }
    // Backwards compatibility with old 'both', 'uniform', 'cap' strings
    let isLegacyUniform = false;
    let isLegacyCap = false;
    let itemIdsToReturn = [];

    if (typeof payload === 'string') {
      isLegacyUniform = payload === 'uniform' || payload === 'both';
      isLegacyCap = payload === 'cap' || payload === 'both';
    } else if (payload) {
      isLegacyUniform = !!payload.legacyUniform;
      isLegacyCap = !!payload.legacyCap;
      itemIdsToReturn = payload.itemIds || [];
    }

    const data = {};
    if (isLegacyUniform) data.uniformReturned = true;
    if (isLegacyCap) data.capReturned = true;

    // Handle dynamic items
    let currentItems = [];
    if (allocation.allocatedItems) {
      if (typeof allocation.allocatedItems === 'string') {
        try { currentItems = JSON.parse(allocation.allocatedItems); } catch(e){}
      } else if (Array.isArray(allocation.allocatedItems)) {
        currentItems = allocation.allocatedItems;
      }
    }

    if (itemIdsToReturn.length > 0) {
      const newlyReturnedItems = currentItems.filter(item => 
        itemIdsToReturn.includes(item.id) && !item.returned
      );

      for (const retItem of newlyReturnedItems) {
        if (retItem.productId) {
          const prod = await tx.product.findUnique({
            where: { id: retItem.productId },
            include: { brand: { select: { name: true } } }
          });
          if (prod) {
            const brandName = prod.brand?.name || 'General';
            const ref = await generateCustomRef(tx, 'RET', brandName);
            await tx.inventoryTransaction.create({
              data: {
                productId: retItem.productId,
                transactionType: 'RETURN',
                fromEntityType: 'STORE',
                fromEntityId: allocation.storeId,
                toEntityType: 'WAREHOUSE',
                toEntityId: null,
                quantity: parseInt(retItem.qty, 10) || 1,
                notes: `Returned Uniform via promoter tracking return flow. Allocation: ${allocation.id}. Promoter: ${allocation.staffId}. ${notes || ''}`,
                deliveryStatus: 'Delivered',
                deliveryNote: ref
              }
            });
          }
        }
      }

      const updatedItems = currentItems.map(item => {
        if (itemIdsToReturn.includes(item.id)) {
          return { ...item, returned: true, returnedAt: new Date().toISOString() };
        }
        return item;
      });
      data.allocatedItems = updatedItems;
    }

    // Calculate if fully returned
    const willBeUniformReturned = data.uniformReturned ?? allocation.uniformReturned;
    const willBeCapReturned = data.capReturned ?? allocation.capReturned;
    
    let allItemsReturned = true;
    if (data.allocatedItems) {
      allItemsReturned = data.allocatedItems.every(i => i.returned);
    } else if (allocation.allocatedItems) {
      let currentItems = typeof allocation.allocatedItems === 'string' ? JSON.parse(allocation.allocatedItems) : allocation.allocatedItems;
      allItemsReturned = Array.isArray(currentItems) ? currentItems.every(i => i.returned) : true;
    }

    const legacyDone = (allocation.uniformQty === 0 || willBeUniformReturned) && (allocation.capQty === 0 || willBeCapReturned);

    if (legacyDone && allItemsReturned) {
      data.returnDate = new Date();
    }

    if (notes) {
      data.notes = allocation.notes ? `${allocation.notes} | Return Notes: ${notes}` : notes;
    }

    await tx.staffUniformAllocation.update({
      where: { id: allocationId },
      data,
    });
  }, { timeout: 20000 });

  revalidatePath('/dashboard/staff');
}

export async function getAllocationDetails(allocationId) {
  await checkAuth();
  return prisma.staffUniformAllocation.findUnique({
    where: { id: allocationId },
    include: {
      staff: true,
      store: true,
    }
  });
}

export async function saveCombinedAllocation(formData, allocationId = null) {
  await checkAuth();

  const isNewPromoter = formData.get('isNewPromoter') === 'true';
  const promoterName = formData.get('promoterName');
  const promoterPhone = formData.get('promoterPhone') || '';
  const promoterShirtSize = formData.get('promoterShirtSize') || 'Medium';
  const existingStaffId = formData.get('existingStaffId');

  const storeId = formData.get('storeId');
  const uniformQty = parseInt(formData.get('uniformQty') || '0', 10);
  const capQty = parseInt(formData.get('capQty') || '0', 10);
  const workingPeriod = formData.get('workingPeriod') || '';
  const notes = formData.get('notes') || '';
  
  const uniformReturned = formData.get('uniformReturned') === 'true';
  const capReturned = formData.get('capReturned') === 'true';

  const allocatedItemsStr = formData.get('allocatedItems');
  const allocatedItems = allocatedItemsStr ? JSON.parse(allocatedItemsStr) : [];

  if (!storeId) {
    throw new Error('Store placement is required');
  }

  let finalStaffId = existingStaffId;

  if (allocationId) {
    const allocation = await prisma.staffUniformAllocation.findUnique({
      where: { id: allocationId },
      include: { staff: true }
    });
    if (!allocation) throw new Error('Allocation record not found');

    finalStaffId = allocation.staffId;

    await prisma.staff.update({
      where: { id: finalStaffId },
      data: {
        name: promoterName || allocation.staff.name,
        phone: promoterPhone,
        shirtSize: promoterShirtSize,
        storeId,
      }
    });

    const wasFullyReturned = allocation.uniformReturned && allocation.capReturned;
    const isNowFullyReturned = (uniformQty === 0 || uniformReturned) && (capQty === 0 || capReturned) && allocatedItems.every(i => i.returned);
    
    await prisma.staffUniformAllocation.update({
      where: { id: allocationId },
      data: {
        storeId,
        uniformQty,
        capQty,
        uniformReturned,
        capReturned,
        workingPeriod,
        notes,
        allocatedItems,
        returnDate: isNowFullyReturned && !wasFullyReturned ? new Date() : (isNowFullyReturned ? allocation.returnDate : null),
      }
    });
  } else {
    if (isNewPromoter) {
      if (!promoterName) throw new Error('Promoter name is required for registration');
      const staffIdVal = await generateId('staff', 'STAF', 3);
      const newStaff = await prisma.staff.create({
        data: {
          id: staffIdVal,
          name: promoterName,
          phone: promoterPhone,
          shirtSize: promoterShirtSize,
          storeId,
        }
      });
      finalStaffId = newStaff.id;
    } else {
      if (!existingStaffId) throw new Error('Please select an existing promoter or register a new one');
      
      await prisma.staff.update({
        where: { id: existingStaffId },
        data: { storeId }
      });
    }

    const id = await generateId('staffUniformAllocation', 'ALOC', 5);

    await prisma.staffUniformAllocation.create({
      data: {
        id,
        staffId: finalStaffId,
        storeId,
        uniformQty,
        capQty,
        uniformReturned,
        capReturned,
        workingPeriod,
        notes,
        allocatedItems,
      }
    });
  }

  revalidatePath('/dashboard/staff');
}

export async function bulkReturnUniformItems(allocationIds, notes = '') {
  await checkAuth();

  if (!allocationIds || !Array.isArray(allocationIds) || allocationIds.length === 0) {
    throw new Error('No allocations selected for return');
  }

  // Find existing to mark dynamic items as returned too
  const allocations = await prisma.staffUniformAllocation.findMany({
    where: { id: { in: allocationIds } }
  });

  await prisma.$transaction(async (tx) => {
    for (const alloc of allocations) {
      let currentItems = [];
      if (alloc.allocatedItems) {
        currentItems = typeof alloc.allocatedItems === 'string' ? JSON.parse(alloc.allocatedItems) : alloc.allocatedItems;
      }
      let updatedItems = [];
      if (Array.isArray(currentItems)) {
        const unreturned = currentItems.filter(item => !item.returned);
        for (const retItem of unreturned) {
          if (retItem.productId) {
            const prod = await tx.product.findUnique({
              where: { id: retItem.productId },
              include: { brand: { select: { name: true } } }
            });
            if (prod) {
              const brandName = prod.brand?.name || 'General';
              const ref = await generateCustomRef(tx, 'RET', brandName);
              await tx.inventoryTransaction.create({
                data: {
                  productId: retItem.productId,
                  transactionType: 'RETURN',
                  fromEntityType: 'STORE',
                  fromEntityId: alloc.storeId,
                  toEntityType: 'WAREHOUSE',
                  toEntityId: null,
                  quantity: parseInt(retItem.qty, 10) || 1,
                  notes: `Bulk Returned Uniform via promoter tracking return flow. Allocation: ${alloc.id}. Promoter: ${alloc.staffId}. ${notes || ''}`,
                  deliveryStatus: 'Delivered',
                  deliveryNote: ref
                }
              });
            }
          }
        }
        updatedItems = currentItems.map(item => ({ ...item, returned: true, returnedAt: item.returnedAt || new Date().toISOString() }));
      }

      await tx.staffUniformAllocation.update({
        where: { id: alloc.id },
        data: {
          uniformReturned: true,
          capReturned: true,
          allocatedItems: updatedItems,
          returnDate: new Date(),
          notes: notes ? (alloc.notes ? `${alloc.notes} | Bulk Return: ${notes}` : `Bulk Return: ${notes}`) : undefined
        }
      });
    }
  }, { timeout: 30000 });

  revalidatePath('/dashboard/staff');
}

export async function saveBulkCombinedAllocations(payload) {
  await checkAuth();

  const { items = [] } = payload;
  if (items.length === 0) throw new Error('At least one promoter assignment is required');

  const allocations = await prisma.$transaction(async (tx) => {
    const createdAllocations = [];

    for (const item of items) {
      const {
        isNewPromoter,
        promoterName,
        promoterPhone = '',
        promoterShirtSize = 'Medium',
        existingStaffId,
        storeId,
        uniformQty = 0,
        capQty = 0,
        allocatedItems = [],
        workingPeriod = '',
        notes = ''
      } = item;

      if (!storeId) {
        throw new Error('Store placement is required for all allocations');
      }

      let finalStaffId = existingStaffId;

      if (isNewPromoter) {
        if (!promoterName) throw new Error('Promoter name is required for registration');
        const staffIdVal = await generateId('staff', 'STAF', 3);
        const newStaff = await tx.staff.create({
          data: {
            id: staffIdVal,
            name: promoterName,
            phone: promoterPhone,
            shirtSize: promoterShirtSize,
            storeId,
          }
        });
        finalStaffId = newStaff.id;
      } else {
        if (!existingStaffId) throw new Error('Please select an existing promoter or register a new one');
        
        await tx.staff.update({
          where: { id: existingStaffId },
          data: { storeId }
        });
      }

      const id = await generateId('staffUniformAllocation', 'ALOC', 5);

      const allocation = await tx.staffUniformAllocation.create({
        data: {
          id,
          staffId: finalStaffId,
          storeId,
          uniformQty,
          capQty,
          uniformReturned: false,
          capReturned: false,
          allocatedItems,
          workingPeriod,
          notes,
        }
      });

      createdAllocations.push(allocation);
    }

    return createdAllocations;
  }, { timeout: 20000 });

  revalidatePath('/dashboard/staff');
  return allocations;
}

