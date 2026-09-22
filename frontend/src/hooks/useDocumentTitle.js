import { useEffect } from 'react';

/**
 * Custom hook to dynamically update the document title based on the current page.
 * @param {string} title - The title of the page (e.g., 'Analyze X-Ray')
 */
export function useDocumentTitle(title) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title ? `${title} — DiagnoVision` : 'DiagnoVision — AI-Assisted Pneumonia Screening';

    return () => {
      document.title = previousTitle;
    };
  }, [title]);
}
