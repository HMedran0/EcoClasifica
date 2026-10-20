type Block = { kind: 'paragraph'; text: string } | { kind: 'list'; items: string[]; start: number };

const NUMBERED = /^(\d{1,2})[.)]\s+(.*)$/;

/** Agrupa líneas en párrafos y listas numeradas. Todo es texto: React lo escapa, nunca es HTML. */
export function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const match = NUMBERED.exec(line);
    const last = blocks.at(-1);
    if (match) {
      const item = match[2] ?? '';
      if (last?.kind === 'list') last.items.push(item);
      else blocks.push({ kind: 'list', items: [item], start: Number(match[1]) });
    } else {
      blocks.push({ kind: 'paragraph', text: line });
    }
  }
  return blocks;
}

export function MessageText({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2">
      {toBlocks(text).map((block, i) =>
        block.kind === 'list' ? (
          <ol key={i} start={block.start} className="flex list-decimal flex-col gap-1 pl-6">
            {block.items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </ol>
        ) : (
          <p key={i}>{block.text}</p>
        ),
      )}
    </div>
  );
}
