export class AuthRateLimitError extends Error {
  status = 429;
  retryAfter: number;
  constructor(message: string, retryAfter = 30) {
    super(message);
    this.name = "AuthRateLimitError";
    this.retryAfter = retryAfter;
  }
}

export class AuthNetworkError extends Error {
  status = 503;
  constructor(message: string) {
    super(message);
    this.name = "AuthNetworkError";
  }
}
