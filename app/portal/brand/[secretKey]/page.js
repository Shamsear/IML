import { getBrandPortalDetails } from '@/app/actions/brands';
import { AlertCircle } from 'lucide-react';
import BrandPortalClient from './BrandPortalClient';

export default async function BrandPortalPage({ params }) {
  const { secretKey } = await params;

  const brand = await getBrandPortalDetails(secretKey);

  if (!brand) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-16 h-16 rounded-full bg-danger/10 text-danger flex items-center justify-center mb-4">
          <AlertCircle size={32} />
        </div>
        <h1 className="text-xl font-display font-extrabold text-text-primary mb-2">Portal Access Denied</h1>
        <p className="text-sm text-text-secondary max-w-sm leading-relaxed">
          The link you followed is invalid or the secret key was changed. Please contact the warehouse administrator to request a new partner access link.
        </p>
      </div>
    );
  }

  return (
    <BrandPortalClient brand={brand} />
  );
}
