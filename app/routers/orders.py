import uuid
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db
from app.models import Order, OrderItem, Product, User
from app.schemas import OrderCreate, OrderOut, OrderItemOut
from app.auth import get_current_user
from app.utils.redis_client import flush_pattern

router = APIRouter(prefix="/orders", tags=["Orders"])


@router.post("/", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
async def create_order(
    data: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    total_amount = Decimal("0.00")
    order_items_data = []

    for item in data.items:
        product = db.query(Product).filter(
            Product.id == item.product_id
        ).with_for_update().first()

        if not product:
            raise HTTPException(
                status_code=404,
                detail=f"Product {item.product_id} not found"
            )

        if product.stock_quantity < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for '{product.name}'. Available: {product.stock_quantity}, Requested: {item.quantity}"
            )

        product.stock_quantity -= item.quantity

        line_total = product.price * item.quantity
        total_amount += line_total

        order_items_data.append({
            "product_id": product.id,
            "quantity": item.quantity,
            "price": product.price,
            "product_name": product.name
        })

    order = Order(
        user_id=current_user.id,
        status="completed",
        total_amount=total_amount
    )
    db.add(order)
    db.flush()

    for item_data in order_items_data:
        order_item = OrderItem(
            order_id=order.id,
            product_id=item_data["product_id"],
            quantity=item_data["quantity"],
            price=item_data["price"]
        )
        db.add(order_item)

    db.commit()
    db.refresh(order)

    flush_pattern("products:*")

    items_out = []
    for oi in order.items:
        item_out = OrderItemOut(
            id=oi.id,
            product_id=oi.product_id,
            quantity=oi.quantity,
            price=oi.price,
            product_name=oi.product.name if oi.product else None
        )
        items_out.append(item_out)

    return OrderOut(
        id=order.id,
        status=order.status,
        total_amount=order.total_amount,
        created_at=order.created_at,
        items=items_out
    )


@router.get("/me", response_model=list[OrderOut])
async def get_my_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    orders = db.query(Order).filter(
        Order.user_id == current_user.id
    ).order_by(Order.created_at.desc()).all()

    result = []
    for order in orders:
        items_out = []
        for oi in order.items:
            item_out = OrderItemOut(
                id=oi.id,
                product_id=oi.product_id,
                quantity=oi.quantity,
                price=oi.price,
                product_name=oi.product.name if oi.product else None
            )
            items_out.append(item_out)

        result.append(OrderOut(
            id=order.id,
            status=order.status,
            total_amount=order.total_amount,
            created_at=order.created_at,
            items=items_out
        ))

    return result
