#!/bin/bash

declare -A labels
labels["brands/[id]"]="Loading brand details"
labels["brands/[id]/edit"]="Loading brand editor"
labels["client-returns/balances"]="Loading client balances"
labels["client-returns/new"]="Preparing client return form"
labels["damage/new"]="Preparing damage report form"
labels["inbound/new"]="Preparing inbound receipt form"
labels["inbound/[dn]/edit"]="Loading receive note editor"
labels["loss/new"]="Preparing loss report form"
labels["outbound/new"]="Preparing outbound dispatch form"
labels["outbound/[dn]/edit"]="Loading delivery note editor"
labels["products/new"]="Preparing product form"
labels["rebrand/new"]="Preparing rebrand map form"
labels["staff/assign"]="Preparing staff assignment form"
labels["stores/new"]="Preparing store form"
labels["stores/[id]"]="Loading store details"
labels["stores/[id]/edit"]="Loading store editor"
labels["supervisors/new"]="Preparing supervisor form"
labels["supervisors/[id]/edit"]="Loading supervisor editor"
labels["transactions/[id]/edit"]="Loading transaction editor"

declare -A descriptions
descriptions["brands/[id]"]="Fetching brand catalog and products…"
descriptions["brands/[id]/edit"]="Loading brand data for editing…"
descriptions["client-returns/balances"]="Fetching client stock balances…"
descriptions["client-returns/new"]="Loading returnable items…"
descriptions["damage/new"]="Loading damage form data…"
descriptions["inbound/new"]="Loading receive form data…"
descriptions["inbound/[dn]/edit"]="Loading receive note details…"
descriptions["loss/new"]="Loading loss form data…"
descriptions["outbound/new"]="Loading dispatch form data…"
descriptions["outbound/[dn]/edit"]="Loading delivery note details…"
descriptions["products/new"]="Loading product form data…"
descriptions["rebrand/new"]="Loading rebrand form data…"
descriptions["staff/assign"]="Loading staff and store data…"
descriptions["stores/new"]="Loading store form data…"
descriptions["stores/[id]"]="Fetching store info and transactions…"
descriptions["stores/[id]/edit"]="Loading store data for editing…"
descriptions["supervisors/new"]="Loading supervisor form data…"
descriptions["supervisors/[id]/edit"]="Loading supervisor data for editing…"
descriptions["transactions/[id]/edit"]="Loading transaction data for editing…"

for dir in "brands/[id]" "brands/[id]/edit" "client-returns/balances" "client-returns/new" "damage/new" "inbound/new" "inbound/[dn]/edit" "loss/new" "outbound/new" "outbound/[dn]/edit" "products/new" "rebrand/new" "staff/assign" "stores/new" "stores/[id]" "stores/[id]/edit" "supervisors/new" "supervisors/[id]/edit" "transactions/[id]/edit"; do
  cat > "app/dashboard/$dir/loading.js" << EOF
'use client';

export default function Loading() {
  return (
    <div className="w-full min-h-[60vh] flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-[pulse_1.4s_ease-in-out_infinite]" />
          <span className="w-2 h-2 rounded-full bg-primary animate-[pulse_1.4s_ease-in-out_0.2s_infinite]" />
          <span className="w-2 h-2 rounded-full bg-primary animate-[pulse_1.4s_ease-in-out_0.4s_infinite]" />
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="font-display font-bold text-sm text-text-primary tracking-tight">
            ${labels[$dir]}
          </h3>
          <p className="text-xs text-text-secondary">
            ${descriptions[$dir]}
          </p>
        </div>
      </div>
    </div>
  );
}
EOF
done
echo "All loading files created"
