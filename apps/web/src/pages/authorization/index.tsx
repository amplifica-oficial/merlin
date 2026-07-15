import {NextSeo} from 'next-seo';
import {useRouter} from 'next/router';
import {useEffect} from 'react';
import {IconSpinner} from '@merlin/ui';

import {AllowlistSettings} from '../../components/AllowlistSettings';
import {DashboardLayout} from '../../components/DashboardLayout';
import {useUser} from '../../lib/hooks/useUser';

export default function AuthorizationPage() {
  const router = useRouter();
  const {data: user, isLoading} = useUser();

  useEffect(() => {
    if (!isLoading && user && !user.canManageAllowlist) {
      void router.replace('/');
    }
  }, [isLoading, user, router]);

  if (isLoading || user === undefined) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <IconSpinner className="h-8 w-8" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user?.canManageAllowlist) {
    return null;
  }

  return (
    <DashboardLayout>
      <NextSeo title="Authorization" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Authorization</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Manage who can create an account on this instance. Only people with a trusted company email can access this
            page.
          </p>
        </div>
        <AllowlistSettings />
      </div>
    </DashboardLayout>
  );
}
