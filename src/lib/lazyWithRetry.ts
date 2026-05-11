import { lazy, ComponentType } from 'react';

/**
 * A wrapper around React.lazy that catches dynamic import failures 
 * (typically caused by deploying a new version while the user has the app open)
 * and forces a page reload to fetch the new index.html and correct chunk hashes.
 */
export const lazyWithRetry = <T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>
) =>
  lazy(async () => {
    try {
      return await componentImport();
    } catch (error: any) {
      const isDynamicImportError =
        error?.message?.includes('dynamically imported module') ||
        error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('Importing a module script failed');

      if (isDynamicImportError) {
        const retryKey = 'retry-lazy-load-reloaded';
        // Check if we already tried to reload to prevent infinite loops
        if (!sessionStorage.getItem(retryKey)) {
          sessionStorage.setItem(retryKey, 'true');
          window.location.reload();
          // Return a never-resolving promise to halt rendering while reload happens
          return new Promise<{ default: T }>(() => {});
        } else {
          // If we already reloaded and it still fails, clear the flag and throw
          sessionStorage.removeItem(retryKey);
        }
      }
      throw error;
    }
  });
