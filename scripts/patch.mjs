import fs from 'fs';
import path from 'path';

const targetPath = path.resolve(process.cwd(), '../kliknizam-web/src/components/marketing/NizamDashboardHeroPreview.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

content = content.replace(/import \{ DashboardClient \} from '@\/app\/\(dashboard\)\/dashboard\/DashboardClient'/g, '');

content = content.replace(/<DashboardClient data=\{dashboardDemoData\} \/>/g, `
  <div className="space-y-6 w-full">
    <div className="grid grid-cols-5 gap-4">
      {dashboardDemoData.metrics.map(m => (
        <div key={m.label} className="p-5 bg-white border border-slate-200 rounded-3xl shadow-sm hover:-translate-y-1 transition-transform">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{m.label}</div>
          <div className="text-xl font-black text-slate-800 mt-2">{m.value}</div>
          <div className="text-[10px] font-bold text-slate-500 mt-2">{m.hint}</div>
        </div>
      ))}
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div className="p-6 bg-white border border-slate-200 rounded-[30px] h-[300px] flex items-center justify-center text-slate-300 font-bold shadow-md shadow-slate-200/50">
        [Grafik OCF & Laba Tersimulasi]
      </div>
      <div className="p-6 bg-white border border-slate-200 rounded-[30px] h-[300px] flex items-center justify-center text-slate-300 font-bold shadow-md shadow-slate-200/50">
        [Analisis Pareto B2B Tersimulasi]
      </div>
    </div>
  </div>
`);

fs.writeFileSync(targetPath, content, 'utf8');
console.log('NizamDashboardHeroPreview patched successfully.');
