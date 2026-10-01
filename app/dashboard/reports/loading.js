import TableSkeleton from '@/components/skeletons/TableSkeleton';

export default function ReportsLoading() {
  return (
    <TableSkeleton
      columns={12}
      rows={10}
      hasFilters={true}
      hasTabs={false}
      actionCount={2}
    />
  );
}
