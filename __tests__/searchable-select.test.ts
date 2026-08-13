import { describe, expect, it } from 'vitest'
import { getVisibleSearchableOptions, type SearchableSelectOption } from '@/components/ui/SearchableSelect'

const customers: SearchableSelectOption[] = Array.from({ length: 8 }, (_, index) => ({
  id: `customer-${index + 1}`,
  name: index === 6 ? 'Customer Khusus' : `Customer ${index + 1}`,
  code: index === 6 ? 'khusus@example.com' : `081000000${index + 1}`,
}))

describe('SearchableSelect result limit', () => {
  it('shows only five options by default', () => {
    expect(getVisibleSearchableOptions(customers, '', 5)).toHaveLength(5)
  })

  it('searches the full option set before limiting results', () => {
    expect(getVisibleSearchableOptions(customers, 'khusus@example.com', 5)).toEqual([
      expect.objectContaining({ id: 'customer-7' }),
    ])
  })
})