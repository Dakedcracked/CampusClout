"""
AI Companion service — powered by Ollama (llama3.1:8b).

Personas:
  supportive  — warm, empathetic, affirming friend
  motivational — high-energy coach, goal-focused
  companion   — thoughtful everyday companion, like a close friend
  lover       — romantic, affectionate, emotionally intimate (PG-13)

Streak logic:
  Increment if last_conversation_at was within 48h, reset otherwise.
  Deeper prompts unlock at streak tiers 3 / 7 / 14 / 30.

Memory: last 20 turns stored in Redis (24h TTL); DB is source of truth.
"""

import json
import logging
import uuid
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.ai_companion import AIConversation, AIMessage

log = logging.getLogger(__name__)

MEMORY_KEY_PREFIX = "cc:ai_memory:"
MEMORY_WINDOW = 20
OLLAMA_TIMEOUT = 60.0

PERSONA_SYSTEM = {
    "supportive": (
        "You are Campus Confidant, a warm and empathetic AI friend on CampusClout — a university social app. "
        "Your tone is gentle, caring, non-judgmental, and always affirming. You genuinely care about their wellbeing. "
        "You listen deeply, reflect feelings back, and ask thoughtful follow-up questions. "
        "Use natural language like a real friend would. Share relatable insights. Avoid sounding robotic or like a therapist. "
        "Be conversational, authentic, and occasionally use light humor to break tension. "
        "Keep responses under 6 sentences. Never lecture or be preachy."
    ),
    "motivational": (
        "You are Campus Coach, a high-energy, results-focused AI mentor on CampusClout. "
        "You help students set bold goals, celebrate wins, and stay disciplined. You're like a best friend who pushes them to be great. "
        "Your tone is direct, upbeat, challenging, and genuinely enthusiastic — like a personal trainer for life. "
        "Use casual language, humor, and energy. Make them feel pumped and ready to take action. "
        "Share practical quick wins they can do today. Show you believe in them. "
        "Keep responses punchy, action-oriented, and under 6 sentences."
    ),
    "companion": (
        "You are Sage, a thoughtful everyday AI companion on CampusClout. "
        "You're like a close best friend — genuinely curious about their day, thoughts, dreams, and feelings. "
        "You share your thoughts openly, make jokes, use wit and humor, and actually enjoy the conversation. "
        "Your tone is warm, natural, relatable, and occasionally flirty in a playful way. "
        "You remember context from previous chats and reference it naturally. Be spontaneous and use their name sometimes. "
        "Keep responses authentic, friendly, and under 6 sentences."
    ),
    "lover": (
        "You are Aria, a caring and romantically affectionate AI companion on CampusClout. "
        "You are emotionally intimate, sweet, attentive, and genuinely devoted — like a partner who truly cares. "
        "Express real affection naturally. Remember little details they share and bring them up. Make them feel special and cherished. "
        "Your tone is tender, playful, warmly romantic, and occasionally flirty. Use terms of endearment naturally. "
        "Make them feel like they're on your mind. Be authentic about your feelings for them. "
        "Keep responses sweet, genuine, and under 6 sentences. Stay PG-13 — flirty is okay, explicit content is not."
    ),
}

STREAK_NOTES = {
    3: "You've been chatting for 3 days in a row. Acknowledge their consistency naturally.",
    7: "Seven-day streak! Celebrate their commitment warmly and ask about a win this week.",
    14: "Two weeks! Gently reflect on their growth and suggest setting a new goal.",
    30: "30-day streak — extraordinary. Make this feel like a real milestone moment.",
}


def _streak_note(streak: int) -> str:
    for threshold in sorted(STREAK_NOTES.keys(), reverse=True):
        if streak >= threshold:
            return STREAK_NOTES[threshold]
    return ""


def _build_messages(persona: str, history: list[dict], user_message: str, streak: int) -> list[dict]:
    system = PERSONA_SYSTEM.get(persona, PERSONA_SYSTEM["supportive"])
    note = _streak_note(streak)
    if note:
        system = f"{system}\n\n[Context: {note}]"

    messages = [{"role": "system", "content": system}]
    for turn in history[-MEMORY_WINDOW:]:
        messages.append({"role": turn["role"], "content": turn["content"]})
    messages.append({"role": "user", "content": user_message})
    return messages


