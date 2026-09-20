export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

// 429 con el tiempo de espera, para que el cliente pueda mostrar cuanto falta
export class ErrorDemasiadosIntentos extends AppError {
  public readonly reintentarEnSegundos: number;

  constructor(message: string, reintentarEnSegundos: number) {
    super(message, 429);
    this.reintentarEnSegundos = Math.max(1, Math.ceil(reintentarEnSegundos));
  }
}
