import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models import Product, User
from app.schemas import ProductCreate, ProductUpdate, ProductOut, ProductListResponse
from app.auth import get_current_user, require_admin
from app.utils.redis_client import get_cache, set_cache, flush_pattern

router = APIRouter(prefix="/products", tags=["Products"])


@router.get("/", response_model=ProductListResponse)
async def list_products(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    cache_key = f"products:page={page}:limit={limit}"
    cached = get_cache(cache_key)
    if cached:
        return cached

    offset = (page - 1) * limit
    total = db.query(Product).count()
    products = db.query(Product).order_by(Product.created_at.desc()).offset(offset).limit(limit).all()

    result = {
        "products": [ProductOut.model_validate(p).model_dump(mode="json") for p in products],
        "page": page,
        "limit": limit,
        "total": total
    }

    set_cache(cache_key, result, ttl=300)
    return result


@router.post("/", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def create_product(
    data: ProductCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    # Check SKU uniqueness
    existing = db.query(Product).filter(Product.sku == data.sku).first()
    if existing:
        raise HTTPException(status_code=409, detail="SKU already exists")

    product = Product(
        sku=data.sku,
        name=data.name,
        description=data.description or "",
        image_url=data.image_url or "",
        price=data.price,
        stock_quantity=data.stock_quantity
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    flush_pattern("products:*")

    return product


@router.put("/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: uuid.UUID,
    data: ProductUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)

    db.commit()
    db.refresh(product)

    flush_pattern("products:*")

    return product
