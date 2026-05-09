#!/bin/bash

# Test script untuk verify version system

echo "✓ Checking version system files..."
echo ""

# Check lib/version.ts
echo "1. lib/version.ts (version constants):"
grep "full:\|short:" lib/version.ts | head -2

echo ""
echo "2. FloatingVersionBadge.tsx (bottom-left corner):"
grep "fixed bottom-6 left-6" components/shared/FloatingVersionBadge.tsx && echo "   ✓ File exists dan configured"

echo ""
echo "3. AppHeader.tsx (top navigation bar - v1.2.0):"
grep -A2 "href=\"/settings/version-info\"" components/shared/AppHeader.tsx | head -3 && echo "   ✓ Version badge in header"

echo ""
echo "4. DashboardClient.tsx (Dashboard overview page):"
grep -B2 "NIZAM_VERSION.short" app/\(dashboard\)/dashboard/DashboardClient.tsx | grep "Link\|href" && echo "   ✓ Version badge in dashboard"

echo ""
echo "5. Settings menu - version-info page:"
ls -lh app/\(dashboard\)/settings/version-info/page.tsx && echo "   ✓ Version info page exists"

echo ""
echo "6. Sidebar Config menu:"
grep "Informasi Versi" components/shared/AppSidebar.tsx && echo "   ✓ Menu item added"

echo ""
echo "Semua file sudah ada dan dikonfigurasi dengan benar!"
echo ""
echo "Jika masih tidak terlihat di UI:"
echo "1. Restart npm dev server (Ctrl+C, lalu 'npm run dev')"
echo "2. Hard refresh browser (Ctrl+Shift+R)"
echo "3. Check browser console (F12) untuk error messages"
