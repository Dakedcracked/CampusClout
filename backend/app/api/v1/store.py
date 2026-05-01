import uuid

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.schemas.auth import MessageResponse
from app.schemas.store import (
    OrderResponse,
    PricePreviewResponse,
    ProductCreate,
    ProductResponse,
    ProductUpdate,
    ProductWithPriceResponse,
    StorefrontCreate,
    StorefrontEligibility,
    StorefrontResponse,
    StorefrontUpdate,
)
from app.services.store_service import (
    add_product,
    check_eligibility,
    create_storefront,
    delete_product,
    get_my_storefront,
    get_storefront_by_username,
    list_products_with_price,
    list_storefronts,
    my_purchases,
    my_sales,
    price_preview,
    purchase,
    update_product,
    update_storefront,
)
from sqlalchemy import select
from app.models.store import Storefront

router = APIRouter(prefix="/store", tags=["store"])


# ------------------------------------------------------------------
# Discovery
# ------------------------------------------------------------------

@router.get("/storefronts", response_model=list[StorefrontResponse])
async def browse_storefronts(
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
) -> list[StorefrontResponse]:
    if limit > 50:
        limit = 50
    return await list_storefronts(db, limit=limit, offset=offset)


@router.get("/storefronts/{username}", response_model=StorefrontResponse)
async def view_storefront(
    username: str,
    db: AsyncSession = Depends(get_db),
) -> StorefrontResponse:
    return await get_storefront_by_username(db, username)


@router.get("/storefronts/{username}/products", response_model=list[ProductWithPriceResponse])
async def view_products(
    username: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> list[ProductWithPriceResponse]:
    sf_response = await get_storefront_by_username(db, username)

    buyer_id: uuid.UUID | None = None
    try:
        buyer_id = uuid.UUID(get_current_user_id(request))
    except Exception:
        pass

    return await list_products_with_price(db, sf_response.id, buyer_id, sf_response.owner_id)


# ------------------------------------------------------------------
# My storefront management
# ------------------------------------------------------------------

@router.get("/my/eligibility", response_model=StorefrontEligibility)
async def eligibility(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> StorefrontEligibility:
    user_id = uuid.UUID(get_current_user_id(request))
    return await check_eligibility(db, user_id)


@router.get("/my/storefront", response_model=StorefrontResponse | None)
async def my_storefront(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> StorefrontResponse | None:
    user_id = uuid.UUID(get_current_user_id(request))
    return await get_my_storefront(db, user_id)


@router.post("/my/storefront", response_model=StorefrontResponse, status_code=status.HTTP_201_CREATED)
async def open_storefront(
    data: StorefrontCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> StorefrontResponse:
    user_id = uuid.UUID(get_current_user_id(request))
    return await create_storefront(db, user_id, data)


@router.patch("/my/storefront", response_model=StorefrontResponse)
async def edit_storefront(
    data: StorefrontUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> StorefrontResponse:
    user_id = uuid.UUID(get_current_user_id(request))
    return await update_storefront(db, user_id, data)


@router.post("/my/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    data: ProductCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> ProductResponse:
    user_id = uuid.UUID(get_current_user_id(request))
    return await add_product(db, user_id, data)


@router.patch("/my/products/{product_id}", response_model=ProductResponse)
async def edit_product(
    product_id: uuid.UUID,
    data: ProductUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> ProductResponse:
    user_id = uuid.UUID(get_current_user_id(request))
    return await update_product(db, user_id, product_id, data)


@router.delete("/my/products/{product_id}", response_model=MessageResponse)
async def remove_product(
    product_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    user_id = uuid.UUID(get_current_user_id(request))
    await delete_product(db, user_id, product_id)
    return MessageResponse(message="Product removed")


@router.post("/my/products/{product_id}/image", response_model=ProductResponse)
async def upload_product_image(
    product_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    image_url: str = "",
    image_type: str = "image",
) -> ProductResponse:
    """Upload or update product image (base64 data URL or image path)."""
    user_id = uuid.UUID(get_current_user_id(request))
    return await update_product(db, user_id, product_id, ProductUpdate(image_url=image_url))


@router.get("/my/sales", response_model=list[OrderResponse])
async def sales_history(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> list[OrderResponse]:
    user_id = uuid.UUID(get_current_user_id(request))
    return await my_sales(db, user_id)


# ------------------------------------------------------------------
# Buying
# ------------------------------------------------------------------

@router.get("/products/{product_id}/price", response_model=PricePreviewResponse)
async def preview_price(
    product_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> PricePreviewResponse:
    buyer_id = uuid.UUID(get_current_user_id(request))
    return await price_preview(db, buyer_id, product_id)


@router.post("/products/{product_id}/purchase", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def buy_product(
    product_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> OrderResponse:
    buyer_id = uuid.UUID(get_current_user_id(request))
    return await purchase(db, buyer_id, product_id)


@router.get("/my/purchases", response_model=list[OrderResponse])
async def purchase_history(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> list[OrderResponse]:
    buyer_id = uuid.UUID(get_current_user_id(request))
    return await my_purchases(db, buyer_id)
