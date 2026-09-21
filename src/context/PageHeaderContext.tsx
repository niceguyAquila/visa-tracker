import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type PageHeaderValue = {
  title: string;
  /** Shows a back arrow in the app header when set. */
  backTo?: string;
  backLabel?: string;
};

type PageHeaderContextValue = {
  header: PageHeaderValue;
  setHeader: (next: PageHeaderValue) => void;
};

const EMPTY_HEADER: PageHeaderValue = { title: "" };

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeaderState] = useState<PageHeaderValue>(EMPTY_HEADER);

  const setHeader = useCallback((next: PageHeaderValue) => {
    setHeaderState((prev) =>
      prev.title === next.title &&
      prev.backTo === next.backTo &&
      prev.backLabel === next.backLabel
        ? prev
        : next
    );
  }, []);

  const value = useMemo(() => ({ header, setHeader }), [header, setHeader]);

  return (
    <PageHeaderContext.Provider value={value}>
      {children}
    </PageHeaderContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- hook paired with provider
export function useCurrentPageHeader(): PageHeaderValue {
  return useContext(PageHeaderContext)?.header ?? EMPTY_HEADER;
}

/**
 * Publishes this page's title, and optional back target, to the app header.
 * Call it above any early return so the header stays set while the page loads.
 */
// eslint-disable-next-line react-refresh/only-export-components -- hook paired with provider
export function usePageHeader({ title, backTo, backLabel }: PageHeaderValue) {
  const setHeader = useContext(PageHeaderContext)?.setHeader;

  useEffect(() => {
    setHeader?.({ title, backTo, backLabel });
  }, [setHeader, title, backTo, backLabel]);
}
