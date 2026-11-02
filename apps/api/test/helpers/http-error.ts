/** Hinh dang loi HTTP cua NestJS dung de kiem tra trong test (thay cho any). */
export interface HttpErrorLike {
  status: number;
  response: { error: { code: string } };
}
