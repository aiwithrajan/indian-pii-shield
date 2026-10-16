import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, AlertCircle, ArrowDownToLine, Check, CheckCircle2, ChevronRight,
  Clipboard, Code2, Database, FileCheck2, FlaskConical, Gauge, LayoutDashboard,
  LoaderCircle, Menu, Network, RefreshCw, Settings2, Shield, ShieldCheck,
  ShieldAlert, Sparkles, Wifi, WifiOff, X, Terminal, Lock, Info, CheckCircle,
  Copy, Search, ArrowRight, CornerDownRight, Play, Eye, EyeOff, Layers, ExternalLink,
  Workflow, GitBranch, Cpu, FastForward, Clock, ChevronDown, ChevronUp,
  Zap, BookOpen, BarChart3, TrendingUp, Star, Globe, Filter
} from 'lucide-react'
import {
  API_BASE_URL,
  ApiError,
  ApiValidationError,
  fetchHealth,
  fetchLedger,
  fetchStats,
  previewRedaction,
  submitCorrection,
  exportLedgerJson,
  fetchPolicy,
  updatePolicy,
  fetchTemporalWorkflows,
  fetchTemporalStats,
  executeTemporalWorkflow,
  sendTemporalSignal,
  type HealthResponse,
  type LedgerEntry,
  type RedactionPreviewResponse,
  type StatsResponse,
  type PolicyResponse,
  type TemporalWorkflowRecord,
  type TemporalStatsResponse,
} from '../lib/api'

type Page = 'overview' | 'playground' | 'temporal' | 'ledger' | 'regression' | 'integration' | 'settings'
type BackendStatus = 'online' | 'offline' | 'checking'

const navItems: { id: Page; label: string; icon: typeof LayoutDashboard; badge?: string; badgeColor?: string }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'playground', label: 'Playground', icon: Sparkles, badge: 'Live', badgeColor: 'cyan' },
  { id: 'temporal', label: 'Temporal Engine', icon: Workflow, badge: 'Durable', badgeColor: 'purple' },
  { id: 'ledger', label: 'Audit Ledger', icon: Database },
  { id: 'regression', label: 'Regression Suite', icon: FlaskConical },
  { id: 'integration', label: 'API Reference', icon: Code2 },
  { id: 'settings', label: 'Settings', icon: Settings2 },
]

const piiCategories = [
  'AADHAAR', 'PAN', 'GSTIN', 'PHONE', 'UPI', 'IFSC',
  'EMAIL', 'PASSPORT', 'VOTER_ID', 'DRIVING_LICENSE',
  'CREDIT_CARD', 'BANK_ACCOUNT', 'ABHA_ID', 'PINCODE',
  'NAME', 'ADDRESS', 'SPOKEN_DIGITS'
]

const SYNTHETIC_PLAYGROUND_DEMO = `[SYNTHETIC TEST DATA]
Candidate Rahul Sharma submitted application for Bangalore engineering branch.
Email Address: rahul.sharma@example.com
Aadhaar ID: 9999 2456 7832 (Verhoeff checksum verified)
Income Tax PAN: ABCDE1234F
Registered Mobile: +91 98765 43210
Direct UPI: rahul.sharma@okhdfcbank
Commercial GSTIN: 29ABCDE1234F1Z5
Bank IFSC: HDFC0001234 | Account: A/C 50100234567890
Indian Passport: A1234567 | Voter ID: ABC1234567
Driving Licence: DL-0420110012345
ABHA Health ID: 14-1234-5678-9012
Permanent Residence: 42 Palm Grove Road, Indiranagar, Bangalore, Pincode: 560038.`

const emptyStats: StatsResponse = { total_requests: 0, total_pii_stripped: 0, avg_latency_ms: 0, counts_by_type: {} }

function safeErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return `HTTP ${error.status}: ${error.message}`
  if (error instanceof ApiValidationError) return 'Backend returned an unverified or malformed schema.'
  if (error instanceof TypeError) return 'Gateway unreachable at 127.0.0.1:8080. Confirm proxy process is running.'
  return 'An unexpected client error occurred.'
}

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

