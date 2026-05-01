import uuid

from fastapi import APIRouter, Depends, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.schemas.social import LikeResponse, PostCreate, PostResponse
from app.services.feed_service import create_post, get_feed, toggle_like, edit_post, delete_post
from app.services.social_service import add_comment, get_comments

router = APIRouter(prefix="/feed", tags=["feed"])


class CommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=500)
    use_alter_ego: bool = False


@router.get("", response_model=list[PostResponse])
async def read_feed(
    request: Request,
    limit: int = 30,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
) -> list[PostResponse]:
    viewer_id: uuid.UUID | None = None
    try:
        viewer_id = uuid.UUID(get_current_user_id(request))
    except Exception:
        pass
    if limit > 100:
        limit = 100
    return await get_feed(db, viewer_id=viewer_id, limit=limit, offset=offset)


@router.post("", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def new_post(
    data: PostCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> PostResponse:
    author_id = uuid.UUID(get_current_user_id(request))
    return await create_post(db, author_id, data)


@router.post("/{post_id}/like", response_model=LikeResponse)
async def like_post(
    post_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> LikeResponse:
    user_id = uuid.UUID(get_current_user_id(request))
    liked, count = await toggle_like(db, user_id, post_id)
    return LikeResponse(post_id=post_id, liked=liked, new_like_count=count)


@router.put("/{post_id}", response_model=PostResponse)
async def edit_post_route(
    post_id: uuid.UUID,
    body: BaseModel,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> PostResponse:
    """Edit post content. Only author can edit."""
    user_id = uuid.UUID(get_current_user_id(request))
    content = getattr(body, "content", None)
    if not content:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Content is required")
    return await edit_post(db, user_id, post_id, content)


@router.delete("/{post_id}", status_code=status.HTTP_200_OK)
async def delete_post_route(
    post_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Delete post. Only author can delete."""
    user_id = uuid.UUID(get_current_user_id(request))
    return await delete_post(db, user_id, post_id)


@router.get("/{post_id}/comments")
async def comments(
    post_id: uuid.UUID,
    limit: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    return await get_comments(db, post_id, limit=limit)


@router.post("/{post_id}/comments", status_code=status.HTTP_201_CREATED)
async def add_comment_route(
    post_id: uuid.UUID,
    body: CommentCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    author_id = uuid.UUID(get_current_user_id(request))
    alter_ego_alias: str | None = None
    if body.use_alter_ego:
        from app.models.economy import AlterEgo
        from sqlalchemy import select
        ae_r = await db.execute(select(AlterEgo).where(AlterEgo.user_id == author_id, AlterEgo.is_active == True))
        ae = ae_r.scalar_one_or_none()
        alter_ego_alias = ae.alias if ae else None
    return await add_comment(db, post_id, author_id, body.content, body.use_alter_ego, alter_ego_alias)
