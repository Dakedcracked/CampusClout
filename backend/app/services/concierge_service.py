import random
import uuid
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.chat import ChatThread, ChatMessage
from app.models.room import CommunityRoom
from app.ws.chat_manager import chat_manager

PLACES = [
    "the local Campus Library 📚",
    "the Quad for a quick walk 🌳",
    "the Student Union coffee shop ☕",
    "the nearby Boba place 🧋",
    "the campus art museum 🎨",
]

async def trigger_date_concierge(db: AsyncSession, user_a: User, user_b: User):
    """
    Acts as the AI Date Concierge. When a mutual green-light occurs, 
    the AI proposes a low-pressure campus date.
    """
    
    # Order user IDs canonically for ChatThread
    uid1, uid2 = str(user_a.id), str(user_b.id)
    if uid1 > uid2:
        uid1, uid2 = uid2, uid1
        
    thread_query = await db.execute(
        select(ChatThread).where(
            and_(ChatThread.user_a_id == uuid.UUID(uid1), ChatThread.user_b_id == uuid.UUID(uid2))
        )
    )
    thread = thread_query.scalar_one_or_none()
    
    if not thread:
        thread = ChatThread(user_a_id=uuid.UUID(uid1), user_b_id=uuid.UUID(uid2))
        db.add(thread)
        await db.flush()
        
    # Query active CommunityRooms for date personalization
    rooms_result = await db.execute(
        select(CommunityRoom.name).where(CommunityRoom.is_active == True).limit(10)
    )
    active_rooms = rooms_result.scalars().all()

    # Generate the proposal
    if active_rooms and random.random() > 0.5:
        room_name = random.choice(active_rooms)
        proposal = f"✨ Campus Concierge: You both just Green-Lighted each other! I've analyzed your vector compatibility and noticed high overlap. How about checking out the '{room_name}' community room or meeting up nearby? Let me know if you want me to coordinate a time!"
    else:
        place = random.choice(PLACES)
        proposal = f"✨ Campus Concierge: You both just Green-Lighted each other! I've analyzed your vector compatibility and noticed high overlap. How about a low-pressure meetup at {place} this week? Let me know if you want me to share your temporary locations!"
    
    # Sender is NULL because it's a system/concierge message
    msg = ChatMessage(
        thread_id=thread.id,
        sender_id=None,
        content=proposal,
        is_ai_icebreaker=True
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    
    # Broadcast WS event
    await chat_manager.publish(str(thread.id), {
        "id": str(msg.id),
        "thread_id": str(thread.id),
        "sender_id": None,
        "content": msg.content,
        "is_ai_icebreaker": True,
        "created_at": msg.created_at.isoformat()
    })
