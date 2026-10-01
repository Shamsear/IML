import CardsGridSkeleton from '@/components/skeletons/CardsGridSkeleton';

export default function SupervisorsLoading() {
  return <CardsGridSkeleton count={6} cardType="supervisor" actionCount={2} />;
}
