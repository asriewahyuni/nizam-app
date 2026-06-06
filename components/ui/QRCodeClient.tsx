'use client'

import { QRCodeSVG } from 'qrcode.react'

interface Props {
  value: string
  size?: number
}

export function QRCodeClient({ value, size = 96 }: Props) {
  return (
    <QRCodeSVG
      value={value}
      size={size}
      bgColor="#ffffff"
      fgColor="#0f172a"
      level="M"
      includeMargin={false}
    />
  )
}
