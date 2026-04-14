const fs = require('fs');
const file = 'modules/accounting/actions/aging.actions.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /\.select\('id, sale_number, sale_date, due_date, grand_total, shariah_mode, customer_id, contacts!customer_id\(name\)'\)/g,
  ".select('id, sale_number, sale_date, due_date, grand_total, shariah_mode, customer_id')"
);

code = code.replace(
  /\.select\('id, purchase_number, purchase_date, due_date, grand_total, status, payment_status, shariah_mode, vendor_id, contacts!vendor_id\(name\)'\)/g,
  ".select('id, purchase_number, purchase_date, due_date, grand_total, status, payment_status, shariah_mode, vendor_id')"
);

code = code.replace(
  /\.select\('id, purchase_number, purchase_date, due_date, grand_total, vendor_id, contacts!vendor_id\(name\)'\)/g,
  ".select('id, purchase_number, purchase_date, due_date, grand_total, vendor_id')"
);

code = code.replace(
  /\.select\('id, sale_number, sale_date, due_date, grand_total, shariah_mode, status, customer_id, contacts!customer_id\(name\)'\)/g,
  ".select('id, sale_number, sale_date, due_date, grand_total, shariah_mode, status, customer_id')"
);

// We also need to fetch contacts separately in getAgingReport
// Let's add a helper function `enrichWithContactNames` inside `getAgingReport`
const enrichCode = `
  const enrichWithContactNames = async (items, idField) => {
    if (!items || items.length === 0) return items;
    const contactIds = [...new Set(items.map(i => i[idField]).filter(Boolean))];
    if (contactIds.length === 0) return items;
    const { data: contacts } = await db.from('contacts').select('id, name').in('id', contactIds);
    const contactMap = {};
    if (contacts) {
      contacts.forEach(c => contactMap[c.id] = c.name);
    }
    return items.map(item => ({
      ...item,
      contacts: item[idField] ? { name: contactMap[item[idField]] } : null
    }));
  };
`;

code = code.replace("  let results: AgingReportRow[] = []", enrichCode + "\n  let results: AgingReportRow[] = []");

// Now replace where `const { data: sales } = await salesQuery` is happening:
code = code.replace(/const \{ data: sales \} = await salesQuery\n\n\s+if \(sales && sales\.length > 0\) \{/g,
  "let { data: sales } = await salesQuery\n    sales = await enrichWithContactNames(sales, 'customer_id')\n\n    if (sales && sales.length > 0) {");

code = code.replace(/const \{ data: salamPurchases \} = await salamPurchasesQuery\n\n\s+const salamPurchasesFiltered = \(salamPurchases || \[\]\)\.filter/g,
  "let { data: salamPurchases } = await salamPurchasesQuery\n    salamPurchases = await enrichWithContactNames(salamPurchases, 'vendor_id')\n\n    const salamPurchasesFiltered = (salamPurchases || []).filter");

code = code.replace(/const \{ data: purchases \} = await purchasesQuery\n\n\s+if \(purchases && purchases\.length > 0\) \{/g,
  "let { data: purchases } = await purchasesQuery\n    purchases = await enrichWithContactNames(purchases, 'vendor_id')\n\n    if (purchases && purchases.length > 0) {");

code = code.replace(/const \{ data: salamSales \} = await salamSalesQuery\n\n\s+const salamSalesFiltered = \(salamSales || \[\]\)\.filter/g,
  "let { data: salamSales } = await salamSalesQuery\n    salamSales = await enrichWithContactNames(salamSales, 'customer_id')\n\n    const salamSalesFiltered = (salamSales || []).filter");

fs.writeFileSync(file, code);
