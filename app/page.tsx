'use client'

import { useState, useEffect, useCallback } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { copyToClipboard } from '@/lib/clipboard'
import {
  getSchedule,
  getScheduleLogs,
  pauseSchedule,
  resumeSchedule,
  triggerScheduleNow,
  cronToHuman,
  type Schedule,
  type ExecutionLog,
} from '@/lib/scheduler'
import {
  FiLoader,
  FiX,
  FiRefreshCw,
  FiCheck,
  FiSend,
  FiChevronDown,
  FiChevronUp,
  FiAlertCircle,
  FiInfo,
  FiCopy,
  FiPlus,
  FiSearch,
  FiSettings,
  FiArrowRight,
} from 'react-icons/fi'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

// ─── Constants ───────────────────────────────────────────────────────────────

const AGENT_ID = '698b9424d33873d8366013f2'
const SCHEDULE_ID = '698b98a2ebe6fd87d1dcc0d4'
const DEFAULT_STOCKS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA']
const LS_KEY_STOCKS = 'stock_watchlist'
const LS_KEY_EMAIL = 'stock_email'

const SAMPLE_ANALYSIS = `### Morning Briefing: Stock Analysis for AAPL, MSFT, GOOGL

#### Portfolio Overview Summary
Today's analysis focuses on three major tech stocks: Apple Inc. (AAPL), Microsoft Corporation (MSFT), and Alphabet Inc. (GOOGL). The technology sector has shown mixed performance recently, with ongoing concerns related to inflation and changing consumer behavior impacting investor sentiment.

---

### 1. Apple Inc. (AAPL)
- **Current Price:** $174.58
- **Daily Change:** +1.25%
- **52-week High/Low:** $198.23 / $124.17
- **Market Cap:** $2.7 trillion
- **P/E Ratio:** 29.5
- **Market Sentiment:** Bullish

**Recent News:**
Apple has announced a software update focusing on privacy features, which has been well received by users and analysts alike. The company continues to expand its service offerings, particularly in subscriptions and advertising.

**Actionable Insights:**
- **Recommendation:** Buy on dips; the recent price decline presents a potential entry point for long-term investors.

---

### 2. Microsoft Corporation (MSFT)
- **Current Price:** $342.12
- **Daily Change:** -0.55%
- **52-week High/Low:** $366.78 / $213.43
- **Market Cap:** $2.55 trillion
- **P/E Ratio:** 36.7
- **Market Sentiment:** Neutral

**Recent News:**
Microsoft has seen a recent decline in cloud service growth rates, which has raised concerns among investors. However, their integration of AI across services remains a bright spot.

**Actionable Insights:**
- **Recommendation:** Hold; monitor for signs of stabilization in cloud growth.

---

### 3. Alphabet Inc. (GOOGL)
- **Current Price:** $128.39
- **Daily Change:** +2.10%
- **52-week High/Low:** $145.64 / $83.45
- **Market Cap:** $1.66 trillion
- **P/E Ratio:** 24.1
- **Market Sentiment:** Bullish

**Recent News:**
Alphabet's latest quarterly earnings exceeded expectations thanks to strong ad revenue growth and improved performance in their cloud division.

**Actionable Insights:**
- **Recommendation:** Buy; given the robust growth in advertising and cloud services.

---

### Conclusion
The tech sector offers promising opportunities amid current volatility. Apple and Alphabet exhibit bullish trends supported by positive news, while Microsoft remains stable but neutral.`

// ─── Theme ───────────────────────────────────────────────────────────────────

