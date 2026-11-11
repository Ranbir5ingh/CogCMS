function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inlineMarkdownToHtml(text: string): string {
  return escapeHtml(text)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

export function markdownToEditorHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let paragraph: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let listItems: string[] = [];

  const flushParagraph = () => {
    const text = paragraph.join(' ').trim();
    if (text) html.push(`<p>${inlineMarkdownToHtml(text)}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (listType && listItems.length) {
      html.push(
        `<${listType}>${listItems.map((item) => `<li>${inlineMarkdownToHtml(item)}</li>`).join('')}</${listType}>`,
      );
    }
    listType = null;
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
    } else if (line.startsWith('## ')) {
      flushParagraph();
      flushList();
      html.push(`<h2>${inlineMarkdownToHtml(line.slice(3).trim())}</h2>`);
    } else if (line.startsWith('### ')) {
      flushParagraph();
      flushList();
      html.push(`<h3>${inlineMarkdownToHtml(line.slice(4).trim())}</h3>`);
    } else if (line.startsWith('- ')) {
      flushParagraph();
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      listItems.push(line.slice(2).trim());
    } else if (/^\d+\.\s/.test(line)) {
      flushParagraph();
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
      }
      listItems.push(line.replace(/^\d+\.\s/, '').trim());
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return html.join('');
}

function normalizeInline(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function inlineNodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();
  if (tag === 'br') return '\n';
  const children = Array.from(element.childNodes).map(inlineNodeToMarkdown).join('');
  if (tag === 'strong' || tag === 'b') {
    const text = children.trim();
    return text ? `**${text}**` : '';
  }
  if (tag === 'a') {
    const href = element.getAttribute('href')?.trim();
    const label = normalizeInline(children);
    return href ? `[${label || href}](${href})` : label;
  }
  return children;
}

function blockToMarkdown(element: HTMLElement): string {
  const tag = element.tagName.toLowerCase();
  if (tag === 'h1' || tag === 'h2') {
    const text = normalizeInline(inlineNodeToMarkdown(element));
    return text ? `## ${text}` : '';
  }
  if (tag === 'h3' || tag === 'h4') {
    const text = normalizeInline(inlineNodeToMarkdown(element));
    return text ? `### ${text}` : '';
  }
  if (tag === 'ul' || tag === 'ol') {
    let number = 0;
    return Array.from(element.querySelectorAll(':scope > li'))
      .map((item) => {
        const text = normalizeInline(inlineNodeToMarkdown(item));
        if (!text) return '';
        const kind = item.getAttribute('data-list') ?? (tag === 'ul' ? 'bullet' : 'ordered');
        if (kind !== 'ordered') {
          number = 0;
          return `- ${text}`;
        }
        number += 1;
        return `${number}. ${text}`;
      })
      .filter(Boolean)
      .join('\n');
  }
  if (tag === 'p') return normalizeInline(inlineNodeToMarkdown(element));
  const nested = Array.from(element.children)
    .map((child) => blockToMarkdown(child as HTMLElement))
    .filter(Boolean);
  return nested.length ? nested.join('\n\n') : normalizeInline(inlineNodeToMarkdown(element));
}

export function editorHtmlToMarkdown(html: string): string {
  if (typeof window === 'undefined') return '';
  const document = new window.DOMParser().parseFromString(html || '', 'text/html');
  return Array.from(document.body.children)
    .map((child) => blockToMarkdown(child as HTMLElement))
    .filter(Boolean)
    .join('\n\n')
    .trim();
}
