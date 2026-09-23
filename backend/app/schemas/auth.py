from pydantic import BaseModel, EmailStr, field_validator


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_required(cls, v):
        if not v:
            raise ValueError("Password is required")
        return v


class CurrentUserOut(BaseModel):
    id: str
    name: str
    email: str
    role: str
    organizationId: str
    organizationName: str | None = None
