import { redirect } from 'next/navigation';
import { getActiveOrg, getActiveBranch } from '@/modules/organization/actions/org.actions';
import { getCanvasserVans, getTodayDashboard, getVanLocations } from '@/modules/canvasser/actions/canvasser.actions';
import { getEmployees } from '@/modules/hris/actions/employee.actions';
import { getOrgBrandColor } from '@/modules/canvasser/lib/canvasser-theme.server';
import { queryPostgres } from '@/lib/db/postgres';
import { CoSalesDashboardClient } from './CoSalesDashboardClient';

export default async function CoSalesDashboardPage() {
  const orgData = await getActiveOrg();
  if (!orgData) redirect('/onboarding');

  const orgId = orgData.org.id;
  const activeBranch = await getActiveBranch(orgId);

  const [vans, todayDashboard, productsRes, employeeRows, vanLocations, brandColor] = await Promise.all([
    getCanvasserVans(orgId),
    getTodayDashboard(orgId),
    queryPostgres<{ id: string; name: string; unit: string; selling_price: string }>(
      `SELECT id, name, unit, selling_price FROM products
       WHERE org_id = $1 AND type = 'INVENTORY' AND is_active = true
       ORDER BY name ASC`,
      [orgId]
    ),
    getEmployees(orgId),
    getVanLocations(orgId),
    getOrgBrandColor(orgId),
  ]);

  const products = productsRes.rows.map(p => ({
    id: p.id,
    name: p.name,
    unit: p.unit,
    sellingPrice: Number(p.selling_price),
  }));

  const employees = employeeRows.map((e: Record<string, unknown>) => ({
    id: String(e.id || ''),
    name: [e.first_name, e.last_name].filter(Boolean).join(' ').trim() || '(Tanpa nama)',
    phone: e.phone ? String(e.phone) : null,
  }));

  return (
    <CoSalesDashboardClient
      orgId={orgId}
      branchId={activeBranch?.id || null}
      vans={vans}
      todayDashboard={todayDashboard}
      products={products}
      employees={employees}
      vanLocations={vanLocations}
      brandColor={brandColor}
    />
  );
}
