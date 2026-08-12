'use server';

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

import { generateId } from '@/lib/idGenerator';

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

export async function returnUniformItem(allocationId, itemType, notes = '') {
  await checkAuth();

  const allocation = await prisma.staffUniformAllocation.findUnique({
    where: { id: allocationId }
  });

  if (!allocation) throw new Error('Allocation record not found');

  const data = {};
  if (itemType === 'uniform') {
    data.uniformReturned = true;
  } else if (itemType === 'cap') {
    data.capReturned = true;
  } else {
    data.uniformReturned = true;
    data.capReturned = true;
  }

  const willBeUniformReturned = data.uniformReturned || allocation.uniformReturned;
  const willBeCapReturned = data.capReturned || allocation.capReturned;
  if (willBeUniformReturned && willBeCapReturned) {
    data.returnDate = new Date();
  }

  if (notes) {
    data.notes = allocation.notes ? `${allocation.notes} | Return Notes: ${notes}` : notes;
  }

  await prisma.staffUniformAllocation.update({
    where: { id: allocationId },
    data,
  });

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
    const isNowFullyReturned = (uniformQty === 0 || uniformReturned) && (capQty === 0 || capReturned);
    
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

  // Use a transaction to update all allocation entries
  await prisma.$transaction(
    allocationIds.map(id => 
      prisma.staffUniformAllocation.update({
        where: { id },
        data: {
          uniformReturned: true,
          capReturned: true,
          returnDate: new Date(),
          notes: notes ? `Bulk Return: ${notes}` : undefined
        }
      })
    )
  );

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
          workingPeriod,
          notes,
        }
      });

      createdAllocations.push(allocation);
    }

    return createdAllocations;
  });

  revalidatePath('/dashboard/staff');
  return allocations;
}

