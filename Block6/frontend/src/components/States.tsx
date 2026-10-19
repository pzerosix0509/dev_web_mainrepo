import { displayError } from '../services/errorMessages';
export function LoadingState() { return <div className="state">Đang tải dữ liệu...</div>; }
export function EmptyState({ text = 'Chưa có dữ liệu.' }: { text?: string }) { return <div className="state">{text}</div>; }
export function ErrorState({ code, fields }: { code: string; fields?: Record<string, string> }) { return <div className="error state"><strong>{displayError(code)}</strong>{fields && Object.values(fields).map((message) => <div key={message}>{message}</div>)}</div>; }
export function FieldError({ message }: { message?: string }) { return message ? <small className="field-error">{message}</small> : null; }
