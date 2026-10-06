import { ArrowLeft, Check, Hash, Loader2, RotateCcw, Search } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import { FaSlack } from 'react-icons/fa'
import type { IdentityPath } from '../data/escalation'
import { evidenceFor } from '../data/exposure'
import type { Resource } from '../data/types'

/* ─────────────────────────────────────────────────────────
 * SEND TO SLACK (mock)
 *
 *   Pick channels → pick how much detail → edit the drafted
 *   message (or preview it as Slack would show it) → Send.
 *   Sending is simulated; nothing leaves the browser.
 * ───────────────────────────────────────────────────────── */

export type ShareTarget = { resource: Resource } | { path: IdentityPath }
export type DetailLevel = 'summary' | 'standard' | 'full'
export interface SentRecord {
  channels: string[]
  at: Date
}

export interface Channel {
  id: string
  name: string
  purpose: string
  members: number
}

export const SLACK_CHANNELS: Channel[] = [
  { id: 'security-oncall', name: 'security-oncall', purpose: 'Security on-call rotation', members: 8 },
  { id: 'incident-response', name: 'incident-response', purpose: 'Active incidents', members: 15 },
  { id: 'platform-eng', name: 'platform-eng', purpose: 'Platform engineering', members: 12 },
  { id: 'cloud-infra', name: 'cloud-infra', purpose: 'Cloud accounts and IAM', members: 6 },
  { id: 'appsec', name: 'appsec', purpose: 'Application security', members: 9 },
  { id: 'eng-leads', name: 'eng-leads', purpose: 'Engineering leads', members: 7 },
]

const LEVELS: { id: DetailLevel; label: string; hint: string }[] = [
  { id: 'summary', label: 'Summary', hint: 'Headline and link' },
  { id: 'standard', label: 'Standard', hint: 'Plus why it matters' },
  { id: 'full', label: 'Full evidence', hint: 'Plus everything we observed' },
]

const SEVERITY_LABEL = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', sensitive: 'Sensitive', none: 'Info' } as const

const riskOf = (t: ShareTarget) => ('path' in t ? t.path.risk : t.resource.risk)
const linkFor = (t: ShareTarget) => `https://app.parameter.ai/infrastructure/exposure/${'path' in t ? t.path.id : t.resource.id}`

/** Channels suggested first: on-call and incidents for anything critical, otherwise the infra owners. */
export function suggestedChannels(t: ShareTarget) {
  return riskOf(t) === 'critical' ? ['security-oncall', 'incident-response'] : ['cloud-infra']
}

/** Draft the Slack message (Slack markdown: *bold*, `code`) for a finding at a detail level. */
export function draftMessage(t: ShareTarget, level: DetailLevel) {
  const sev = SEVERITY_LABEL[riskOf(t)]
  const lines: string[] = []
  if ('path' in t) {
    const p = t.path
    const entities = p.chain.flatMap((c) => ('entity' in c ? [c.entity] : []))
    lines.push(`*${sev} · ${p.kind === 'escalation' ? 'Privilege escalation path' : 'Expected access'}* in ${p.account}`)
    lines.push(`${entities[0]} → ${entities[entities.length - 1]}`)
    if (level !== 'summary') {
      lines.push('', p.explain, '', `Grant: \`${p.grant}\``, `Traits: ${p.traits.join(', ')}`)
      if (p.reaches) lines.push(`Reaches: ${p.reaches} credentials`)
    }
    if (level === 'full') {
      lines.push('', '*Chain*')
      p.chain.forEach((c, i) => {
        if ('entity' in c) lines.push(`${Math.floor(i / 2) + 1}. ${i > 0 ? `${(p.chain[i - 1] as { verb: string }).verb} ` : ''}${c.entity}`)
      })
    }
  } else {
    const r = t.resource
    const ev = evidenceFor(r)
    const reachable = r.exposure === 'internet'
    lines.push(`*${sev} · ${reachable ? 'Internet reachable' : 'Holds credentials or data'}*: ${r.name}`)
    lines.push(`${r.type} · ${r.location} · ${r.project}`)
    if (level !== 'summary') {
      lines.push('', reachable ? ev.reason : 'Nothing exposes it to the internet directly, but an identity that can read it may be reachable.')
    }
    if (level === 'full') {
      if (reachable) {
        lines.push('', '*Observed*', ...ev.observed.map(([k, v]) => `• ${k}: \`${v}\``))
        lines.push('', '*Evidence*', ...ev.sources.map((s) => `• \`${s}\``))
      }
      lines.push('', `Resource: \`${r.path}\``)
    }
  }
  lines.push('', `View in Parameter: ${linkFor(t)}`)
  return lines.join('\n')
}

