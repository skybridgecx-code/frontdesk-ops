type TestimonialCardProps = {
  quote: string;
  author: string;
  role: string;
};

export function TestimonialCard({ quote, author, role }: TestimonialCardProps) {
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-1 text-amber-400" aria-label="5 star rating">
        {Array.from({ length: 5 }).map((_, index) => (
          <svg key={index} viewBox="0 0 20 20" className="h-4 w-4 fill-current" aria-hidden="true">
            <path d="m10 1.8 2.2 4.6 5.1.7-3.7 3.6.9 5-4.5-2.4-4.5 2.4.9-5L2.7 7.1l5.1-.7L10 1.8Z" />
          </svg>
        ))}
      </div>
      <p className="mt-4 text-sm leading-7 text-gray-700">“{quote}”</p>
      <div className="mt-4 border-t border-gray-100 pt-4">
        <p className="text-sm font-semibold text-gray-900">{author}</p>
        <p className="text-sm text-gray-500">{role}</p>
      </div>
    </article>
  );
}
