import React from 'react';

interface RichContentProps {
  content: string;
  className?: string;
  inline?: boolean;
}

/**
 * Checks if a string contains HTML tags
 */
export function hasHtmlTags(str: string): boolean {
  if (!str) return false;
  return /<[a-z][\s\S]*>/i.test(str);
}

/**
 * Safely sanitizes simple HTML to prevent script execution
 * Allows b, i, u, s, sub, sup, p, br, span, strong, em, ul, ol, li,
 * table, thead, tbody, tr, th, td, blockquote, code, pre, img
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';

  // Remove script and iframe tags entirely
  let clean = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*(?:["'][^"']*["']|[^\s>]+)/gi, ''); // remove event handlers like onload, onerror, onclick

  return clean;
}

export const RichContent: React.FC<RichContentProps> = ({
  content,
  className = '',
  inline = false,
}) => {
  if (!content) {
    return null;
  }

  const isHtml = hasHtmlTags(content);

  if (!isHtml) {
    // Plain text with line breaks
    if (inline) {
      return <span className={className}>{content}</span>;
    }
    return <div className={`whitespace-pre-wrap ${className}`}>{content}</div>;
  }

  const sanitized = sanitizeHtml(content);

  const styleClass = `rich-content leading-relaxed break-words ${className} [&_table]:w-full [&_table]:border-collapse [&_table]:my-2 [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-100 [&_th]:p-2 [&_th]:text-xs [&_td]:border [&_td]:border-slate-200 [&_td]:p-2 [&_td]:text-xs [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-2.5 [&_img]:shadow-xs [&_img]:border [&_img]:border-slate-200 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5 [&_blockquote]:border-l-4 [&_blockquote]:border-indigo-400 [&_blockquote]:pl-3 [&_blockquote]:py-1 [&_blockquote]:italic [&_blockquote]:my-2 [&_blockquote]:text-slate-600 [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_code]:text-indigo-600 [&_pre]:bg-slate-900 [&_pre]:text-slate-100 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-2 [&_sub]:text-[0.75em] [&_sup]:text-[0.75em]`;

  if (inline) {
    return (
      <span
        className={styleClass}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    );
  }

  return (
    <div
      className={styleClass}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
};
