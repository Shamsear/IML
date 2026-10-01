import TableSkeleton from '@/components/skeletons/TableSkeleton';

export default function RebrandLoading() {
  return (
    <TableSkeleton
      columns={8}
      rows={8}
      hasFilters={false}
      hasTabs={false}
      actionCount={2}
    />
  );
}
