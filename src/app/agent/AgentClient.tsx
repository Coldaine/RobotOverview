'use client';

import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  isToolUIPart,
  getToolName,
  type UIMessage,
} from 'ai';
import clsx from 'clsx';
import { Activity, AlertTriangle, Bot, Lock, Send, ShieldAlert } from 'lucide-react';
import { useMemo, useState } from 'react';

type AgentClientProps = {
  enabled: boolean;
  bridgeConfigured: boolean;
  plannerConfigured: boolean;
  modelLabel: string | null;
};

function DegradedPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-[70vh] flex-col items-center justify-center p-6 text-center">
      <div className="panel max-w-md select-none border-crit/50 bg-crit/10 px-8 py-10 shadow-hud-red text-glow-crit">
        <Activity className="mx-auto mb-4 h-12 w-12 animate-pulse text-crit" />
        <h1 className="mb-3 font-display text-xl uppercase tracking-widest text-crit">{title}</h1>
        <div className="space-y-3 font-mono text-sm leading-relaxed text-ink-dim">{children}</div>
      </div>
    </div>
  );
}

function ToolPartView({
  part,
  onApprove,
  onDeny,
}: {
  part: UIMessage['parts'][number];
  onApprove: (approvalId: string) => void;
  onDeny: (approvalId: string) => void;
}) {
  if (!isToolUIPart(part)) return null;
  const name = getToolName(part);
  const isMotion = name === 'drive_on_heading' || name === 'spin' || name === 'back_up';

  const state = 'state' in part ? String(part.state) : 'unknown';
  const input = 'input' in part ? part.input : undefined;
  const output = 'output' in part ? part.output : undefined;
  const approval =
    'approval' in part && part.approval && typeof part.approval === 'object'
      ? (part.approval as { id?: string })
      : null;

  return (
    <div
      className={clsx(
        'panel-inset mt-2 border px-3 py-2 font-mono text-[11px]',
        isMotion ? 'border-amber-500/40 bg-amber-950/20' : 'border-rim/60 bg-panel-2/40',
      )}
    >
      <div className="mb-1 flex items-center gap-2 font-display text-[10px] uppercase tracking-[0.16em]">
        {isMotion ? (
          <ShieldAlert className="h-3 w-3 text-amber-400" />
        ) : (
          <Bot className="h-3 w-3 text-cyan" />
        )}
        <span className={isMotion ? 'text-amber-300' : 'text-cyan'}>{name}</span>
        <span className="text-ink-dim">· {state}</span>
      </div>

      {input !== undefined && (
        <pre className="overflow-x-auto text-ink-dim whitespace-pre-wrap">
          {JSON.stringify(input, null, 0)}
        </pre>
      )}

      {state === 'approval-requested' && approval?.id && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border border-cyan/50 bg-cyan/10 px-3 py-1 font-display text-[10px] uppercase tracking-wider text-cyan hover:bg-cyan/20"
            onClick={() => onApprove(approval.id!)}
          >
            Approve
          </button>
          <button
            type="button"
            className="rounded border border-crit/50 bg-crit/10 px-3 py-1 font-display text-[10px] uppercase tracking-wider text-crit hover:bg-crit/20"
            onClick={() => onDeny(approval.id!)}
          >
            Deny
          </button>
        </div>
      )}

      {state === 'output-available' && output !== undefined && (
        <pre className="mt-1 overflow-x-auto text-ink whitespace-pre-wrap">
          {typeof output === 'string' ? output : JSON.stringify(output, null, 2)}
        </pre>
      )}

      {state === 'output-denied' && (
        <p className="mt-1 text-crit">Operator denied this motion intent.</p>
      )}
    </div>
  );
}

