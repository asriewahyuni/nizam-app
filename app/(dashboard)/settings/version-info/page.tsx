'use client'

import { NIZAM_VERSION, getVersionInfo } from '@/lib/version'
import { FileText, Package, Calendar, Tag, CheckCircle2, Copy } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function VersionInfoPage() {
  const [copied, setCopied] = useState(false)
  const versionInfo = getVersionInfo()

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Informasi Versi NIZAM Full</h1>
        <p className="text-gray-500 mt-2">Monitoring version, changelog, dan compatibility</p>
      </div>

      {/* Version Card */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-8">
        <div className="space-y-6">
          {/* Main Version Display */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600 uppercase tracking-wide">Current Version</p>
              <div className="flex items-baseline gap-3 mt-2">
                <h2 className="text-5xl font-bold text-blue-900">{versionInfo.full}</h2>
                <span className="text-lg font-semibold text-blue-700 bg-blue-200 px-3 py-1 rounded-full">
                  {versionInfo.category}
                </span>
              </div>
              <p className="text-blue-600 mt-3 font-medium">{versionInfo.codeName}</p>
            </div>
            <div className="hidden lg:block">
              <Package className="w-24 h-24 text-blue-400 opacity-50" />
            </div>
          </div>

          {/* Quick Copy */}
          <div className="pt-4 border-t border-blue-200">
            <Button
              onClick={() => copyToClipboard(versionInfo.full)}
              variant="outline"
              className="border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              <Copy className="w-4 h-4 mr-2" />
              {copied ? 'Copied!' : 'Copy Version'}
            </Button>
          </div>
        </div>
      </div>

      {/* Version Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <VersionDetail label="Core" value={NIZAM_VERSION.core} description="Foundation generation" />
        <VersionDetail label="Module" value={NIZAM_VERSION.module} description="Module baseline iteration" />
        <VersionDetail label="Add-on" value={NIZAM_VERSION.addon} description="Add-on expansion wave" />
        <VersionDetail label="Patch" value={NIZAM_VERSION.patch} description="Patch/hotfix number" />
      </div>

      {/* Release Info */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-start gap-4">
            <Calendar className="w-5 h-5 text-gray-400 mt-1" />
            <div>
              <p className="text-sm font-medium text-gray-500">Release Date</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">{versionInfo.releaseDate}</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <Tag className="w-5 h-5 text-gray-400 mt-1" />
            <div>
              <p className="text-sm font-medium text-gray-500">Release Type</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">{versionInfo.category} Release</p>
            </div>
          </div>
        </div>
      </div>

      {/* Major Changes */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <h3 className="text-lg font-semibold text-gray-900">Major Changes in This Version</h3>
        </div>
        <ul className="space-y-3">
          {NIZAM_VERSION.changes.map((change, idx) => (
            <li key={idx} className="flex items-start gap-3 text-gray-700">
              <span className="text-green-600 font-bold mt-0.5">✓</span>
              <span>{change}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Baseline Modules */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-900">Included Modules</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {NIZAM_VERSION.modules.map((module, idx) => (
            <div
              key={idx}
              className={cn(
                'px-4 py-3 rounded-lg border',
                module.includes('(NEW)')
                  ? 'bg-green-50 border-green-200 text-green-900'
                  : 'bg-gray-50 border-gray-200 text-gray-900'
              )}
            >
              <span className="font-medium">{module}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Versioning Format Info */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-indigo-900 mb-4">Versioning Format (vC.M.A.P)</h3>
        <div className="space-y-2 text-indigo-800">
          <p className="text-sm">
            <span className="font-semibold">C (Core):</span> Foundation generation — changes in auth, org, billing foundation
          </p>
          <p className="text-sm">
            <span className="font-semibold">M (Module):</span> Module baseline iteration — new modules or major module changes
          </p>
          <p className="text-sm">
            <span className="font-semibold">A (Add-on):</span> Add-on expansion wave — new add-ons or major add-on changes
          </p>
          <p className="text-sm">
            <span className="font-semibold">P (Patch):</span> Patch/hotfix number — bug fixes and minor adjustments
          </p>
        </div>
      </div>
    </div>
  )
}

interface VersionDetailProps {
  label: string
  value: number
  description: string
}

function VersionDetail({ label, value, description }: VersionDetailProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-4xl font-bold text-gray-900 mt-2">{value}</p>
      <p className="text-xs text-gray-500 mt-2">{description}</p>
    </div>
  )
}
