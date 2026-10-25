import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
const LoadingContext = createContext({ isLoading: false, setLoading: (_value: boolean) => {} });
export function LoadingProvider({ children }: { children: ReactNode }) { const [isLoading, setLoading] = useState(false); const value = useMemo(() => ({ isLoading, setLoading }), [isLoading]); return <LoadingContext.Provider value={value}>{children}{isLoading && <div className="loading-overlay" aria-live="polite"><div className="spinner" /> Đang xử lý...</div>}</LoadingContext.Provider>; }
export const useLoading = () => useContext(LoadingContext);
