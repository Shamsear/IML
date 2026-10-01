import TableSkeleton from '@/components/skeletons/TableSkeleton';

export default function UsedLoading() {
  return (
    <TableSkeleton
      columns={6}
      rows={8}
      hasFilters={true}
      hasTabs={true}
      tabsCount={2}
      actionCount={2}
    />
  );
}
