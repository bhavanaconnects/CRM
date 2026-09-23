"""
Ported from src/lib/api-response.ts: a consistent {success, data} /
{success: false, error} envelope on every response, and an AppError
carrying an HTTP status the same way the Next.js AppError did.
"""
from fastapi import Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(self, message: str, status: int = 400, details=None):
        self.message = message
        self.status = status
        self.details = details
        super().__init__(message)


class NotFoundError(AppError):
    def __init__(self, resource: str):
        super().__init__(f"{resource} not found", 404)


def ok(data, status: int = 200):
    return JSONResponse({"success": True, "data": data}, status_code=status)


def created(data):
    return ok(data, 201)


async def app_error_handler(request: Request, exc: AppError):
    return JSONResponse(
        {"success": False, "error": {"message": exc.message, "details": exc.details}},
        status_code=exc.status,
    )


async def unhandled_error_handler(request: Request, exc: Exception):
    return JSONResponse(
        {"success": False, "error": {"message": "Internal server error", "details": None}},
        status_code=500,
    )
