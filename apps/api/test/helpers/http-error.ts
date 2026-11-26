/** Hinh dang loi HTTP cua NestJS dung de kiem tra trong test (thay cho any). */
export interface HttpErrorLike {
  status: number;
  response: { error: { code: string } };
}

/** Ma loi on dinh tu ngoai le HTTP cua NestJS hoac loi nghiep vu (domain error). */
export function errorCodeOf(err: unknown): string | undefined {
  const e = err as {
    code?: string;
    response?: { error?: { code?: string } };
  } | null;
  return e?.code ?? e?.response?.error?.code;
}