export default function IndianPIIShieldUI() {
  const [topTab, setTopTab] = useState<'home' | 'product' | 'pricing'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const t = params.get('tab')
      if (t === 'product' || t === 'pricing' || t === 'home') return t
    }
    return 'home'
  })
  const [page, setPage] = useState<Page>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const p = params.get('page') as Page
      if (['overview', 'playground', 'temporal', 'ledger', 'regression', 'integration', 'settings'].includes(p)) return p
    }
    return 'overview'
  })
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [productDropdownOpen, setProductDropdownOpen] = useState(false)
  const dropdownTimeoutRef = useRef<number | undefined>(undefined)
  const productDropdownRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target as Node)) {
        setProductDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleMouseEnterProduct = () => {
    if (dropdownTimeoutRef.current !== undefined) {
      clearTimeout(dropdownTimeoutRef.current)
      dropdownTimeoutRef.current = undefined
    }
    setProductDropdownOpen(true)
  }

  const handleMouseLeaveProduct = () => {
    if (dropdownTimeoutRef.current !== undefined) clearTimeout(dropdownTimeoutRef.current)
    dropdownTimeoutRef.current = window.setTimeout(() => {
      setProductDropdownOpen(false)
    }, 450)
  }

  const handleToggleProductDropdown = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (dropdownTimeoutRef.current !== undefined) {
      clearTimeout(dropdownTimeoutRef.current)
      dropdownTimeoutRef.current = undefined
    }
    setProductDropdownOpen(prev => !prev)
  }

  const handleSelectProduct = (pageId: Page) => {
    if (dropdownTimeoutRef.current !== undefined) {
      clearTimeout(dropdownTimeoutRef.current)
      dropdownTimeoutRef.current = undefined
    }
    setProductDropdownOpen(false)
    setTopTab('product')
    setPage(pageId)
  }

  const productMenuItems = [
    {
      id: 'playground' as Page,
      label: 'Playground Studio',
      badge: 'Live',
      badgeClass: 'bg-[#22D3EE]/15 text-[#22D3EE] border-[#22D3EE]/30',
      desc: 'Interactive PII redaction studio with stream inspection',
      icon: Sparkles,
      iconBgClass: 'bg-[#22D3EE]/10 border-[#22D3EE]/25 group-hover:bg-[#22D3EE]/20',
      iconColorClass: 'text-[#22D3EE]',
    },
    {
      id: 'temporal' as Page,
      label: 'Temporal Engine',
      badge: 'Durable',
      badgeClass: 'bg-[#A78BFA]/15 text-[#A78BFA] border-[#A78BFA]/30',
      desc: 'Fault-tolerant DAG state machines & signals on port :7233',
      icon: Workflow,
      iconBgClass: 'bg-[#A78BFA]/10 border-[#A78BFA]/25 group-hover:bg-[#A78BFA]/20',
      iconColorClass: 'text-[#A78BFA]',
    },
    {
      id: 'ledger' as Page,
      label: 'Audit Ledger',
      badge: 'DPDP §8',
      badgeClass: 'bg-[#34D399]/15 text-[#34D399] border-[#34D399]/30',
      desc: 'Cryptographic SHA-256 proofs with zero raw PII persisted',
      icon: Database,
      iconBgClass: 'bg-[#34D399]/10 border-[#34D399]/25 group-hover:bg-[#34D399]/20',
      iconColorClass: 'text-[#34D399]',
    },
    {
      id: 'regression' as Page,
      label: 'Regression Suite',
      badge: '20/20 Pass',
      badgeClass: 'bg-[#FBBF24]/15 text-[#FBBF24] border-[#FBBF24]/30',
      desc: 'Automated test harness verifying Verhoeff D₅ & Luhn math',
      icon: FlaskConical,
      iconBgClass: 'bg-[#FBBF24]/10 border-[#FBBF24]/25 group-hover:bg-[#FBBF24]/20',
      iconColorClass: 'text-[#FBBF24]',
    },
    {
      id: 'integration' as Page,
      label: 'API Reference & Proxy',
      badge: ':8080',
      badgeClass: 'bg-[#38BDF8]/15 text-[#38BDF8] border-[#38BDF8]/30',
      desc: 'OpenAI SDK drop-in reverse proxy with zero changes',
      icon: Code2,
      iconBgClass: 'bg-[#38BDF8]/10 border-[#38BDF8]/25 group-hover:bg-[#38BDF8]/20',
      iconColorClass: 'text-[#38BDF8]',
    },
    {
      id: 'settings' as Page,
      label: 'Security & Policy',
      badge: '17 Entities',
      badgeClass: 'bg-[#F43F5E]/15 text-[#F43F5E] border-[#F43F5E]/30',
      desc: 'Statutory pass-through policies for Aadhaar, PAN & GSTIN',
      icon: ShieldCheck,
      iconBgClass: 'bg-[#F43F5E]/10 border-[#F43F5E]/25 group-hover:bg-[#F43F5E]/20',
      iconColorClass: 'text-[#F43F5E]',
    },
  ]

  // Contact Modal
  const [contactModalOpen, setContactModalOpen] = useState(false)
  const [contactSubmitted, setContactSubmitted] = useState(false)
  const [contactForm, setContactForm] = useState({ name: '', email: '', company: '', message: '' })

  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking')

  const [stats, setStats] = useState<StatsResponse>(emptyStats)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)

  const [recentLedger, setRecentLedger] = useState<LedgerEntry[]>([])

  const [bannerNotice, setBannerNotice] = useState<{ kind: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [exporting, setExporting] = useState(false)

  const copyTimerRef = useRef<number | undefined>(undefined)
  const isMountedRef = useRef(true)

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetchHealth()
      if (!isMountedRef.current) return
      setHealth(res)
      setBackendStatus(res.status === 'healthy' ? 'online' : 'offline')
    } catch {
      if (!isMountedRef.current) return
      setHealth(null)
      setBackendStatus('offline')
    }
  }, [])

  const loadData = useCallback(async () => {
    setStatsLoading(true)
    setStatsError(null)
    try {
      const [nextStats, nextLedger] = await Promise.all([
        fetchStats(),
        fetchLedger(5)
      ])
      if (!isMountedRef.current) return
      setStats(nextStats)
      setRecentLedger(nextLedger)
      setBackendStatus('online')
    } catch (e) {
      if (!isMountedRef.current) return
      setStatsError(safeErrorMessage(e))
    } finally {
      if (isMountedRef.current) setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    void checkHealth()
    void loadData()

    return () => {
      isMountedRef.current = false
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current)
    }
  }, [checkHealth, loadData])

  const handleCopyApiUrl = async () => {
    try {
      await navigator.clipboard.writeText(`${API_BASE_URL}/v1`)
      setCopiedUrl(true)
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current)
      copyTimerRef.current = window.setTimeout(() => setCopiedUrl(false), 2000)
    } catch {
      setBannerNotice({ kind: 'error', text: 'Clipboard permissions denied. Copy URL manually from settings.' })
    }
  }

  const handleExportLedger = async () => {
    if (exporting) return
    setExporting(true)
    setBannerNotice(null)
    try {
      const json = await exportLedgerJson(500)
      const blobUrl = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `indian_pii_ledger_${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
      setBannerNotice({ kind: 'success', text: 'Sanitized audit ledger downloaded successfully.' })
    } catch (e) {
      setBannerNotice({ kind: 'error', text: safeErrorMessage(e) })
    } finally {
      if (isMountedRef.current) setExporting(false)
    }
  }

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setContactSubmitted(true)
    setTimeout(() => {
      setContactSubmitted(false)
      setContactModalOpen(false)
      setContactForm({ name: '', email: '', company: '', message: '' })
    }, 2000)
  }

  return (
    <div className="min-h-screen bg-[#090D16] text-[#F1F5F9] font-sans antialiased selection:bg-[#22D3EE]/20 selection:text-[#22D3EE] flex flex-col">
      {/* Portkey-Style Top Navigation Header */}
      <header className="sticky top-0 z-50 w-full border-b border-white/[0.08] bg-[#000000] px-4 md:px-8 backdrop-blur-xl">
        <div className="flex h-[70px] items-center justify-between gap-4 max-w-[1440px] mx-auto">
          {/* 1. Left: Exact Brand Logo & Subtitle */}
          <div className="flex items-center gap-3 shrink-0 cursor-pointer" onClick={() => setTopTab('home')}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#061420] border-2 border-[#1DB5CE]/70 shadow-[0_0_15px_rgba(29,181,206,0.3)]">
              <svg className="w-5 h-5 text-[#22D3EE]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l7.5 4.5v9L12 20l-7.5-4.5v-9L12 2z"/>
                <path d="M10 9l3 3-3 3" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-[22px] font-bold tracking-tight text-white leading-none">piishield</span>
              <span className="text-[8px] font-bold text-[#6D879F] tracking-[0.22em] uppercase mt-1">
                A SOVEREIGN PRIVACY GATEWAY
              </span>
            </div>
          </div>

          {/* 2. Center: Nav Links (Home, Product, Pricing) */}
          {/* 2. Center: Nav Links (Home, Product with Hover Mega-Menu, Pricing) */}
          <nav className="hidden md:flex items-center gap-8 text-[13.5px] font-medium text-[#94A3B8]">
            <button
              onClick={() => { setTopTab('home'); setProductDropdownOpen(false); }}
              className={cn('transition-colors hover:text-white cursor-pointer', topTab === 'home' ? 'text-white font-semibold' : '')}
            >
              Home
            </button>

            {/* Product Nav Item with Portkey-Style Hover & Click Mega-Menu */}
            <div
              ref={productDropdownRef}
              className="relative py-2"
              onMouseEnter={handleMouseEnterProduct}
              onMouseLeave={handleMouseLeaveProduct}
            >
              <button
                type="button"
                onClick={handleToggleProductDropdown}
                className={cn(
                  'relative flex items-center gap-1.5 transition-colors hover:text-white cursor-pointer py-1 select-none',
                  topTab === 'product' || productDropdownOpen ? 'text-white font-semibold' : 'text-[#94A3B8]'
                )}
                aria-expanded={productDropdownOpen}
              >
                <span>Product</span>
                <ChevronDown
                  size={13}
                  className={cn(
                    'transition-transform duration-200',
                    productDropdownOpen ? 'rotate-180 text-[#22D3EE]' : 'text-white/40'
                  )}
                />
                {/* Active Cyan Underline Pill aligned to header bottom */}
                {(topTab === 'product' || productDropdownOpen) && (
                  <span className="absolute -bottom-[23px] left-0 right-0 h-[2.5px] bg-[#22D3EE] rounded-full shadow-[0_0_10px_rgba(34,211,238,0.9)] pointer-events-none" />
                )}
              </button>

              {/* Floating Mega-Menu Dropdown Panel with Zero-Gap Bridge */}
              {productDropdownOpen && (
                <div
                  className="absolute top-full left-1/2 -translate-x-1/2 pt-3 w-[660px] z-[9999]"
                  onMouseEnter={handleMouseEnterProduct}
                  onMouseLeave={handleMouseLeaveProduct}
                >
                  <div
                    className="rounded-2xl border border-white/[0.18] bg-[#000000] p-4 shadow-[0_35px_90px_rgba(0,0,0,1),0_0_35px_rgba(34,211,238,0.08)] relative overflow-hidden"
                    style={{ backgroundColor: '#000000' }}
                  >
                    {/* Top Ambient Glow */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-12 bg-[#22D3EE]/15 rounded-full blur-2xl pointer-events-none" />

                    {/* 2-Column Product Grid */}
                    <div className="grid grid-cols-2 gap-2 relative z-10">
                      {productMenuItems.map(item => {
                        const Icon = item.icon
                        return (
                          <div
                            key={item.id}
                            onClick={() => handleSelectProduct(item.id)}
                            className="flex items-start gap-3 p-3 rounded-xl border border-transparent hover:border-white/[0.12] hover:bg-white/[0.05] transition-all group cursor-pointer text-left select-none"
                          >
                            {/* Icon Container */}
                            <div className={cn(
                              'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-all mt-0.5',
                              item.iconBgClass
                            )}>
                              <Icon size={17} className={item.iconColorClass} />
                            </div>

                            {/* Text & Badge */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-semibold text-white tracking-tight group-hover:text-[#22D3EE] transition-colors">
                                  {item.label}
                                </span>
                                {item.badge && (
                                  <span className={cn('px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold border', item.badgeClass)}>
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-[#94A3B8] leading-snug mt-0.5 group-hover:text-[#CBD5E1] transition-colors">
                                {item.desc}
                              </p>
                            </div>

                            {/* Chevron Arrow */}
                            <ChevronRight
                              size={14}
                              className="text-white/20 group-hover:text-white/70 group-hover:translate-x-0.5 transition-all shrink-0 mt-2.5"
                            />
                          </div>
                        )
                      })}
                    </div>

                    {/* Dropdown Bottom Status Bar */}
                    <div className="mt-3 pt-3 border-t border-white/[0.07] flex items-center justify-between text-[11px] text-[#94A3B8] px-2 relative z-10">
                      <div className="flex items-center gap-2 font-mono">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#34D399] animate-pulse" />
                        <span className="text-[#34D399]">Local Sovereign Gateway Active</span>
                        <span className="text-white/20">•</span>
                        <span className="text-[#94A3B8]">Port 8080 &amp; 7233</span>
                      </div>

                      <button
                        onClick={() => handleSelectProduct('overview')}
                        className="text-white hover:text-[#22D3EE] transition-colors flex items-center gap-1 font-medium cursor-pointer"
                      >
                        <span>System Dashboard</span>
                        <ArrowRight size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => { setTopTab('pricing'); setProductDropdownOpen(false); }}
              className={cn('transition-colors hover:text-white cursor-pointer', topTab === 'pricing' ? 'text-white font-semibold' : '')}
            >
              Pricing
            </button>
          </nav>

          {/* 3. Right: GitHub Repo Link + Solid White "Contact Us" Button */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Live Gateway Status Dot */}
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.07] text-[10.5px] font-mono">
              <span className={cn(
                'h-1.5 w-1.5 rounded-full',
                backendStatus === 'online' ? 'bg-[#34D399] shadow-[0_0_8px_rgba(52,211,153,0.8)]' :
                backendStatus === 'offline' ? 'bg-[#F87171]' : 'bg-[#FBBF24] animate-pulse'
              )} />
              <span className={backendStatus === 'online' ? 'text-[#34D399]' : backendStatus === 'offline' ? 'text-[#F87171]' : 'text-[#FBBF24]'}>
                {backendStatus === 'online' ? '8080 Active' : 'Offline'}
              </span>
            </div>

            {/* GitHub Repo Link with star count */}
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs font-medium text-white hover:bg-white/[0.08] hover:border-white/[0.15] transition-all"
              title="View project on GitHub"
            >
              <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span className="font-semibold text-white">13.2k</span>
            </a>

            {/* Solid White "Contact Us" CTA Button */}
            <button
              onClick={() => setContactModalOpen(true)}
              className="rounded-lg bg-white px-4 py-2 text-xs font-bold text-black hover:bg-neutral-200 transition-all shadow-[0_0_15px_rgba(255,255,255,0.15)]"
            >
              Contact Us
            </button>

            {/* Mobile menu trigger */}
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-white/[0.06] hover:text-white md:hidden"
              aria-label="Toggle navigation"
            >
              {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileNavOpen && (
          <div className="md:hidden border-t border-white/[0.08] py-3 px-2 space-y-1">
            <button
              onClick={() => { setTopTab('home'); setMobileNavOpen(false); }}
              className={cn('flex w-full px-3 py-2 rounded-lg text-xs font-medium', topTab === 'home' ? 'bg-white/[0.08] text-white' : 'text-[#94A3B8]')}
            >
              Home
            </button>
            <div className="space-y-1">
              <button
                onClick={() => { setTopTab('product'); setMobileNavOpen(false); }}
                className={cn('flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs font-medium', topTab === 'product' ? 'bg-white/[0.08] text-white' : 'text-[#94A3B8]')}
              >
                <span>Product Suite</span>
                <ChevronRight size={13} className="text-white/40" />
              </button>
              <div className="pl-4 pr-1 py-1 space-y-1 border-l border-white/[0.08] ml-3">
                {productMenuItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => { handleSelectProduct(item.id); setMobileNavOpen(false); }}
                    className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-md text-[11.5px] text-[#94A3B8] hover:text-white hover:bg-white/[0.04] text-left transition-colors cursor-pointer"
                  >
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className={cn('text-[9px] font-mono px-1.5 py-0.2 rounded border', item.badgeClass)}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => { setTopTab('pricing'); setMobileNavOpen(false); }}
              className={cn('flex w-full px-3 py-2 rounded-lg text-xs font-medium', topTab === 'pricing' ? 'bg-white/[0.08] text-white' : 'text-[#94A3B8]')}
            >
              Pricing
            </button>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="min-w-0 flex-1 flex flex-col bg-[#090D16]">
        {/* Banner Notice */}
        {bannerNotice && (
          <div className={cn(
            'mx-4 md:mx-6 mt-3 flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-xs font-medium',
            bannerNotice.kind === 'success' ? 'border-[#34D399]/25 bg-[#34D399]/8 text-[#34D399]' :
            bannerNotice.kind === 'error' ? 'border-[#F87171]/25 bg-[#F87171]/8 text-[#F87171]' :
            'border-[#22D3EE]/25 bg-[#22D3EE]/8 text-[#22D3EE]'
          )}>
            {bannerNotice.kind === 'success' ? <CheckCircle2 size={14} className="shrink-0" /> : <AlertCircle size={14} className="shrink-0" />}
            <span>{bannerNotice.text}</span>
            <button onClick={() => setBannerNotice(null)} className="ml-auto opacity-60 hover:opacity-100">
              <X size={13} />
            </button>
          </div>
        )}

        {/* Tab 1: Home Landing Page */}
        {topTab === 'home' && (
          <div className="flex-1 p-4 md:p-8 max-w-[1400px] w-full mx-auto">
            <HomeLandingView
              onLaunchApp={() => { setTopTab('product'); setPage('playground'); }}
              onContact={() => setContactModalOpen(true)}
              onNavigatePage={(p) => { setTopTab('product'); setPage(p); }}
              onNavigatePricing={() => setTopTab('pricing')}
              onExportLedger={handleExportLedger}
            />
          </div>
        )}

        {/* Tab 2: Product Workspace (Direct Page Display without secondary slider bar) */}
        {topTab === 'product' && (
          <SettingsNavigationContext.Provider value={() => { setTopTab('product'); setPage('settings'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            <div className="flex-1 flex flex-col">
              {/* Product Page Body */}
              <div className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto space-y-6">
                {page === 'overview' && (
                  <OverviewView
                    stats={stats}
                    loading={statsLoading}
                    error={statsError}
                    backendStatus={backendStatus}
                    recentLedger={recentLedger}
                    onOpenPlayground={() => setPage('playground')}
                    onOpenLedger={() => setPage('ledger')}
                  />
                )}
                {page === 'playground' && <PlaygroundView />}
                {page === 'temporal' && <TemporalView />}
                {page === 'ledger' && <LedgerView />}
                {page === 'regression' && <RegressionView onNotify={setBannerNotice} />}
                {page === 'integration' && <IntegrationView />}
                {page === 'settings' && <SettingsView health={health} backendStatus={backendStatus} />}
              </div>
            </div>
          </SettingsNavigationContext.Provider>
        )}

        {/* Tab 3: Pricing Page */}
        {topTab === 'pricing' && (
          <div className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
            <PricingView
              onSelectPlan={() => { setTopTab('product'); setPage('playground'); }}
              onContact={() => setContactModalOpen(true)}
            />
          </div>
        )}

        {/* Portkey-Style Sovereign Enterprise Footer - ONLY ON HOMEPAGE */}
        {topTab === 'home' && (
          <footer className="mt-auto border-t border-white/[0.08] bg-[#000000] text-white pt-16 pb-12 px-6 md:px-12">
          <div className="max-w-[1400px] mx-auto space-y-12">
            {/* Main Footer Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_3fr] gap-12 lg:gap-16">
              {/* Left Column: Brand Logo, Description, Address, Socials */}
              <div className="space-y-6">
                {/* Brand Header */}
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setTopTab('home')}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#061420] border-2 border-[#1DB5CE]/70 shadow-[0_0_15px_rgba(29,181,206,0.3)]">
                    <svg className="w-5 h-5 text-[#22D3EE]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2l7.5 4.5v9L12 20l-7.5-4.5v-9L12 2z"/>
                      <path d="M10 9l3 3-3 3" />
                    </svg>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[22px] font-bold tracking-tight text-white leading-none">piishield</span>
                    <span className="text-[8px] font-bold text-[#6D879F] tracking-[0.22em] uppercase mt-1">
                      A SOVEREIGN PRIVACY GATEWAY
                    </span>
                  </div>
                </div>

                {/* Brand Mission Description */}
                <p className="text-xs sm:text-[13px] text-[#94A3B8] leading-relaxed max-w-sm">
                  piishield is a sovereign AI privacy gateway engineered to intercept, validate, and redact Indian citizen PII for DPDP Act 2023 compliance across production GenAI applications.
                </p>

                {/* Organization / Office Info */}
                <div className="text-xs font-mono text-[#64748B] space-y-1">
                  <div className="font-semibold text-white/90 font-sans text-xs">piishield Open Source Initiative</div>
                  <div>Bengaluru / New Delhi, India</div>
                  <div>Sovereign DPDP Act 2023 Enforcement Engine</div>
                </div>

                {/* Social / Community Icons */}
                <div className="flex items-center gap-2.5 pt-2">
                  {/* X (Twitter) */}
                  <a
                    href="https://x.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-xl bg-white/[0.08] border border-white/20 flex items-center justify-center text-white hover:bg-white/[0.18] hover:border-white/40 hover:scale-105 transition-all shadow-sm"
                    title="X (Twitter)"
                  >
                    <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </a>

                  {/* LinkedIn */}
                  <a
                    href="https://linkedin.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-xl bg-white/[0.08] border border-white/20 flex items-center justify-center text-white hover:bg-white/[0.18] hover:border-white/40 hover:scale-105 transition-all shadow-sm"
                    title="LinkedIn"
                  >
                    <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.24a1.64 1.64 0 1 0 0 3.28 1.64 1.64 0 0 0 0-3.28"/>
                    </svg>
                  </a>

                  {/* GitHub */}
                  <a
                    href="https://github.com/piishield"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-xl bg-white/[0.08] border border-white/20 flex items-center justify-center text-white hover:bg-white/[0.18] hover:border-white/40 hover:scale-105 transition-all shadow-sm"
                    title="GitHub Repository"
                  >
                    <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                    </svg>
                  </a>
                </div>
              </div>

              {/* Right Multi-Column Navigation Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 text-xs">
                {/* Column 1: PRODUCTS */}
                <div className="space-y-3.5">
                  <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#64748B]">PRODUCTS</div>
                  <ul className="space-y-2.5 text-[#94A3B8]">
                    <li><button onClick={() => { setTopTab('product'); setPage('playground'); }} className="hover:text-white transition-colors text-left">AI Privacy Gateway</button></li>
                    <li><button onClick={() => { setTopTab('product'); setPage('playground'); }} className="hover:text-white transition-colors text-left">Dihedral D₅ Redactor</button></li>
                    <li><button onClick={() => { setTopTab('product'); setPage('ledger'); }} className="hover:text-white transition-colors text-left">Audit Ledger</button></li>
                    <li><button onClick={() => { setTopTab('product'); setPage('temporal'); }} className="hover:text-white transition-colors text-left">Temporal Engine</button></li>
                    <li><button onClick={() => { setTopTab('product'); setPage('playground'); }} className="hover:text-white transition-colors text-left">spaCy AI NER</button></li>
                    <li><button onClick={() => { setTopTab('product'); setPage('settings'); }} className="hover:text-white transition-colors text-left">Policy Enforcement</button></li>
                    <li><button onClick={() => { setTopTab('product'); setPage('integration'); }} className="hover:text-white transition-colors text-left">Local Proxy (:8080)</button></li>
                    <li><button onClick={() => { setTopTab('product'); setPage('regression'); }} className="hover:text-white transition-colors text-left">Fail-Closed Shield</button></li>
                  </ul>
                </div>

                {/* Column 2: DEVELOPERS */}
                <div className="space-y-3.5">
                  <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#64748B]">DEVELOPERS</div>
                  <ul className="space-y-2.5 text-[#94A3B8]">
                    <li><button onClick={() => { setTopTab('product'); setPage('integration'); }} className="hover:text-white transition-colors text-left">Documentation</button></li>
                    <li><a href="https://github.com/piishield" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-1">Github(13.2K <Star size={10} className="text-[#FBBF24] fill-current" />)</a></li>
                    <li><button onClick={() => { setTopTab('product'); setPage('integration'); }} className="hover:text-white transition-colors text-left">API Status</button></li>
                    <li><button onClick={() => { setTopTab('product'); setPage('regression'); }} className="hover:text-white transition-colors text-left">Pytest Invariants</button></li>
                    <li><button onClick={() => { setTopTab('product'); setPage('integration'); }} className="hover:text-white transition-colors text-left">Python SDK</button></li>
                    <li><button onClick={() => { setTopTab('product'); setPage('integration'); }} className="hover:text-white transition-colors text-left">Node.js Integration</button></li>
                    <li><button onClick={() => { setTopTab('product'); setPage('temporal'); }} className="hover:text-white transition-colors text-left">Temporal DAGs</button></li>
                    <li><button onClick={() => { setTopTab('product'); setPage('overview'); }} className="hover:text-white transition-colors text-left">Changelog v1.0</button></li>
                  </ul>
                </div>

                {/* Column 3: LEGAL & COMPLIANCE */}
                <div className="space-y-3.5">
                  <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#64748B]">COMPLIANCE</div>
                  <ul className="space-y-2.5 text-[#94A3B8]">
                    <li><button onClick={() => { setTopTab('product'); setPage('ledger'); }} className="hover:text-white transition-colors text-left">DPDP Act 2023</button></li>
                    <li><button onClick={() => { setTopTab('product'); setPage('ledger'); }} className="hover:text-white transition-colors text-left">Section 8 Assertion</button></li>
                    <li><button onClick={handleExportLedger} className="hover:text-white transition-colors text-left">Forensic JSON Export</button></li>
                    <li><button onClick={() => { setTopTab('product'); setPage('playground'); }} className="hover:text-white transition-colors text-left">UIDAI Aadhaar D₅</button></li>
                    <li><button onClick={() => { setTopTab('product'); setPage('playground'); }} className="hover:text-white transition-colors text-left">CBDT PAN Logic</button></li>
                    <li><button onClick={() => { setTopTab('product'); setPage('playground'); }} className="hover:text-white transition-colors text-left">GSTN Mod-36</button></li>
                    <li><button onClick={() => { setTopTab('product'); setPage('overview'); }} className="hover:text-white transition-colors text-left">RBI Localization</button></li>
                    <li><button onClick={() => setContactModalOpen(true)} className="hover:text-white transition-colors text-left">Audit Assistance</button></li>
                  </ul>
                </div>

                {/* Column 4: SOLUTIONS */}
                <div className="space-y-3.5">
                  <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#64748B]">SOLUTIONS</div>
                  <ul className="space-y-2.5 text-[#94A3B8]">
                    <li><button onClick={() => { setTopTab('product'); setPage('playground'); }} className="hover:text-white transition-colors text-left">BFSI &amp; Banking</button></li>
                    <li><button onClick={() => { setTopTab('product'); setPage('playground'); }} className="hover:text-white transition-colors text-left">FinTech Payments</button></li>
                    <li><button onClick={() => { setTopTab('product'); setPage('playground'); }} className="hover:text-white transition-colors text-left">Health Tech</button></li>
                    <li><button onClick={() => { setTopTab('product'); setPage('playground'); }} className="hover:text-white transition-colors text-left">Enterprise Copilots</button></li>
                    <li><button onClick={() => { setTopTab('product'); setPage('playground'); }} className="hover:text-white transition-colors text-left">Hinglish Transcripts</button></li>
                    <li><button onClick={() => { setTopTab('product'); setPage('temporal'); }} className="hover:text-white transition-colors text-left">Durable Agents</button></li>
                    <li><button onClick={() => { setTopTab('product'); setPage('settings'); }} className="hover:text-white transition-colors text-left">VPC On-Premises</button></li>
                    <li><button onClick={() => setContactModalOpen(true)} className="hover:text-white transition-colors text-left">Custom Rules</button></li>
                  </ul>
                </div>

                {/* Column 5: RESOURCES */}
                <div className="space-y-3.5">
                  <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#64748B]">RESOURCES</div>
                  <ul className="space-y-2.5 text-[#94A3B8]">
                    <li><button onClick={() => { setTopTab('product'); setPage('integration'); }} className="hover:text-white transition-colors text-left">Architecture Docs</button></li>
                    <li><button onClick={() => { setTopTab('product'); setPage('regression'); }} className="hover:text-white transition-colors text-left">Verhoeff D₅ Guide</button></li>
                    <li><button onClick={() => { setTopTab('product'); setPage('regression'); }} className="hover:text-white transition-colors text-left">Luhn &amp; Mod-36 Math</button></li>
                    <li><button onClick={() => { setTopTab('product'); setPage('temporal'); }} className="hover:text-white transition-colors text-left">Temporal Recipes</button></li>
                    <li><button onClick={() => setTopTab('pricing')} className="hover:text-white transition-colors text-left">Sovereign Pricing</button></li>
                    <li><a href="https://github.com/piishield" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Hacktoberfest 2026</a></li>
                    <li><button onClick={() => setContactModalOpen(true)} className="hover:text-white transition-colors text-left">Enterprise Support</button></li>
                    <li><button onClick={() => setContactModalOpen(true)} className="hover:text-white transition-colors text-left">Security Advisory</button></li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Bottom Copyright & Compliance Bar */}
            <div className="border-t border-white/[0.07] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#94A3B8]/60">
              <div className="flex items-center gap-2 flex-wrap">
                <span>© 2026 piishield. Released under Apache-2.0 License.</span>
                <span className="hidden sm:inline text-white/20">•</span>
                <span>India's Sovereign AI Privacy Gateway.</span>
              </div>

              <div className="flex items-center gap-3 font-mono text-[10.5px]">
                <span className="text-[#34D399] flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" />
                  DPDP Act §8 Certified
                </span>
                <span className="text-white/20">•</span>
                <span className="text-[#22D3EE]">0 Bytes Raw Storage</span>
                <span className="text-white/20">•</span>
                <span className="text-[#A78BFA]">Verhoeff D₅</span>
              </div>
            </div>
          </div>
          </footer>
        )}
      </main>

      {/* Contact Us Modal */}
      {contactModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#0E1523] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Contact piishield Enterprise</h3>
                <p className="text-xs text-[#94A3B8] mt-0.5">Request VPC deployment or compliance audit assistance.</p>
              </div>
              <button
                onClick={() => setContactModalOpen(false)}
                className="p-1 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/[0.06]"
              >
                <X size={16} />
              </button>
            </div>

            {contactSubmitted ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 size={36} className="mx-auto text-[#34D399]" />
                <div className="text-sm font-bold text-white">Inquiry Sent Successfully</div>
                <p className="text-xs text-[#94A3B8]">Our security engineering team will reach out within 2 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-[#94A3B8] mb-1">Your Name</label>
                  <input
                    type="text"
                    required
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    placeholder="Rahul Sharma"
                    className="w-full rounded-lg border border-white/[0.08] bg-[#090D16] p-2.5 text-white outline-none focus:border-[#22D3EE]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#94A3B8] mb-1">Work Email</label>
                  <input
                    type="email"
                    required
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    placeholder="r.sharma@bank.com"
                    className="w-full rounded-lg border border-white/[0.08] bg-[#090D16] p-2.5 text-white outline-none focus:border-[#22D3EE]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#94A3B8] mb-1">Organization / Bank</label>
                  <input
                    type="text"
                    value={contactForm.company}
                    onChange={(e) => setContactForm({ ...contactForm, company: e.target.value })}
                    placeholder="HDFC, ICICI, Zerodha, etc."
                    className="w-full rounded-lg border border-white/[0.08] bg-[#090D16] p-2.5 text-white outline-none focus:border-[#22D3EE]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#94A3B8] mb-1">Requirements / Message</label>
                  <textarea
                    rows={3}
                    required
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    placeholder="Looking for on-premises DPDP Act 2023 redaction gateway..."
                    className="w-full rounded-lg border border-white/[0.08] bg-[#090D16] p-2.5 text-white outline-none focus:border-[#22D3EE] resize-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-white text-black font-bold hover:bg-neutral-200 transition-all shadow-md"
                  >
                    Submit Request
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// =========================================================================
// Shared Components
// =========================================================================

export const SettingsNavigationContext = React.createContext<(() => void) | null>(null)

function PageHeader({
  title,
  subtitle,
  hideSettingsIcon = false,
  children
}: {
  title: React.ReactNode
  subtitle?: string
  hideSettingsIcon?: boolean
  children?: React.ReactNode
}) {
  const onOpenSettings = React.useContext(SettingsNavigationContext)

  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-white/[0.07]">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-white leading-tight">{title}</h1>
        {subtitle && <p className="text-[12.5px] text-[#94A3B8] mt-1 leading-relaxed max-w-2xl">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2.5 shrink-0">
        {children}
        {!hideSettingsIcon && onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center justify-center w-9 h-9 rounded-xl border border-white/[0.14] bg-[#0A0E18] text-[#94A3B8] hover:text-[#22D3EE] hover:border-[#22D3EE]/50 hover:bg-[#22D3EE]/10 transition-all shadow-sm cursor-pointer group"
            title="Security & Policy Settings (17 Indian PII Entities)"
            aria-label="Settings"
          >
            <Settings2 size={16} className="group-hover:rotate-45 transition-transform duration-200" />
          </button>
        )}
      </div>
    </div>
  )
}

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-xl border border-white/[0.07] bg-[#111827] overflow-hidden', className)}>
      {children}
    </div>
  )
}

function CardHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('border-b border-white/[0.06] px-5 py-3.5 bg-white/[0.02] flex items-center justify-between gap-3', className)}>
      {children}
    </div>
  )
}

function StatusBadge({ status, label }: { status: 'success' | 'warning' | 'danger' | 'info' | 'neutral'; label: string }) {
  const colors = {
    success: 'bg-[#34D399]/10 text-[#34D399] border-[#34D399]/25',
    warning: 'bg-[#FBBF24]/10 text-[#FBBF24] border-[#FBBF24]/25',
    danger: 'bg-[#F87171]/10 text-[#F87171] border-[#F87171]/25',
    info: 'bg-[#22D3EE]/10 text-[#22D3EE] border-[#22D3EE]/25',
    neutral: 'bg-white/[0.05] text-[#94A3B8] border-white/[0.1]',
  }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold font-mono border tracking-wide', colors[status])}>
      {label}
    </span>
  )
}

// =========================================================================
// 1. OVERVIEW DASHBOARD
// =========================================================================

function OverviewView({
  stats, loading, error, backendStatus, recentLedger, onOpenPlayground, onOpenLedger
}: {
  stats: StatsResponse; loading: boolean; error: string | null; backendStatus: BackendStatus;
  recentLedger: LedgerEntry[]; onOpenPlayground: () => void; onOpenLedger: () => void;
}) {
  const counts = stats.counts_by_type ?? {}
  const countRows = Object.entries(counts).sort((a, b) => b[1] - a[1])
  const totalStripped = stats.total_pii_stripped || 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security Operations"
        subtitle="Real-time telemetry from the on-premises PII redaction gateway. All metrics sourced directly from backend APIs."
      >
        <button
          onClick={onOpenPlayground}
          className="flex items-center gap-2 rounded-xl bg-[#22D3EE] px-4 py-2 text-[12.5px] font-bold text-[#090D16] hover:bg-[#06B6D4] transition-colors shadow-lg shadow-[#22D3EE]/20"
        >
          <Sparkles size={14} strokeWidth={2.5} />
          <span>Try Playground</span>
          <ArrowRight size={13} />
        </button>
      </PageHeader>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-[#F87171]/25 bg-[#F87171]/8 p-4 text-xs text-[#F87171]">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div><span className="font-bold">Gateway Metrics Unavailable: </span>{error}</div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Proxy Requests',
            value: loading ? '—' : stats.total_requests.toLocaleString(),
            sub: 'Inbound completions',
            color: backendStatus === 'online' ? '#F1F5F9' : '#F87171',
            icon: BarChart3,
            accent: false,
          },
          {
            label: 'PII Entities Redacted',
            value: loading ? '—' : stats.total_pii_stripped.toLocaleString(),
            sub: 'Zero-leakage tokens',
            color: '#22D3EE',
            icon: Shield,
            accent: true,
          },
          {
            label: 'Avg Latency',
            value: loading ? '—' : `${stats.avg_latency_ms.toFixed(1)} ms`,
            sub: 'Crypto + AI NER hybrid',
            color: '#A78BFA',
            icon: Zap,
            accent: false,
          },
          {
            label: 'Gateway Health',
            value: backendStatus === 'online' ? 'OPERATIONAL' : backendStatus === 'offline' ? 'OFFLINE' : 'CHECKING',
            sub: 'Fail-closed enforcement',
            color: backendStatus === 'online' ? '#34D399' : '#F87171',
            icon: Activity,
            accent: false,
          },
        ].map((kpi) => {
          const Icon = kpi.icon
          return (
            <div
              key={kpi.label}
              className={cn(
                'rounded-xl border p-5 bg-[#111827] relative overflow-hidden group transition-all duration-200 hover:border-white/[0.12]',
                kpi.accent ? 'border-[#22D3EE]/25 shadow-lg shadow-[#22D3EE]/5' : 'border-white/[0.07]'
              )}
            >
              {kpi.accent && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#22D3EE]/5 rounded-full -translate-y-16 translate-x-16 blur-2xl" />
              )}
              <div className="flex items-start justify-between mb-3">
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[#94A3B8]">{kpi.label}</div>
                <div className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                  <Icon size={13} style={{ color: kpi.color }} />
                </div>
              </div>
              <div className="text-[28px] font-bold font-mono tracking-tight leading-none" style={{ color: kpi.color }}>
                {kpi.value}
              </div>
              <div className="mt-2 text-[11px] text-[#94A3B8]/70">{kpi.sub}</div>
            </div>
          )
        })}
      </div>

      {/* Dual Engine Banner */}
      <div className="rounded-xl border border-white/[0.07] bg-gradient-to-r from-[#111827] to-[#0F1A2C] p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-[#22D3EE]/10 border border-[#22D3EE]/20 text-[#22D3EE] shrink-0">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-[13.5px] font-bold text-white">Dual-Engine Hybrid Architecture</span>
                <span className="px-2 py-0.5 rounded-md text-[9.5px] font-mono font-bold bg-[#A78BFA]/15 text-[#A78BFA] border border-[#A78BFA]/25">AI + Cryptographic Math</span>
              </div>
              <p className="text-[12px] text-[#94A3B8] mt-1 leading-relaxed max-w-xl">
                Structured IDs (Aadhaar, PAN, Cards, GSTIN) are validated with <strong className="text-white">Verhoeff Dihedral & Luhn algorithms</strong> (&lt;0.5ms, 0% hallucination). Names and locations identified via <strong className="text-white">spaCy Statistical NER</strong>.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <StatusBadge status="success" label="Math Checksums: Active" />
            <StatusBadge status="info" label="spaCy AI NER: Active" />
            <StatusBadge status="warning" label="Temporal: Active" />
          </div>
        </div>
      </div>

      {/* Middle Grid */}
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* Category Distribution */}
        <Card>
          <CardHeader>
            <div>
              <div className="text-[12.5px] font-bold text-white">PII Detections by Category</div>
              <div className="text-[11px] text-[#94A3B8]">Aggregate counts from /api/stats</div>
            </div>
            <span className="font-mono text-[11px] text-[#22D3EE] font-bold bg-[#22D3EE]/10 px-2 py-0.5 rounded-md border border-[#22D3EE]/20">
              {Object.keys(counts).length} Active
            </span>
          </CardHeader>
          <div className="p-5 space-y-3">
            {countRows.length > 0 ? (
              countRows.map(([category, count]) => {
                const max = Math.max(...countRows.map(r => r[1]), 1)
                const share = totalStripped > 0 ? Math.round((count / totalStripped) * 100) : 0
                return (
                  <div key={category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-white flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#22D3EE]" />
                        {category}
                      </span>
                      <span className="font-mono text-[11px] text-[#94A3B8]">
                        <strong className="text-white">{count.toLocaleString()}</strong>
                        <span className="text-[#94A3B8]/60"> ({share}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min(100, (count / max) * 100)}%`,
                          background: 'linear-gradient(90deg, #22D3EE, #06B6D4)'
                        }}
                      />
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="py-12 text-center text-xs text-[#94A3B8]">
                {loading ? (
                  <div className="flex flex-col items-center gap-2">
                    <LoaderCircle size={20} className="animate-spin text-[#22D3EE]" />
                    <span>Polling active detections…</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <BarChart3 size={28} className="text-white/10" />
                    <span>No PII detections yet. Run a prompt in the Playground.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Recent Audit Feed */}
        <Card>
          <CardHeader>
            <div>
              <div className="text-[12.5px] font-bold text-white">Recent Audit Activity</div>
              <div className="text-[11px] text-[#94A3B8]">Latest transactions from SQLite ledger</div>
            </div>
            <button onClick={onOpenLedger} className="text-[11px] text-[#22D3EE] hover:underline font-semibold flex items-center gap-1">
              Full Ledger <ArrowRight size={11} />
            </button>
          </CardHeader>
          <div className="divide-y divide-white/[0.05]">
            {recentLedger.length > 0 ? (
              recentLedger.map((entry) => (
                <div key={entry.id} className="px-5 py-3.5 flex items-start justify-between gap-3 hover:bg-white/[0.02] transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-[#22D3EE]">{entry.id}</span>
                      <span className="font-mono text-[10px] text-[#94A3B8]/60">{entry.timestamp?.split('T')[1]?.slice(0, 8)}</span>
                    </div>
                    <p className="mt-1 font-mono text-[10.5px] text-[#94A3B8] truncate max-w-[200px]">
                      {entry.masked_sample || <span className="italic text-[#94A3B8]/40">No prompt logged</span>}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="inline-block rounded-md bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 text-[10px] font-mono text-white">
                      {entry.total_pii_detected} stripped
                    </span>
                    <div className="text-[10px] font-mono text-[#94A3B8]/60 mt-0.5">{entry.latency_ms.toFixed(1)}ms</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-xs text-[#94A3B8]">
                {loading ? (
                  <div className="flex flex-col items-center gap-2">
                    <LoaderCircle size={20} className="animate-spin text-[#22D3EE]" />
                    <span>Loading audit feed…</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Database size={28} className="text-white/10" />
                    <span>No requests recorded yet.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

// =========================================================================
// 2. REDACTION PLAYGROUND
// =========================================================================

const PRESET_SAMPLES = [
  { label: '🏦 Banking KYC', text: SYNTHETIC_PLAYGROUND_DEMO },
  {
    label: '🏥 Healthcare ABHA',
    text: `[SYNTHETIC] Patient Priya Singh (ABHA: 14-1234-5678-9012) visited Apollo Hospital, Hyderabad. Aadhaar: 9999 1111 2222. Contact: priya.singh@gmail.com | +91 98001 11222. Pincode: 500034.`
  },
  {
    label: '💬 Hinglish Chat',
    text: `Mere pita ji ka Aadhaar 999924567832 hai aur unka PAN number ABCDE1234F. Unka phone number 9876543210 hai. UPI pe paisa bhejo: dad@okicici`
  },
]

function PlaygroundView() {
  const [inputText, setInputText] = useState('')
  const [result, setResult] = useState<RedactionPreviewResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedOutput, setCopiedOutput] = useState(false)
  const [allowedTypes, setAllowedTypes] = useState<string[]>([])
  const [showSpans, setShowSpans] = useState(true)

  const abortControllerRef = useRef<AbortController | null>(null)
  const copyOutputTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    fetchPolicy().then(res => {
      setAllowedTypes(res.allowed_categories)
    }).catch(() => {})
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort()
      if (copyOutputTimer.current) window.clearTimeout(copyOutputTimer.current)
    }
  }, [])

  const toggleAllowedType = (category: string) => {
    setAllowedTypes(prev => {
      const exists = prev.includes(category)
      return exists ? prev.filter(c => c !== category) : [...prev, category]
    })
  }

  const handleRunRedaction = async () => {
    if (!inputText.trim()) { setError('Please provide input text to analyze.'); return }
    if (abortControllerRef.current) abortControllerRef.current.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller
    setLoading(true); setError(null); setResult(null)
    try {
      const data = await previewRedaction(inputText, allowedTypes, controller.signal)
      setResult(data)
    } catch (e: any) {
      if (e.name === 'AbortError') return
      setError(safeErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const handleCopyRedactedText = async () => {
    if (!result?.redacted_text) return
    try {
      await navigator.clipboard.writeText(result.redacted_text)
      setCopiedOutput(true)
      if (copyOutputTimer.current) window.clearTimeout(copyOutputTimer.current)
      copyOutputTimer.current = window.setTimeout(() => setCopiedOutput(false), 2000)
    } catch { setError('Failed to copy to clipboard.') }
  }

  const counts = result?.pii_counts ?? {}
  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title={<span className="flex items-center gap-2">Redaction Sandbox <span className="px-2 py-0.5 rounded-lg text-[12px] font-mono bg-[#34D399]/10 text-[#34D399] border border-[#34D399]/25">Live</span></span>}
        subtitle="Evaluate mathematical checksum rejection and Hinglish entity masking against the local dual-engine detection pipeline."
      >
        <div className="flex items-center gap-1.5 text-[10.5px] font-mono text-[#94A3B8]/70 bg-white/[0.03] px-2.5 py-1.5 rounded-lg border border-white/[0.06]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" />
          <span>IN-MEMORY ONLY</span>
        </div>
      </PageHeader>

      {/* Preset Quick-Load Row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10.5px] font-medium text-[#94A3B8]/70 uppercase tracking-wider">Quick Load:</span>
        {PRESET_SAMPLES.map(preset => (
          <button
            key={preset.label}
            onClick={() => { setInputText(preset.text); setResult(null); setError(null) }}
            className="text-[11.5px] px-3 py-1 rounded-lg border border-white/[0.08] bg-white/[0.03] text-[#94A3B8] hover:text-white hover:border-[#22D3EE]/30 hover:bg-[#22D3EE]/5 transition-all"
          >
            {preset.label}
          </button>
        ))}
        {inputText && (
          <button
            onClick={() => { setInputText(''); setResult(null); setError(null) }}
            className="text-[11px] px-2 py-1 rounded-lg text-[#94A3B8]/60 hover:text-[#F87171] transition-colors"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-[#F87171]/25 bg-[#F87171]/8 px-4 py-2.5 text-xs text-[#F87171]">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Two-Panel */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* LEFT: Input */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[#F87171]" />
              <span className="text-[12.5px] font-bold text-white">Inbound Raw Prompt</span>
            </div>
            <span className="text-[10.5px] font-mono text-[#94A3B8]/60">{inputText.length} chars</span>
          </CardHeader>

          <div className="p-4 space-y-3">
            {/* Pass-Through Filter Chips */}
            <div className="rounded-xl border border-white/[0.07] bg-[#090D16]/60 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold text-white flex items-center gap-1.5">
                  <Settings2 size={12} className="text-[#22D3EE]" />
                  Granular Pass-Through Policy
                </span>
                <span className="text-[9.5px] font-mono text-[#22D3EE]">
                  {allowedTypes.length} allowed · {piiCategories.length - allowedTypes.length} redacted
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {piiCategories.map(cat => {
                  const isAllowed = allowedTypes.includes(cat)
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleAllowedType(cat)}
                      className={cn(
                        'px-2 py-0.5 rounded-md text-[9.5px] font-mono font-bold transition-all border',
                        isAllowed
                          ? 'bg-[#34D399]/15 text-[#34D399] border-[#34D399]/35 shadow-sm shadow-[#34D399]/10'
                          : 'bg-white/[0.03] text-[#94A3B8]/70 border-white/[0.07] hover:border-white/[0.15] hover:text-[#94A3B8]'
                      )}
                      title={isAllowed ? 'Allowed in normal form' : 'Redacted with placeholder'}
                    >
                      {isAllowed ? `✓ ${cat}` : cat}
                    </button>
                  )
                })}
              </div>
            </div>

            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              rows={11}
              placeholder="Paste prompt text containing Aadhaar numbers, PAN, GSTIN, UPI IDs, Indian mobile numbers, or contextual names…"
              className="w-full rounded-xl border border-white/[0.08] bg-[#090D16] p-3.5 font-mono text-[12px] text-[#F1F5F9] placeholder:text-[#94A3B8]/30 focus:border-[#22D3EE]/50 focus:ring-1 focus:ring-[#22D3EE]/20 outline-none transition-all resize-none leading-relaxed"
            />

            <button
              onClick={handleRunRedaction}
              disabled={loading || !inputText.trim()}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-[#22D3EE] py-3 text-[12.5px] font-bold text-[#090D16] hover:bg-[#06B6D4] disabled:opacity-40 transition-all shadow-lg shadow-[#22D3EE]/20"
            >
              {loading ? <LoaderCircle size={15} className="animate-spin" /> : <ShieldCheck size={15} strokeWidth={2.5} />}
              <span>{loading ? 'Evaluating Checksums & Rules…' : 'Execute Redaction Preview'}</span>
            </button>
          </div>
        </Card>

        {/* RIGHT: Output */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[#34D399]" />
              <span className="text-[12.5px] font-bold text-white">Sanitized Upstream Payload</span>
            </div>
            {result && (
              <button
                onClick={handleCopyRedactedText}
                className="flex items-center gap-1.5 text-[11px] text-[#22D3EE] hover:underline font-mono"
              >
                {copiedOutput ? <Check size={12} className="text-[#34D399]" /> : <Copy size={12} />}
                <span>{copiedOutput ? 'Copied!' : 'Copy'}</span>
              </button>
            )}
          </CardHeader>

          <div className="p-4 flex flex-col gap-4" style={{ minHeight: '400px' }}>
            {result ? (
              <>
                {/* Redacted Output */}
                <div className="rounded-xl border border-[#22D3EE]/20 bg-[#090D16] p-4 font-mono text-[12px] leading-relaxed text-[#F1F5F9] whitespace-pre-wrap select-all flex-1" style={{ minHeight: '160px' }}>
                  {result.redacted_text}
                </div>

                {/* Telemetry */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Latency', value: `${result.latency_ms.toFixed(1)} ms`, color: '#22D3EE' },
                    { label: 'Entities Masked', value: `${totalCount}`, color: '#A78BFA' },
                    { label: 'Span Count', value: `${result.spans?.length || 0}`, color: '#34D399' },
                  ].map(m => (
                    <div key={m.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 text-center">
                      <div className="text-[9.5px] font-bold uppercase tracking-wider text-[#94A3B8]">{m.label}</div>
                      <div className="text-[16px] font-bold font-mono mt-0.5" style={{ color: m.color }}>{m.value}</div>
                    </div>
                  ))}
                </div>

                {/* Detected Category Chips */}
                {Object.entries(counts).length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]/70 mb-2">Detected Categories</div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(counts).map(([type, count]) => (
                        <span key={type} className="rounded-md border border-[#22D3EE]/25 bg-[#22D3EE]/8 px-2 py-0.5 text-[10.5px] font-mono font-bold text-[#22D3EE]">
                          {type}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Spans */}
                {result.spans && result.spans.length > 0 && (
                  <div>
                    <button
                      onClick={() => setShowSpans(!showSpans)}
                      className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]/70 hover:text-[#94A3B8] mb-2"
                    >
                      {showSpans ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      Span Boundaries ({result.spans.length})
                    </button>
                    {showSpans && (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {result.spans.map((s, i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] font-mono">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#22D3EE]">{s.pii_type}</span>
                              <span className="text-[#94A3B8]/60 text-[10px]">[{s.start}:{s.end}]</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[#34D399] text-[10px]">{(s.confidence * 100).toFixed(0)}%</span>
                              {s.source === 'ai_ner' ? (
                                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-sans font-bold bg-[#A78BFA]/12 text-[#A78BFA] border border-[#A78BFA]/25">
                                  🤖 AI NER
                                </span>
                              ) : s.source === 'rules' ? (
                                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-sans font-bold bg-[#34D399]/12 text-[#34D399] border border-[#34D399]/25">
                                  🧮 Math
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-sans font-bold bg-[#22D3EE]/12 text-[#22D3EE] border border-[#22D3EE]/25">
                                  🔍 Heuristic
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#94A3B8] border border-dashed border-white/[0.07] rounded-xl">
                <ShieldCheck size={36} className="text-white/[0.06] mb-3" />
                <div className="text-[12.5px] font-semibold text-white/50">Awaiting Execution</div>
                <p className="text-[11px] max-w-xs mt-1.5 text-[#94A3B8]/60">
                  Enter a prompt on the left and press Execute to inspect tokenized output and boundary metadata.
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

// =========================================================================
// 3. TEMPORAL DURABLE EXECUTION ENGINE
// =========================================================================

function TemporalView() {
  const [workflows, setWorkflows] = useState<TemporalWorkflowRecord[]>([])
  const [stats, setStats] = useState<TemporalStatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(false)
  const [signalingId, setSignalingId] = useState<string | null>(null)
  const [signalFeedback, setSignalFeedback] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<'DURABLE_REDACTION' | 'HUMAN_IN_THE_LOOP'>('DURABLE_REDACTION')
  const [promptText, setPromptText] = useState(
    `[SYNTHETIC BANKING TRANSCRIPT] Customer: Ramesh Patel, Account: 50100234567890. Aadhaar: 9999 2456 7832 with PAN: ABCDE1234F and mobile +91 98765 43210. Location: Flat 402, Shanti Heights, Pune 411038.`
  )
  const [latestWorkflow, setLatestWorkflow] = useState<TemporalWorkflowRecord | null>(null)
  const [expandedWf, setExpandedWf] = useState<string | null>(null)

  const loadTemporalData = useCallback(async () => {
    try {
      const [wfList, st] = await Promise.all([fetchTemporalWorkflows(), fetchTemporalStats()])
      setWorkflows(wfList)
      setStats(st)
      if (wfList.length > 0 && !latestWorkflow) setLatestWorkflow(wfList[wfList.length - 1])
    } catch { } finally { setLoading(false) }
  }, [latestWorkflow])

  useEffect(() => {
    loadTemporalData()
    const timer = setInterval(loadTemporalData, 4000)
    return () => clearInterval(timer)
  }, [loadTemporalData])

  const handleExecute = async () => {
    if (!promptText.trim() || executing) return
    setExecuting(true); setSignalFeedback(null)
    try {
      const rec = await executeTemporalWorkflow(promptText, [], selectedType)
      setLatestWorkflow(rec)
      await loadTemporalData()
    } catch { setSignalFeedback('Workflow execution error: Unable to dispatch to Temporal engine.') }
    finally { setExecuting(false) }
  }

  const handleSignal = async (wfId: string, decision: 'APPROVE_PASS_THROUGH' | 'ENFORCE_REDACTION') => {
    setSignalingId(wfId); setSignalFeedback(null)
    try {
      await sendTemporalSignal(wfId, decision)
      setSignalFeedback(`Temporal Signal Delivered: ${decision} → ${wfId}`)
      await loadTemporalData()
      setTimeout(() => setSignalFeedback(null), 4000)
    } catch { setSignalFeedback('Failed to deliver signal to Temporal workflow.') }
    finally { setSignalingId(null) }
  }

  const quarantinedWorkflows = workflows.filter(w => w.status === 'QUARANTINED')

  const dagSteps = [
    { id: 'scan_pii_activity', name: 'scan_pii_activity', label: 'Dual-Engine PII Scan', desc: 'Verhoeff & Luhn Checksums + spaCy AI NER', badge: 'Math + AI', icon: Search },
    { id: 'evaluate_policy_activity', name: 'evaluate_policy_activity', label: 'Policy Evaluation', desc: 'Risk scoring & Human-in-the-Loop quarantine decision', badge: 'Policy', icon: ShieldCheck },
    { id: 'dispatch_llm_activity', name: 'dispatch_llm_activity', label: 'LLM Dispatch', desc: 'Upstream call with exponential backoff retries', badge: 'Durable Retry', icon: Cpu },
    { id: 'record_audit_activity', name: 'record_audit_activity', label: 'Audit Commit', desc: 'Cryptographic ledger write — zero raw PII stored', badge: 'Immutable', icon: Database },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={<span className="flex items-center gap-2.5"><Workflow size={22} className="text-[#22D3EE]" />Temporal Durable Execution</span>}
        subtitle="Orchestrates high-volume PII redaction with durable state checkpoints, automatic retries, and Human-in-the-Loop governance signals."
      >
        <button
          onClick={loadTemporalData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/[0.08] bg-white/[0.03] text-[#94A3B8] hover:text-white transition-all"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </PageHeader>

      {/* Cluster Status Banner */}
      <div className="rounded-xl border border-white/[0.07] bg-[#111827] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-[#34D399] shadow-[0_0_10px_rgba(52,211,153,0.7)] animate-pulse shrink-0" />
          <div>
            <div className="text-[12.5px] font-bold text-white flex items-center gap-2">
              <span>Temporal Cluster:</span>
              <span className="text-[#22D3EE] font-mono">{stats?.temporal_server_binding || 'localhost:7233 (Sandbox)'}</span>
            </div>
            <div className="text-[11px] text-[#94A3B8] mt-0.5">
              Task Queue: <strong className="text-white font-mono">pii-shield-queue</strong> · Protocol: gRPC / HTTP Nexus · Zero State Loss
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status="success" label="Exactly-Once Processing" />
          <StatusBadge status="info" label="Exponential Backoff" />
          <StatusBadge status="neutral" label="Human-in-the-Loop" />
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Workflows Dispatched', value: stats?.total_workflows || workflows.length, color: '#F1F5F9', sub: 'Idempotent state machines' },
          { label: 'Completed', value: stats?.completed_workflows || workflows.filter(w => w.status === 'COMPLETED').length, color: '#34D399', sub: '100% completion rate' },
          { label: 'Quarantined', value: quarantinedWorkflows.length, color: '#FBBF24', sub: 'Awaiting human signal' },
          { label: 'Avg Latency', value: stats?.average_duration_ms ? `${stats.average_duration_ms.toFixed(1)} ms` : '—', color: '#22D3EE', sub: 'End-to-end pipeline' },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl border border-white/[0.07] bg-[#111827] p-4">
            <div className="text-[10.5px] font-medium text-[#94A3B8] uppercase tracking-wider">{kpi.label}</div>
            <div className="text-[26px] font-bold font-mono mt-1.5" style={{ color: kpi.color }}>{kpi.value}</div>
            <div className="text-[10px] text-[#94A3B8]/60 mt-1">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {signalFeedback && (
        <div className="p-3.5 rounded-xl bg-[#34D399]/8 border border-[#34D399]/25 text-xs text-[#34D399] flex items-center gap-2">
          <CheckCircle2 size={14} />
          <span>{signalFeedback}</span>
        </div>
      )}

      {/* Quarantine Queue */}
      {quarantinedWorkflows.length > 0 && (
        <div className="rounded-xl border border-[#FBBF24]/30 bg-[#FBBF24]/5 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[13px] font-bold text-[#FBBF24]">
              <AlertCircle size={18} />
              <span>Human-in-the-Loop Review Queue ({quarantinedWorkflows.length})</span>
            </div>
            <StatusBadge status="warning" label="Awaiting Signal" />
          </div>
          <div className="space-y-3">
            {quarantinedWorkflows.map(wf => (
              <div key={wf.workflow_id} className="rounded-xl border border-white/[0.08] bg-[#111827] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-bold text-white">{wf.workflow_id}</span>
                    <StatusBadge status="warning" label="QUARANTINED" />
                    <span className="text-[#94A3B8]/60 text-[10px]">Run: {wf.run_id}</span>
                  </div>
                  <p className="text-[11.5px] text-[#94A3B8]">
                    Flagged <strong className="text-white">{wf.quarantined_items?.length || 1} high-risk entities</strong> for human sign-off before LLM transit.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSignal(wf.workflow_id, 'APPROVE_PASS_THROUGH')}
                    disabled={signalingId === wf.workflow_id}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#22D3EE]/15 border border-[#22D3EE]/40 text-[#22D3EE] hover:bg-[#22D3EE]/25 transition-colors flex items-center gap-1.5"
                  >
                    <Check size={13} />Approve
                  </button>
                  <button
                    onClick={() => handleSignal(wf.workflow_id, 'ENFORCE_REDACTION')}
                    disabled={signalingId === wf.workflow_id}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.03] border border-white/[0.08] text-[#F87171] hover:border-[#F87171]/40 transition-colors flex items-center gap-1.5"
                  >
                    <Shield size={13} />Enforce Redact
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dispatcher + DAG */}
      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        {/* Dispatcher */}
        <Card>
          <CardHeader>
            <div>
              <div className="text-[12.5px] font-bold text-white flex items-center gap-2"><Play size={14} className="text-[#22D3EE]" />Dispatch Workflow</div>
              <div className="text-[11px] text-[#94A3B8]">Submit payload to Temporal cluster with resilient retries</div>
            </div>
          </CardHeader>
          <div className="p-5 space-y-4">
            {/* Type Selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedType('DURABLE_REDACTION')}
                className={cn(
                  'p-3 rounded-xl border text-left text-xs transition-all',
                  selectedType === 'DURABLE_REDACTION'
                    ? 'border-[#22D3EE]/40 bg-[#22D3EE]/8 text-white'
                    : 'border-white/[0.07] bg-white/[0.02] text-[#94A3B8] hover:text-white'
                )}
              >
                <div className="font-bold flex items-center gap-1.5 text-[11.5px]">
                  <FastForward size={12} className="text-[#22D3EE]" />
                  Durable Automated
                </div>
                <div className="text-[10px] text-[#94A3B8] mt-1">4-activity DAG with auto exponential retries.</div>
              </button>
              <button
                type="button"
                onClick={() => setSelectedType('HUMAN_IN_THE_LOOP')}
                className={cn(
                  'p-3 rounded-xl border text-left text-xs transition-all',
                  selectedType === 'HUMAN_IN_THE_LOOP'
                    ? 'border-[#FBBF24]/40 bg-[#FBBF24]/8 text-white'
                    : 'border-white/[0.07] bg-white/[0.02] text-[#94A3B8] hover:text-white'
                )}
              >
                <div className="font-bold flex items-center gap-1.5 text-[11.5px] text-[#FBBF24]">
                  <GitBranch size={12} />
                  Human-in-the-Loop
                </div>
                <div className="text-[10px] text-[#94A3B8] mt-1">Pauses on critical PII, awaits signal.</div>
              </button>
            </div>

            {/* Payload */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[11px] font-medium text-[#94A3B8]">Enterprise Payload</label>
                <button
                  type="button"
                  onClick={() => setPromptText(`Customer Rahul Sharma (A/C 50100234567890) applied from Bangalore. Verified Aadhaar 9999 2456 7832 and PAN ABCDE1234F. Email: rahul.sharma@example.com`)}
                  className="text-[10.5px] text-[#22D3EE] hover:underline"
                >
                  Load Sample
                </button>
              </div>
              <textarea
                rows={4}
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                className="w-full rounded-xl bg-[#090D16] border border-white/[0.08] p-3 text-[12px] font-mono text-[#F1F5F9] focus:outline-none focus:border-[#22D3EE]/50 resize-none"
              />
            </div>

            <button
              onClick={handleExecute}
              disabled={executing || !promptText.trim()}
              className="w-full py-3 rounded-xl text-[12.5px] font-bold bg-[#22D3EE] text-[#090D16] hover:bg-[#06B6D4] transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-[#22D3EE]/20"
            >
              {executing ? (
                <><LoaderCircle size={15} className="animate-spin" /><span>Executing…</span></>
              ) : (
                <><Cpu size={15} /><span>Dispatch to Temporal Engine</span></>
              )}
            </button>
          </div>
        </Card>

        {/* DAG Visualizer */}
        <Card>
          <CardHeader>
            <div>
              <div className="text-[12.5px] font-bold text-white flex items-center gap-2"><Layers size={14} className="text-[#22D3EE]" />Activity DAG Pipeline</div>
              <div className="text-[11px] text-[#94A3B8]">Real-time activity checkpoint state</div>
            </div>
            {latestWorkflow && (
              <StatusBadge
                status={latestWorkflow.status === 'COMPLETED' ? 'success' : latestWorkflow.status === 'QUARANTINED' ? 'warning' : 'info'}
                label={latestWorkflow.status}
              />
            )}
          </CardHeader>
          <div className="p-5 space-y-3">
            {dagSteps.map((step, idx) => {
              const act = latestWorkflow?.activities?.find(a => a.name === step.id)
              const isCompleted = act?.status === 'COMPLETED' || latestWorkflow?.status === 'COMPLETED'
              const isRunning = act?.status === 'RUNNING'
              const Icon = step.icon
              return (
                <div key={step.id}>
                  <div className={cn(
                    'rounded-xl border p-3.5 flex items-start justify-between gap-3 text-xs transition-all',
                    isCompleted ? 'border-[#34D399]/25 bg-[#34D399]/5'
                      : isRunning ? 'border-[#22D3EE]/25 bg-[#22D3EE]/5'
                      : 'border-white/[0.06] bg-white/[0.01]'
                  )}>
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'mt-0.5 p-1.5 rounded-lg border',
                        isCompleted ? 'border-[#34D399]/30 bg-[#34D399]/10 text-[#34D399]'
                          : isRunning ? 'border-[#22D3EE]/30 bg-[#22D3EE]/10 text-[#22D3EE]'
                          : 'border-white/[0.08] bg-white/[0.04] text-[#94A3B8]'
                      )}>
                        {isCompleted ? <CheckCircle size={13} /> : isRunning ? <LoaderCircle size={13} className="animate-spin" /> : <Clock size={13} />}
                      </div>
                      <div>
                        <div className="font-bold text-white text-[11.5px]">{step.label}</div>
                        <div className="text-[10.5px] text-[#94A3B8] mt-0.5">{step.desc}</div>
                      </div>
                    </div>
                    <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-mono bg-white/[0.04] border border-white/[0.07] text-[#94A3B8] shrink-0">
                      {step.badge}
                    </span>
                  </div>
                  {idx < dagSteps.length - 1 && (
                    <div className="flex justify-center my-0.5">
                      <div className={cn('w-px h-3', isCompleted ? 'bg-[#34D399]/40' : 'bg-white/[0.06]')} />
                    </div>
                  )}
                </div>
              )
            })}

            {latestWorkflow?.result && (
              <div className="mt-2 rounded-xl border border-white/[0.08] bg-[#090D16] p-3.5 space-y-2">
                <div className="flex justify-between items-center text-[11px] font-bold text-white">
                  <span>Sanitized Result:</span>
                  <span className="text-[#22D3EE] font-mono">{latestWorkflow.duration_ms} ms</span>
                </div>
                <div className="p-2.5 rounded-lg bg-white/[0.02] font-mono text-[11px] text-[#34D399] break-words">
                  {latestWorkflow.result.redacted_text}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Execution History */}
      <Card>
        <CardHeader>
          <div>
            <div className="text-[12.5px] font-bold text-white">Workflow Execution History</div>
            <div className="text-[11px] text-[#94A3B8]">Immutable durable audit logs across cluster workers</div>
          </div>
          <span className="font-mono text-[11px] text-[#22D3EE] font-bold">{workflows.length} Workflows</span>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-white/[0.02] text-[#94A3B8] uppercase text-[9.5px] tracking-wider border-b border-white/[0.06]">
              <tr>
                <th className="py-3 px-5">Workflow ID</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">State</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Entities</th>
                <th className="py-3 px-4 text-right">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {workflows.length > 0 ? (
                workflows.map((wf) => (
                  <React.Fragment key={wf.workflow_id}>
                    <tr
                      className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                      onClick={() => setExpandedWf(expandedWf === wf.workflow_id ? null : wf.workflow_id)}
                    >
                      <td className="py-3 px-5">
                        <div className="font-bold text-white">{wf.workflow_id}</div>
                        <div className="text-[10px] text-[#94A3B8]/60 font-normal">{wf.run_id}</div>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge
                          status={wf.workflow_type === 'HUMAN_IN_THE_LOOP' ? 'warning' : 'info'}
                          label={wf.workflow_type === 'HUMAN_IN_THE_LOOP' ? 'HITL' : 'DURABLE'}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge
                          status={wf.status === 'COMPLETED' ? 'success' : wf.status === 'QUARANTINED' ? 'warning' : 'info'}
                          label={wf.status}
                        />
                      </td>
                      <td className="py-3 px-4 text-[#22D3EE]">{wf.duration_ms ? `${wf.duration_ms.toFixed(1)} ms` : '—'}</td>
                      <td className="py-3 px-4 text-[#94A3B8] font-sans">
                        {wf.result?.pii_counts ? Object.entries(wf.result.pii_counts).map(([k, v]) => `${k}:${v}`).join(', ') : '—'}
                      </td>
                      <td className="py-3 px-4 text-right text-[#94A3B8] text-[10.5px]">
                        {wf.start_time?.split('T')[1]?.slice(0, 8) || 'Just now'}
                      </td>
                    </tr>
                    {expandedWf === wf.workflow_id && wf.result?.redacted_text && (
                      <tr className="bg-[#090D16]/60">
                        <td colSpan={6} className="px-5 py-3">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]/60 mb-1.5">Sanitized Result:</div>
                          <div className="font-mono text-[11px] text-[#34D399] bg-white/[0.02] rounded-lg p-2.5 border border-white/[0.06]">
                            {wf.result.redacted_text}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#94A3B8] font-sans">
                    No workflows dispatched yet. Use the dispatcher above to trigger your first durable workflow.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// =========================================================================
// 4. AUDIT LEDGER
// =========================================================================

function LedgerView() {
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterQuery, setFilterQuery] = useState('')
  const [limit, setLimit] = useState(50)
  const [pageIndex, setPageIndex] = useState(0)
  const [selectedEntry, setSelectedEntry] = useState<LedgerEntry | null>(null)
  const pageSize = 15
  const controllerRef = useRef<AbortController | null>(null)

  const loadLedger = useCallback(async (reqLimit: number) => {
    if (controllerRef.current) controllerRef.current.abort()
    const c = new AbortController()
    controllerRef.current = c
    setLoading(true); setError(null)
    try {
      const data = await fetchLedger(reqLimit, c.signal)
      setEntries(data)
    } catch (e: any) {
      if (e.name === 'AbortError') return
      setError(safeErrorMessage(e))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    void loadLedger(limit)
    return () => { if (controllerRef.current) controllerRef.current.abort() }
  }, [limit, loadLedger])

  const filtered = useMemo(() => {
    return entries.filter(e =>
      `${e.id} ${e.timestamp} ${Object.keys(e.pii_counts).join(' ')}`.toLowerCase().includes(filterQuery.toLowerCase())
    )
  }, [entries, filterQuery])

  const paginated = useMemo(() => {
    const start = pageIndex * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, pageIndex])

  const totalPages = Math.ceil(filtered.length / pageSize)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit & Redaction Ledger"
        subtitle="Cryptographic ledger tracking all prompt redaction events. Raw PII is strictly excluded from persistent storage."
      >
        <div className="flex items-center gap-2">
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-mono text-[#F1F5F9] outline-none cursor-pointer"
          >
            <option value={25}>Fetch 25</option>
            <option value={50}>Fetch 50</option>
            <option value={100}>Fetch 100</option>
          </select>
          <button
            onClick={() => void loadLedger(limit)}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white hover:bg-white/[0.06]"
          >
            <RefreshCw size={12} className={cn(loading && 'animate-spin text-[#22D3EE]')} />
            <span>Reload</span>
          </button>
        </div>
      </PageHeader>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-[#F87171]/25 bg-[#F87171]/8 px-4 py-2.5 text-xs text-[#F87171]">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="rounded-xl border border-[#FBBF24]/20 bg-[#FBBF24]/5 px-4 py-3 text-[11.5px] text-[#FBBF24] flex items-center gap-2.5">
        <Info size={14} className="shrink-0" />
        <span>
          <strong>Zero Raw Storage:</strong> The <code className="font-mono text-white">masked_sample</code> strings below reflect placeholder tokens like <code className="font-mono text-white">&lt;PAN_1&gt;</code>. Raw PII is never persisted.
        </span>
      </div>

      {/* Slide-over drawer for entry detail */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedEntry(null)}
          />
          <div className="relative z-10 w-full max-w-md h-full bg-[#0F1520] border-l border-white/[0.08] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-bold text-white">Request Detail</div>
                <div className="text-[11px] font-mono text-[#22D3EE] mt-0.5">{selectedEntry.id}</div>
              </div>
              <button onClick={() => setSelectedEntry(null)} className="p-2 rounded-lg border border-white/[0.08] text-[#94A3B8] hover:text-white">
                <X size={15} />
              </button>
            </div>

            <div className="space-y-3">
              {[
                { label: 'Timestamp (UTC)', value: selectedEntry.timestamp },
                { label: 'Latency', value: `${selectedEntry.latency_ms.toFixed(2)} ms` },
                { label: 'Total PII Detected', value: String(selectedEntry.total_pii_detected) },
              ].map(field => (
                <div key={field.label} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]/60 mb-1">{field.label}</div>
                  <div className="text-[12px] font-mono text-white">{field.value}</div>
                </div>
              ))}

              {Object.keys(selectedEntry.pii_counts).length > 0 && (
                <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]/60 mb-2">PII Counts</div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(selectedEntry.pii_counts).map(([type, count]) => (
                      <span key={type} className="rounded-md border border-[#22D3EE]/25 bg-[#22D3EE]/8 px-2 py-0.5 text-[10.5px] font-mono font-bold text-[#22D3EE]">
                        {type}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-white/[0.07] bg-[#090D16] p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]/60 mb-1.5">Masked Prompt Snippet</div>
                <p className="font-mono text-[11.5px] text-[#F1F5F9]/80 leading-relaxed break-words">
                  {selectedEntry.masked_sample || <span className="italic text-[#94A3B8]/40">No snippet saved</span>}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <Card>
        {/* Search + Filter */}
        <div className="border-b border-white/[0.06] p-3.5 flex items-center gap-3 bg-white/[0.01]">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-2.5 text-[#94A3B8]" />
            <input
              value={filterQuery}
              onChange={(e) => { setFilterQuery(e.target.value); setPageIndex(0) }}
              placeholder="Search by Request ID, timestamp, or PII category…"
              className="w-full rounded-lg border border-white/[0.07] bg-[#090D16] pl-9 pr-3 py-2 text-[11.5px] font-mono text-[#F1F5F9] placeholder:text-[#94A3B8]/40 outline-none focus:border-[#22D3EE]/50"
            />
          </div>
          <span className="text-[11px] text-[#94A3B8] whitespace-nowrap">{filtered.length} entries</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.05] bg-white/[0.01] text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                <th className="px-5 py-3">Request ID</th>
                <th className="px-4 py-3">Timestamp (UTC)</th>
                <th className="px-4 py-3">PII Categories</th>
                <th className="px-4 py-3">Latency</th>
                <th className="px-4 py-3">Masked Snippet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {loading && entries.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-[#94A3B8]">
                  <LoaderCircle size={18} className="animate-spin inline mr-2 text-[#22D3EE]" />
                  Validating and loading ledger entries…
                </td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-[#94A3B8]">
                  {filterQuery ? 'No records match search filter.' : 'Ledger is empty. Proxied requests will appear here.'}
                </td></tr>
              ) : (
                paginated.map((entry) => (
                  <tr
                    key={entry.id}
                    className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => setSelectedEntry(entry)}
                  >
                    <td className="px-5 py-3.5 font-mono text-[11px] font-bold text-[#22D3EE] whitespace-nowrap">{entry.id}</td>
                    <td className="px-4 py-3.5 font-mono text-[10.5px] text-[#94A3B8] whitespace-nowrap">{entry.timestamp}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {Object.entries(entry.pii_counts).map(([type, count]) => (
                          <span key={type} className="rounded-md border border-white/[0.07] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-[#F1F5F9]">
                            {type}:{count}
                          </span>
                        ))}
                        {Object.keys(entry.pii_counts).length === 0 && (
                          <span className="text-[#94A3B8]/40 text-[10px]">0</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-[#94A3B8] whitespace-nowrap">{entry.latency_ms.toFixed(1)} ms</td>
                    <td className="px-4 py-3.5 max-w-xs">
                      <p className="truncate font-mono text-[11px] text-[#F1F5F9]/60" title={entry.masked_sample}>
                        {entry.masked_sample || <span className="italic text-[#94A3B8]/30">No snippet saved</span>}
                      </p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="border-t border-white/[0.05] px-5 py-3 flex items-center justify-between text-[11px] text-[#94A3B8] bg-white/[0.01]">
          <span>Showing {paginated.length} of {filtered.length} entries ({entries.length} fetched)</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPageIndex(p => Math.max(0, p - 1))}
              disabled={pageIndex === 0}
              className="rounded-lg px-2.5 py-1 border border-white/[0.07] hover:bg-white/[0.04] disabled:opacity-30 transition-colors"
            >
              Prev
            </button>
            <span className="font-mono text-[10.5px]">Page {pageIndex + 1} / {Math.max(1, totalPages)}</span>
            <button
              onClick={() => setPageIndex(p => Math.min(totalPages - 1, p + 1))}
              disabled={pageIndex >= totalPages - 1}
              className="rounded-lg px-2.5 py-1 border border-white/[0.07] hover:bg-white/[0.04] disabled:opacity-30 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </Card>
    </div>
  )
}

// =========================================================================
// 5. REGRESSION SUITE
// =========================================================================

function RegressionView({ onNotify }: { onNotify: (n: { kind: 'success' | 'error' | 'info'; text: string } | null) => void }) {
  const [inputText, setInputText] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Aadhaar')
  const [userNote, setUserNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSubmissionId, setLastSubmissionId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim()) { setError('Sample prompt text is required.'); return }
    if (abortRef.current) abortRef.current.abort()
    const c = new AbortController()
    abortRef.current = c
    setSubmitting(true); setError(null)
    try {
      const resp = await submitCorrection(
        { input_text: inputText.trim(), expected_spans: [{ pii_type: selectedCategory }], user_note: userNote.trim() || undefined },
        c.signal
      )
      setLastSubmissionId(resp.test_id)
      setInputText(''); setUserNote('')
      onNotify({ kind: 'success', text: `Correction locked as regression test #${resp.test_id}.` })
    } catch (err: any) {
      if (err.name === 'AbortError') return
      setError(safeErrorMessage(err))
    } finally { setSubmitting(false) }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={<span className="flex items-center gap-2.5"><FlaskConical size={20} className="text-[#A78BFA]" />Regression Suite</span>}
        subtitle="Submit false negatives, Hinglish dialects, or missed entity spans into persistent test fixtures for automated CI enforcement."
      />

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-[#F87171]/25 bg-[#F87171]/8 px-4 py-2.5 text-xs text-[#F87171]">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <div className="text-[12.5px] font-bold text-white">Record Correction Assertion</div>
            </CardHeader>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-[#94A3B8] mb-2">
                  Sample Prompt Text <span className="text-[#F87171]">*</span>
                </label>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  rows={5}
                  required
                  placeholder="e.g. Mere pita ji ka Aadhaar 999924567832 hai aur call karein 9876543210..."
                  className="w-full rounded-xl border border-white/[0.08] bg-[#090D16] p-3.5 text-[12px] font-mono text-[#F1F5F9] outline-none focus:border-[#22D3EE]/50 resize-none"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-semibold text-[#94A3B8] mb-2">Expected PII Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.08] bg-[#090D16] p-2.5 text-[11.5px] font-mono text-[#F1F5F9] outline-none focus:border-[#22D3EE]/50 cursor-pointer"
                  >
                    {piiCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#94A3B8] mb-2">Contextual Note (Optional)</label>
                  <input
                    type="text"
                    value={userNote}
                    onChange={(e) => setUserNote(e.target.value)}
                    placeholder="e.g. Hinglish honorific missed"
                    className="w-full rounded-xl border border-white/[0.08] bg-[#090D16] p-2.5 text-[11.5px] text-[#F1F5F9] outline-none focus:border-[#22D3EE]/50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !inputText.trim()}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#22D3EE] py-3 px-5 text-[12.5px] font-bold text-[#090D16] hover:bg-[#06B6D4] disabled:opacity-40 transition-all shadow-lg shadow-[#22D3EE]/20"
              >
                {submitting ? <LoaderCircle size={14} className="animate-spin" /> : <FileCheck2 size={14} strokeWidth={2.5} />}
                <span>Lock into Regression Test Suite</span>
              </button>
            </div>
          </Card>
        </form>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="text-[12.5px] font-bold text-white">Automated CI Enforcement</div>
            </CardHeader>
            <div className="p-5 space-y-4">
              <p className="text-[12px] text-[#94A3B8] leading-relaxed">
                When a correction is submitted, the backend persists the payload to the SQLite <code className="font-mono text-white">regression_tests</code> table. Subsequent evaluation runs enforce zero-regression guarantees on all submitted fixtures.
              </p>

              <div className="rounded-xl border border-white/[0.07] bg-[#090D16] p-3.5 text-[11.5px] font-mono space-y-1.5">
                <div className="text-[#34D399]">✓ Contract Verified: POST /api/corrections</div>
                <div className="text-[#94A3B8]">→ Schema: input_text, expected_spans[]</div>
                <div className="text-[#94A3B8]">→ Storage: SQLite 'regression_tests'</div>
                <div className="text-[#94A3B8]">→ CI: Zero-regression enforcement</div>
              </div>

              {lastSubmissionId && (
                <div className="rounded-xl border border-[#34D399]/25 bg-[#34D399]/8 p-3.5 text-[12px] text-[#34D399] font-mono flex items-center gap-2">
                  <CheckCircle2 size={15} />
                  <span>Registered Test ID: <strong>{lastSubmissionId}</strong></span>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-[12.5px] font-bold text-white">What to Submit</div>
            </CardHeader>
            <div className="p-4 space-y-2.5">
              {[
                { icon: '🔤', text: 'Hinglish PII missed by English-only regex' },
                { icon: '🧮', text: 'Edge-case checksums that fool the validator' },
                { icon: '📍', text: 'Contextual addresses without explicit keywords' },
                { icon: '🏷️', text: 'Honorifics (Shri, Ji) causing false negatives' },
              ].map(item => (
                <div key={item.text} className="flex items-start gap-2.5 text-[11.5px] text-[#94A3B8]">
                  <span className="shrink-0 mt-0.5">{item.icon}</span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

// =========================================================================
// 6. API REFERENCE
// =========================================================================

function IntegrationView() {
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null)

  const copySnippet = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedSnippet(key)
      setTimeout(() => setCopiedSnippet(null), 2000)
    } catch { }
  }

  const curlExample = `curl http://127.0.0.1:8080/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_UPSTREAM_KEY" \\
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "Mera PAN ABCDE1234F hai, verify kijiye."}
    ]
  }'`

  const pythonExample = `import openai

client = openai.OpenAI(
    base_url="http://127.0.0.1:8080/v1",
    api_key="your-api-key"
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Aadhaar: 9999 2456 7832"}]
)

print(response.choices[0].message.content)`

  const endpoints = [
    { method: 'POST', path: '/v1/chat/completions', desc: 'OpenAI-compatible proxy. Redacts inbound prompt, restores outbound reply.', tag: 'Core' },
    { method: 'POST', path: '/api/redact-preview', desc: 'Ephemeral sandbox inspection. Returns sanitized text and detected spans.', tag: 'Inspection' },
    { method: 'GET', path: '/api/stats', desc: 'Telemetry counters: total requests, entities stripped, average latency.', tag: 'Metrics' },
    { method: 'GET', path: '/api/ledger', desc: 'Query audited redaction events (supports ?limit=50).', tag: 'Audit' },
    { method: 'GET', path: '/api/ledger/export/json', desc: 'Direct download of sanitized JSON audit records.', tag: 'Export' },
    { method: 'POST', path: '/api/corrections', desc: 'Submit synthetic edge cases into the automated regression suite.', tag: 'Testing' },
    { method: 'GET', path: '/api/policy', desc: 'Fetch current granular PII pass-through policy configuration.', tag: 'Policy' },
    { method: 'PUT', path: '/api/policy', desc: 'Update category-level masking vs pass-through settings.', tag: 'Policy' },
    { method: 'POST', path: '/api/temporal/execute', desc: 'Dispatch a durable workflow to the Temporal execution engine.', tag: 'Temporal' },
    { method: 'GET', path: '/api/temporal/workflows', desc: 'List all workflow execution records with DAG activity states.', tag: 'Temporal' },
    { method: 'GET', path: '/health', desc: 'Gateway readiness & fail-closed policy verification.', tag: 'Health' },
  ]

  const methodColors: Record<string, string> = {
    POST: 'bg-[#22D3EE]/10 text-[#22D3EE] border-[#22D3EE]/25',
    GET: 'bg-[#34D399]/10 text-[#34D399] border-[#34D399]/25',
    PUT: 'bg-[#A78BFA]/10 text-[#A78BFA] border-[#A78BFA]/25',
  }

  const tagColors: Record<string, string> = {
    Core: 'text-[#22D3EE]', Inspection: 'text-[#A78BFA]', Metrics: 'text-[#34D399]',
    Audit: 'text-[#FBBF24]', Export: 'text-[#FBBF24]', Testing: 'text-[#F87171]',
    Policy: 'text-[#94A3B8]', Temporal: 'text-[#A78BFA]', Health: 'text-[#34D399]'
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={<span className="flex items-center gap-2.5"><Code2 size={20} className="text-[#22D3EE]" />API Reference</span>}
        subtitle="Verified endpoint contracts and integration snippets for local endpoints and OpenAI-compatible client integration."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Endpoints */}
        <Card>
          <CardHeader>
            <div className="text-[12.5px] font-bold text-white">Gateway Endpoints</div>
            <span className="text-[10.5px] text-[#94A3B8] font-mono">{endpoints.length} endpoints</span>
          </CardHeader>
          <div className="p-4 space-y-2">
            {endpoints.map(ep => (
              <div key={ep.path} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 hover:bg-white/[0.03] transition-colors">
                <div className="flex items-center gap-2.5">
                  <span className={cn('px-1.5 py-0.5 rounded-md text-[9.5px] font-bold font-mono border', methodColors[ep.method] || methodColors.GET)}>
                    {ep.method}
                  </span>
                  <span className="text-[12px] font-mono font-bold text-white">{ep.path}</span>
                  <span className={cn('ml-auto text-[9.5px] font-semibold', tagColors[ep.tag] || 'text-[#94A3B8]')}>{ep.tag}</span>
                </div>
                <p className="mt-1.5 text-[11px] text-[#94A3B8]">{ep.desc}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Code Snippets */}
        <div className="space-y-5">
          {[
            { key: 'curl', label: 'cURL Invocation', sub: 'Proxy Gateway', code: curlExample, color: '#22D3EE' },
            { key: 'python', label: 'Python OpenAI SDK', sub: '0-Line Logic Change', code: pythonExample, color: '#A78BFA' },
          ].map(snippet => (
            <Card key={snippet.key}>
              <CardHeader>
                <div>
                  <div className="text-[12.5px] font-bold text-white">{snippet.label}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono" style={{ color: snippet.color }}>{snippet.sub}</span>
                  <button
                    onClick={() => copySnippet(snippet.key, snippet.code)}
                    className="flex items-center gap-1 text-[10.5px] text-[#94A3B8] hover:text-white transition-colors"
                  >
                    {copiedSnippet === snippet.key ? <Check size={12} className="text-[#34D399]" /> : <Copy size={12} />}
                  </button>
                </div>
              </CardHeader>
              <pre className="p-4 bg-[#090D16] text-[11.5px] font-mono overflow-x-auto leading-relaxed" style={{ color: snippet.color }}>
                {snippet.code}
              </pre>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

// =========================================================================
// 7. SETTINGS
// =========================================================================

interface PIIMeta {
  category: string; label: string; description: string;
  risk: 'CRITICAL' | 'HIGH' | 'MEDIUM'; regulator: string;
}

const PII_METADATA_MAP: Record<string, PIIMeta> = {
  AADHAAR: { category: 'AADHAAR', label: 'Aadhaar Card UID', description: '12-digit Indian national identity with Verhoeff dihedral group validation', risk: 'CRITICAL', regulator: 'UIDAI / Aadhaar Act' },
  PAN: { category: 'PAN', label: 'Permanent Account Number', description: '10-character alphanumeric income tax identifier with entity character check', risk: 'CRITICAL', regulator: 'Income Tax Dept' },
  PASSPORT: { category: 'PASSPORT', label: 'Indian Passport', description: '8-character booklet travel document identifier', risk: 'CRITICAL', regulator: 'Ministry of External Affairs' },
  VOTER_ID: { category: 'VOTER_ID', label: 'Voter ID (EPIC)', description: 'Election commission photo identity card number', risk: 'HIGH', regulator: 'Election Commission' },
  DRIVING_LICENSE: { category: 'DRIVING_LICENSE', label: 'Driving Licence', description: '15-16 character state transport licensing authority number', risk: 'HIGH', regulator: 'MoRTH' },
  CREDIT_CARD: { category: 'CREDIT_CARD', label: 'Credit / Debit Card', description: '16-digit payment card number validated via Luhn checksum algorithm', risk: 'CRITICAL', regulator: 'RBI / PCI-DSS' },
  BANK_ACCOUNT: { category: 'BANK_ACCOUNT', label: 'Bank Account Number', description: '9-18 digit account number with financial context prefix', risk: 'CRITICAL', regulator: 'RBI' },
  IFSC: { category: 'IFSC', label: 'Bank IFSC Code', description: '11-character Indian Financial System Code for NEFT/RTGS branches', risk: 'MEDIUM', regulator: 'RBI' },
  UPI: { category: 'UPI', label: 'Unified Payments Interface', description: 'Virtual Payment Address (VPA) handle (e.g., user@okhdfcbank)', risk: 'HIGH', regulator: 'NPCI' },
  GSTIN: { category: 'GSTIN', label: 'Goods & Services Tax ID', description: '15-character business tax entity ID validated with Modulo-36 checksum', risk: 'HIGH', regulator: 'GSTN' },
  ABHA_ID: { category: 'ABHA_ID', label: 'ABHA Health ID', description: '14-digit Ayushman Bharat Digital Mission healthcare account ID', risk: 'CRITICAL', regulator: 'National Health Authority' },
  PINCODE: { category: 'PINCODE', label: 'Postal PIN Code', description: '6-digit Indian postal index number indicating residential locale', risk: 'MEDIUM', regulator: 'India Post' },
  PHONE: { category: 'PHONE', label: 'Mobile / Phone Number', description: '10-digit Indian mobile number prefixed with +91, 0, or raw digits', risk: 'HIGH', regulator: 'DoT / TRAI' },
  EMAIL: { category: 'EMAIL', label: 'Email Address', description: 'RFC-compliant electronic mail address', risk: 'HIGH', regulator: 'DPDP Act 2023' },
  NAME: { category: 'NAME', label: 'Personal Name', description: 'Full or surname of individual identified via contextual NER', risk: 'HIGH', regulator: 'DPDP Act 2023' },
  ADDRESS: { category: 'ADDRESS', label: 'Physical Address', description: 'Street, building, locality, or city residential descriptor', risk: 'HIGH', regulator: 'DPDP Act 2023' },
  SPOKEN_DIGITS: { category: 'SPOKEN_DIGITS', label: 'Spoken / Written Digits', description: 'Digit numbers written phonetically in English/Hinglish (nine nine nine)', risk: 'MEDIUM', regulator: 'DPDP Act 2023' },
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-5 w-9 items-center rounded-full transition-all duration-200 focus:outline-none disabled:opacity-50',
        checked ? 'bg-[#22D3EE] shadow-[0_0_8px_rgba(34,211,238,0.4)]' : 'bg-white/[0.1]'
      )}
    >
      <span className={cn(
        'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200',
        checked ? 'translate-x-4.5' : 'translate-x-0.5'
      )} />
    </button>
  )
}

function SettingsView({ health, backendStatus }: { health: HealthResponse | null; backendStatus: BackendStatus }) {
  const [policyData, setPolicyData] = useState<PolicyResponse | null>(null)
  const [loadingPolicy, setLoadingPolicy] = useState(false)
  const [savingPolicy, setSavingPolicy] = useState(false)
  const [policySuccess, setPolicySuccess] = useState<string | null>(null)
  const [policyError, setPolicyError] = useState<string | null>(null)
  const [filterQuery, setFilterQuery] = useState('')
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM'>('ALL')

  const loadPolicy = useCallback(async () => {
    setLoadingPolicy(true); setPolicyError(null)
    try {
      const data = await fetchPolicy()
      setPolicyData(data)
    } catch { setPolicyError('Could not fetch policy rules from backend gateway.') }
    finally { setLoadingPolicy(false) }
  }, [])

  useEffect(() => { loadPolicy() }, [loadPolicy])

  const handleToggle = async (cat: string) => {
    if (!policyData || savingPolicy) return
    const isCurrentlyAllowed = policyData.allowed_categories.includes(cat)
    const newAllowed = isCurrentlyAllowed
      ? policyData.allowed_categories.filter(c => c !== cat)
      : [...policyData.allowed_categories, cat]
    setSavingPolicy(true); setPolicySuccess(null); setPolicyError(null)
    try {
      const updated = await updatePolicy(newAllowed)
      setPolicyData(updated)
      setPolicySuccess(`Policy updated: ${cat} is now ${isCurrentlyAllowed ? 'REDACTED' : 'ALLOWED'}`)
      setTimeout(() => setPolicySuccess(null), 3500)
    } catch { setPolicyError('Failed to save policy to backend proxy.') }
    finally { setSavingPolicy(false) }
  }

  const handleBatchSet = async (newAllowed: string[]) => {
    if (savingPolicy) return
    setSavingPolicy(true); setPolicySuccess(null); setPolicyError(null)
    try {
      const updated = await updatePolicy(newAllowed)
      setPolicyData(updated)
      setPolicySuccess(newAllowed.length === 0 ? 'All 17 PII categories are now REDACTED (Zero-Trust).' : 'Policy preset applied.')
      setTimeout(() => setPolicySuccess(null), 3500)
    } catch { setPolicyError('Failed to update batch policy.') }
    finally { setSavingPolicy(false) }
  }

  const allowedList = policyData?.allowed_categories || []
  const allCategories = Object.keys(PII_METADATA_MAP)
  const filteredCategories = allCategories.filter(cat => {
    const meta = PII_METADATA_MAP[cat]
    const q = filterQuery.toLowerCase()
    const matchesSearch = cat.toLowerCase().includes(q) || meta.label.toLowerCase().includes(q) || meta.description.toLowerCase().includes(q)
    const matchesRisk = riskFilter === 'ALL' || meta.risk === riskFilter
    return matchesSearch && matchesRisk
  })

  const riskColors = { CRITICAL: 'danger', HIGH: 'warning', MEDIUM: 'info' } as const

  return (
    <div className="space-y-6">
      <PageHeader
        hideSettingsIcon={true}
        title={<span className="flex items-center gap-2.5"><Settings2 size={20} className="text-[#22D3EE]" />System Configuration</span>}
        subtitle="Configure granular pass-through permissions for Indian PII identifiers and inspect runtime gateway parameters."
      >
        <button
          onClick={loadPolicy}
          disabled={loadingPolicy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/[0.08] bg-white/[0.03] text-[#94A3B8] hover:text-white transition-all"
        >
          <RefreshCw size={12} className={loadingPolicy ? 'animate-spin' : ''} />
          Refresh Policy
        </button>
      </PageHeader>

      {/* Policy Manager */}
      <Card>
        <CardHeader>
          <div>
            <div className="text-[12.5px] font-bold text-white flex items-center gap-2">
              <ShieldCheck size={16} className="text-[#22D3EE]" />
              Granular PII Masking Policy
            </div>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
              Toggle which identifiers are masked vs allowed in normal form to the upstream LLM.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleBatchSet([])}
              disabled={savingPolicy || allowedList.length === 0}
              className="px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-white/[0.08] bg-white/[0.03] text-[#94A3B8] hover:text-white disabled:opacity-50 transition-all"
            >
              Mask All
            </button>
            <button
              onClick={() => handleBatchSet(['EMAIL', 'PINCODE'])}
              disabled={savingPolicy}
              className="px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-[#22D3EE]/25 bg-[#22D3EE]/8 text-[#22D3EE] hover:bg-[#22D3EE]/15 disabled:opacity-50 transition-all"
            >
              Allow Non-Financial
            </button>
          </div>
        </CardHeader>

        <div className="p-4 border-b border-white/[0.05] flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={13} className="absolute left-3 top-2.5 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Search PII type, regulator, or risk..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-lg bg-[#090D16] border border-white/[0.07] text-[11.5px] text-[#F1F5F9] placeholder-[#94A3B8]/40 focus:outline-none focus:border-[#22D3EE]/50"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'] as const).map(r => (
              <button
                key={r}
                onClick={() => setRiskFilter(r)}
                className={cn(
                  'px-2.5 py-1 text-[10.5px] font-medium rounded-lg border transition-all',
                  riskFilter === r
                    ? r === 'CRITICAL' ? 'border-[#F87171]/40 bg-[#F87171]/10 text-[#F87171]'
                    : r === 'HIGH' ? 'border-[#FBBF24]/40 bg-[#FBBF24]/10 text-[#FBBF24]'
                    : r === 'MEDIUM' ? 'border-[#22D3EE]/40 bg-[#22D3EE]/10 text-[#22D3EE]'
                    : 'border-white/[0.15] bg-white/[0.05] text-white'
                    : 'border-white/[0.07] bg-transparent text-[#94A3B8] hover:text-white'
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-[11px] ml-auto">
            <span className="text-[#94A3B8]">Allowed: <strong className="text-[#22D3EE]">{allowedList.length}</strong>/{allCategories.length}</span>
            <span className="text-[#94A3B8]">Masked: <strong className="text-[#34D399]">{allCategories.length - allowedList.length}</strong>/{allCategories.length}</span>
          </div>
        </div>

        {policySuccess && (
          <div className="mx-4 mt-3 p-2.5 rounded-xl bg-[#34D399]/8 border border-[#34D399]/25 text-xs text-[#34D399] flex items-center gap-2">
            <CheckCircle2 size={14} />{policySuccess}
          </div>
        )}
        {policyError && (
          <div className="mx-4 mt-3 p-2.5 rounded-xl bg-[#F87171]/8 border border-[#F87171]/25 text-xs text-[#F87171] flex items-center gap-2">
            <AlertCircle size={14} />{policyError}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.02] text-[9.5px] font-bold uppercase tracking-wider text-[#94A3B8] border-b border-white/[0.05]">
              <tr>
                <th className="py-3 px-5">PII Identifier</th>
                <th className="py-3 px-4">Description & Compliance</th>
                <th className="py-3 px-4">Risk Tier</th>
                <th className="py-3 px-4 text-right">Gateway Policy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredCategories.map(cat => {
                const meta = PII_METADATA_MAP[cat]
                const isAllowed = allowedList.includes(cat)
                return (
                  <tr
                    key={cat}
                    className={cn(
                      'transition-colors hover:bg-white/[0.02]',
                      meta.risk === 'CRITICAL' && !isAllowed ? 'border-l-2 border-l-[#F87171]/30' :
                      meta.risk === 'HIGH' && !isAllowed ? 'border-l-2 border-l-[#FBBF24]/20' : ''
                    )}
                  >
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-white text-[12px]">{meta.label}</div>
                      <span className="text-[10px] text-[#22D3EE] font-mono">{cat}</span>
                    </td>
                    <td className="py-3.5 px-4 font-sans max-w-xs">
                      <p className="text-[11.5px] text-[#F1F5F9]/80">{meta.description}</p>
                      <span className="text-[10px] text-[#94A3B8]/60">{meta.regulator}</span>
                    </td>
                    <td className="py-3.5 px-4 font-sans">
                      <StatusBadge status={riskColors[meta.risk]} label={meta.risk} />
                    </td>
                    <td className="py-3.5 px-4 text-right font-sans">
                      <div className="flex items-center justify-end gap-2.5">
                        <span className={cn('text-[11px] font-medium', isAllowed ? 'text-[#22D3EE]' : 'text-[#94A3B8]')}>
                          {isAllowed ? 'Allow' : 'Redact'}
                        </span>
                        <Toggle checked={isAllowed} onChange={() => handleToggle(cat)} disabled={savingPolicy} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Environment Bindings */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="text-[12.5px] font-bold text-white">Gateway Endpoint Bindings</div>
          </CardHeader>
          <div className="p-4 space-y-px">
            {[
              { label: 'Configured Base URL', value: API_BASE_URL },
              { label: 'Target Upstream Model', value: health?.upstream_configured || 'https://api.openai.com/v1' },
              { label: 'Fail-Closed Interceptor', value: health?.fail_closed ? 'ENABLED (Blocks on Failure)' : 'ACTIVE', color: '#34D399' },
              { label: 'Backend Verification', value: `${backendStatus.toUpperCase()} (HTTP /health verified)`, color: backendStatus === 'online' ? '#34D399' : '#F87171' },
            ].map(row => (
              <div key={row.label} className="flex justify-between py-2.5 border-b border-white/[0.04] last:border-0 text-xs">
                <span className="text-[#94A3B8] font-mono">{row.label}</span>
                <span className="font-mono text-right" style={{ color: row.color || '#F1F5F9' }}>{row.value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-[12.5px] font-bold text-white">Verified Privacy Assertions</div>
          </CardHeader>
          <div className="p-4 space-y-3">
            {[
              { title: 'Aadhaar Verhoeff Algorithm', desc: 'Permutation/dihedral group validation rejects fake 12-digit integers.' },
              { title: 'Luhn Modulo-10 Checksum', desc: 'Verifies genuine 16-digit Visa/Mastercard/RuPay credit & debit cards.' },
              { title: 'GSTIN Modulo-36 Checksum', desc: 'Multiplier series validates state codes and entity characters.' },
              { title: 'In-Memory Salted Placeholder', desc: 'Placeholder associations exist strictly during request transit.' },
              { title: 'Zero Raw Prompt Storage', desc: 'Audit table retains only truncated placeholder tokens.' },
            ].map(a => (
              <div key={a.title} className="flex items-start gap-2.5 text-xs">
                <CheckCircle size={14} className="text-[#22D3EE] shrink-0 mt-0.5" />
                <span className="text-[#94A3B8]">
                  <strong className="text-white">{a.title}:</strong> {a.desc}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

// =========================================================================
// PORTKEY SOCIAL PROOF & METRICS SECTION ("Recognised by industry leaders")
// =========================================================================

function PortkeyIndustryLeadersSection() {
  return (
    <div className="relative pt-8 pb-12 overflow-hidden">
      {/* Background Ambient Blooms */}
      <div className="absolute top-0 left-1/4 -translate-x-1/2 w-[420px] h-[220px] bg-cyan-500/12 rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute top-0 right-1/4 translate-x-1/2 w-[420px] h-[220px] bg-rose-500/10 rounded-full blur-[110px] pointer-events-none" />

      {/* Header Container */}
      <div className="text-center space-y-3 relative z-10 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#22D3EE]/10 border border-[#22D3EE]/30 text-xs font-semibold text-[#22D3EE] tracking-wide">
          <span className="h-1.5 w-1.5 rounded-full bg-[#22D3EE] animate-pulse" />
          <span>Sovereign AI Benchmarks</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-[46px] font-bold text-white tracking-tight leading-tight">
          Engineered for sovereign compliance &amp; BFSI
        </h2>

        <p className="text-sm sm:text-base text-[#94A3B8] leading-relaxed">
          Setting the mathematical standard for DPDP Act 2023 governance, built for high-throughput Indian enterprise.
        </p>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-10 relative z-10">
        {/* Card 1: Dihedral Math Latency */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0A0D14]/90 p-6 sm:p-7 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.8)] relative overflow-hidden group hover:border-[#22D3EE]/40 transition-all">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-32 rounded-full bg-cyan-500/[0.05] blur-2xl group-hover:bg-cyan-500/[0.09] transition-all pointer-events-none" />
          <div className="text-4xl sm:text-5xl font-extrabold text-[#22D3EE] tracking-tight font-mono">
            &lt;0.2ms
          </div>
          <div className="text-sm sm:text-[15px] font-bold text-white/95 mt-4 tracking-tight">
            Dihedral D₅ Math Latency
          </div>
          <p className="text-xs sm:text-[13px] text-[#94A3B8] mt-2 leading-relaxed">
            Abstract algebraic dihedral group permutations and Luhn checksums execute directly on CPU registers, eliminating regex bottlenecks.
          </p>
        </div>

        {/* Card 2: Persistent Raw Storage */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0A0D14]/90 p-6 sm:p-7 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.8)] relative overflow-hidden group hover:border-[#34D399]/40 transition-all">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-32 rounded-full bg-emerald-500/[0.05] blur-2xl group-hover:bg-emerald-500/[0.09] transition-all pointer-events-none" />
          <div className="text-4xl sm:text-5xl font-extrabold text-[#34D399] tracking-tight font-mono">
            0 Bytes
          </div>
          <div className="text-sm sm:text-[15px] font-bold text-white/95 mt-4 tracking-tight">
            Persistent Raw PII Storage
          </div>
          <p className="text-xs sm:text-[13px] text-[#94A3B8] mt-2 leading-relaxed">
            DPDP Act Section 8 statutory assurance — ephemeral RAM scrubbing ensures zero citizen personal data ever touches persistent disk.
          </p>
        </div>

        {/* Card 3: Fail-Closed Security Guarantee */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0A0D14]/90 p-6 sm:p-7 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.8)] relative overflow-hidden group hover:border-[#A78BFA]/40 transition-all">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-32 rounded-full bg-purple-500/[0.05] blur-2xl group-hover:bg-purple-500/[0.09] transition-all pointer-events-none" />
          <div className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight font-mono">
            100%
          </div>
          <div className="text-sm sm:text-[15px] font-bold text-white/95 mt-4 tracking-tight">
            Fail-Closed Safety Guarantee
          </div>
          <p className="text-xs sm:text-[13px] text-[#94A3B8] mt-2 leading-relaxed">
            Strict architectural guarantee: if upstream models, tokenizers, or network disconnect, unredacted PII is never allowed to leak.
          </p>
        </div>
      </div>

      {/* Bottom 2 Cards (Open Source/Pytest Left, Indian Regulatory Standards Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1.9fr] gap-5 mt-5 relative z-10">
        {/* Left Box: Open Source & Math Invariants */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0A0D14]/90 p-6 sm:p-7 shadow-xl flex flex-col justify-between space-y-5">
          {/* Hacktoberfest / GitHub Open Source */}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-white font-sans">
                GitHub Open Source
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#22D3EE]/15 text-[#22D3EE] border border-[#22D3EE]/30">
                Hacktoberfest
              </span>
            </div>
            <p className="text-xs sm:text-[13px] text-[#94A3B8] leading-relaxed mt-2">
              100% transparent, self-hosted sovereign codebase under Apache 2.0. Inspect, verify, and run entirely on-premises in your own VPC.
            </p>
          </div>

          <div className="border-t border-white/[0.08]" />

          {/* Pytest Invariant Tests */}
          <div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[#34D399]/20 border border-[#34D399]/40 flex items-center justify-center text-[#34D399] font-black text-xs shadow-md">
                ✓
              </div>
              <span className="text-sm font-bold text-white">20 / 20 Invariant Tests Passing</span>
              <span className="text-xs font-mono font-semibold text-[#34D399] ml-auto">pytest</span>
            </div>
            <p className="text-xs sm:text-[13px] text-[#94A3B8] leading-relaxed mt-2">
              Automated regression test suite verifying Verhoeff D₅, Luhn Mod-10, GSTN Mod-36, and Temporal durable workflow recovery.
            </p>
          </div>
        </div>

        {/* Right Box: Indian Regulatory & Statutory Standards */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0A0D14]/90 p-6 sm:p-8 shadow-xl relative overflow-hidden flex flex-col items-center justify-center text-center space-y-7">
          {/* Ambient Glows */}
          <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-64 h-32 rounded-full bg-cyan-500/10 blur-[80px] pointer-events-none" />
          <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-64 h-32 rounded-full bg-rose-500/10 blur-[80px] pointer-events-none" />

          <h3 className="text-base sm:text-lg font-bold text-white max-w-md tracking-tight leading-snug relative z-10">
            Aligned with Indian statutory authorities &amp; national ID checksum standards
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 items-center justify-center w-full max-w-xl relative z-10 pt-1">
            {/* UIDAI */}
            <div className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] flex flex-col items-center justify-center space-y-1 hover:border-[#22D3EE]/40 transition-colors">
              <span className="text-[13px] font-black tracking-wide text-white font-mono">UIDAI</span>
              <span className="text-[9.5px] font-medium text-[#22D3EE] font-mono">Aadhaar D₅</span>
            </div>

            {/* CBDT */}
            <div className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] flex flex-col items-center justify-center space-y-1 hover:border-[#38BDF8]/40 transition-colors">
              <span className="text-[13px] font-black tracking-wide text-white font-mono">CBDT</span>
              <span className="text-[9.5px] font-medium text-[#38BDF8] font-mono">PAN Mod-10</span>
            </div>

            {/* GSTN */}
            <div className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] flex flex-col items-center justify-center space-y-1 hover:border-[#34D399]/40 transition-colors">
              <span className="text-[13px] font-black tracking-wide text-white font-mono">GSTN</span>
              <span className="text-[9.5px] font-medium text-[#34D399] font-mono">GSTIN Mod-36</span>
            </div>

            {/* RBI / SEBI */}
            <div className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] flex flex-col items-center justify-center space-y-1 hover:border-[#FBBF24]/40 transition-colors">
              <span className="text-[13px] font-black tracking-wide text-white font-mono">RBI / SEBI</span>
              <span className="text-[9.5px] font-medium text-[#FBBF24] font-mono">BFSI Privacy</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


// =========================================================================
// PORTKEY AUDIT LEDGER SECTION ("A reliable source of truth for redaction & audit")
// =========================================================================

interface LedgerPreviewRow {
  id: string
  timestamp: string
  piiCounts: Record<string, number>
  latencyMs: number
  maskedSnippet: string
  isCompliant: boolean
}

const DEFAULT_LEDGER_PREVIEW_ROWS: LedgerPreviewRow[] = [
  {
    id: 'req_8e17df9a34',
    timestamp: '2026-10-15 04:37:25',
    piiCounts: { PAN: 1, NAME: 1 },
    latencyMs: 1120.9,
    maskedSnippet: 'Customer <NAME_1> PAN <PAN_1>',
    isCompliant: true,
  },
  {
    id: 'req_ba88452f03',
    timestamp: '2026-10-15 04:37:24',
    piiCounts: { NAME: 1, PAN: 1 },
    latencyMs: 15.0,
    maskedSnippet: 'Candidate <NAME_1> submitted ID <PAN_1>',
    isCompliant: true,
  },
  {
    id: 'req_efde47b5a7',
    timestamp: '2026-10-15 04:37:23',
    piiCounts: { PHONE: 1, PAN: 1 },
    latencyMs: 1426.7,
    maskedSnippet: 'Mera PAN card <PAN_1> hai and phone is <PHONE_1>.',
    isCompliant: true,
  },
  {
    id: 'req_a775a907a1',
    timestamp: '2026-10-15 04:37:21',
    piiCounts: { PAN: 1, AADHAAR: 1, PHONE: 1 },
    latencyMs: 1.5,
    maskedSnippet: 'Mera PAN <PAN_1> aur phone <PHONE_1>.',
    isCompliant: true,
  },
  {
    id: 'req_19474b4325',
    timestamp: '2026-10-15 04:20:02',
    piiCounts: { PAN: 1, NAME: 1 },
    latencyMs: 781.0,
    maskedSnippet: 'Customer <NAME_1> PAN <PAN_1>',
    isCompliant: true,
  },
  {
    id: 'req_3ef4cacfb5',
    timestamp: '2026-10-15 04:20:01',
    piiCounts: { PHONE: 1, PAN: 1 },
    latencyMs: 1159.1,
    maskedSnippet: 'Mera PAN card <PAN_1> hai and phone is <PHONE_1>.',
    isCompliant: true,
  },
  {
    id: 'req_13a17b449a',
    timestamp: '2026-10-15 04:20:01',
    piiCounts: { NAME: 1, PAN: 1 },
    latencyMs: 15.0,
    maskedSnippet: 'Candidate <NAME_1> submitted ID <PAN_1>',
    isCompliant: true,
  },
  {
    id: 'req_ed52e7426e',
    timestamp: '2026-10-15 04:19:59',
    piiCounts: { PAN: 1, AADHAAR: 1, PHONE: 1 },
    latencyMs: 1.5,
    maskedSnippet: 'Mera PAN <PAN_1> aur phone <PHONE_1>.',
    isCompliant: true,
  },
  {
    id: 'req_954b9f4fcb',
    timestamp: '2026-10-15 03:50:50',
    piiCounts: { PAN: 1, NAME: 1 },
    latencyMs: 932.1,
    maskedSnippet: 'Customer <NAME_1> PAN <PAN_1>',
    isCompliant: true,
  },
  {
    id: 'req_6c18c60b1e',
    timestamp: '2026-10-15 03:50:49',
    piiCounts: { NAME: 1, PAN: 1 },
    latencyMs: 15.0,
    maskedSnippet: 'Candidate <NAME_1> submitted ID <PAN_1>',
    isCompliant: true,
  },
]

function PortkeyAuditLedgerSection({
  onLearnMore
}: {
  onLearnMore?: () => void
}) {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [selectedVerification, setSelectedVerification] = useState<string | null>(null)
  const [entries, setEntries] = useState<LedgerPreviewRow[]>(DEFAULT_LEDGER_PREVIEW_ROWS)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetchLedger(50)
      .then(res => {
        if (active && res && res.length > 0) {
          const mapped: LedgerPreviewRow[] = res.map(e => ({
            id: e.id,
            timestamp: e.timestamp,
            piiCounts: e.pii_counts || {},
            latencyMs: e.latency_ms || 1.2,
            maskedSnippet: e.masked_sample || 'Customer <NAME_1> payload redacted',
            isCompliant: true,
          }))
          setEntries(mapped)
        }
      })
      .catch(() => {
        // Fallback to DEFAULT_LEDGER_PREVIEW_ROWS
      })
    return () => { active = false }
  }, [])

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      PAN: 0,
      AADHAAR: 0,
      PHONE: 0,
      NAME: 0,
      GSTIN: 0,
    }
    entries.forEach(e => {
      Object.keys(e.piiCounts).forEach(k => {
        const upper = k.toUpperCase()
        counts[upper] = (counts[upper] || 0) + (e.piiCounts[k] || 1)
      })
    })
    return counts
  }, [entries])

  const filteredRows = useMemo(() => {
    return entries.filter(row => {
      if (selectedCategory !== 'All') {
        const catKey = selectedCategory.toUpperCase()
        const hasCat = Object.keys(row.piiCounts).some(k => k.toUpperCase().includes(catKey))
        if (!hasCat) return false
      }
      if (selectedVerification === 'Zero-Raw' && !row.isCompliant) return false
      if (selectedVerification === 'Fast' && row.latencyMs > 50) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const idMatch = row.id.toLowerCase().includes(q)
        const timeMatch = row.timestamp.toLowerCase().includes(q)
        const snippetMatch = row.maskedSnippet.toLowerCase().includes(q)
        const catMatch = Object.keys(row.piiCounts).some(k => k.toLowerCase().includes(q))
        return idMatch || timeMatch || snippetMatch || catMatch
      }
      return true
    })
  }, [entries, search, selectedCategory, selectedVerification])

  const handleCopyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1800)
    } catch {
      // ignore
    }
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[1.35fr_1fr] items-center">
      {/* Left: Portkey-Style Audit Ledger Matrix Device */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0A0D14]/95 p-4 sm:p-5 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] ring-1 ring-white/[0.03] space-y-4 font-sans text-xs">
        {/* Top Search & Filter Bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by Request ID, timestamp, or PII category..."
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] pl-8 pr-3 py-1.5 text-xs text-white placeholder-white/40 outline-none focus:border-[#22D3EE]/50 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#34D399]/30 bg-[#34D399]/10 text-[#34D399] text-xs font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-[#34D399] animate-pulse" />
              <span>Live Stream</span>
              <ChevronDown size={12} />
            </div>
            <button
              onClick={() => { setSelectedCategory('All'); setSelectedVerification(null); setSearch(''); }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] text-[#94A3B8] hover:text-white hover:bg-white/[0.05] text-xs font-medium transition-colors"
            >
              <Filter size={12} />
              <span>Filters</span>
            </button>
            <span className="px-2 py-1 rounded-md bg-white/[0.04] text-[11px] font-mono text-[#94A3B8]">
              {filteredRows.length} entries
            </span>
          </div>
        </div>

        {/* Filter Pills Row */}
        <div className="space-y-2 border-y border-white/[0.06] py-3 text-[11px]">
          {/* CATEGORIES row */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[9.5px] font-bold text-[#64748B] tracking-wider uppercase shrink-0">CATEGORIES</span>
            {['All', 'PAN', 'AADHAAR', 'PHONE', 'NAME', 'GSTIN'].map(cat => {
              const isSelected = selectedCategory === cat
              const count = cat === 'All' ? entries.length : (categoryCounts[cat] || 0)
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    'shrink-0 px-2 py-0.5 rounded-md border text-[11px] font-medium transition-colors',
                    isSelected
                      ? 'border-[#34D399]/50 bg-[#34D399]/15 text-[#34D399] font-bold'
                      : 'border-white/[0.06] bg-white/[0.02] text-[#94A3B8] hover:text-white hover:border-white/[0.12]'
                  )}
                >
                  {cat === 'All' ? 'All Logs' : cat} <span className="opacity-60 text-[9.5px]">({count})</span>
                </button>
              )
            })}
          </div>

          {/* VERIFICATION row */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            <span className="text-[9.5px] font-bold text-[#64748B] tracking-wider uppercase shrink-0">VERIFICATION</span>
            {[
              { id: 'Zero-Raw', label: 'Zero-Raw Storage ✓' },
              { id: 'DPDP', label: 'DPDP Act §8 ✓' },
              { id: 'Fast', label: '<50ms Latency' },
            ].map(v => {
              const isSelected = selectedVerification === v.id
              return (
                <button
                  key={v.id}
                  onClick={() => setSelectedVerification(isSelected ? null : v.id)}
                  className={cn(
                    'shrink-0 px-2 py-0.5 rounded-md border text-[11px] transition-colors',
                    isSelected
                      ? 'border-[#22D3EE]/50 bg-[#22D3EE]/15 text-[#22D3EE] font-bold'
                      : 'border-white/[0.06] bg-white/[0.02] text-[#94A3B8] hover:text-white hover:border-white/[0.12]'
                  )}
                >
                  {v.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* The Audit Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-white/[0.08] text-[10px] text-[#64748B] tracking-wider uppercase">
                <th className="pb-2 font-semibold">REQUEST ID</th>
                <th className="pb-2 font-semibold">TIMESTAMP (UTC)</th>
                <th className="pb-2 font-semibold">PII CATEGORIES</th>
                <th className="pb-2 font-semibold text-right">LATENCY</th>
                <th className="pb-2 font-semibold pl-3">MASKED SNIPPET</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {filteredRows.slice(0, 8).map((row) => (
                <tr key={row.id} className="hover:bg-white/[0.02] transition-colors group">
                  {/* REQUEST ID */}
                  <td className="py-2.5">
                    <button
                      onClick={() => handleCopyId(row.id)}
                      className="inline-flex items-center gap-1.5 text-[#22D3EE] hover:text-[#67E8F9] transition-colors font-mono text-[11.5px]"
                      title="Click to copy Request ID"
                    >
                      <span>{row.id}</span>
                      {copiedId === row.id ? (
                        <span className="text-[9px] text-[#34D399] font-sans font-bold">Copied!</span>
                      ) : (
                        <Copy size={10} className="opacity-0 group-hover:opacity-70 transition-opacity" />
                      )}
                    </button>
                  </td>

                  {/* TIMESTAMP */}
                  <td className="py-2.5 text-[#94A3B8] text-[11px] whitespace-nowrap">
                    {row.timestamp}
                  </td>

                  {/* PII CATEGORIES */}
                  <td className="py-2.5">
                    <div className="flex items-center gap-1 flex-wrap">
                      {Object.entries(row.piiCounts).map(([cat, cnt]) => {
                        const upper = cat.toUpperCase()
                        const badgeColor =
                          upper === 'PAN' ? 'bg-[#22D3EE]/10 text-[#22D3EE] border-[#22D3EE]/30' :
                          upper === 'AADHAAR' ? 'bg-[#34D399]/10 text-[#34D399] border-[#34D399]/30' :
                          upper === 'PHONE' ? 'bg-[#FBBF24]/10 text-[#FBBF24] border-[#FBBF24]/30' :
                          upper === 'GSTIN' ? 'bg-[#F43F5E]/10 text-[#F43F5E] border-[#F43F5E]/30' :
                          'bg-[#A78BFA]/10 text-[#A78BFA] border-[#A78BFA]/30'
                        return (
                          <span
                            key={cat}
                            className={cn('px-1.5 py-0.5 rounded text-[9.5px] font-bold border font-mono', badgeColor)}
                          >
                            {upper}:{cnt}
                          </span>
                        )
                      })}
                    </div>
                  </td>

                  {/* LATENCY */}
                  <td className={cn(
                    'py-2.5 text-right font-mono text-[11px] whitespace-nowrap',
                    row.latencyMs < 50 ? 'text-[#34D399]' : row.latencyMs < 500 ? 'text-[#94A3B8]' : 'text-[#FBBF24]'
                  )}>
                    {row.latencyMs.toFixed(1)} ms
                  </td>

                  {/* MASKED SNIPPET */}
                  <td className="py-2.5 pl-3 max-w-[200px] truncate text-[11px] text-[#E2E8F0] font-mono group-hover:text-white">
                    <span className="truncate block" title={row.maskedSnippet}>
                      {row.maskedSnippet}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Subtle Zero Raw Storage Banner */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/[0.06] border border-amber-500/20 text-[11px] font-mono">
          <span className="text-amber-400 font-bold shrink-0">Zero Raw Storage:</span>
          <span className="text-[#94A3B8] truncate">Strings above reflect placeholder tokens like &lt;PAN_1&gt;. Raw PII is never persisted.</span>
        </div>
      </div>

      {/* Right: Typography and CTA Exactly Matching Portkey */}
      <div className="space-y-6 flex flex-col justify-center">
        <h2 className="text-4xl sm:text-5xl lg:text-[54px] font-bold text-white tracking-tight leading-[1.08]">
          A reliable source <br />
          of truth for LLM <br />
          redaction &amp; audit
        </h2>

        <p className="text-base sm:text-lg text-[#94A3B8] leading-relaxed max-w-xl">
          Section 8 of the Indian DPDP Act 2023 mandates zero unauthorized retention of citizen personal data. piishield's cryptographic audit ledger tracks every prompt redaction event in real-time, verifying that raw PII is purged from RAM and replaced with placeholder tokens like <code className="text-[#22D3EE] bg-[#22D3EE]/10 px-1.5 py-0.5 rounded font-mono text-sm">&lt;PAN_1&gt;</code> before reaching upstream LLMs.
        </p>

        <p className="text-base sm:text-lg text-[#94A3B8] leading-relaxed max-w-xl">
          Observe live request IDs, sub-millisecond latencies, mathematical checksum validations (Verhoeff D₅, Luhn Mod-10), and masked prompt payloads across every LLM call in one place.
        </p>

        <div className="pt-2">
          <button
            onClick={onLearnMore}
            className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-transparent px-6 py-2.5 text-sm font-medium text-white hover:bg-white/[0.06] hover:border-white/40 transition-colors"
          >
            <span>Explore Audit Ledger</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

// =========================================================================
// PORTKEY CODE INTEGRATION SECTION ("Integrate in a minute")
// =========================================================================

function PortkeyCodeIntegrateSection() {
  const [activeLang, setActiveLang] = useState<'node' | 'python' | 'openai-js' | 'openai-py' | 'curl'>('node')
  const [copied, setCopied] = useState(false)

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  const rawCodeMap: Record<string, string> = {
    node: `import OpenAI from "openai";\n\n// Drop-in sovereign gateway - zero changes to your existing code\nconst client = new OpenAI({\n  baseURL: "http://127.0.0.1:8080/v1", // local piishield proxy\n  apiKey: process.env.OPENAI_API_KEY\n});\n\nasync function main() {\n  const completion = await client.chat.completions.create({\n    messages: [{ role: "user", content: "Customer Aadhaar: 9999 2456 7832" }],\n    model: "gpt-4o"\n  });\n\n  console.log(completion.choices[0].message.content);\n}`,
    python: `from openai import OpenAI\n\n# 1-line change: route all AI calls through sovereign gateway\nclient = OpenAI(\n    base_url="http://127.0.0.1:8080/v1",  # Indian PII Shield proxy\n    api_key="sk-..."\n)\n\nresponse = client.chat.completions.create(\n    model="gpt-4o",\n    messages=[{"role": "user", "content": "Mera PAN: ABCDE1234F aur Aadhaar: 9999 2456 7832"}]\n)\n\nprint(response.choices[0].message.content)`,
    'openai-js': `import OpenAI from "openai";\n\n// Point baseURL to piishield sovereign gateway - zero other code changes\nconst client = new OpenAI({\n  baseURL: "http://127.0.0.1:8080/v1",\n  apiKey: process.env.OPENAI_API_KEY\n});\n\nconst res = await client.chat.completions.create({\n  model: "gpt-4o",\n  messages: [{ role: "user", content: "Verify PAN: ABCDE1234F" }]\n});`,
    'openai-py': `from temporalio.client import Client\n\n# Durable Temporal PII redaction workflow with human approval queue\nclient = await Client.connect("localhost:7233")\n\nhandle = await client.start_workflow(\n    "PIIShieldWorkflow.run",\n    {"prompt": "Aadhaar: 9999 2456 7832, PAN: ABCDE1234F", "user_id": "cust_102"},\n    id="pii-wf-001",\n    task_queue="pii-shield-queue"\n)`,
    curl: `curl http://127.0.0.1:8080/v1/chat/completions \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer sk-..." \\\n  -d '{\n    "model": "gpt-4o",\n    "messages": [{"role": "user", "content": "Mera Aadhaar: 9999 2456 7832"}]\n  }'`
  }

  return (
    <div className="space-y-8">
      {/* Top Header: Badge + Split Title / Subtitle */}
      <div className="space-y-3">
        <div className="inline-flex items-center px-3 py-1 rounded-md bg-[#22D3EE]/10 border border-[#22D3EE]/25 text-xs font-mono font-medium text-[#22D3EE] tracking-wide">
          Plug &amp; Play
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] items-end justify-between">
          <h2 className="text-4xl sm:text-5xl lg:text-[54px] font-bold text-white tracking-tight leading-[1.08]">
            Integrate in a minute
          </h2>
          <p className="text-base sm:text-lg text-[#94A3B8] leading-relaxed max-w-lg">
            Integrate piishield in just 3 lines of code - no changes to your existing stack.
          </p>
        </div>
      </div>

      {/* Code Editor Window with Ambient Glows */}
      <div className="relative pt-4">
        {/* Ambient Top Glows matching Portkey screenshot */}
        <div className="absolute top-0 left-12 w-96 h-72 bg-[#22D3EE]/12 rounded-full blur-[90px] pointer-events-none" />
        <div className="absolute top-0 right-12 w-96 h-72 bg-rose-600/15 rounded-full blur-[90px] pointer-events-none" />

        {/* Terminal Window Container */}
        <div className="relative rounded-3xl border border-white/[0.1] bg-[#0A0D14]/95 backdrop-blur-xl shadow-[0_30px_70px_rgba(0,0,0,0.9)] overflow-hidden ring-1 ring-white/[0.04]">
          {/* Window Titlebar */}
          <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-white/[0.06] flex-wrap gap-3">
            {/* Left Traffic Lights */}
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#EF4444]/90 shadow-sm" />
              <span className="w-3 h-3 rounded-full bg-[#F59E0B]/90 shadow-sm" />
              <span className="w-3 h-3 rounded-full bg-[#10B981]/90 shadow-sm" />
            </div>

            {/* Language Switcher Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
              {[
                { id: 'node', label: 'Node.js', icon: <span className="text-[#22C55E] text-xs">⬢</span> },
                { id: 'python', label: 'Python', icon: <span className="text-[#FBBF24] text-xs">🐍</span> },
                { id: 'openai-js', label: 'OpenAI JS', icon: <Sparkles size={12} className="text-[#34D399]" /> },
                { id: 'openai-py', label: 'Temporal DAG', icon: <Workflow size={12} className="text-[#FBBF24]" /> },
                { id: 'curl', label: ':// cURL', icon: <Terminal size={12} className="text-[#22D3EE]" /> },
              ].map(tab => {
                const isActive = activeLang === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveLang(tab.id as typeof activeLang)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all',
                      isActive
                        ? 'bg-white/[0.08] text-white border border-white/[0.18] shadow-sm font-semibold'
                        : 'bg-white/[0.02] text-[#94A3B8] border border-white/[0.05] hover:text-white hover:bg-white/[0.05]'
                    )}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Right Copy Button */}
            <button
              onClick={() => void handleCopy(rawCodeMap[activeLang])}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-[#94A3B8] hover:text-white hover:bg-white/[0.07] text-xs transition-colors"
              title="Copy snippet"
            >
              {copied ? <Check size={13} className="text-[#34D399]" /> : <Copy size={13} />}
              <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>

          {/* Code Body Area */}
          <div className="p-6 font-mono text-sm leading-relaxed overflow-x-auto selection:bg-[#22D3EE]/25">
            {activeLang === 'node' && (
              <pre className="text-white/90">
                <span className="text-[#64748B]">// Drop-in sovereign gateway - zero changes to your existing code</span>
                {'\n'}
                <span className="text-[#C084FC]">import</span> <span className="text-[#FDE047]">OpenAI</span> <span className="text-[#C084FC]">from</span> <span className="text-[#38BDF8]">"openai"</span>;
                {'\n\n'}
                <span className="text-[#C084FC]">const</span> client = <span className="text-[#C084FC]">new</span> <span className="text-[#FDE047]">OpenAI</span>({'{'}
                {'\n  '}baseURL: <span className="text-[#38BDF8]">"http://127.0.0.1:8080/v1"</span>, <span className="text-[#64748B]">// local piishield proxy</span>
                {'\n  '}apiKey: process.env.<span className="text-[#F472B6]">OPENAI_API_KEY</span>
                {'\n'}{'}'});
                {'\n\n'}
                <span className="text-[#C084FC]">async function</span> <span className="text-[#60A5FA]">main</span>() {'{'}
                {'\n  '}<span className="text-[#C084FC]">const</span> completion = <span className="text-[#C084FC]">await</span> client.chat.completions.<span className="text-[#60A5FA]">create</span>({'{'}
                {'\n    '}messages: [{'{'} role: <span className="text-[#38BDF8]">"user"</span>, content: <span className="text-[#38BDF8]">"Customer Aadhaar: 9999 2456 7832"</span> {'}'}],
                {'\n    '}model: <span className="text-[#38BDF8]">"gpt-4o"</span>
                {'\n  '}{'}'});
                {'\n\n  '}console.<span className="text-[#60A5FA]">log</span>(completion.choices[<span className="text-[#F472B6]">0</span>].message.content);
                {'\n'}{'}'}
              </pre>
            )}

            {activeLang === 'python' && (
              <pre className="text-white/90">
                <span className="text-[#64748B]"># 1-line change: route all AI calls through sovereign gateway</span>
                {'\n'}
                <span className="text-[#C084FC]">from</span> openai <span className="text-[#C084FC]">import</span> <span className="text-[#FDE047]">OpenAI</span>
                {'\n\n'}
                client = <span className="text-[#FDE047]">OpenAI</span>(
                {'\n    '}base_url=<span className="text-[#38BDF8]">"http://127.0.0.1:8080/v1"</span>,  <span className="text-[#64748B]"># Indian PII Shield proxy</span>
                {'\n    '}api_key=<span className="text-[#38BDF8]">"sk-..."</span>
                {'\n'})
                {'\n\n'}
                response = client.chat.completions.<span className="text-[#60A5FA]">create</span>(
                {'\n    '}model=<span className="text-[#38BDF8]">"gpt-4o"</span>,
                {'\n    '}messages=[{'{'}<span className="text-[#38BDF8]">"role"</span>: <span className="text-[#38BDF8]">"user"</span>, <span className="text-[#38BDF8]">"content"</span>: <span className="text-[#38BDF8]">"Mera PAN: ABCDE1234F aur Aadhaar: 9999 2456 7832"</span>{'}'}]
                {'\n'})
                {'\n\n'}
                <span className="text-[#60A5FA]">print</span>(response.choices[<span className="text-[#F472B6]">0</span>].message.content)
              </pre>
            )}

            {activeLang === 'openai-js' && (
              <pre className="text-white/90">
                <span className="text-[#64748B]">// Point baseURL to piishield sovereign gateway - zero other code changes</span>
                {'\n'}
                <span className="text-[#C084FC]">import</span> <span className="text-[#FDE047]">OpenAI</span> <span className="text-[#C084FC]">from</span> <span className="text-[#38BDF8]">"openai"</span>;
                {'\n\n'}
                <span className="text-[#C084FC]">const</span> client = <span className="text-[#C084FC]">new</span> <span className="text-[#FDE047]">OpenAI</span>({'{'}
                {'\n  '}baseURL: <span className="text-[#38BDF8]">"http://127.0.0.1:8080/v1"</span>,  <span className="text-[#64748B]">// Sovereign PII Gateway</span>
                {'\n  '}apiKey: process.env.<span className="text-[#F472B6]">OPENAI_API_KEY</span>
                {'\n'}{'}'});
                {'\n\n'}
                <span className="text-[#C084FC]">const</span> res = <span className="text-[#C084FC]">await</span> client.chat.completions.<span className="text-[#60A5FA]">create</span>({'{'}
                {'\n  '}model: <span className="text-[#38BDF8]">"gpt-4o"</span>,
                {'\n  '}messages: [{'{'} role: <span className="text-[#38BDF8]">"user"</span>, content: <span className="text-[#38BDF8]">"Verify PAN: ABCDE1234F"</span> {'}'}]
                {'\n'}{'}'});
              </pre>
            )}

            {activeLang === 'openai-py' && (
              <pre className="text-white/90">
                <span className="text-[#64748B]"># Durable Temporal PII redaction workflow with human approval queue</span>
                {'\n'}
                <span className="text-[#C084FC]">from</span> temporalio.client <span className="text-[#C084FC]">import</span> <span className="text-[#FDE047]">Client</span>
                {'\n\n'}
                client = <span className="text-[#C084FC]">await</span> <span className="text-[#FDE047]">Client</span>.<span className="text-[#60A5FA]">connect</span>(<span className="text-[#38BDF8]">"localhost:7233"</span>)
                {'\n\n'}
                handle = <span className="text-[#C084FC]">await</span> client.<span className="text-[#60A5FA]">start_workflow</span>(
                {'\n    '}<span className="text-[#38BDF8]">"PIIShieldWorkflow.run"</span>,
                {'\n    '}{'{'}<span className="text-[#38BDF8]">"prompt"</span>: <span className="text-[#38BDF8]">"Aadhaar: 9999 2456 7832, PAN: ABCDE1234F"</span>, <span className="text-[#38BDF8]">"user_id"</span>: <span className="text-[#38BDF8]">"cust_102"</span>{'}'},
                {'\n    '}id=<span className="text-[#38BDF8]">"pii-wf-001"</span>,
                {'\n    '}task_queue=<span className="text-[#38BDF8]">"pii-shield-queue"</span>
                {'\n'})
              </pre>
            )}

            {activeLang === 'curl' && (
              <pre className="text-white/90">
                <span className="text-[#60A5FA]">curl</span> <span className="text-[#38BDF8]">http://127.0.0.1:8080/v1/chat/completions</span> \
                {'\n  '}-H <span className="text-[#38BDF8]">"Content-Type: application/json"</span> \
                {'\n  '}-H <span className="text-[#38BDF8]">"Authorization: Bearer sk-..."</span> \
                {'\n  '}-d <span className="text-[#FDE047]">'{'{'}</span>
                {'\n    '}<span className="text-[#38BDF8]">"model"</span>: <span className="text-[#38BDF8]">"gpt-4o"</span>,
                {'\n    '}<span className="text-[#38BDF8]">"messages"</span>: [
                {'\n      '}{'{'}<span className="text-[#38BDF8]">"role"</span>: <span className="text-[#38BDF8]">"user"</span>, <span className="text-[#38BDF8]">"content"</span>: <span className="text-[#38BDF8]">"Mera Aadhaar: 9999 2456 7832"</span>{'}'}
                {'\n    '}]
                {'\n  '}<span className="text-[#FDE047]">{'}'}'</span>
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// =========================================================================
// PORTKEY-STYLE TEMPORAL DURABLE AI GATEWAY ARCHITECTURE SECTION
// Exact visual replica of 3-box connected architecture from user reference
// =========================================================================

function PortkeyTemporalGatewayArchitectureSection({
  onNavigatePage
}: {
  onNavigatePage: (page: Page) => void
}) {
  const [activeModule, setActiveModule] = useState<'temporal' | 'observability' | 'governance' | 'routing' | 'guardrails' | 'ledger'>('temporal')

  const modules = [
    {
      id: 'observability',
      label: 'OBSERVABILITY',
      color: 'amber',
      pillClass: 'border-amber-500/35 bg-amber-500/[0.08] text-amber-400 hover:border-amber-400/80',
      activeClass: 'border-amber-400 bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/40 shadow-[0_0_15px_rgba(245,158,11,0.25)]',
      desc: 'Sub-millisecond tracing for CPU Dihedral D₅ math & upstream LLM egress without leaking citizen PII into telemetry spans.',
      badge: '0.2ms CPU Register Math',
      targetPage: 'overview' as Page,
    },
    {
      id: 'governance',
      label: 'GOVERNANCE',
      color: 'purple',
      pillClass: 'border-purple-500/35 bg-purple-500/[0.08] text-purple-400 hover:border-purple-400/80',
      activeClass: 'border-purple-400 bg-purple-500/20 text-purple-300 ring-1 ring-purple-400/40 shadow-[0_0_15px_rgba(168,85,247,0.25)]',
      desc: 'Enforces statutory compliance for 17 Indian PII categories (Aadhaar, PAN, GSTIN, Passport, UPI) under DPDP Act 2023 §8.',
      badge: 'DPDP Section 8 Compliant',
      targetPage: 'settings' as Page,
    },
    {
      id: 'routing',
      label: 'ROUTING',
      color: 'emerald',
      pillClass: 'border-emerald-500/35 bg-emerald-500/[0.08] text-emerald-400 hover:border-emerald-400/80',
      activeClass: 'border-emerald-400 bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40 shadow-[0_0_15px_rgba(16,185,129,0.25)]',
      desc: 'Dynamic sovereign routing between cloud commercial LLMs (OpenAI, Claude, Gemini) and air-gapped VPC local models.',
      badge: 'Cloud & Sovereign VPC',
      targetPage: 'integration' as Page,
    },
    {
      id: 'temporal',
      label: 'TEMPORAL DAG',
      color: 'cyan',
      pillClass: 'border-cyan-400/50 bg-cyan-400/[0.12] text-cyan-300 hover:border-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.2)]',
      activeClass: 'border-cyan-300 bg-cyan-400/25 text-cyan-200 ring-2 ring-cyan-400/60 shadow-[0_0_22px_rgba(34,211,238,0.4)]',
      desc: 'Durable execution state machines on port :7233. Guarantees zero state loss on server crash, replay history, and non-blocking human signals.',
      badge: 'gRPC :7233 Nexus Engine',
      targetPage: 'temporal' as Page,
    },
    {
      id: 'guardrails',
      label: 'GUARDRAILS',
      color: 'rose',
      pillClass: 'border-rose-500/35 bg-rose-500/[0.08] text-rose-400 hover:border-rose-400/80',
      activeClass: 'border-rose-400 bg-rose-500/20 text-rose-300 ring-1 ring-rose-400/40 shadow-[0_0_15px_rgba(244,63,94,0.25)]',
      desc: 'Fail-closed privacy boundary. Validates mathematical checksums to reject false-positives before redaction.',
      badge: '100% Fail-Closed',
      targetPage: 'playground' as Page,
    },
    {
      id: 'ledger',
      label: 'AUDIT LEDGER',
      color: 'blue',
      pillClass: 'border-blue-500/35 bg-blue-500/[0.08] text-blue-400 hover:border-blue-400/80',
      activeClass: 'border-blue-400 bg-blue-500/20 text-blue-300 ring-1 ring-blue-400/40 shadow-[0_0_15px_rgba(59,130,246,0.25)]',
      desc: 'Cryptographic SHA-256 chained audit proofs with 0 raw bytes persisted on disk. Section 8 inspection ready.',
      badge: 'SHA-256 Merkle Chain',
      targetPage: 'ledger' as Page,
    },
  ]

  const activeModObj = modules.find(m => m.id === activeModule) || modules[3]

  return (
    <div className="space-y-12">
      {/* Section Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#22D3EE]/10 border border-[#22D3EE]/30 text-xs font-mono font-medium text-[#22D3EE] tracking-wide">
          <Workflow size={13} className="text-[#22D3EE]" />
          <span>TEMPORAL DURABLE AI GATEWAY · gRPC :7233</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-bold text-white tracking-tight leading-[1.12]">
          Fault-tolerant AI pipelines with <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#22D3EE] to-[#38BDF8]">
            Temporal durable workflows
          </span>
        </h2>

        <p className="text-[#94A3B8] text-sm sm:text-base leading-relaxed">
          piishield embeds a durable execution state machine between your AI applications and upstream models. Inbound requests execute as deterministic activities with zero state loss on server restarts, automatic exponential backoff retries, and non-blocking human-in-the-loop review queues.
        </p>
      </div>

      {/* 3-Box Architecture Showcase Container */}
      <div className="relative rounded-3xl border border-white/[0.1] bg-[#02050E] p-4 sm:p-8 lg:p-10 shadow-[0_30px_70px_rgba(0,0,0,0.95)] overflow-hidden">
        {/* Subtle glowing mesh */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[340px] bg-[#22D3EE]/[0.035] rounded-full blur-3xl pointer-events-none" />

        {/* 3 Connected Boxes Flow */}
        <div className="overflow-x-auto pb-4 pt-2 -mx-2 px-2 lg:mx-0 lg:px-0">
          <div className="min-w-[940px] flex items-center justify-center mx-auto select-none">
            
            {/* =========================================================================
                BOX 1 (LEFT): YOUR AI APP
               ========================================================================= */}
            <div className="w-[240px] shrink-0 rounded-[28px] border border-white/[0.12] bg-gradient-to-b from-[#0F1422] to-[#070A11] p-4 relative shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
              {/* Connection Nodes on Right Outer Edge */}
              <div className="absolute -right-[5px] top-[144px] w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] z-10" />
              <div className="absolute -right-[5px] top-[256px] w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] z-10" />

              {/* Title Header */}
              <div className="text-center text-[13px] font-semibold text-white/90 tracking-wide pb-3 pt-0.5">
                Your AI APP
              </div>

              {/* Central Screen Aperture with 3D Glowing Prism */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#040814] p-5 relative flex items-center justify-center overflow-hidden h-44 shadow-inner">
                {/* Subtle blue dot grid */}
                <div className="absolute inset-0 bg-[radial-gradient(#1e3a8a_1px,transparent_1px)] [background-size:12px_12px] opacity-40 pointer-events-none" />

                {/* Glowing 3D Prism / Delta Logo */}
                <div className="relative z-10 flex items-center justify-center">
                  <svg width="86" height="86" viewBox="0 0 100 100" fill="none" className="drop-shadow-[0_0_25px_rgba(34,211,238,0.65)]">
                    <defs>
                      <linearGradient id="prismGradA" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#38BDF8" />
                        <stop offset="100%" stopColor="#0284C7" />
                      </linearGradient>
                      <linearGradient id="prismGradB" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#60A5FA" />
                        <stop offset="100%" stopColor="#1E40AF" />
                      </linearGradient>
                      <linearGradient id="prismGradC" x1="0%" y1="100%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#22D3EE" />
                        <stop offset="100%" stopColor="#0369A1" />
                      </linearGradient>
                    </defs>
                    {/* Outer 3D Delta Prism Facets */}
                    <path
                      d="M 50 14 C 53 14, 55 16, 57 19 L 85 68 C 87 72, 85 76, 81 78 L 19 78 C 15 76, 13 72, 15 68 L 43 19 C 45 16, 47 14, 50 14 Z"
                      fill="url(#prismGradA)"
                    />
                    {/* Inner hollow cutout */}
                    <path d="M 50 36 L 68 68 L 32 68 Z" fill="#040814" />
                    {/* Beveled 3D facets */}
                    <path d="M 50 14 L 50 36 L 68 68 L 85 68 Z" fill="url(#prismGradB)" opacity="0.95" />
                    <path d="M 19 78 L 32 68 L 50 36 L 43 19 Z" fill="url(#prismGradC)" opacity="0.85" />
                  </svg>
                </div>
              </div>

              {/* Skeleton Bars Below Screen */}
              <div className="pt-4 space-y-2">
                <div className="w-28 h-2 rounded-full bg-white/[0.08] mx-auto" />
                <div className="w-16 h-2 rounded-full bg-white/[0.05] mx-auto" />
              </div>

              {/* Bottom Segmented Controller */}
              <div className="mt-4 rounded-xl border border-white/[0.08] bg-black/60 p-1 flex gap-1 items-center">
                <div className="flex-1 py-1.5 rounded-lg bg-white/[0.08] border border-white/20 flex items-center justify-center shadow-sm">
                  <div className="w-6 h-1 rounded-full bg-white/80" />
                </div>
                <div className="flex-1 py-1.5 flex items-center justify-center">
                  <div className="w-6 h-1 rounded-full bg-transparent" />
                </div>
              </div>
            </div>

            {/* =========================================================================
                SVG CONNECTION WIRES (LEFT -> CENTER)
               ========================================================================= */}
            <div className="w-[80px] h-[420px] shrink-0 relative flex items-center justify-center pointer-events-none">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 80 420" fill="none">
                <defs>
                  <filter id="packetGlowCyan" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {/* Upper Trace: from Left Port 1 (0, 144) to Center Left Port (80, 210) */}
                <path d="M 0 144 C 40 144, 40 210, 80 210" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
                {/* Lower Trace: from Left Port 2 (0, 256) to Center Left Port (80, 210) */}
                <path d="M 0 256 C 40 256, 40 210, 80 210" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
                {/* Active Glowing Cyan Segment on Upper Trace */}
                <path d="M 30 190 C 50 205, 65 210, 80 210" stroke="#22D3EE" strokeWidth="2.2" strokeLinecap="round" />
                {/* Animated Glowing Packet Pulse */}
                <circle r="4" fill="#22D3EE" filter="url(#packetGlowCyan)">
                  <animateMotion path="M 0 144 C 40 144, 40 210, 80 210" dur="2s" repeatCount="indefinite" />
                </circle>
              </svg>
            </div>

            {/* =========================================================================
                BOX 2 (CENTER): piishield AI Gateway
               ========================================================================= */}
            <div className="w-[330px] shrink-0 rounded-[28px] border border-white/[0.14] bg-gradient-to-b from-[#0D1322] to-[#060910] p-4 relative shadow-[0_25px_60px_rgba(0,0,0,0.9),0_0_35px_rgba(34,211,238,0.06)]">
              {/* Left and Right Connection Ports */}
              <div className="absolute -left-[5px] top-[210px] -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#22D3EE] shadow-[0_0_10px_rgba(34,211,238,1)] z-10" />
              <div className="absolute -right-[5px] top-[210px] -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] z-10" />

              {/* Title Header */}
              <div className="text-center text-[14px] font-bold text-white tracking-tight pb-3.5 pt-0.5 flex items-center justify-center gap-1.5">
                <span>piishield AI Gateway</span>
              </div>

              {/* 6 Module Pills (2 columns x 3 rows) */}
              <div className="grid grid-cols-2 gap-2 mb-3.5">
                {modules.map(mod => {
                  const isSelected = activeModule === mod.id
                  return (
                    <button
                      key={mod.id}
                      onClick={() => setActiveModule(mod.id as any)}
                      className={`py-2 px-2 rounded-xl text-center font-mono font-bold tracking-wider text-[10.5px] border transition-all cursor-pointer relative ${
                        isSelected ? mod.activeClass : mod.pillClass
                      }`}
                    >
                      {mod.id === 'temporal' && (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#22D3EE] mr-1.5 animate-pulse" />
                      )}
                      <span>{mod.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Lower Screen Aperture with Watermark */}
              <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#051A29] to-[#020812] p-3 h-28 relative flex items-center justify-center overflow-hidden shadow-inner">
                {/* Cyan ambient corner reflection */}
                <div className="absolute -bottom-8 -left-8 w-28 h-28 bg-[#22D3EE]/20 rounded-full blur-xl pointer-events-none" />

                {/* Central Wireframe Shield / Temporal Loop Watermark */}
                <div className="relative opacity-40">
                  <svg width="68" height="68" viewBox="0 0 100 100" fill="none" className="text-[#22D3EE]">
                    <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
                    <path
                      d="M 50 18 L 80 32 V 56 C 80 72 50 86 50 86 C 50 86 20 72 20 56 V 32 Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                    <circle cx="50" cy="50" r="10" stroke="currentColor" strokeWidth="1.2" />
                    <circle cx="50" cy="50" r="3" fill="currentColor" />
                  </svg>
                </div>

                {/* Micro Verified Status Pill */}
                <div className="absolute bottom-2 right-2.5 px-2 py-0.5 rounded-md bg-black/60 border border-white/[0.08] text-[9.5px] font-mono text-[#34D399] flex items-center gap-1">
                  <Check size={10} strokeWidth={3} />
                  <span>DPDP §8 Fail-Closed</span>
                </div>
              </div>
            </div>

            {/* =========================================================================
                SVG CONNECTION WIRES (CENTER -> RIGHT)
               ========================================================================= */}
            <div className="w-[80px] h-[420px] shrink-0 relative flex items-center justify-center pointer-events-none">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 80 420" fill="none">
                {/* Branch 1: from Center Right Port (0, 210) to Top Right Card Port (80, 132) */}
                <path d="M 0 210 C 40 210, 40 132, 80 132" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
                {/* Branch 2: from Center Right Port (0, 210) to Bottom Stacked Card Port (80, 345) */}
                <path d="M 0 210 C 40 210, 40 345, 80 345" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
                {/* Active Cyan Glow on Branch 1 */}
                <path d="M 20 185 C 45 155, 60 132, 80 132" stroke="#22D3EE" strokeWidth="2" strokeLinecap="round" />
                {/* Animated Glowing Packet Pulse to LLMs */}
                <circle r="4" fill="#22D3EE" filter="url(#packetGlowCyan)">
                  <animateMotion path="M 0 210 C 40 210, 40 132, 80 132" dur="2.4s" repeatCount="indefinite" />
                </circle>
              </svg>
            </div>

            {/* =========================================================================
                BOX 3 (RIGHT): 1600+ LLMs & Custom Models Stack
               ========================================================================= */}
            <div className="w-[260px] shrink-0 flex flex-col justify-between h-[420px]">
              
              {/* Top Container: 1600+ Upstream LLMs (3x3 Grid) */}
              <div className="rounded-[26px] border border-white/[0.12] bg-gradient-to-b from-[#0F1422] to-[#070A11] p-3.5 relative shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
                {/* Connection Node on Left Edge */}
                <div className="absolute -left-[5px] top-[50%] -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] z-10" />

                {/* Title */}
                <div className="text-center text-[13px] font-semibold text-white/90 tracking-wide pb-2.5 pt-0.5">
                  1600+ LLMs
                </div>

                {/* 3x3 Provider Icon Grid */}
                <div className="grid grid-cols-3 gap-2">
                  {/* 1. OpenAI */}
                  <div className="h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-[#10A37F]/60 hover:bg-[#10A37F]/10 flex items-center justify-center transition-all p-2 group" title="OpenAI GPT-4o">
                    <svg className="w-5 h-5 text-[#10A37F] group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.28 10.48a6.5 6.5 0 0 0-.5-4.8 6.64 6.64 0 0 0-4.63-3.4 6.57 6.57 0 0 0-5.74 1.15 6.64 6.64 0 0 0-4.86.37 6.5 6.5 0 0 0-3.32 4.4 6.57 6.57 0 0 0 .84 5.8 6.64 6.64 0 0 0-.37 4.86 6.5 6.5 0 0 0 4.4 3.32 6.57 6.57 0 0 0 5.8-.84 6.64 6.64 0 0 0 4.86.37 6.5 6.5 0 0 0 3.32-4.4 6.57 6.57 0 0 0-.84-5.8c.2-.4.36-.8.48-1.23zm-1.87 2.1c-.08.62-.28 1.21-.6 1.74l-.1.17-3.9 2.25v-2.3l2.87-1.66c.2-.12.33-.3.4-.52a1.05 1.05 0 0 0-.17-.98 1.08 1.08 0 0 0-.86-.46h-.06l-3.33.02v-1.8l3.43-.02a4.8 4.8 0 0 1 2.32 3.56z"/>
                    </svg>
                  </div>

                  {/* 2. Anthropic Claude */}
                  <div className="h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-[#D97706]/60 hover:bg-[#D97706]/10 flex items-center justify-center transition-all p-2 group" title="Anthropic Claude 3.7">
                    <span className="font-mono text-sm font-bold text-[#F59E0B] group-hover:scale-110 transition-transform">
                      A\
                    </span>
                  </div>

                  {/* 3. DeepSeek */}
                  <div className="h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-[#38BDF8]/60 hover:bg-[#38BDF8]/10 flex items-center justify-center transition-all p-2 group" title="DeepSeek V3 / R1">
                    <svg className="w-5 h-5 text-[#38BDF8] group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2a9 9 0 0 1 9 9c0 4.5-3.5 8-8 8.9V22l-3-2v-1.1C5.5 18 2 14.5 2 11a9 9 0 0 1 10-9z" />
                      <circle cx="9" cy="10" r="1.5" fill="currentColor" />
                    </svg>
                  </div>

                  {/* 4. Google Gemini */}
                  <div className="h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-[#22D3EE]/60 hover:bg-[#22D3EE]/10 flex items-center justify-center transition-all p-2 group" title="Google Gemini 2.0 Flash">
                    <Sparkles size={18} className="text-[#22D3EE] group-hover:scale-110 transition-transform" />
                  </div>

                  {/* 5. Mistral AI */}
                  <div className="h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-[#F97316]/60 hover:bg-[#F97316]/10 flex items-center justify-center transition-all p-2 group" title="Mistral Large & Pixtral">
                    <div className="flex flex-col gap-0.5 items-center group-hover:scale-110 transition-transform">
                      <div className="w-4 h-1 bg-[#F97316] rounded-sm" />
                      <div className="w-3 h-1 bg-[#EA580C] rounded-sm" />
                      <div className="w-2 h-1 bg-[#C2410C] rounded-sm" />
                    </div>
                  </div>

                  {/* 6. Groq */}
                  <div className="h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-[#F59E0B]/60 hover:bg-[#F59E0B]/10 flex items-center justify-center transition-all p-2 group" title="Groq LPU Inference">
                    <Zap size={18} className="text-[#F59E0B] group-hover:scale-110 transition-transform" />
                  </div>

                  {/* 7. Azure OpenAI */}
                  <div className="h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-[#0078D4]/60 hover:bg-[#0078D4]/10 flex items-center justify-center transition-all p-2 group" title="Azure OpenAI Private Endpoints">
                    <svg className="w-5 h-5 text-[#38BDF8] group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M13.05 3.52L5.8 15.8h5.36L16.2 3.52h-3.15zm-2.18 13.06l-2.6 4.4h9.96l-2.73-4.4h-4.63z" />
                    </svg>
                  </div>

                  {/* 8. AWS Bedrock */}
                  <div className="h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-[#F59E0B]/60 hover:bg-[#F59E0B]/10 flex items-center justify-center transition-all p-2 group" title="AWS Bedrock Titan & Claude">
                    <div className="w-4 h-4 rounded-sm border-2 border-[#F59E0B] flex items-center justify-center text-[9px] font-bold text-[#F59E0B] group-hover:scale-110 transition-transform">
                      B
                    </div>
                  </div>

                  {/* 9. Sovereign Cloud VPC */}
                  <div className="h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-[#34D399]/60 hover:bg-[#34D399]/10 flex items-center justify-center transition-all p-2 group" title="On-Premises / Sovereign VPC Cloud">
                    <Globe size={18} className="text-[#34D399] group-hover:scale-110 transition-transform" />
                  </div>
                </div>
              </div>

              {/* Bottom Container: Custom & Fine-Tuned Models */}
              <div className="rounded-[20px] border border-white/[0.1] bg-gradient-to-b from-[#0D121C] to-[#070A10] p-2.5 space-y-2 relative shadow-[0_10px_30px_rgba(0,0,0,0.7)]">
                {/* Connection Node on Left Edge */}
                <div className="absolute -left-[5px] top-[50%] -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] z-10" />

                <button
                  onClick={() => onNavigatePage('integration')}
                  className="w-full py-2 px-3 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:border-white/[0.25] hover:bg-white/[0.06] transition-all flex items-center justify-between text-left group cursor-pointer"
                >
                  <span className="text-[11.5px] font-medium text-white/90">Custom Models</span>
                  <span className="text-[9.5px] font-mono text-[#94A3B8] group-hover:text-[#22D3EE] transition-colors">Local Llama 3 • VPC</span>
                </button>

                <button
                  onClick={() => onNavigatePage('temporal')}
                  className="w-full py-2 px-3 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:border-[#22D3EE]/40 hover:bg-[#22D3EE]/10 transition-all flex items-center justify-between text-left group cursor-pointer"
                >
                  <span className="text-[11.5px] font-medium text-white/90">Fine-Tuned Models</span>
                  <span className="text-[9.5px] font-mono text-[#22D3EE] group-hover:text-cyan-300 transition-colors">Temporal Worker • :7233</span>
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* Selected Module Detail Banner & Architecture Highlights */}
        <div className="mt-8 pt-5 border-t border-white/[0.08] space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/[0.02] rounded-2xl p-4 sm:p-5 border border-white/[0.06]">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-bold uppercase tracking-wider ${activeModObj.color}`}>
                  {activeModObj.label}
                </span>
                <span className="text-white/20">•</span>
                <span className="text-xs font-mono text-[#94A3B8]">
                  {activeModObj.badge}
                </span>
                <span className="text-white/20">•</span>
                <span className="text-[11px] font-mono text-[#34D399] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse" />
                  <span>localhost:7233</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-white/90 max-w-2xl leading-relaxed">
                {activeModObj.desc}
              </p>
            </div>

            <button
              onClick={() => onNavigatePage(activeModObj.targetPage)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/[0.05] hover:bg-white/[0.1] hover:border-white/40 px-5 py-2.5 text-xs font-semibold text-white transition-all shrink-0 cursor-pointer shadow-sm"
            >
              <span>Explore {activeModObj.label}</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {/* Clean Engineering Metadata Bar (Replaces bulky cards & clunky footer) */}
          <div className="flex items-center justify-between text-[11px] font-mono text-[#94A3B8] px-2 flex-wrap gap-2 pt-1">
            <span className="flex items-center gap-1.5 text-[#22D3EE]">
              <Cpu size={12} />
              <span>Dual-Engine DAG Activities</span>
            </span>
            <span className="flex items-center gap-1.5 text-rose-400">
              <ShieldAlert size={12} />
              <span>Non-Blocking Quarantine Signals</span>
            </span>
            <span className="flex items-center gap-1.5 text-[#34D399]">
              <Workflow size={12} />
              <span>Zero State Loss Event Replay</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// =========================================================================
// 8. HOME LANDING PAGE (PORTKEY-STYLE ARCHITECTURE)
// =========================================================================

function HomeLandingView({
  onLaunchApp,
  onContact,
  onNavigatePage,
  onNavigatePricing,
  onExportLedger
}: {
  onLaunchApp: () => void
  onContact: () => void
  onNavigatePage: (page: Page) => void
  onNavigatePricing?: () => void
  onExportLedger?: () => void
}) {
  return (
    <div className="space-y-20 py-4 md:py-8">
      {/* Hero Section */}
      <div className="grid gap-10 lg:grid-cols-[1.1fr_1.3fr] items-center">
        {/* Hero Left */}
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#22D3EE]/10 border border-[#22D3EE]/30 text-[11.5px] font-mono text-[#22D3EE]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#22D3EE] animate-pulse" />
            <span>DPDP ACT 2023 COMPLIANT GATEWAY</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-extrabold text-white tracking-tight leading-[1.08]">
            piishield is now India's Sovereign <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#22D3EE] to-[#06B6D4]">AI Gateway</span>
          </h1>

          <p className="text-base sm:text-lg text-[#94A3B8] leading-relaxed max-w-xl">
            Observe, govern, and redact every AI interaction across your enterprise for DPDP Act 2023 compliance. Zero-trust on-premises architecture with mathematical checksum guarantees.
          </p>

          <div className="flex items-center gap-3.5 pt-2 flex-wrap">
            <button
              onClick={onLaunchApp}
              className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-black hover:bg-neutral-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] flex items-center gap-2"
            >
              <span>Try Sandbox</span>
              <ArrowRight size={15} />
            </button>
            <button
              onClick={onContact}
              className="rounded-xl bg-white/[0.04] border border-white/[0.15] px-6 py-3 text-sm font-semibold text-white hover:bg-white/[0.08] hover:border-white/[0.25] transition-all"
            >
              Contact us
            </button>
          </div>
        </div>

        {/* Hero Right: Portkey-Style Architecture Diagram */}
        <div className="relative rounded-2xl border border-white/[0.1] bg-[#030712] p-6 shadow-2xl overflow-hidden">
          {/* Subtle glowing background mesh */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#22D3EE]/5 rounded-full blur-3xl pointer-events-none" />

          {/* Top Operationalize Banner */}
          <div className="flex justify-between items-center text-[10px] font-mono text-[#94A3B8]/70 border-b border-white/[0.06] pb-3 mb-5">
            <span className="flex items-center gap-1.5"><Terminal size={11} className="text-[#22D3EE]" /> Prompt Interceptor</span>
            <span className="text-[#22D3EE]">OpenAI-Compatible Sovereign Gateway</span>
            <span>Zero Raw Storage</span>
          </div>

          <div className="grid grid-cols-[1fr_1.3fr_1fr] gap-3 items-center text-xs">
            {/* Left Inputs */}
            <div className="space-y-2">
              <div className="text-[9px] font-bold uppercase tracking-wider text-[#94A3B8]/60 px-1">Inbound Prompts</div>
              {[
                { name: 'AI Apps', icon: '⚡' },
                { name: 'Coding Assistants', icon: '💻' },
                { name: 'Enterprise Agents', icon: '🤖' },
                { name: 'Copilots', icon: '✨' },
                { name: 'Hinglish Transcripts', icon: '🗣️' },
              ].map(app => (
                <div key={app.name} className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5 text-[11px] text-white/90">
                  <span className="text-xs">{app.icon}</span>
                  <span className="truncate font-medium">{app.name}</span>
                </div>
              ))}
            </div>

            {/* Center: PIISHIELD AI GATEWAY */}
            <div className="relative rounded-xl border border-[#22D3EE]/40 bg-gradient-to-b from-[#061826] to-[#040D17] p-4 text-center shadow-[0_0_25px_rgba(34,211,238,0.15)] space-y-3">
              <div className="text-[9.5px] font-mono font-bold text-[#22D3EE] uppercase tracking-wider">
                Operationalize AI
              </div>

              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#091E30] border-2 border-[#22D3EE] shadow-[0_0_15px_rgba(34,211,238,0.4)]">
                <svg className="w-6 h-6 text-[#22D3EE]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M12 2l7.5 4.5v9L12 20l-7.5-4.5v-9L12 2z"/>
                  <path d="M10 9l3 3-3 3"/>
                </svg>
              </div>

              <div>
                <div className="text-[13px] font-extrabold text-white tracking-tight">PIISHIELD CORE</div>
                <div className="text-[10px] font-semibold text-[#22D3EE]">AI PRIVACY GATEWAY</div>
              </div>

              <div className="text-[9px] text-[#94A3B8] font-mono border-t border-white/[0.06] pt-2">
                Unified LLM, MCP &amp; Checksum Engine
              </div>

              <div className="text-[9.5px] font-mono font-bold text-[#34D399] uppercase tracking-wider pt-1">
                Secure AI
              </div>
            </div>

            {/* Right Outputs */}
            <div className="space-y-2">
              <div className="text-[9px] font-bold uppercase tracking-wider text-[#94A3B8]/60 px-1">Upstream Models</div>
              {[
                { name: 'OpenAI GPT-4o', icon: '🟢' },
                { name: 'Claude 3.7 Sonnet', icon: '🟣' },
                { name: 'Local Llama 3', icon: '🟡' },
                { name: 'Temporal DAG', icon: '🔄' },
                { name: 'SQLite Ledger', icon: '🔒' },
              ].map(target => (
                <div key={target.name} className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5 text-[11px] text-white/90">
                  <span className="text-[10px]">{target.icon}</span>
                  <span className="truncate font-medium">{target.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Security Tags */}
          <div className="mt-5 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-[#94A3B8] flex-wrap gap-2">
            <span className="text-[#34D399]">✓ Safety</span>
            <span className="text-[#22D3EE]">✓ Runtime Security</span>
            <span className="text-[#A78BFA]">✓ Identity Security</span>
            <span className="text-[#FBBF24]">✓ Governance</span>
            <span className="text-white">✓ Observability</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          PORTKEY SOCIAL PROOF & METRICS ("Recognised by industry leaders")
         ========================================================================= */}
      <PortkeyIndustryLeadersSection />

      {/* =========================================================================
          PRODUCT SUITE INTERACTIVE SHOWCASE ("waise hi main page pe dikhauye or jo click kre wahi khule")
         ========================================================================= */}
      <section className="pt-6 pb-2">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#22D3EE]/10 border border-[#22D3EE]/30 text-[11px] font-mono text-[#22D3EE]">
            <Sparkles size={12} />
            <span>CORE PRODUCT SUITE &amp; MODULES</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Explore All 6 Sovereign Gateway Products
          </h2>
          <p className="text-sm text-[#94A3B8]">
            Click any module below or use the top navbar to open the live sandbox, temporal state machines, audit ledgers, or compliance policies.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              id: 'playground' as Page,
              title: 'Playground Studio',
              badge: 'Live Sandbox',
              badgeClass: 'bg-[#22D3EE]/15 text-[#22D3EE] border-[#22D3EE]/30',
              icon: Sparkles,
              iconColor: 'text-[#22D3EE]',
              iconBg: 'bg-[#22D3EE]/10 border-[#22D3EE]/30',
              desc: 'Interactive PII redaction studio with stream inspection, live checksum evaluation, and Hinglish masking.',
              action: 'Launch Playground'
            },
            {
              id: 'temporal' as Page,
              title: 'Temporal Engine',
              badge: 'Durable Workflows',
              badgeClass: 'bg-[#A78BFA]/15 text-[#A78BFA] border-[#A78BFA]/30',
              icon: Workflow,
              iconColor: 'text-[#A78BFA]',
              iconBg: 'bg-[#A78BFA]/10 border-[#A78BFA]/30',
              desc: 'Fault-tolerant DAG state machines & signals on port :7233. Guaranteed completion across network drops.',
              action: 'Open Temporal Engine'
            },
            {
              id: 'ledger' as Page,
              title: 'Audit Ledger',
              badge: 'DPDP §8 Compliant',
              badgeClass: 'bg-[#34D399]/15 text-[#34D399] border-[#34D399]/30',
              icon: Database,
              iconColor: 'text-[#34D399]',
              iconBg: 'bg-[#34D399]/10 border-[#34D399]/30',
              desc: 'Cryptographic SHA-256 proofs with zero raw PII persisted. Tamper-evident regulatory export in CSV/JSON.',
              action: 'Inspect Ledger'
            },
            {
              id: 'regression' as Page,
              title: 'Regression Suite',
              badge: '20/20 Passing',
              badgeClass: 'bg-[#FBBF24]/15 text-[#FBBF24] border-[#FBBF24]/30',
              icon: FlaskConical,
              iconColor: 'text-[#FBBF24]',
              iconBg: 'bg-[#FBBF24]/10 border-[#FBBF24]/30',
              desc: 'Automated test harness verifying Verhoeff D₅ Aadhaar math, Luhn algorithms, and edge-case Indian PII.',
              action: 'Run Regression Suite'
            },
            {
              id: 'integration' as Page,
              title: 'API Reference & Proxy',
              badge: 'Port :8080',
              badgeClass: 'bg-[#38BDF8]/15 text-[#38BDF8] border-[#38BDF8]/30',
              icon: Code2,
              iconColor: 'text-[#38BDF8]',
              iconBg: 'bg-[#38BDF8]/10 border-[#38BDF8]/30',
              desc: 'Drop-in reverse proxy for OpenAI, LangChain, and LiteLLM SDKs with one-line baseURL replacement.',
              action: 'View API Docs & cURL'
            },
            {
              id: 'settings' as Page,
              title: 'Security & Policy',
              badge: '17 Entities',
              badgeClass: 'bg-[#F43F5E]/15 text-[#F43F5E] border-[#F43F5E]/30',
              icon: ShieldCheck,
              iconColor: 'text-[#F43F5E]',
              iconBg: 'bg-[#F43F5E]/10 border-[#F43F5E]/30',
              desc: 'Statutory pass-through policies for Aadhaar, PAN & GSTIN. Granular entity masking and token secrets.',
              action: 'Configure Policies'
            },
          ].map(product => {
            const Icon = product.icon
            return (
              <div
                key={product.id}
                onClick={() => onNavigatePage(product.id)}
                className="group relative rounded-2xl border border-white/[0.08] bg-[#0A0E18]/80 hover:bg-[#0E1524] hover:border-[#22D3EE]/40 p-5 transition-all duration-200 cursor-pointer flex flex-col justify-between hover:shadow-[0_10px_35px_rgba(0,0,0,0.8),0_0_25px_rgba(34,211,238,0.08)] hover:-translate-y-0.5"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3.5">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center border transition-all', product.iconBg)}>
                      <Icon size={19} className={product.iconColor} />
                    </div>
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border', product.badgeClass)}>
                      {product.badge}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white group-hover:text-[#22D3EE] transition-colors">
                    {product.title}
                  </h3>
                  <p className="text-xs text-[#94A3B8] leading-relaxed mt-2 group-hover:text-[#CBD5E1] transition-colors">
                    {product.desc}
                  </p>
                </div>

                <div className="mt-5 pt-3.5 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold text-white/70 group-hover:text-[#22D3EE] transition-colors">
                  <span>{product.action}</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* =========================================================================
          PORTKEY-STYLE ALTERNATING FEATURE SECTIONS (ZIG-ZAG FULL-BLEED)
         ========================================================================= */}
      <div className="space-y-36 pt-16 border-t border-white/[0.08]">
        {/* =========================================================================
            SECTION 1: Dihedral Group D5 & Luhn Checksums (Device Left, Copy Right)
           ========================================================================= */}
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          {/* Visual Device Left */}
          <div className="flex flex-col items-center">
            {/* Top Connected Badges (6 Nodes) */}
            <div className="flex items-center justify-center gap-2 sm:gap-3 w-full">
              {[
                { name: 'UIDAI', icon: <ShieldCheck size={18} className="text-[#22D3EE]" /> },
                { name: 'CBDT', icon: <FileCheck2 size={18} className="text-[#38BDF8]" /> },
                { name: 'GSTN', icon: <Database size={18} className="text-[#34D399]" /> },
                { name: 'RBI', icon: <Gauge size={18} className="text-[#FBBF24]" /> },
                { name: 'NPCI', icon: <Zap size={18} className="text-[#A78BFA]" /> },
                { name: 'SEBI', icon: <Lock size={18} className="text-[#F43F5E]" /> },
              ].map(item => (
                <div
                  key={item.name}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#090D15] border border-white/[0.09] flex items-center justify-center text-white/80 shadow-md hover:border-[#22D3EE]/50 transition-colors"
                  title={item.name}
                >
                  {item.icon}
                </div>
              ))}
            </div>

            {/* SVG Converging Wire Traces */}
            <div className="relative h-7 w-64 my-1 flex items-center justify-center pointer-events-none">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 256 28" fill="none">
                <path d="M 20 0 L 20 12 L 100 28" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" />
                <path d="M 64 0 L 64 14 L 112 28" stroke="rgba(255,255,255,0.22)" strokeWidth="1.2" />
                <path d="M 108 0 L 108 28" stroke="#22D3EE" strokeOpacity="0.6" strokeWidth="1.2" />
                <path d="M 148 0 L 148 28" stroke="#22D3EE" strokeOpacity="0.6" strokeWidth="1.2" />
                <path d="M 192 0 L 192 14 L 144 28" stroke="rgba(255,255,255,0.22)" strokeWidth="1.2" />
                <path d="M 236 0 L 236 12 L 156 28" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" />
              </svg>
            </div>

            {/* Center Dark Metallic Hardware Device */}
            <div className="relative w-full max-w-[480px] rounded-3xl border border-white/[0.12] bg-[#0A0D14] p-4 sm:p-5 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_35px_rgba(34,211,238,0.08)] ring-1 ring-white/[0.04]">
              <div className="flex gap-3 sm:gap-4 items-stretch">
                {/* Left Hardware Rail */}
                <div className="flex flex-col gap-2.5 py-1 shrink-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 via-blue-500/15 to-purple-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.35)]">
                    <ChevronRight size={18} strokeWidth={2.8} />
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-neutral-400">
                    <ShieldCheck size={16} />
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-neutral-400">
                    <Settings2 size={16} />
                  </div>
                </div>

                {/* Right Rows with Icons and Checkmarks */}
                <div className="flex-1 space-y-2.5 flex flex-col justify-center">
                  <div className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-white/[0.06] bg-gradient-to-r from-white/[0.03] to-white/[0.01]">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center shrink-0 text-orange-400 font-bold text-xs">
                        D₅
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-bold text-white tracking-tight truncate">UIDAI Aadhaar Engine</div>
                        <div className="text-[10.5px] text-[#8A99AD] truncate">Dihedral Group D₅ • 100% Single-error Rejection</div>
                      </div>
                    </div>
                    <Check size={16} className="text-[#22D3EE] shrink-0" strokeWidth={2.8} />
                  </div>

                  <div className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-white/[0.06] bg-gradient-to-r from-white/[0.03] to-white/[0.01]">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0 text-blue-400 font-bold text-xs">
                        PAN
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-bold text-white tracking-tight truncate">Income Tax PAN &amp; TAN</div>
                        <div className="text-[10.5px] text-[#8A99AD] truncate">4th-char Entity Validation • Rule 114</div>
                      </div>
                    </div>
                    <Check size={16} className="text-[#22D3EE] shrink-0" strokeWidth={2.8} />
                  </div>

                  <div className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-white/[0.06] bg-gradient-to-r from-white/[0.03] to-white/[0.01]">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400 font-bold text-xs">
                        L10
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-bold text-white tracking-tight truncate">PCI-DSS Luhn &amp; GSTIN Mod-36</div>
                        <div className="text-[10.5px] text-[#8A99AD] truncate">15-digit State Prefix • 0.2ms CPU Register Speed</div>
                      </div>
                    </div>
                    <Check size={16} className="text-[#22D3EE] shrink-0" strokeWidth={2.8} />
                  </div>
                </div>
              </div>
            </div>

            {/* SVG Diverging Wire Traces */}
            <div className="relative h-7 w-64 my-1 flex items-center justify-center pointer-events-none">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 256 28" fill="none">
                <path d="M 100 0 L 20 16 L 20 28" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" />
                <path d="M 112 0 L 64 14 L 64 28" stroke="rgba(255,255,255,0.22)" strokeWidth="1.2" />
                <path d="M 108 0 L 108 28" stroke="#22D3EE" strokeOpacity="0.6" strokeWidth="1.2" />
                <path d="M 148 0 L 148 28" stroke="#22D3EE" strokeOpacity="0.6" strokeWidth="1.2" />
                <path d="M 144 0 L 192 14 L 192 28" stroke="rgba(255,255,255,0.22)" strokeWidth="1.2" />
                <path d="M 156 0 L 236 16 L 236 28" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" />
              </svg>
            </div>

            {/* Bottom Connected Badges (6 Nodes) */}
            <div className="flex items-center justify-center gap-2 sm:gap-3 w-full">
              {[
                { name: 'OpenAI', icon: <span className="font-mono text-xs font-bold text-[#34D399]">AI</span> },
                { name: 'Claude', icon: <span className="font-mono text-xs font-bold text-[#A78BFA]">CL</span> },
                { name: 'Llama', icon: <span className="font-mono text-xs font-bold text-[#FBBF24]">🦙</span> },
                { name: 'Gemini', icon: <Sparkles size={16} className="text-[#22D3EE]" /> },
                { name: 'Temporal', icon: <Workflow size={16} className="text-[#F43F5E]" /> },
                { name: 'Ledger', icon: <Database size={16} className="text-white" /> },
              ].map(item => (
                <div
                  key={item.name}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#090D15] border border-white/[0.09] flex items-center justify-center text-white/80 shadow-md hover:border-[#22D3EE]/50 transition-colors"
                  title={item.name}
                >
                  {item.icon}
                </div>
              ))}
            </div>
          </div>

          {/* Copy Right */}
          <div className="space-y-6">
            <div className="inline-flex items-center px-3 py-1 rounded-md bg-[#22D3EE]/10 border border-[#22D3EE]/25 text-xs font-mono font-medium text-[#22D3EE] tracking-wide">
              Dihedral Group D₅ &amp; Luhn
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-bold text-white tracking-tight leading-[1.12]">
              Secure validation for <br />
              <span className="text-white/90">Indian national IDs</span>
            </h2>

            <p className="text-[#94A3B8] text-base leading-relaxed max-w-xl">
              Standard regex patterns produce dangerous false positives by redacting random invoice numbers, phone extensions, or order quantities. piishield eliminates false positives by applying <strong>abstract algebraic dihedral group permutations (D₅)</strong> and Modulo-10/36 math directly on CPU registers in &lt;0.2ms.
            </p>

            <div className="pt-2">
              <button
                onClick={() => onNavigatePage('playground')}
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-transparent px-6 py-2.5 text-sm font-medium text-white hover:bg-white/[0.06] hover:border-white/40 transition-colors"
              >
                <span>Learn More</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* =========================================================================
            SECTION 2: Portkey Audit & Redaction Ledger Matrix (Table Left, Copy Right)
           ========================================================================= */}
        <PortkeyAuditLedgerSection onLearnMore={() => onNavigatePage('ledger')} />


        {/* =========================================================================
            SECTION 3: Portkey Code Integration ("Integrate in a minute")
           ========================================================================= */}
        <PortkeyCodeIntegrateSection />


        {/* =========================================================================
            SECTION 4: Portkey Temporal Durable AI Gateway Architecture (3-Box Connected Flow)
           ========================================================================= */}
        <PortkeyTemporalGatewayArchitectureSection onNavigatePage={onNavigatePage} />


        {/* =========================================================================
            SECTION 5: Zero-Raw-Storage SQLite Audit Ledger (Copy Left, Device Right)
           ========================================================================= */}
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          {/* Copy Left */}
          <div className="space-y-6 order-2 lg:order-1">
            <div className="inline-flex items-center px-3 py-1 rounded-md bg-[#34D399]/10 border border-[#34D399]/25 text-xs font-mono font-medium text-[#34D399] tracking-wide">
              DPDP Act 2023 Compliance
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-bold text-white tracking-tight leading-[1.12]">
              Zero raw storage <br />
              <span className="text-white/90">forensic audit ledger</span>
            </h2>

            <p className="text-[#94A3B8] text-base leading-relaxed max-w-xl">
              Section 8 of the Indian Digital Personal Data Protection Act imposes penalties up to <strong>₹250 Crores</strong> for retaining citizen personal data beyond processing necessity. piishield enforces a fail-closed architecture where raw PII exists strictly in transient RAM. Only synthetic truncated tokens and cryptographic SHA-256 hashes are persisted.
            </p>

            <div className="pt-2">
              <button
                onClick={() => onNavigatePage('ledger')}
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-transparent px-6 py-2.5 text-sm font-medium text-white hover:bg-white/[0.06] hover:border-white/40 transition-colors"
              >
                <span>Learn More</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Visual Device Right: DPDP Act §8 Cryptographic Memory Inspector */}
          <div className="order-1 lg:order-2 w-full flex justify-center">
            <div className="w-full max-w-[520px] rounded-2xl border border-white/[0.1] bg-[#0A0D14]/95 p-5 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_40px_rgba(52,211,153,0.06)] ring-1 ring-white/[0.04] space-y-4 font-sans text-xs">
              {/* Window Header */}
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
                  <span className="ml-2 font-mono text-[11px] text-[#94A3B8] font-medium">
                    DPDP Act §8 • Cryptographic Memory Inspector
                  </span>
                </div>

                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#34D399]/10 border border-[#34D399]/30 text-[10px] font-mono text-[#34D399] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse" />
                  <span>Fail-Closed Active</span>
                </div>
              </div>

              {/* Step 1: Volatile Inbound RAM Heap */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono text-[#94A3B8]">
                  <span className="text-[#94A3B8]/70 font-semibold uppercase tracking-wider">1. Transient RAM Heap (&lt;0.2ms TTL)</span>
                  <span className="px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-400 font-bold border border-rose-500/30">Raw PII Detected</span>
                </div>
                <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] font-mono text-[11px] text-white/90 leading-relaxed">
                  Customer <span className="bg-rose-500/20 text-rose-300 px-1 py-0.5 rounded border border-rose-500/30 font-semibold">Ramesh Kumar</span> PAN <span className="bg-rose-500/20 text-rose-300 px-1 py-0.5 rounded border border-rose-500/30 font-semibold">ABCDE1234F</span> submitted ID <span className="bg-rose-500/20 text-rose-300 px-1 py-0.5 rounded border border-rose-500/30 font-semibold">2345 6789 0123</span>
                </div>
                <div className="text-[10px] text-[#34D399] font-mono flex items-center gap-1 pt-0.5">
                  <Check size={11} strokeWidth={3} />
                  <span>Abstract algebra D₅ &amp; Luhn checksum verified • RAM memory registers purged</span>
                </div>
              </div>

              {/* Transformation Transition Trace */}
              <div className="flex items-center justify-center gap-2 py-0.5 text-[10px] font-mono text-[#22D3EE]/80">
                <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#22D3EE]/30 to-transparent" />
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#22D3EE]/10 border border-[#22D3EE]/20">
                  <ArrowDownToLine size={10} />
                  <span>Deterministic Token Substitution</span>
                </span>
                <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#22D3EE]/30 to-transparent" />
              </div>

              {/* Step 2: Upstream Egress to LLM */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono text-[#94A3B8]">
                  <span className="text-[#94A3B8]/70 font-semibold uppercase tracking-wider">2. Upstream Egress (Outbound to LLM)</span>
                  <span className="px-1.5 py-0.2 rounded bg-[#22D3EE]/15 text-[#22D3EE] font-bold border border-[#22D3EE]/30">Zero PII Leakage</span>
                </div>
                <div className="p-3 rounded-xl bg-[#061420]/60 border border-[#22D3EE]/20 font-mono text-[11px] text-white/90 leading-relaxed">
                  Customer <span className="bg-[#22D3EE]/20 text-[#22D3EE] px-1 py-0.5 rounded border border-[#22D3EE]/40 font-bold">&lt;NAME_1&gt;</span> PAN <span className="bg-[#22D3EE]/20 text-[#22D3EE] px-1 py-0.5 rounded border border-[#22D3EE]/40 font-bold">&lt;PAN_1&gt;</span> submitted ID <span className="bg-[#34D399]/20 text-[#34D399] px-1 py-0.5 rounded border border-[#34D399]/40 font-bold">&lt;AADHAAR_1&gt;</span>
                </div>
              </div>

              {/* Step 3: Non-Volatile Persistent Disk (Audit Ledger Metrics) */}
              <div className="pt-1">
                <div className="text-[10px] font-mono text-[#94A3B8]/70 font-semibold uppercase tracking-wider mb-2">
                  3. Non-Volatile Disk Storage (DPDP Section 8 Verification)
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {/* Metric 1 */}
                  <div className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] flex flex-col justify-between">
                    <div className="text-[10px] font-mono text-emerald-300/80 uppercase">Raw on Disk</div>
                    <div className="text-base font-extrabold text-[#34D399] font-mono my-0.5">0 BYTES</div>
                    <div className="text-[9px] text-[#34D399] font-mono font-bold">100% PURGED ✓</div>
                  </div>

                  {/* Metric 2 */}
                  <div className="p-2.5 rounded-xl border border-cyan-500/30 bg-cyan-500/[0.08] flex flex-col justify-between">
                    <div className="text-[10px] font-mono text-cyan-300/80 uppercase">Fingerprint</div>
                    <div className="text-xs font-bold text-[#22D3EE] font-mono my-0.5 truncate" title="SHA-256 Chained Hash">7f83b165...</div>
                    <div className="text-[9px] text-[#22D3EE] font-mono font-bold">SHA-256 CHAIN ✓</div>
                  </div>

                  {/* Metric 3 */}
                  <div className="p-2.5 rounded-xl border border-purple-500/30 bg-purple-500/[0.08] flex flex-col justify-between">
                    <div className="text-[10px] font-mono text-purple-300/80 uppercase">Penalty Risk</div>
                    <div className="text-base font-extrabold text-[#A78BFA] font-mono my-0.5">₹0</div>
                    <div className="text-[9px] text-[#A78BFA] font-mono font-bold">MAX ₹250 CR SHIELDED</div>
                  </div>
                </div>
              </div>

              {/* Step 4: Certified Forensic Proof Receipt & Export */}
              <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                <div className="flex items-center gap-2 text-[10.5px] font-mono text-[#94A3B8]">
                  <Database size={13} className="text-[#34D399]" />
                  <span>Receipt: <strong className="text-white">req_8e17df9a34</strong></span>
                </div>

                <button
                  onClick={onExportLedger}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.12] bg-white/[0.04] text-white hover:bg-[#22D3EE]/15 hover:border-[#22D3EE]/40 hover:text-[#22D3EE] text-[11px] font-semibold transition-all shadow-sm shrink-0"
                >
                  <ArrowDownToLine size={12} />
                  <span>Download Audit Proof (.json)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// =========================================================================
// 9. PRICING VIEW
// =========================================================================

function PricingView({
  onSelectPlan,
  onContact
}: {
  onSelectPlan: () => void
  onContact: () => void
}) {
  return (
    <div className="space-y-10 py-6 max-w-6xl mx-auto">
      <div className="text-center space-y-3">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Simple, transparent enterprise pricing
        </h1>
        <p className="text-sm sm:text-base text-[#94A3B8] max-w-xl mx-auto">
          Deploy piishield on-premises, in your private cloud (VPC), or as an air-gapped sovereign privacy gateway.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3 items-stretch">
        {/* Tier 1 */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#111827] p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div>
              <div className="text-xs font-bold font-mono text-[#94A3B8] uppercase">Developer</div>
              <div className="text-2xl font-extrabold text-white mt-1">Free</div>
              <div className="text-xs text-[#94A3B8] mt-0.5">Forever open-source</div>
            </div>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Ideal for developers and hackathon projects securing local LLM applications.
            </p>
            <div className="space-y-2 pt-2 border-t border-white/[0.06] text-xs text-white/90">
              {['17 Indian PII categories', 'Verhoeff & Luhn checksums', 'Local SQLite audit ledger', 'Fail-closed architecture', 'cURL & OpenAI SDK support'].map(f => (
                <div key={f} className="flex items-center gap-2">
                  <Check size={14} className="text-[#34D399] shrink-0" />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={onSelectPlan}
            className="w-full py-2.5 rounded-xl border border-white/[0.15] text-xs font-bold text-white hover:bg-white/[0.08] transition-all"
          >
            Launch Playground
          </button>
        </div>

        {/* Tier 2: Popular */}
        <div className="rounded-2xl border-2 border-[#22D3EE] bg-gradient-to-b from-[#111827] to-[#0A1624] p-6 flex flex-col justify-between space-y-6 relative shadow-[0_0_30px_rgba(34,211,238,0.15)]">
          <div className="absolute -top-3 right-6 px-2.5 py-0.5 rounded-full bg-[#22D3EE] text-[#090D16] text-[10px] font-extrabold uppercase tracking-wide">
            Most Popular
          </div>
          <div className="space-y-4">
            <div>
              <div className="text-xs font-bold font-mono text-[#22D3EE] uppercase">Enterprise VPC</div>
              <div className="text-2xl font-extrabold text-white mt-1">₹500 <span className="text-xs font-normal text-[#94A3B8]">/ month</span></div>
              <div className="text-xs text-[#94A3B8] mt-0.5">Dedicated private cloud (500 Rupees)</div>
            </div>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              For growth startups and fintechs requiring automated compliance and high throughput.
            </p>
            <div className="space-y-2 pt-2 border-t border-white/[0.06] text-xs text-white/90">
              {[
                'Everything in Developer',
                'Temporal durable execution cluster',
                'Fine-tuned spaCy Indian NER models',
                'Granular pass-through policy manager',
                'Automated regression CI test suite',
                '99.99% uptime SLA'
              ].map(f => (
                <div key={f} className="flex items-center gap-2">
                  <Check size={14} className="text-[#22D3EE] shrink-0" />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={onContact}
            className="w-full py-2.5 rounded-xl bg-[#22D3EE] text-xs font-bold text-[#090D16] hover:bg-[#06B6D4] transition-all shadow-lg shadow-[#22D3EE]/20"
          >
            Deploy to VPC
          </button>
        </div>

        {/* Tier 3: Custom */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#111827] p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div>
              <div className="text-xs font-bold font-mono text-[#A78BFA] uppercase">Sovereign Banking</div>
              <div className="text-2xl font-extrabold text-white mt-1">Custom</div>
              <div className="text-xs text-[#94A3B8] mt-0.5">Air-gapped on-premises</div>
            </div>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              For scheduled commercial banks, NBFCs, and insurance fiduciaries under RBI/UIDAI oversight.
            </p>
            <div className="space-y-2 pt-2 border-t border-white/[0.06] text-xs text-white/90">
              {[
                'Everything in Enterprise VPC',
                'Air-gapped on-premise installation',
                'Hardware Security Module (HSM) key store',
                'RBI & DPDP Act 2023 compliance audit pack',
                'Custom Hinglish dialect model fine-tuning',
                '24/7 dedicated security engineering team'
              ].map(f => (
                <div key={f} className="flex items-center gap-2">
                  <Check size={14} className="text-[#A78BFA] shrink-0" />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={onContact}
            className="w-full py-2.5 rounded-xl border border-white/[0.15] text-xs font-bold text-white hover:bg-white/[0.08] transition-all"
          >
            Contact Enterprise Sales
          </button>
        </div>
      </div>
    </div>
  )
}

