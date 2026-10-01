import TableSkeleton from '@/components/skeletons/TableSkeleton';

export default function InboundLoading() {
  return (
    <TableSkeleton
      columns={8}
      rows={8}
      hasFilters={true}
      hasTabs={true}
      tabsCount={2}
      actionCount={2}
    />
  );
}