export function AgentClient({
  enabled,
  bridgeConfigured,
  plannerConfigured,
  modelLabel,
}: AgentClientProps) {
  const [input, setInput] = useState('');

  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/agent/chat' }),
    [],
  );

  const { messages, sendMessage, addToolApprovalResponse, status, error } = useChat({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  });

  if (!enabled) {
    return (
      <DegradedPanel title="Agent Path Disabled">
        <p>
          Set <code className="text-crit">HANGAR_AGENT_ENABLED=true</code> to expose the
          language → tool → approval command path.
        </p>
        <p className="text-xs">
          Wave 1 skeleton only — no live arming. Motion tools refuse when{' '}
          <code className="text-crit">allow_motion</code> is not true.
        </p>
      </DegradedPanel>
    );
  }

  const busy = status === 'submitted' || status === 'streaming';

  return (
    <div className="flex flex-col gap-4 px-4 py-3 pb-24 md:px-6">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <div className="flex items-center gap-3">
          <Bot className="h-6 w-6 animate-pulse text-cyan" />
          <h1 className="font-display text-xl font-bold tracking-[0.22em] text-ink uppercase">
            BEAST-01 <span className="text-cyan text-glow-cyan">{'//'} AGENT</span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] tracking-wider">
          {!bridgeConfigured && (
            <span className="chip border-amber-500/40 bg-amber-950/30 px-3 py-1 text-amber-300">
              BRIDGE UNSET
            </span>
          )}
          {!plannerConfigured && (
            <span className="chip border-crit/40 bg-crit/5 px-3 py-1 text-crit animate-pulse">
              PLANNER UNSET
            </span>
          )}
          {plannerConfigured && modelLabel && (
            <span className="chip border-rim/50 bg-panel-2/50 px-3 py-1 text-ink-dim">
              MODEL {modelLabel}
            </span>
          )}
          <span className="chip border-rim/50 bg-panel-2/50 px-3 py-1 text-ink-dim">
            MOTION LOCK RESPECTED
          </span>
        </div>
      </header>

      {(!bridgeConfigured || !plannerConfigured) && (
        <div
          role="status"
          className="panel flex flex-col gap-1.5 border-amber-500/40 bg-amber-950/20 p-3"
        >
          <div className="flex items-center gap-2 font-display text-[11px] font-bold uppercase tracking-[0.16em] text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            Degraded agent path
          </div>
          <ul className="font-mono text-[10px] text-amber-100/80 space-y-1">
            {!bridgeConfigured && (
              <li>
                <Lock className="mr-1 inline h-3 w-3" />
                <code>BEAST_COCKPIT_WS_URL</code> unset — get_status reports bridge idle;
                motion tools refuse. Cockpit bridge not required for UI smoke.
              </li>
            )}
            {!plannerConfigured && (
              <li>
                Set <code>BEAST_AGENT_BASE_URL</code> + <code>BEAST_AGENT_MODEL</code> for
                streamText (OpenAI-compatible / Ollama on CORE-PRIME).
              </li>
            )}
          </ul>
        </div>
      )}

      <main className="panel flex min-h-[55vh] flex-col border-rim bg-panel/85 shadow-hud">
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 && (
            <p className="font-mono text-xs text-ink-dim leading-relaxed">
              Type a command. The planner may call <code className="text-cyan">get_status</code>{' '}
              first; motion intents (<code className="text-amber-300">drive_on_heading</code>,{' '}
              <code className="text-amber-300">spin</code>,{' '}
              <code className="text-amber-300">back_up</code>) pause for your approval.
              Disarmed robots stay honest — tools refuse when allow_motion is not true.
            </p>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={clsx(
                'rounded-lg border px-3 py-2',
                m.role === 'user'
                  ? 'ml-8 border-cyan/30 bg-cyan/5'
                  : 'mr-4 border-rim/50 bg-panel-2/40',
              )}
            >
              <div className="mb-1 font-display text-[10px] uppercase tracking-[0.18em] text-ink-dim">
                {m.role === 'user' ? 'Operator' : 'Planner'}
              </div>
              {m.parts?.map((part, i) => {
                if (part.type === 'text') {
                  return (
                    <p key={i} className="font-mono text-sm text-ink whitespace-pre-wrap">
                      {part.text}
                    </p>
                  );
                }
                if (isToolUIPart(part)) {
                  return (
                    <ToolPartView
                      key={i}
                      part={part}
                      onApprove={(id) =>
                        void addToolApprovalResponse({ id, approved: true })
                      }
                      onDeny={(id) =>
                        void addToolApprovalResponse({
                          id,
                          approved: false,
                          reason: 'operator denied',
                        })
                      }
                    />
                  );
                }
                return null;
              })}
            </div>
          ))}
        </div>

        {error && (
          <div className="border-t border-crit/40 bg-crit/10 px-4 py-2 font-mono text-[11px] text-crit">
            {error.message}
          </div>
        )}

        <form
          className="flex gap-2 border-t border-rim/40 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const text = input.trim();
            if (!text || busy || !plannerConfigured) return;
            void sendMessage({ text });
            setInput('');
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy || !plannerConfigured}
            placeholder={
              plannerConfigured
                ? 'e.g. check status, then spin 15 degrees if armed'
                : 'Configure BEAST_AGENT_* to chat'
            }
            className="flex-1 rounded border border-rim/50 bg-panel-2/60 px-3 py-2 font-mono text-sm text-ink placeholder:text-ink-dim/50 focus:border-cyan/50 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={busy || !plannerConfigured || !input.trim()}
            className="inline-flex items-center gap-2 rounded border border-cyan/40 bg-cyan/10 px-4 py-2 font-display text-[11px] uppercase tracking-wider text-cyan hover:bg-cyan/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
            Send
          </button>
        </form>
      </main>
    </div>
  );
}
