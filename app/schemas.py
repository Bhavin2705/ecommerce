import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)

class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class MessageResponse(BaseModel):
    message: str

class ProductCreate(BaseModel):
    sku: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = Field(default="", max_length=5000)
    image_url: Optional[str] = Field(default="", max_length=500)
    price: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    stock_quantity: int = Field(ge=0)

    @field_validator('sku', 'name')
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        return v.strip()

class ProductUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=5000)
    image_url: Optional[str] = Field(default=None, max_length=500)
    price: Optional[Decimal] = Field(default=None, gt=0, max_digits=10, decimal_places=2)
    stock_quantity: Optional[int] = Field(default=None, ge=0)

class ProductOut(BaseModel):
    id: uuid.UUID
    sku: str
    name: str
    description: Optional[str]
    image_url: Optional[str]
    price: Decimal
    stock_quantity: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ProductListResponse(BaseModel):
    products: List[ProductOut]
    page: int
    limit: int
    total: int

class OrderItemIn(BaseModel):
    product_id: uuid.UUID
    quantity: int = Field(ge=1)

class OrderCreate(BaseModel):
    items: List[OrderItemIn] = Field(min_length=1)

class OrderItemOut(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    quantity: int
    price: Decimal
    product_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class OrderOut(BaseModel):
    id: uuid.UUID
    status: str
    total_amount: Decimal
    created_at: datetime
    items: List[OrderItemOut]

    model_config = ConfigDict(from_attributes=True)
