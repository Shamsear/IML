import CardsGridSkeleton from '@/components/skeletons/CardsGridSkeleton';

export default function BrandsLoading() {
  return <CardsGridSkeleton count={6} cardType="brand" actionCount={2} />;
}
