import { redirect } from 'next/navigation';
import { getActiveOrg, getActiveBranch } from '@/modules/organization/actions/org.actions';
import { saasModuleMatches } from '@/lib/saas/module-catalog';
import { PosMobileClient } from './PosMobileClient';

export default async function PosMobilePage() {
  const orgData = await getActiveOrg();
  if (!orgData) redirect('/onboarding');
  
  const hasCanvassingModule = orgData.enabledModules?.some((m: string) => 
    saasModuleMatches(m, 'mobile canvassing') || saasModuleMatches(m, 'canvassing') || saasModuleMatches(m, 'mobile pos')
  ) ?? true;
  
  if (!hasCanvassingModule && orgData.enabledModules?.length > 0) {
    redirect('/dashboard');
  }

  const activeBranch = await getActiveBranch(orgData.org.id);
  
  return (
    <PosMobileClient 
      orgId={orgData.org.id} 
      branchId={activeBranch?.id || null} 
      userEmail={orgData.user?.email || ''} 
      userName={orgData.user?.user_metadata?.full_name || orgData.user?.email || 'Sales'}
    />
  );
}
