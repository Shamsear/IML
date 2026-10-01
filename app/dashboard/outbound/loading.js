import TableSkeleton from '@/components/skeletons/TableSkeleton';

export default function OutboundLoading() {
  return (
    <TableSkeleton
      columns={9}
      rows={8}
      hasFilters={true}
      hasTabs={true}
      tabsCount={2}
      actionCount={2}
    />
  );
}
