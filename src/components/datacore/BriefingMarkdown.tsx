import type { ReactNode } from 'react';
import clsx from 'clsx';

type Block =
  | { type: 'h1' | 'h2' | 'h3'; text: string }
  | { type: 'p'; text: string }
  | { type: 'blockquote'; text: string }
  | { type: 'ul' | 'ol'; items: string[] }
  | { type: 'code'; lang: string; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'hr' };

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cell.trim());
}

function isTableSep(line: string): boolean {
  return /^\|?[\s:-|]+\|?$/.test(line.trim()) && line.includes('-');
}

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push({ type: 'code', lang, text: body.join('\n') });
      continue;
    }

    if (line.trim() === '---') {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    if (line.startsWith('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const headers = splitTableRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        rows.push(splitTableRow(lines[i]));
        i += 1;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    if (line.startsWith('# ')) {
      blocks.push({ type: 'h1', text: line.slice(2).trim() });
      i += 1;
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', text: line.slice(3).trim() });
      i += 1;
      continue;
    }
    if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', text: line.slice(4).trim() });
      i += 1;
      continue;
    }

    if (line.startsWith('> ')) {
      const parts: string[] = [line.slice(2)];
      i += 1;
      while (i < lines.length && lines[i].startsWith('> ')) {
        parts.push(lines[i].slice(2));
        i += 1;
      }
      blocks.push({ type: 'blockquote', text: parts.join('\n') });
      continue;
    }

    if (/^[-*] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(lines[i].replace(/^[-*] /, ''));
        i += 1;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ''));
        i += 1;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    const parts: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('>') &&
      !lines[i].startsWith('|') &&
      !lines[i].startsWith('```') &&
      !/^[-*] /.test(lines[i]) &&
      !/^\d+\. /.test(lines[i]) &&
      lines[i].trim() !== '---'
    ) {
      parts.push(lines[i]);
      i += 1;
    }
    blocks.push({ type: 'p', text: parts.join(' ') });
  }

  return blocks;
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re =
    /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\[[^\]]+\]\[[^\]]+\])/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push(
        <strong key={key++} className="font-semibold text-ink">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith('`')) {
      nodes.push(
        <code
          key={key++}
          className="rounded border border-rim/70 bg-panel-2/60 px-1 py-0.5 font-mono text-[11px] text-cyan"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('[')) {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const ref = token.match(/^\[([^\]]+)\]\[([^\]]+)\]$/);
      if (link) {
        nodes.push(
          <a
            key={key++}
            href={link[2]}
            target="_blank"
            rel="noreferrer"
            className="text-cyan underline decoration-cyan/40 underline-offset-2 hover:text-cyan-soft"
          >
            {link[1]}
          </a>,
        );
      } else if (ref) {
        nodes.push(
          <span key={key++} className="text-amber">
            {ref[1]}
            <sup className="ml-0.5 font-mono text-[9px] text-ink-dim">[{ref[2]}]</sup>
          </span>,
        );
      }
    }
    last = match.index + token.length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function BriefingMarkdown({ markdown }: { readonly markdown: string }) {
  // Drop reference-definition lines from the body; Sources section still lists them as prose.
  const body = markdown
    .split('\n')
    .filter((line) => !/^\[\d+\]:\s+https?:\/\//.test(line.trim()))
    .join('\n');

  const blocks = parseBlocks(body);

  return (
    <div className="space-y-5">
      {blocks.map((block, idx) => {
        if (block.type === 'h1') {
          return (
            <h1
              key={idx}
              className="font-display text-2xl font-bold uppercase tracking-[0.06em] text-ink"
            >
              {renderInline(block.text)}
            </h1>
          );
        }
        if (block.type === 'h2') {
          return (
            <h2
              key={idx}
              className="mt-8 border-l-2 border-cyan/50 pl-3 font-display text-lg font-semibold uppercase tracking-[0.08em] text-cyan"
            >
              {renderInline(block.text)}
            </h2>
          );
        }
        if (block.type === 'h3') {
          return (
            <h3
              key={idx}
              className="mt-4 font-display text-sm font-semibold uppercase tracking-[0.1em] text-amber"
            >
              {renderInline(block.text)}
            </h3>
          );
        }
        if (block.type === 'p') {
          return (
            <p key={idx} className="font-mono text-[12px] leading-relaxed text-ink-dim">
              {renderInline(block.text)}
            </p>
          );
        }
        if (block.type === 'blockquote') {
          return (
            <blockquote
              key={idx}
              className="border-l-2 border-amber/60 bg-amber/5 px-4 py-3 font-mono text-[12px] leading-relaxed text-ink"
            >
              {block.text.split('\n').map((line, li) => (
                <p key={li} className={clsx(li > 0 && 'mt-2')}>
                  {renderInline(line)}
                </p>
              ))}
            </blockquote>
          );
        }
        if (block.type === 'ul') {
          return (
            <ul key={idx} className="list-disc space-y-1.5 pl-5 font-mono text-[12px] text-ink-dim">
              {block.items.map((item, ii) => (
                <li key={ii}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === 'ol') {
          return (
            <ol key={idx} className="list-decimal space-y-1.5 pl-5 font-mono text-[12px] text-ink-dim">
              {block.items.map((item, ii) => (
                <li key={ii}>{renderInline(item)}</li>
              ))}
            </ol>
          );
        }
        if (block.type === 'code') {
          return (
            <pre
              key={idx}
              className="overflow-x-auto rounded-md border border-rim/80 bg-void/80 p-4 font-mono text-[11px] leading-relaxed text-cyan-soft shadow-hud"
            >
              <code>{block.text}</code>
            </pre>
          );
        }
        if (block.type === 'table') {
          return (
            <div key={idx} className="overflow-x-auto rounded-md border border-rim/70">
              <table className="min-w-full border-collapse font-mono text-[11px]">
                <thead className="bg-panel-2/80 text-cyan">
                  <tr>
                    {block.headers.map((h, hi) => (
                      <th
                        key={hi}
                        className="border-b border-rim px-3 py-2 text-left font-semibold uppercase tracking-[0.08em]"
                      >
                        {renderInline(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, ri) => (
                    <tr key={ri} className="odd:bg-panel/40 even:bg-hull/40">
                      {row.map((cell, ci) => (
                        <td key={ci} className="border-t border-rim/50 px-3 py-2 text-ink-dim">
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return <hr key={idx} className="border-rim/60" />;
      })}
    </div>
  );
}
