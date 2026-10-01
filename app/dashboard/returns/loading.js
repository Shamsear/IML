import TableSkeleton from '@/components/skeletons/TableSkeleton';

export default function ReturnsLoading() {
  return (
    <TableSkeleton
      columns={7}
      rows={8}
      hasFilters={true}
      hasTabs={true}
      tabsCount={2}
      actionCount={2}
    />
  );
}