const THEME_VARS = {
  '--background': '220 15% 97%',
  '--foreground': '220 20% 15%',
  '--card': '0 0% 100%',
  '--card-foreground': '220 20% 15%',
  '--popover': '0 0% 100%',
  '--popover-foreground': '220 20% 15%',
  '--primary': '220 75% 50%',
  '--primary-foreground': '0 0% 100%',
  '--secondary': '220 12% 92%',
  '--secondary-foreground': '220 20% 20%',
  '--accent': '160 65% 40%',
  '--accent-foreground': '0 0% 100%',
  '--destructive': '0 70% 50%',
  '--destructive-foreground': '0 0% 100%',
  '--muted': '220 10% 90%',
  '--muted-foreground': '220 12% 50%',
  '--border': '220 15% 88%',
  '--input': '220 12% 82%',
  '--ring': '220 75% 50%',
  '--radius': '0.125rem',
} as React.CSSProperties

// ─── Markdown Renderer ──────────────────────────────────────────────────────

function MarkdownRenderer({ content }: { content: string }) {
  if (!content) return null

  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: string[] = []
  let listType: 'ul' | 'ol' | null = null

  const flushList = () => {
    if (listItems.length > 0 && listType) {
      const items = listItems.map((item, i) => (
        <li key={i} className="mb-0.5">
          <InlineMarkdown text={item} />
        </li>
      ))
      if (listType === 'ul') {
        elements.push(
          <ul key={elements.length} className="list-disc pl-5 mb-2 text-sm leading-relaxed">
            {items}
          </ul>
        )
      } else {
        elements.push(
          <ol key={elements.length} className="list-decimal pl-5 mb-2 text-sm leading-relaxed">
            {items}
          </ol>
        )
      }
      listItems = []
      listType = null
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('####')) {
      flushList()
      elements.push(
        <h4 key={elements.length} className="text-sm font-semibold text-foreground mt-3 mb-1">
          <InlineMarkdown text={line.replace(/^####\s*/, '')} />
        </h4>
      )
    } else if (line.startsWith('###')) {
      flushList()
      elements.push(
        <h3 key={elements.length} className="text-base font-semibold text-foreground mt-4 mb-1.5">
          <InlineMarkdown text={line.replace(/^###\s*/, '')} />
        </h3>
      )
    } else if (line.startsWith('##')) {
      flushList()
      elements.push(
        <h2 key={elements.length} className="text-lg font-semibold text-foreground mt-4 mb-2">
          <InlineMarkdown text={line.replace(/^##\s*/, '')} />
        </h2>
      )
    } else if (line.startsWith('#')) {
      flushList()
      elements.push(
        <h1 key={elements.length} className="text-xl font-semibold text-foreground mt-4 mb-2">
          <InlineMarkdown text={line.replace(/^#\s*/, '')} />
        </h1>
      )
    } else if (line.startsWith('---')) {
      flushList()
      elements.push(<Separator key={elements.length} className="my-3" />)
    } else if (/^[-*]\s/.test(line)) {
      if (listType !== 'ul') {
        flushList()
        listType = 'ul'
      }
      listItems.push(line.replace(/^[-*]\s+/, ''))
    } else if (/^\d+\.\s/.test(line)) {
      if (listType !== 'ol') {
        flushList()
        listType = 'ol'
      }
      listItems.push(line.replace(/^\d+\.\s+/, ''))
    } else if (line.trim() === '') {
      flushList()
      elements.push(<div key={elements.length} className="h-1.5" />)
    } else {
      flushList()
      elements.push(
        <p key={elements.length} className="text-sm leading-relaxed mb-1.5 text-foreground">
          <InlineMarkdown text={line} />
        </p>
      )
    }
  }
  flushList()

  return <div className="space-y-0">{elements}</div>
}

function InlineMarkdown({ text }: { text: string }) {
  const parts: React.ReactNode[] = []
  let remaining = text
  let keyIdx = 0

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
    const codeMatch = remaining.match(/`(.+?)`/)

    let firstMatch: { index: number; length: number; type: 'bold' | 'code'; content: string } | null = null

    if (boldMatch && boldMatch.index !== undefined) {
      firstMatch = { index: boldMatch.index, length: boldMatch[0].length, type: 'bold', content: boldMatch[1] }
    }
    if (codeMatch && codeMatch.index !== undefined) {
      if (!firstMatch || codeMatch.index < firstMatch.index) {
        firstMatch = { index: codeMatch.index, length: codeMatch[0].length, type: 'code', content: codeMatch[1] }
      }
    }

    if (!firstMatch) {
      parts.push(<span key={keyIdx++}>{remaining}</span>)
      break
    }

    if (firstMatch.index > 0) {
      parts.push(<span key={keyIdx++}>{remaining.substring(0, firstMatch.index)}</span>)
    }

    if (firstMatch.type === 'bold') {
      parts.push(<strong key={keyIdx++} className="font-semibold">{firstMatch.content}</strong>)
    } else {
      parts.push(
        <code key={keyIdx++} className="bg-muted px-1 py-0.5 text-xs font-mono rounded">
          {firstMatch.content}
        </code>
      )
    }

    remaining = remaining.substring(firstMatch.index + firstMatch.length)
  }

  return <>{parts}</>
}

// ─── Stock Card ──────────────────────────────────────────────────────────────

function StockCard({ symbol, onRemove }: { symbol: string; onRemove: () => void }) {
  const colorMap: Record<string, string> = {
    AAPL: 'hsl(220 75% 50%)',
    MSFT: 'hsl(160 65% 40%)',
    GOOGL: 'hsl(280 55% 55%)',
    AMZN: 'hsl(35 80% 50%)',
    TSLA: 'hsl(0 70% 50%)',
  }
  const color = colorMap[symbol] || 'hsl(220 75% 50%)'

  return (
    <div className="relative group bg-card border border-border px-3 py-2 flex items-center justify-between transition-all duration-150 hover:border-primary/40">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="font-semibold text-sm tracking-tight text-foreground">{symbol}</span>
      </div>
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 p-0.5 hover:bg-destructive/10 rounded"
        aria-label={`Remove ${symbol}`}
      >
        <FiX className="w-3 h-3 text-muted-foreground hover:text-destructive" />
      </button>
    </div>
  )
}

// ─── Stock Management Modal ─────────────────────────────────────────────────

function StockManagementModal({
  stocks,
  onUpdate,
  onClose,
}: {
  stocks: string[]
  onUpdate: (s: string[]) => void
  onClose: () => void
}) {
  const [inputVal, setInputVal] = useState('')
  const [localStocks, setLocalStocks] = useState<string[]>(stocks)

  const addStock = () => {
    const sym = inputVal.trim().toUpperCase()
    if (sym && sym.length <= 6 && /^[A-Z]+$/.test(sym) && !localStocks.includes(sym)) {
      setLocalStocks(prev => [...prev, sym])
      setInputVal('')
    }
  }

  const removeStock = (sym: string) => {
    setLocalStocks(prev => prev.filter(s => s !== sym))
  }

  const handleSave = () => {
    onUpdate(localStocks)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Manage Watchlist</CardTitle>
            <button onClick={onClose} className="p-1 hover:bg-muted rounded">
              <FiX className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <CardDescription className="text-xs">Add or remove stock symbols from your watchlist.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          <div className="flex gap-2">
            <Input
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter') addStock() }}
              placeholder="Enter symbol (e.g., AAPL)"
              className="text-sm h-8 bg-background border-border"
            />
            <Button size="sm" onClick={addStock} className="h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90">
              <FiPlus className="w-3.5 h-3.5 mr-1" />
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {localStocks.map(sym => (
              <Badge
                key={sym}
                variant="secondary"
                className="pl-2 pr-1 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground flex items-center gap-1 cursor-default"
              >
                {sym}
                <button onClick={() => removeStock(sym)} className="hover:bg-destructive/20 rounded p-0.5">
                  <FiX className="w-2.5 h-2.5" />
                </button>
              </Badge>
            ))}
            {localStocks.length === 0 && (
              <p className="text-xs text-muted-foreground py-2">No stocks in watchlist. Add some above.</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="pt-2 flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs border-border">Cancel</Button>
          <Button size="sm" onClick={handleSave} className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90">Save Changes</Button>
        </CardFooter>
      </Card>
    </div>
  )
}

// ─── Settings Modal ─────────────────────────────────────────────────────────

function SettingsModal({
  email,
  onSaveEmail,
  onClose,
}: {
  email: string
  onSaveEmail: (e: string) => void
  onClose: () => void
}) {
  const [localEmail, setLocalEmail] = useState(email)

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm bg-card border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Settings</CardTitle>
            <button onClick={onClose} className="p-1 hover:bg-muted rounded">
              <FiX className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <CardDescription className="text-xs">Configure your briefing delivery preferences.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-foreground">Email Address</Label>
            <Input
              type="email"
              value={localEmail}
              onChange={(e) => setLocalEmail(e.target.value)}
              placeholder="your@email.com"
              className="text-sm h-8 bg-background border-border"
            />
            <p className="text-[10px] text-muted-foreground">Analysis reports will be sent to this address.</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-foreground">Schedule</Label>
            <div className="flex items-center gap-2 p-2 bg-muted/50 border border-border rounded-sm">
              <FiInfo className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground">Daily at 2:30 AM IST (Asia/Kolkata)</span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="pt-2 flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs border-border">Cancel</Button>
          <Button
            size="sm"
            onClick={() => { onSaveEmail(localEmail); onClose() }}
            className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Save Settings
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

// ─── Schedule Panel ─────────────────────────────────────────────────────────

function SchedulePanel() {
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [logs, setLogs] = useState<ExecutionLog[]>([])
  const [loading, setLoading] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [triggering, setTriggering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showLogs, setShowLogs] = useState(false)

  const fetchScheduleData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [schedRes, logsRes] = await Promise.all([
        getSchedule(SCHEDULE_ID),
        getScheduleLogs(SCHEDULE_ID, { limit: 5 }),
      ])
      if (schedRes.success && schedRes.schedule) {
        setSchedule(schedRes.schedule)
      }
      if (logsRes.success) {
        setLogs(Array.isArray(logsRes.executions) ? logsRes.executions : [])
      }
    } catch {
      setError('Failed to load schedule data')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchScheduleData()
  }, [fetchScheduleData])

  const handleToggle = async () => {
    if (!schedule) return
    setToggling(true)
    const res = schedule.is_active
      ? await pauseSchedule(SCHEDULE_ID)
      : await resumeSchedule(SCHEDULE_ID)
    if (res.success) {
      setSchedule(prev => prev ? { ...prev, is_active: !prev.is_active } : prev)
    } else {
      setError(res.error || 'Failed to toggle schedule')
    }
    setToggling(false)
  }

  const handleTrigger = async () => {
    setTriggering(true)
    const res = await triggerScheduleNow(SCHEDULE_ID)
    if (!res.success) {
      setError(res.error || 'Failed to trigger schedule')
    }
    setTriggering(false)
    setTimeout(fetchScheduleData, 2000)
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A'
    try {
      return new Date(dateStr).toLocaleString()
    } catch {
      return dateStr
    }
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Schedule Management</CardTitle>
          <button onClick={fetchScheduleData} className="p-1 hover:bg-muted rounded" disabled={loading}>
            <FiRefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {error && (
          <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 p-2 rounded-sm">
            <FiAlertCircle className="w-3 h-3 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading && !schedule ? (
          <div className="flex items-center justify-center py-4">
            <FiLoader className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="space-y-0.5">
                <span className="text-muted-foreground">Status</span>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${schedule?.is_active ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                  <span className="font-medium text-foreground">{schedule?.is_active ? 'Active' : 'Paused'}</span>
                </div>
              </div>
              <div className="space-y-0.5">
                <span className="text-muted-foreground">Frequency</span>
                <span className="font-medium text-foreground block">{cronToHuman('30 2 * * *')}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-muted-foreground">Next Run</span>
                <span className="font-medium text-foreground block text-[11px]">{formatDate(schedule?.next_run_time)}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-muted-foreground">Last Run</span>
                <span className="font-medium text-foreground block text-[11px]">{formatDate(schedule?.last_run_at)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Switch
                  checked={schedule?.is_active ?? false}
                  onCheckedChange={handleToggle}
                  disabled={toggling}
                />
                <Label className="text-xs text-muted-foreground">{toggling ? 'Updating...' : (schedule?.is_active ? 'Pause' : 'Resume')}</Label>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTrigger}
                disabled={triggering}
                className="h-7 text-xs ml-auto border-border"
              >
                {triggering ? <FiLoader className="w-3 h-3 animate-spin mr-1" /> : <FiArrowRight className="w-3 h-3 mr-1" />}
                Run Now
              </Button>
            </div>

            <div>
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showLogs ? <FiChevronUp className="w-3 h-3" /> : <FiChevronDown className="w-3 h-3" />}
                Run History ({logs.length})
              </button>
              {showLogs && (
                <div className="mt-2 space-y-1">
                  {logs.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground py-1">No execution history yet.</p>
                  ) : (
                    logs.map((log, logIdx) => (
                      <div key={log?.id ?? `log-${logIdx}`} className="flex items-center justify-between text-[11px] p-1.5 bg-muted/40 rounded-sm border border-border/50">
                        <div className="flex items-center gap-1.5">
                          {log?.success ? (
                            <FiCheck className="w-3 h-3 text-green-600" />
                          ) : (
                            <FiAlertCircle className="w-3 h-3 text-destructive" />
                          )}
                          <span className="text-muted-foreground">{formatDate(log?.executed_at)}</span>
                        </div>
                        <Badge variant={log?.success ? 'secondary' : 'destructive'} className="text-[10px] h-4 px-1">
                          {log?.success ? 'OK' : 'Failed'}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Agent Info Panel ────────────────────────────────────────────────────────

function AgentInfoPanel({ activeAgentId }: { activeAgentId: string | null }) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-semibold">Agent Info</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-2 py-1">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${activeAgentId === AGENT_ID ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/40'}`} />
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground truncate">Stock Analysis Agent</p>
            <p className="text-[10px] text-muted-foreground truncate">Perplexity sonar-pro -- Real-time market analysis and briefings</p>
          </div>
          {activeAgentId === AGENT_ID && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-auto flex-shrink-0">Active</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Home() {
  // State
  const [stocks, setStocks] = useState<string[]>([])
  const [email, setEmail] = useState('vidur@lyzr.ai')
  const [analysisResult, setAnalysisResult] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [showStockModal, setShowStockModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [sampleData, setSampleData] = useState(false)
  const [copied, setCopied] = useState(false)
  const [lastAnalysisTime, setLastAnalysisTime] = useState<string>('')
  const [currentTime, setCurrentTime] = useState('')

  // Load from localStorage
  useEffect(() => {
    try {
      const savedStocks = localStorage.getItem(LS_KEY_STOCKS)
      if (savedStocks) {
        const parsed = JSON.parse(savedStocks)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setStocks(parsed)
        } else {
          setStocks(DEFAULT_STOCKS)
        }
      } else {
        setStocks(DEFAULT_STOCKS)
      }
    } catch {
      setStocks(DEFAULT_STOCKS)
    }
    try {
      const savedEmail = localStorage.getItem(LS_KEY_EMAIL)
      if (savedEmail) setEmail(savedEmail)
    } catch {
      // ignore
    }
  }, [])

  // Persist stocks
  useEffect(() => {
    if (stocks.length > 0) {
      try { localStorage.setItem(LS_KEY_STOCKS, JSON.stringify(stocks)) } catch { /* ignore */ }
    }
  }, [stocks])

  // Persist email
  useEffect(() => {
    if (email) {
      try { localStorage.setItem(LS_KEY_EMAIL, email) } catch { /* ignore */ }
    }
  }, [email])

  // Clock
  useEffect(() => {
    setCurrentTime(new Date().toLocaleTimeString())
    const interval = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 60000)
    return () => clearInterval(interval)
  }, [])

  // Sample data toggle
  useEffect(() => {
    if (sampleData) {
      setAnalysisResult(SAMPLE_ANALYSIS)
      setLastAnalysisTime('Feb 10, 2026 7:00 AM')
      setEmail((prev) => prev || 'vidur@lyzr.ai')
    } else {
      setAnalysisResult('')
      setLastAnalysisTime('')
    }
  }, [sampleData])

  // Run analysis
  const runAnalysis = async () => {
    if (stocks.length === 0) {
      setError('Add at least one stock to your watchlist first.')
      return
    }
    setIsLoading(true)
    setError(null)
    setActiveAgentId(AGENT_ID)

    try {
      const message = `Analyze the following stocks for my morning briefing: ${stocks.join(', ')}. Provide current price movements, key metrics, market sentiment, recent news, and actionable insights for each stock. Format as a comprehensive portfolio briefing.${email ? ` Send the report to ${email}.` : ''}`

      const result = await callAIAgent(message, AGENT_ID)

      if (result?.success) {
        let text = ''
        const resp = result?.response
        if (typeof resp === 'string') {
          text = resp
        } else if (resp?.result) {
          if (typeof resp.result === 'string') {
            text = resp.result
          } else if (resp.result?.text) {
            text = resp.result.text
          } else if (resp.result?.response) {
            text = resp.result.response
          } else if (resp.result?.raw_text) {
            text = resp.result.raw_text
          } else {
            try {
              text = JSON.stringify(resp.result, null, 2)
            } catch {
              text = String(resp.result)
            }
          }
        } else if (resp?.message) {
          text = resp.message
        }

        if (result?.raw_response && !text) {
          text = result.raw_response
        }

        setAnalysisResult(text || 'Analysis completed but no content returned.')
        setLastAnalysisTime(new Date().toLocaleString())
      } else {
        setError(result?.error || result?.response?.message || 'Analysis failed. Please try again.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    }

    setActiveAgentId(null)
    setIsLoading(false)
  }

  const handleCopy = async () => {
    if (!analysisResult) return
    const ok = await copyToClipboard(analysisResult)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const displayStocks = stocks.length > 0 ? stocks : DEFAULT_STOCKS

  return (
    <div style={THEME_VARS} className="min-h-screen bg-background text-foreground font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-primary rounded-sm flex items-center justify-center">
              <FiSearch className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-foreground leading-none">Stock Analysis Assistant</h1>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">AI-powered market briefings</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="sample-toggle" className="text-xs text-muted-foreground">Sample Data</Label>
              <Switch
                id="sample-toggle"
                checked={sampleData}
                onCheckedChange={setSampleData}
              />
            </div>
            <button onClick={() => setShowSettingsModal(true)} className="p-1.5 hover:bg-muted rounded-sm transition-colors">
              <FiSettings className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column - Watchlist & Controls */}
          <div className="lg:col-span-4 space-y-3">
            {/* Portfolio Summary */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-1.5">
                <CardTitle className="text-sm font-semibold">Portfolio Summary</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Tracked</span>
                    <p className="text-2xl font-semibold text-foreground leading-none">{displayStocks.length}</p>
                    <span className="text-[10px] text-muted-foreground">stocks</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Last Run</span>
                    <p className="text-xs font-medium text-foreground leading-tight mt-1">{lastAnalysisTime || 'Not yet'}</p>
                  </div>
                </div>
                {currentTime && (
                  <div className="mt-2 pt-2 border-t border-border/60">
                    <span className="text-[10px] text-muted-foreground">Current time: {currentTime}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Watchlist */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-1.5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Watchlist</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowStockModal(true)}
                    className="h-6 text-[10px] px-2 border-border"
                  >
                    <FiPlus className="w-3 h-3 mr-0.5" />
                    Manage
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-1.5">
                  {displayStocks.map(sym => (
                    <StockCard
                      key={sym}
                      symbol={sym}
                      onRemove={() => setStocks(prev => prev.filter(s => s !== sym))}
                    />
                  ))}
                </div>
                {displayStocks.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No stocks tracked. Click Manage to add symbols.</p>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="space-y-2">
              <Button
                onClick={runAnalysis}
                disabled={isLoading || stocks.length === 0}
                className="w-full h-9 bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-sm"
              >
                {isLoading ? (
                  <>
                    <FiLoader className="w-4 h-4 animate-spin mr-2" />
                    Analyzing {stocks.length} stocks...
                  </>
                ) : (
                  <>
                    <FiSend className="w-3.5 h-3.5 mr-2" />
                    Analyze Now
                  </>
                )}
              </Button>

              {isLoading && (
                <div className="flex items-center gap-1.5 px-2 py-1.5 bg-primary/5 border border-primary/20 rounded-sm">
                  <FiLoader className="w-3 h-3 animate-spin text-primary" />
                  <span className="text-[11px] text-primary font-medium">Running analysis with Perplexity AI...</span>
                </div>
              )}
            </div>

            {/* Schedule Panel */}
            <SchedulePanel />

            {/* Agent Info */}
            <AgentInfoPanel activeAgentId={activeAgentId} />
          </div>

          {/* Right Column - Analysis Results */}
          <div className="lg:col-span-8">
            <Card className="bg-card border-border h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold">Analysis Report</CardTitle>
                    {lastAnalysisTime && (
                      <CardDescription className="text-[10px] mt-0.5">Generated: {lastAnalysisTime}</CardDescription>
                    )}
                  </div>
                  {analysisResult && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopy}
                      className="h-7 text-xs border-border"
                    >
                      {copied ? <FiCheck className="w-3 h-3 mr-1 text-green-600" /> : <FiCopy className="w-3 h-3 mr-1" />}
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {error && (
                  <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-sm mb-3">
                    <FiAlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-destructive">Analysis Error</p>
                      <p className="text-[11px] text-destructive/80 mt-0.5">{error}</p>
                    </div>
                  </div>
                )}

                {isLoading && !analysisResult && (
                  <div className="space-y-3 py-8">
                    <div className="flex flex-col items-center gap-3">
                      <FiLoader className="w-6 h-6 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Generating comprehensive analysis...</p>
                    </div>
                    <div className="space-y-2 px-4">
                      <div className="animate-pulse bg-muted rounded h-4 w-3/4" />
                      <div className="animate-pulse bg-muted rounded h-4 w-full" />
                      <div className="animate-pulse bg-muted rounded h-4 w-5/6" />
                      <div className="animate-pulse bg-muted rounded h-3 w-2/3" />
                      <div className="animate-pulse bg-muted rounded h-3 w-4/5" />
                    </div>
                  </div>
                )}

                {!analysisResult && !isLoading && !error && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-12 h-12 bg-muted rounded-sm flex items-center justify-center mb-3">
                      <FiSearch className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">No Analysis Yet</p>
                    <p className="text-xs text-muted-foreground max-w-xs">Click "Analyze Now" to generate a comprehensive market briefing for your watchlist stocks. The AI will analyze prices, news, and sentiment.</p>
                    <p className="text-[10px] text-muted-foreground mt-3">Tip: Turn on "Sample Data" to preview a report.</p>
                  </div>
                )}

                {analysisResult && (
                  <ScrollArea className="h-[calc(100vh-220px)] pr-3">
                    <MarkdownRenderer content={analysisResult} />
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Modals */}
      {showStockModal && (
        <StockManagementModal
          stocks={stocks}
          onUpdate={setStocks}
          onClose={() => setShowStockModal(false)}
        />
      )}
      {showSettingsModal && (
        <SettingsModal
          email={email}
          onSaveEmail={setEmail}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </div>
  )
}