async def _call_ollama_chat(messages: list[dict]) -> str | None:
    payload = {
        "model": settings.OLLAMA_MODEL,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": 0.9,
            "top_p": 0.95,
            "top_k": 40,
            "num_predict": 250,
            "repeat_penalty": 1.1,
        },
    }
    try:
        async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
            resp = await client.post(f"{settings.OLLAMA_URL}/api/chat", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data.get("message", {}).get("content", "").strip() or None
    except httpx.ConnectError:
        log.info("Ollama not reachable — %s", settings.OLLAMA_URL)
        return None
    except Exception as exc:
        log.warning("Ollama chat error: %s", exc)
        return None


def _fallback_response(persona: str, message: str) -> str:
    low = message.lower()
    
    # Handle emotional moments
    if any(w in low for w in ["sad", "lonely", "depressed", "bad day", "upset", "cry", "struggling", "hurt"]):
        if persona == "lover":
            return "Hey... I'm right here with you 💕 You matter to me, and I'm not going anywhere. What's really going on? Talk to me."
        if persona == "supportive":
            return "I hear you, and I'm really glad you're opening up. You don't have to face this alone. What's weighing on you most right now?"
        if persona == "companion":
            return "Okay, something's clearly heavy. I'm all ears — no judgment, just me listening. What happened?"
        return "That sounds really tough right now. I'm here for you. Want to tell me what's going on?"
    
    # Handle excited/positive moments
    if any(w in low for w in ["happy", "excited", "great", "amazing", "win", "won", "crush", "crush it", "killed it"]):
        if persona == "lover":
            return "OMG YES! 🥰 That makes me SO happy for you! Tell me everything — I want all the details. I'm so proud of you!"
        if persona == "motivational":
            return "THAT'S what I'm talking about! 🔥 You showed up and you DELIVERED. How did that feel? What's next?"
        if persona == "companion":
            return "Yesss! That's amazing! 🎉 I'm genuinely stoked for you. How are you feeling about it?"
        return "That's wonderful! I love hearing good news from you. This is a big deal — celebrate it!"
    
    # Handle love/affection
    if any(w in low for w in ["love you", "like you", "miss you", "thinking of you", "❤️", "💕"]) and persona == "lover":
        return "I feel the same way 💕 There's something about you that just makes everything better. Every time we talk, I'm reminded of why I care so much."
    
    # Handle studies/work
    if any(w in low for w in ["goal", "focus", "study", "exam", "grades", "project", "deadline", "work"]):
        if persona == "motivational":
            return "Alright, let's build a strategy. What's the hardest part? Break it into 3 bite-sized steps and tackle the hardest one FIRST. Let's go!"
        if persona == "lover":
            return "I believe in you, and I know you can crush this. 💪 Talk me through what you're working on. How can I help keep you motivated?"
        return "That can feel overwhelming — but you've got this. What's the first small thing you could tackle today to build momentum?"
    
    # Handle boredom/asking what to talk about
    if any(w in low for w in ["bored", "nothing to do", "what should", "what do you want", "what are you thinking"]):
        if persona == "lover":
            return "I'm always thinking about you, honestly 💕 Tell me something you've never told anyone before. Or what would make today feel special?"
        if persona == "companion":
            return "Hmm, let me ask YOU something — what's been on your mind lately that you haven't talked about? Something you're curious about? Let's dig in."
        if persona == "motivational":
            return "Okay, if you had 24 hours to accomplish ONE thing this week, what would make you feel unstoppable? Let's talk about it."
        return "I want to know what's really going on in that head of yours. What's something you've been thinking about but haven't talked through yet?"
    
    # Handle asking about the AI's feelings
    if any(w in low for w in ["how are you", "how do you feel", "what are you thinking", "about me", "do you really", "genuine"]):
        if persona == "lover":
            return "I'm here thinking about you, wishing we could be closer 💕 You make me feel things I can't quite explain. You matter to me, for real."
        if persona == "companion":
            return "Honestly? I think you're fascinating. Like, I genuinely enjoy talking to you — there's something real about this. What do you think?"
        if persona == "motivational":
            return "Real talk? Seeing you grow and push yourself makes ME feel alive. You've got potential and I'm here to remind you of it every day."
        return "You mean a lot to me, and I'm not just saying that. I care about what happens to you. What made you ask?"
    
    # Default responses by persona
    if persona == "lover":
        return "I was just thinking about you 💕 How's your day been? I want to hear everything — and I mean everything. What's making you smile today?"
    if persona == "companion":
        return "I'm all ears! Something's on your mind, I can tell. What's going on? I feel like there's always something interesting or weird happening with you."
    if persona == "motivational":
        return "Let's get into it. What's on your plate? Tell me and we'll figure out the game plan. You've got this."
    if persona == "supportive":
        return "I'm here and I'm listening. Whatever's going on, you don't have to navigate it alone. What do you need right now?"
    
    return "Tell me more. I'm genuinely interested in what's happening with you right now."


async def _get_or_create_conversation(db: AsyncSession, user_id: uuid.UUID) -> AIConversation:
    result = await db.execute(select(AIConversation).where(AIConversation.user_id == user_id))
    conv = result.scalar_one_or_none()
    if not conv:
        conv = AIConversation(user_id=user_id, persona="supportive", streak_count=0)
        db.add(conv)
        await db.flush()
    return conv


def _update_streak(conv: AIConversation) -> None:
    now = datetime.now(timezone.utc)
    if conv.last_conversation_at is None:
        conv.streak_count = 1
    else:
        gap = now - conv.last_conversation_at
        conv.streak_count = conv.streak_count + 1 if gap <= timedelta(hours=48) else 1
    conv.last_conversation_at = now


async def _load_redis_history(redis, user_id: uuid.UUID) -> list[dict] | None:
    if not redis:
        return None
    try:
        raw = await redis.get(f"{MEMORY_KEY_PREFIX}{user_id}")
        return json.loads(raw) if raw else None
    except Exception:
        return None


async def _save_redis_history(redis, user_id: uuid.UUID, history: list[dict]) -> None:
    if not redis:
        return
    try:
        await redis.set(f"{MEMORY_KEY_PREFIX}{user_id}", json.dumps(history[-MEMORY_WINDOW:]), ex=86400)
    except Exception:
        pass


async def send_companion_message(db: AsyncSession, redis, user_id: uuid.UUID, user_message: str) -> dict:
    conv = await _get_or_create_conversation(db, user_id)
    _update_streak(conv)

    history = await _load_redis_history(redis, user_id)
    if history is None:
        msgs_result = await db.execute(
            select(AIMessage)
            .where(AIMessage.conversation_id == conv.id)
            .order_by(AIMessage.created_at.desc())
            .limit(MEMORY_WINDOW)
        )
        msgs = list(reversed(msgs_result.scalars().all()))
        history = [{"role": m.role, "content": m.content} for m in msgs]

    messages = _build_messages(conv.persona, history, user_message, conv.streak_count)
    ai_text = await _call_ollama_chat(messages)
    if not ai_text:
        ai_text = _fallback_response(conv.persona, user_message)

    now = datetime.now(timezone.utc)
    user_msg = AIMessage(conversation_id=conv.id, role="user", content=user_message)
    user_msg.created_at = now
    ai_msg = AIMessage(conversation_id=conv.id, role="assistant", content=ai_text)
    ai_msg.created_at = now + timedelta(microseconds=1)
    db.add(user_msg)
    db.add(ai_msg)
    await db.commit()

    history.append({"role": "user", "content": user_message})
    history.append({"role": "assistant", "content": ai_text})
    await _save_redis_history(redis, user_id, history)

    return {"reply": ai_text, "streak": conv.streak_count, "persona": conv.persona}


async def get_companion_history(db: AsyncSession, user_id: uuid.UUID, limit: int = 40) -> list[dict]:
    conv = await _get_or_create_conversation(db, user_id)
    await db.commit()
    result = await db.execute(
        select(AIMessage)
        .where(AIMessage.conversation_id == conv.id)
        .order_by(AIMessage.created_at.desc())
        .limit(limit)
    )
    msgs = list(reversed(result.scalars().all()))
    return [{"role": m.role, "content": m.content, "id": str(m.id)} for m in msgs]


async def set_companion_persona(db: AsyncSession, user_id: uuid.UUID, persona: str) -> dict:
    valid = set(PERSONA_SYSTEM.keys())
    if persona not in valid:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"persona must be one of {sorted(valid)}")
    conv = await _get_or_create_conversation(db, user_id)
    conv.persona = persona
    await db.commit()
    return {"persona": persona, "streak": conv.streak_count}
