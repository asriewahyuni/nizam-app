import { redirect } from 'next/navigation';
import { getActiveOrg, getActiveBranch } from '@/modules/organization/actions/org.actions';
import { CoSalesDashboardClient } from './CoSalesDashboardClient';

export default async function CoSalesDashboardPage() {
  const orgData = await getActiveOrg();
  if (!orgData) redirect('/onboarding');
  
  const activeBranch = await getActiveBranch(orgData.org.id);
  
  return (
    <CoSalesDashboardClient 
      orgId={orgData.org.id} 
      branchId={activeBranch?.id || null} 
    />
  );
}
