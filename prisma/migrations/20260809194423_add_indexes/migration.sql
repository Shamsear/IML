-- CreateIndex
CREATE INDEX "InventoryTransaction_timestamp_idx" ON "InventoryTransaction"("timestamp");

-- CreateIndex
CREATE INDEX "InventoryTransaction_transactionType_idx" ON "InventoryTransaction"("transactionType");

-- CreateIndex
CREATE INDEX "InventoryTransaction_fromEntityType_fromEntityId_idx" ON "InventoryTransaction"("fromEntityType", "fromEntityId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_toEntityType_toEntityId_idx" ON "InventoryTransaction"("toEntityType", "toEntityId");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX "ProductSerialNumber_currentLocationType_currentLocationId_idx" ON "ProductSerialNumber"("currentLocationType", "currentLocationId");

-- CreateIndex
CREATE INDEX "Staff_name_idx" ON "Staff"("name");

-- CreateIndex
CREATE INDEX "Store_name_idx" ON "Store"("name");
