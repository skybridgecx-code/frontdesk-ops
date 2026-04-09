'use client';

import { useState } from 'react';

type FaqItem = {
  question: string;
  answer: string;
};

type FaqAccordionProps = {
  items: FaqItem[];
};

export function FaqAccordion({ items }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const isOpen = openIndex === index;

        return (
          <article key={item.question} className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <button
              type="button"
              className="flex min-h-11 w-full items-center justify-between gap-4 px-4 py-4 text-left sm:px-5"
              onClick={() => setOpenIndex((current) => (current === index ? null : index))}
              aria-expanded={isOpen}
            >
              <span className="text-sm font-semibold text-gray-900 sm:text-base">{item.question}</span>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 text-gray-500">
                <svg
                  viewBox="0 0 24 24"
                  className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-45' : ''}`}
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </span>
            </button>

            {isOpen ? <p className="px-4 pb-4 text-sm leading-6 text-gray-600 sm:px-5">{item.answer}</p> : null}
          </article>
        );
      })}
    </div>
  );
}
