import { NextRequest, NextResponse } from 'next/server'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { uploadCoAFromExcel } from '@/modules/accounting/actions/coa.actions'

export async function POST(request: NextRequest) {
  try {
    const orgData = await getActiveOrg()
    if (!orgData) {
      return NextResponse.json(
        { success: false, error: 'Tidak terautentikasi' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File tidak ditemukan' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.type.includes('spreadsheet') && !file.type.includes('excel')) {
      return NextResponse.json(
        { success: false, error: 'File harus berformat Excel (.xlsx)' },
        { status: 400 }
      )
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'Ukuran file tidak boleh lebih dari 5MB' },
        { status: 400 }
      )
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const result = await uploadCoAFromExcel(orgData.org.id, fileBuffer, file.name)

    if (!result.success) {
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('CoA upload error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Terjadi kesalahan saat mengupload CoA' },
      { status: 500 }
    )
  }
}