/** Tiny Slack-markdown renderer for the preview: *bold* and `code`, line by line. */
function SlackText({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <div key={i} className={line ? '' : 'h-2.5'}>
          {line.split(/(\*[^*]+\*|`[^`]+`|https?:\/\/\S+)/g).map((part, j) =>
            part.startsWith('*') && part.endsWith('*') && part.length > 2 ? (
              <strong key={j} className="font-semibold">
                {part.slice(1, -1)}
              </strong>
            ) : part.startsWith('`') && part.endsWith('`') && part.length > 2 ? (
              <code key={j} className="rounded border border-[#e3e3e3] bg-[#f6f6f6] px-1 font-mono text-[12px] break-all text-[#c0255a] [box-decoration-break:clone]">
                {part.slice(1, -1)}
              </code>
            ) : /^https?:\/\//.test(part) ? (
              <span key={j} className="break-all text-[#1264a3]">
                {part}
              </span>
            ) : (
              <Fragment key={j}>{part}</Fragment>
            ),
          )}
        </div>
      ))}
    </>
  )
}

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-t border-line-soft px-5 py-4">
      <div className="flex items-center justify-between">
        <div className="text-xs leading-4 font-medium text-subtle">{title}</div>
        {aside}
      </div>
      <div className="mt-2.5">{children}</div>
    </section>
  )
}

export function SlackComposer({ target, onBack, onSent }: { target: ShareTarget; onBack: () => void; onSent: (channels: string[]) => void }) {
  const suggested = useMemo(() => suggestedChannels(target), [target])
  const [picked, setPicked] = useState<Set<string>>(() => new Set(suggested.slice(0, 1)))
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState<DetailLevel>('standard')
  // Once the user edits the draft, switching detail level no longer overwrites their text.
  const [text, setText] = useState(() => draftMessage(target, 'standard'))
  const [edited, setEdited] = useState(false)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [sending, setSending] = useState(false)

  const channels = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^#/, '')
    const list = SLACK_CHANNELS.filter((c) => !q || c.name.includes(q) || c.purpose.toLowerCase().includes(q))
    return [...list].sort((a, b) => Number(suggested.includes(b.id)) - Number(suggested.includes(a.id)))
  }, [query, suggested])

  const pickLevel = (l: DetailLevel) => {
    setLevel(l)
    if (!edited) setText(draftMessage(target, l))
  }
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const send = () => {
    setSending(true)
    window.setTimeout(() => onSent([...picked]), 900)
  }

  const canSend = picked.size > 0 && text.trim().length > 0 && !sending

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <header className="px-5 py-4">
          <button
            onClick={onBack}
            className="-ml-1.5 flex h-7 items-center gap-1.5 rounded-md px-1.5 text-[13px] leading-5 text-muted hover:bg-[#f0f0f0] hover:text-ink"
          >
            <ArrowLeft className="size-3.5" />
            Back to details
          </button>
          <h2 className="mt-2 flex items-center gap-2 text-[15px] leading-6 font-semibold text-ink">
            <FaSlack className="size-4 text-[#4a154b]" />
            Send to Slack
          </h2>
          <p className="mt-0.5 text-[13px] leading-5 text-subtle">Share this finding with the people who can fix it.</p>
        </header>

        <Section title="Send to" aside={picked.size > 0 && <span className="text-xs leading-4 text-muted tabular-nums">{picked.size} selected</span>}>
          <label className="flex h-9 items-center gap-2 rounded-md border border-[#e0e0e0] bg-white px-3 text-sm">
            <Search className="size-4 shrink-0 text-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a channel"
              className="w-full bg-transparent outline-none placeholder:text-[#a3a3a3]"
            />
          </label>
          <ul className="mt-2 max-h-[208px] overflow-y-auto rounded-lg border border-line bg-white">
            {channels.map((c) => {
              const on = picked.has(c.id)
              return (
                <li key={c.id} className="border-b border-line-soft last:border-b-0">
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-[#fafafa]">
                    <input type="checkbox" checked={on} onChange={() => toggle(c.id)} />
                    <Hash className="size-3.5 shrink-0 text-subtle" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm leading-5 font-medium text-ink">{c.name}</span>
                        {suggested.includes(c.id) && (
                          <span className="rounded border border-line bg-[#f6f6f6] px-1 text-[11px] leading-4 text-muted">Suggested</span>
                        )}
                      </span>
                      <span className="block truncate text-xs leading-4 text-subtle">
                        {c.purpose} · {c.members} members
                      </span>
                    </span>
                  </label>
                </li>
              )
            })}
            {channels.length === 0 && <li className="px-3 py-4 text-center text-[13px] text-subtle">No channels match.</li>}
          </ul>
        </Section>

        <Section title="How much detail">
          <div role="radiogroup" className="grid grid-cols-3 gap-2">
            {LEVELS.map((l) => (
              <button
                key={l.id}
                role="radio"
                aria-checked={level === l.id}
                onClick={() => pickLevel(l.id)}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  level === l.id ? 'border-[#c4c4c4] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.05)]' : 'border-line bg-transparent hover:bg-white'
                }`}
              >
                <span className="flex items-center justify-between text-[13px] leading-5 font-medium text-ink">
                  {l.label}
                  {level === l.id && <Check className="size-3.5" />}
                </span>
                <span className="block text-xs leading-4 text-subtle">{l.hint}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section
          title="Message"
          aside={
            <div className="flex items-center gap-2">
              {edited && (
                <button
                  onClick={() => {
                    setText(draftMessage(target, level))
                    setEdited(false)
                  }}
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs leading-4 text-muted hover:bg-[#f0f0f0] hover:text-ink"
                >
                  <RotateCcw className="size-3" />
                  Reset
                </button>
              )}
              <div className="flex rounded-md bg-[#f0f0f0] p-0.5 text-xs leading-4">
                {(['edit', 'preview'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`rounded px-2 py-0.5 capitalize ${mode === m ? 'bg-white font-medium text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          }
        >
          {mode === 'edit' ? (
            <>
              <textarea
                value={text}
                onChange={(e) => {
                  setText(e.target.value)
                  setEdited(true)
                }}
                rows={11}
                className="block w-full resize-y rounded-lg border border-[#e0e0e0] bg-white px-3 py-2.5 text-[13px] leading-5 text-ink outline-none focus:border-[#c4c4c4] focus:shadow-[0_0_0_3px_rgba(23,23,23,0.06)]"
              />
              <p className="mt-1.5 text-xs leading-4 text-subtle">Add your own notes or edit anything. *bold* and `code` work like in Slack.</p>
            </>
          ) : (
            <div className="rounded-lg border border-line bg-white p-3">
              <div className="flex gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-ink text-xs font-semibold text-white">P</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5 text-[13px] leading-5">
                    <span className="font-semibold text-ink">Parameter</span>
                    <span className="rounded bg-[#ececec] px-1 text-[10px] leading-4 font-medium text-muted">APP</span>
                    <span className="text-xs text-subtle">now</span>
                  </div>
                  <div className="mt-1 min-w-0 text-[13px] leading-5 [overflow-wrap:anywhere] text-[#1d1c1d]">
                    <SlackText text={text} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </Section>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line bg-page px-5 py-3">
        <span className="min-w-0 truncate text-xs leading-4 text-subtle">
          {picked.size === 0 ? 'Pick at least one channel' : [...picked].map((id) => `#${id}`).join(', ')}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={onBack}
            className="flex h-9 items-center rounded-md border border-[#e0e0e0] bg-white px-3 text-sm font-medium text-[#525252] hover:bg-[#fafafa] hover:text-ink"
          >
            Cancel
          </button>
          <button
            onClick={send}
            disabled={!canSend}
            className="flex h-9 items-center gap-1.5 rounded-md bg-ink px-3.5 text-sm font-medium text-white shadow-sm transition duration-150 ease-out hover:bg-[#2a2a2a] enabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-[#d4d4d4]"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <FaSlack className="size-3.5" />}
            {sending ? 'Sending…' : `Send to ${picked.size || ''} ${picked.size === 1 ? 'channel' : 'channels'}`.replace('  ', ' ')}
          </button>
        </div>
      </div>
    </div>
  )
}
