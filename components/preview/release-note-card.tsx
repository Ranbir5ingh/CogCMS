'use client';

import { motion } from 'motion/react';
import type { ReleaseNote } from '@/lib/release-notes-parser';

function safeHref(href: string): string {
  return /^(https?:\/\/|mailto:|tel:|\/)/i.test(href) ? href : '#';
}

function RenderText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index}>{part.slice(2, -2)}</strong>;
        }
        const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link) {
          return (
            <a
              key={index}
              href={safeHref(link[2])}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              {link[1]}
            </a>
          );
        }
        return part;
      })}
    </>
  );
}

function numberFor(items: ReleaseNote['sections'][number]['items'], index: number): number {
  let number = 1;
  for (let i = index - 1; i >= 0 && items[i].type === 'numbered'; i -= 1) number += 1;
  return number;
}

export function ReleaseNoteCard({ note, index = 0 }: { note: ReleaseNote; index?: number }) {
  return (
    <motion.article
      id={note.slug}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="relative pl-8"
    >
      <span className="absolute left-[-6px] top-8 h-3 w-3 rounded-full border-2 border-[#FDFAF7] bg-orange-500 shadow-[0_0_0_3px_rgba(255,117,31,0.18)]" />
      <div className="rounded-2xl border border-orange-100 bg-gradient-to-br from-white to-orange-50/50 p-6 shadow-sm">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-gradient-to-br from-orange-500 to-orange-400 px-3 py-1 text-xs font-bold tracking-wide text-white">
            {note.version ? `v${note.version}` : 'Release'}
          </span>
          {note.date ? <span className="text-sm text-stone-400">{note.date}</span> : null}
        </div>

        {note.intro.length ? (
          <div className="mb-7 space-y-2.5">
            {note.intro.map((paragraph, paragraphIndex) => (
              <p key={paragraphIndex} className="text-[15px] leading-relaxed text-stone-600">
                <RenderText text={paragraph} />
              </p>
            ))}
          </div>
        ) : null}

        <div className="space-y-7">
          {note.sections.map((section, sectionIndex) => (
            <section key={sectionIndex}>
              <span className="mb-3 inline-block rounded-md border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-orange-600">
                {section.title}
              </span>
              <div className="space-y-2 pl-0.5">
                {section.items.map((item, itemIndex) =>
                  item.type === 'subheading' ? (
                    <h4 key={itemIndex} className="mt-3.5 text-[13px] font-semibold text-stone-900">
                      <RenderText text={item.text} />
                    </h4>
                  ) : item.type === 'numbered' ? (
                    <div key={itemIndex} className="flex items-start gap-2.5">
                      <span className="min-w-[1.25rem] shrink-0 text-[14px] font-semibold leading-relaxed text-orange-500">
                        {numberFor(section.items, itemIndex)}.
                      </span>
                      <span className="text-[14px] leading-relaxed text-stone-600">
                        <RenderText text={item.text} />
                      </span>
                    </div>
                  ) : item.type === 'bullet' ? (
                    <div key={itemIndex} className="flex items-start gap-2.5">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
                      <span className="text-[14px] leading-relaxed text-stone-600">
                        <RenderText text={item.text} />
                      </span>
                    </div>
                  ) : (
                    <p key={itemIndex} className="text-[14px] leading-relaxed text-stone-600">
                      <RenderText text={item.text} />
                    </p>
                  ),
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </motion.article>
  );
}
