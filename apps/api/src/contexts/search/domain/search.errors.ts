/** Con tro phan trang khong tro toi su kien da cong bo. */
export class InvalidSearchCursorError extends Error {
  constructor() {
    super("Cursor khong hop le");
    this.name = "InvalidSearchCursorError";
  }
}
