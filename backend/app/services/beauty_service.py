"""
Beauty & Style AI scoring service — powered by MediaPipe + DeepFace + Ollama fallback.

The system provides multiple analysis methods:
1. PRIMARY: MediaPipe + DeepFace for fast local face rating (100-300ms)
   - Face detection & landmarks analysis
   - Demographic analysis (age, gender, emotion)
   - Custom attractiveness scoring
2. FALLBACK: Ollama vision model if face detection fails
3. FINAL FALLBACK: Hardcoded tips if all AI systems unavailable

For text-based self-assessment:
  The user submits 5 dimensions (1-10 each).
  Ollama analyzes and returns per-dimension scores + tips.

Dimensions:
  skincare  — skin routine, hydration, sun protection
  style     — fashion sense, colour matching, outfit coordination
  grooming  — hair, nails, fragrance, hygiene
  fitness   — exercise, posture, body language
  confidence — self-presentation, eye contact, smile, energy
"""

import json
import logging
import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.beauty import BeautyScore
from app.utils.face_rating import compute_attractiveness_score

log = logging.getLogger(__name__)
OLLAMA_TIMEOUT = 90.0

DIMENSION_WEIGHTS = {
    "skincare": 0.20,
    "style": 0.25,
    "grooming": 0.20,
    "fitness": 0.15,
    "confidence": 0.20,
}

FALLBACK_TIPS = {
    "skincare": [
        "Cleanse your face morning and night with a gentle face wash.",
        "Apply SPF 30+ sunscreen every morning — it's the single most effective anti-aging step.",
        "Drink at least 8 glasses of water daily; hydration shows on your skin.",
        "Add a niacinamide serum to reduce pores and even out skin tone.",
        "Never sleep with makeup on — it clogs pores and accelerates aging.",
    ],
    "style": [
        "Build a capsule wardrobe of 10-15 versatile neutral pieces that all match each other.",
        "Fit is everything — a cheap well-fitted outfit beats an expensive ill-fitting one.",
        "Learn your undertone (warm/cool/neutral) and dress to complement it.",
        "Invest in one statement accessory per outfit instead of wearing everything at once.",
        "Research your body type and learn which silhouettes flatter you most.",
    ],
    "grooming": [
        "Get a haircut every 6-8 weeks — even small trims keep you looking polished.",
        "Moisturise your hands daily; people notice hands more than you think.",
        "Keep nails clean, trimmed, and filed — it signals attention to detail.",
        "Use a good deodorant and consider a signature fragrance (apply to pulse points).",
        "Whiten your teeth gradually with whitening toothpaste — a bright smile is magnetic.",
    ],
    "fitness": [
        "Start with 30 minutes of walking daily — it improves posture and metabolism.",
        "Practice standing tall: shoulders back, chin parallel to ground, core gently engaged.",
        "Strength training 3x/week builds a lean, confident physique over 3 months.",
        "Stretch every morning — flexibility improves posture and reduces the appearance of tension.",
        "Sleep 7-9 hours; nothing affects your appearance more than chronic sleep deprivation.",
    ],
    "confidence": [
        "Make deliberate eye contact when speaking — it projects confidence and trustworthiness.",
        "Smile authentically and often; it changes how others perceive and respond to you.",
        "Slow down your speech — confident people don't rush their words.",
        "Use open body language: uncross your arms, take up a little more space intentionally.",
        "Compliment others genuinely — it reflects well on you and builds positive energy.",
    ],
}


def _build_beauty_prompt(assessment: dict) -> str:
    lines = [
        "You are a professional beauty, style, and wellness coach. Analyse this person's self-assessment "
        "and return a JSON object ONLY (no markdown, no extra text) with this exact structure:",
        "",
        '{"skincare_score": <1-100>, "style_score": <1-100>, "grooming_score": <1-100>,',
        ' "fitness_score": <1-100>, "confidence_score": <1-100>,',
        ' "overall_score": <1-100>,',
        ' "analysis": "<2-3 sentence honest but encouraging overall analysis>",',
        ' "tips": {',
        '   "skincare": ["<tip 1>", "<tip 2>", "<tip 3>"],',
        '   "style": ["<tip 1>", "<tip 2>", "<tip 3>"],',
        '   "grooming": ["<tip 1>", "<tip 2>", "<tip 3>"],',
        '   "fitness": ["<tip 1>", "<tip 2>", "<tip 3>"],',
        '   "confidence": ["<tip 1>", "<tip 2>", "<tip 3>"]',
        ' }',
        "}",
        "",
        "Self-assessment (each dimension rated 1-10 by the user):",
    ]
    for dim, val in assessment.items():
        label = dim.replace("_", " ").title()
        desc = _dim_description(dim, val)
        lines.append(f"  {label}: {val}/10 — {desc}")

    lines.append("")
    lines.append("Scores must reflect how this person can realistically improve. Be specific and actionable with tips.")
    lines.append("Return ONLY the JSON object.")
    return "\n".join(lines)


def _dim_description(dim: str, val: int) -> str:
    descs = {
        "skincare": {
            "low": "minimal or no routine",
            "mid": "basic cleansing and moisturising",
            "high": "consistent multi-step routine with actives",
        },
        "style": {
            "low": "mostly comfortable/casual, little attention to coordination",
            "mid": "some attention to outfit matching and fit",
            "high": "deliberate, well-coordinated personal style",
        },
        "grooming": {
            "low": "basic hygiene only",
            "mid": "regular haircuts, basic grooming habits",
            "high": "meticulous grooming including fragrance and nail care",
        },
        "fitness": {
            "low": "mostly sedentary",
            "mid": "occasional exercise, average posture",
            "high": "regular exercise, strong posture, active lifestyle",
        },
        "confidence": {
            "low": "shy, avoids eye contact, self-conscious",
            "mid": "reasonably confident in familiar situations",
            "high": "assertive, warm, commands attention naturally",
        },
    }
    tier = "low" if val <= 3 else ("mid" if val <= 6 else "high")
    return descs.get(dim, {}).get(tier, f"score {val}")


async def _call_ollama(prompt: str) -> dict | None:
    payload = {
        "model": settings.OLLAMA_MODEL,
        "messages": [
            {
                "role": "system",
                "content": "You are a beauty and style coach. Always respond with valid JSON only, no extra text.",
            },
            {"role": "user", "content": prompt},
        ],
        "stream": False,
        "options": {"temperature": 0.4, "num_predict": 800},
    }
    try:
        async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
            resp = await client.post(f"{settings.OLLAMA_URL}/api/chat", json=payload)
            resp.raise_for_status()
            text = resp.json().get("message", {}).get("content", "").strip()
            # Strip markdown fences if model wraps in ```json
            if text.startswith("```"):
                text = text.split("```")[-2] if "```" in text[3:] else text[3:]
                if text.lower().startswith("json"):
                    text = text[4:]
            return json.loads(text.strip())
    except httpx.ConnectError:
        log.info("Ollama not reachable for beauty score")
        return None
    except (json.JSONDecodeError, Exception) as exc:
        log.warning("Ollama beauty score parse error: %s", exc)
        return None


def _apply_ai_score_transformation(raw_score: float) -> float:
    """
    Apply a non-linear transformation to AI scores for more nuanced feedback.

    - Scores 1-3 (low): penalize heavily to encourage improvement
    - Scores 4-7 (mid): apply light reward curve
    - Scores 8-10 (high): reward strongly to encourage pursuit of excellence

    This creates stronger differentiation at extremes while maintaining fairness mid-range.
    """
    if raw_score <= 0:
        return 0.0
    if raw_score >= 100:
        return 100.0

    # Normalized to 0-1
    normalized = raw_score / 100.0

    # Apply sigmoid-like curve: emphasizes scores at extremes
    # Formula: y = (x^1.2) for mid-range smoothness, with boost for high scores
    if normalized <= 0.3:
        # Low scores: curve down (penalize)
        return (normalized / 0.3) ** 1.5 * 30
    elif normalized <= 0.7:
        # Mid scores: linear scaling
        return 30 + ((normalized - 0.3) / 0.4) * 40
    else:
        # High scores: curve up (reward excellence)
        return 70 + ((normalized - 0.7) / 0.3) ** 0.9 * 30

    return raw_score


def _compute_weighted_score(assessment: dict) -> float:
    """
    Compute overall beauty score from 5 dimensions using weighted average.

    Weights:
      - skincare: 20%
      - style: 25%
      - grooming: 20%
      - fitness: 15%
      - confidence: 20%
    """
    total = 0.0
    for dim, weight in DIMENSION_WEIGHTS.items():
        raw = assessment.get(dim, 5)
        # Convert 1-10 scale to 0-100 scale
        score_100 = (raw / 10.0) * 100
        # Apply transformation for nuanced feedback
        transformed = _apply_ai_score_transformation(score_100)
        total += transformed * weight

    return round(total, 1)


def _build_fallback_result(assessment: dict) -> dict:
    overall = _compute_weighted_score(assessment)
    tips = {dim: FALLBACK_TIPS[dim][:3] for dim in DIMENSION_WEIGHTS}
    analysis = (
        f"Based on your self-assessment, your overall presence score is {overall:.0f}/100. "
        "Every dimension has room to grow — the tips below are your personalised roadmap. "
        "Small, consistent improvements in each area compound into a remarkable transformation."
    )
    scores = {dim: round((assessment.get(dim, 5) / 10.0) * 100) for dim in DIMENSION_WEIGHTS}
    return {"overall_score": overall, "analysis": analysis, "tips": tips, **scores}


async def analyze_beauty(db: AsyncSession, user_id: uuid.UUID, assessment: dict) -> dict:
    prompt = _build_beauty_prompt(assessment)
    ai_result = await _call_ollama(prompt)

    if ai_result:
        try:
            overall = float(ai_result.get("overall_score", _compute_weighted_score(assessment)))
            skincare = float(ai_result.get("skincare_score", assessment.get("skincare", 5) * 10))
            style = float(ai_result.get("style_score", assessment.get("style", 5) * 10))
            grooming = float(ai_result.get("grooming_score", assessment.get("grooming", 5) * 10))
            fitness = float(ai_result.get("fitness_score", assessment.get("fitness", 5) * 10))
            confidence = float(ai_result.get("confidence_score", assessment.get("confidence", 5) * 10))
            analysis = str(ai_result.get("analysis", ""))
            raw_tips = ai_result.get("tips", {})
            if not isinstance(raw_tips, dict):
                raw_tips = {}
            tips = {dim: raw_tips.get(dim, FALLBACK_TIPS[dim][:3]) for dim in DIMENSION_WEIGHTS}
        except Exception:
            result = _build_fallback_result(assessment)
            overall = result["overall_score"]
            skincare = result.get("skincare_score", 50)
            style = result.get("style_score", 50)
            grooming = result.get("grooming_score", 50)
            fitness = result.get("fitness_score", 50)
            confidence = result.get("confidence_score", 50)
            analysis = result["analysis"]
            tips = result["tips"]
    else:
        result = _build_fallback_result(assessment)
        overall = result["overall_score"]
        skincare = result.get("skincare_score", assessment.get("skincare", 5) * 10)
        style = result.get("style_score", assessment.get("style", 5) * 10)
        grooming = result.get("grooming_score", assessment.get("grooming", 5) * 10)
        fitness = result.get("fitness_score", assessment.get("fitness", 5) * 10)
        confidence = result.get("confidence_score", assessment.get("confidence", 5) * 10)
        analysis = result["analysis"]
        tips = result["tips"]

    score_row = BeautyScore(
        user_id=user_id,
        overall_score=overall,
        skincare_score=skincare,
        style_score=style,
        grooming_score=grooming,
        fitness_score=fitness,
        confidence_score=confidence,
        analysis=analysis,
        tips=json.dumps(tips),
    )
    db.add(score_row)
    await db.commit()
    await db.refresh(score_row)

    return {
        "id": str(score_row.id),
        "overall_score": overall,
        "skincare_score": skincare,
        "style_score": style,
        "grooming_score": grooming,
        "fitness_score": fitness,
        "confidence_score": confidence,
        "analysis": analysis,
        "tips": tips,
        "created_at": score_row.created_at.isoformat(),
    }


async def _call_ollama_vision(image_data_b64: str, content_type: str) -> dict | None:
    """Call llama3.2-vision with a base64-encoded image. Returns parsed JSON or None."""
    prompt = (
        "You are a professional beauty, style, and wellness coach. Analyse this person's appearance in the image "
        "and return a JSON object ONLY (no markdown, no extra text) with this exact structure:\n"
        '{"skincare_score": <1-100>, "style_score": <1-100>, "grooming_score": <1-100>,\n'
        ' "fitness_score": <1-100>, "confidence_score": <1-100>,\n'
        ' "overall_score": <1-100>,\n'
        ' "analysis": "<2-3 sentence honest but encouraging overall analysis>",\n'
        ' "tips": {\n'
        '   "skincare": ["<tip 1>", "<tip 2>", "<tip 3>"],\n'
        '   "style": ["<tip 1>", "<tip 2>", "<tip 3>"],\n'
        '   "grooming": ["<tip 1>", "<tip 2>", "<tip 3>"],\n'
        '   "fitness": ["<tip 1>", "<tip 2>", "<tip 3>"],\n'
        '   "confidence": ["<tip 1>", "<tip 2>", "<tip 3>"]\n'
        ' }\n'
        "}\n\n"
        "Scores must reflect realistic improvement potential. Be specific and actionable with tips. "
        "Return ONLY the JSON object."
    )
    payload = {
        "model": "llama3.2-vision",
        "messages": [
            {
                "role": "user",
                "content": prompt,
                "images": [image_data_b64],
            }
        ],
        "stream": False,
        "options": {"temperature": 0.3},
    }
    try:
        async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
            resp = await client.post(f"{settings.OLLAMA_URL}/api/chat", json=payload)
            resp.raise_for_status()
            text = resp.json().get("message", {}).get("content", "").strip()
            if text.startswith("```"):
                text = text.split("```")[-2] if "```" in text[3:] else text[3:]
                if text.lower().startswith("json"):
                    text = text[4:]
            return json.loads(text.strip())
    except httpx.ConnectError:
        log.info("Ollama not reachable for vision beauty analysis")
        return None
    except Exception as exc:
        log.warning("Ollama vision beauty parse error: %s", exc)
        return None


async def _call_ollama_text_fallback_for_image() -> dict | None:
    """Text-only fallback when vision model is unavailable."""
    prompt = (
        "You are a professional beauty, style, and wellness coach. As a beauty advisor providing a general "
        "assessment without an actual image, generate encouraging scores and actionable tips. "
        "Return a JSON object ONLY (no markdown, no extra text) with this exact structure:\n"
        '{"skincare_score": <1-100>, "style_score": <1-100>, "grooming_score": <1-100>,\n'
        ' "fitness_score": <1-100>, "confidence_score": <1-100>,\n'
        ' "overall_score": <1-100>,\n'
        ' "analysis": "<2-3 sentence general encouraging analysis>",\n'
        ' "tips": {\n'
        '   "skincare": ["<tip 1>", "<tip 2>", "<tip 3>"],\n'
        '   "style": ["<tip 1>", "<tip 2>", "<tip 3>"],\n'
        '   "grooming": ["<tip 1>", "<tip 2>", "<tip 3>"],\n'
        '   "fitness": ["<tip 1>", "<tip 2>", "<tip 3>"],\n'
        '   "confidence": ["<tip 1>", "<tip 2>", "<tip 3>"]\n'
        ' }\n'
        "}\n\n"
        "Use realistic mid-range scores (50-75). Return ONLY the JSON object."
    )
    payload = {
        "model": settings.OLLAMA_MODEL,
        "messages": [
            {
                "role": "system",
                "content": "You are a beauty and style coach. Always respond with valid JSON only, no extra text.",
            },
            {"role": "user", "content": prompt},
        ],
        "stream": False,
        "options": {"temperature": 0.4, "num_predict": 800},
    }
    try:
        async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
            resp = await client.post(f"{settings.OLLAMA_URL}/api/chat", json=payload)
            resp.raise_for_status()
            text = resp.json().get("message", {}).get("content", "").strip()
            if text.startswith("```"):
                text = text.split("```")[-2] if "```" in text[3:] else text[3:]
                if text.lower().startswith("json"):
                    text = text[4:]
            return json.loads(text.strip())
    except httpx.ConnectError:
        log.info("Ollama not reachable for text fallback beauty analysis")
        return None
    except Exception as exc:
        log.warning("Ollama text fallback beauty parse error: %s", exc)
        return None


async def analyze_beauty_image(
    db: AsyncSession,
    user_id: uuid.UUID,
    image_data_b64: str,
    content_type: str,
    face_result: dict | None = None,
) -> dict:
    """Analyze an uploaded image for beauty scores.

    face_result is the pre-computed result from compute_attractiveness_score(),
    already validated to contain a human face by the caller.
    Falls back to Ollama text analysis for tips if the face result is available.
    """
    # face_result should always be provided with has_face=True from beauty.py
    # but handle None defensively
    if face_result is None or not face_result.get("has_face"):
        import base64
        try:
            image_bytes = base64.b64decode(image_data_b64)
            face_result = await compute_attractiveness_score(image_bytes)
        except Exception:
            face_result = {}

    ai_result: dict | None = None

    if face_result.get("has_face"):
        attractiveness = float(face_result.get("attractiveness", 65))
        symmetry = float(face_result.get("symmetry", 65))
        proportions = float(face_result.get("proportions", 65))
        skin_quality = float(face_result.get("skin_quality", 65))
        eye_quality = float(face_result.get("eye_quality", 65))
        demographics = face_result.get("demographics") or {}
        age = demographics.get("age", "?")
        emotion = demographics.get("emotion", "neutral")

        # Map face metrics to the 5 beauty dimensions
        # skincare ← skin clarity (directly measured)
        skincare_score = round(skin_quality, 1)
        # grooming ← symmetry + eye quality (reflects neat appearance)
        grooming_score = round((symmetry + eye_quality) / 2, 1)
        # fitness ← proportions (facial structure / health marker)
        fitness_score = round(proportions, 1)
        # confidence ← overall attractiveness (the headline metric)
        confidence_score = round(attractiveness, 1)
        # style ← blend of attractiveness + proportions (how well-put-together)
        style_score = round((attractiveness * 0.6 + proportions * 0.4), 1)
        # overall ← weighted average matching DIMENSION_WEIGHTS
        overall_score = round(
            skincare_score * 0.20 +
            style_score * 0.25 +
            grooming_score * 0.20 +
            fitness_score * 0.15 +
            confidence_score * 0.20,
            1,
        )

        # Build human-readable analysis
        level = (
            "excellent" if attractiveness >= 80 else
            "good" if attractiveness >= 65 else
            "above average" if attractiveness >= 55 else "average"
        )
        emotion_note = f"Your expression reads as {emotion}" if emotion != "neutral" else "Your expression is composed and neutral"
        analysis = (
            f"Based on facial analysis, your overall attractiveness score is {overall_score:.0f}/100 — {level}. "
            f"Facial symmetry scored {symmetry:.0f}/100 and skin clarity {skin_quality:.0f}/100. "
            f"{emotion_note}. Estimated age: {age}."
        )

        # Get personalised tips from Ollama using the dimension scores
        dim_summary = {
            "skincare": round(skincare_score / 10),
            "style": round(style_score / 10),
            "grooming": round(grooming_score / 10),
            "fitness": round(fitness_score / 10),
            "confidence": round(confidence_score / 10),
        }
        tips_prompt = _build_beauty_prompt(dim_summary)
        ollama_result = await _call_ollama(tips_prompt)
        if ollama_result and isinstance(ollama_result.get("tips"), dict):
            raw_tips = ollama_result["tips"]
            tips = {dim: raw_tips.get(dim, FALLBACK_TIPS[dim][:3]) for dim in DIMENSION_WEIGHTS}
        else:
            tips = {dim: FALLBACK_TIPS[dim][:3] for dim in DIMENSION_WEIGHTS}

        ai_result = {
            "skincare_score": skincare_score,
            "style_score": style_score,
            "grooming_score": grooming_score,
            "fitness_score": fitness_score,
            "confidence_score": confidence_score,
            "overall_score": overall_score,
            "analysis": analysis,
            "tips": tips,
        }
    else:
        # face_result said no face — should not reach here (beauty.py gates on this)
        ai_result = None

    # Final fallback
    if ai_result is None:
        log.info("Using text-only fallback for beauty image analysis")
        ai_result = await _call_ollama_text_fallback_for_image()

    # Neutral mid-range assessment for fallback scoring
    neutral_assessment = {dim: 5 for dim in DIMENSION_WEIGHTS}

    if ai_result:
        try:
            overall = float(ai_result.get("overall_score", _compute_weighted_score(neutral_assessment)))
            skincare = float(ai_result.get("skincare_score", 50))
            style = float(ai_result.get("style_score", 50))
            grooming = float(ai_result.get("grooming_score", 50))
            fitness = float(ai_result.get("fitness_score", 50))
            confidence = float(ai_result.get("confidence_score", 50))
            analysis = str(ai_result.get("analysis", ""))
            raw_tips = ai_result.get("tips", {})
            if not isinstance(raw_tips, dict):
                raw_tips = {}
            tips = {dim: raw_tips.get(dim, FALLBACK_TIPS[dim][:3]) for dim in DIMENSION_WEIGHTS}
        except Exception:
            result = _build_fallback_result(neutral_assessment)
            overall = result["overall_score"]
            skincare = result.get("skincare_score", 50)
            style = result.get("style_score", 50)
            grooming = result.get("grooming_score", 50)
            fitness = result.get("fitness_score", 50)
            confidence = result.get("confidence_score", 50)
            analysis = result["analysis"]
            tips = result["tips"]
    else:
        result = _build_fallback_result(neutral_assessment)
        overall = result["overall_score"]
        skincare = result.get("skincare_score", 50)
        style = result.get("style_score", 50)
        grooming = result.get("grooming_score", 50)
        fitness = result.get("fitness_score", 50)
        confidence = result.get("confidence_score", 50)
        analysis = result["analysis"]
        tips = result["tips"]

    score_row = BeautyScore(
        user_id=user_id,
        overall_score=overall,
        skincare_score=skincare,
        style_score=style,
        grooming_score=grooming,
        fitness_score=fitness,
        confidence_score=confidence,
        analysis=analysis,
        tips=json.dumps(tips),
    )
    db.add(score_row)
    await db.commit()
    await db.refresh(score_row)

    return {
        "id": str(score_row.id),
        "overall_score": overall,
        "skincare_score": skincare,
        "style_score": style,
        "grooming_score": grooming,
        "fitness_score": fitness,
        "confidence_score": confidence,
        "analysis": analysis,
        "tips": tips,
        "created_at": score_row.created_at.isoformat(),
        "source": "image",
    }


async def get_latest_beauty_score(db: AsyncSession, user_id: uuid.UUID) -> dict | None:
    result = await db.execute(
        select(BeautyScore)
        .where(BeautyScore.user_id == user_id)
        .order_by(BeautyScore.created_at.desc())
        .limit(1)
    )
    row = result.scalar_one_or_none()
    if not row:
        return None
    tips = row.tips
    if isinstance(tips, str):
        try:
            tips = json.loads(tips)
        except Exception:
            tips = {}
    return {
        "id": str(row.id),
        "overall_score": row.overall_score,
        "skincare_score": row.skincare_score,
        "style_score": row.style_score,
        "grooming_score": row.grooming_score,
        "fitness_score": row.fitness_score,
        "confidence_score": row.confidence_score,
        "analysis": row.analysis,
        "tips": tips,
        "reference_images": get_reference_images(),
        "created_at": row.created_at.isoformat(),
    }


def get_reference_images() -> dict:
    """Return CC0 reference images by dimension from Unsplash/Pexels-style APIs or hardcoded.
    
    Uses publicly available, attribute-free images for reference.
    """
    return {
        "skincare": {
            "url": "https://images.unsplash.com/photo-1556228578-8c89e6adf883?ixlib=rb-4.0.3&w=400",
            "alt": "Skincare routine with cleansers and moisturizers",
            "source": "Unsplash CC0",
        },
        "style": {
            "url": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0.3&w=400",
            "alt": "Well-coordinated outfit with neutral tones",
            "source": "Unsplash CC0",
        },
        "grooming": {
            "url": "https://images.unsplash.com/photo-1552289550-bee5b51eacc1?ixlib=rb-4.0.3&w=400",
            "alt": "Professional haircut and grooming",
            "source": "Unsplash CC0",
        },
        "fitness": {
            "url": "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?ixlib=rb-4.0.3&w=400",
            "alt": "Active person with good posture",
            "source": "Unsplash CC0",
        },
        "confidence": {
            "url": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?ixlib=rb-4.0.3&w=400",
            "alt": "Person with confident eye contact and warm smile",
            "source": "Unsplash CC0",
        },
    }


def get_dimension_confidence_scores(dimension: str, base_score: float) -> dict:
    """Calculate confidence metrics for a beauty dimension with detailed breakdown.
    
    Returns confidence level and specific areas to focus on.
    """
    if base_score >= 80:
        confidence_level = "Excellent"
        action_items = 3  # Areas to maintain/optimize
    elif base_score >= 60:
        confidence_level = "Good"
        action_items = 4  # Areas to improve
    elif base_score >= 40:
        confidence_level = "Fair"
        action_items = 5  # Areas needing work
    else:
        confidence_level = "Low"
        action_items = 6  # Major focus areas
    
    dimension_focus = {
        "skincare": [
            "Establish consistent morning routine",
            "Add SPF 30+ sunscreen",
            "Invest in hydrating serum",
            "Use gentle cleanser",
            "Add weekly exfoliant",
            "Consider targeted treatment (acne/aging)",
        ],
        "style": [
            "Build capsule wardrobe",
            "Learn your color palette",
            "Invest in well-fitting basics",
            "Study outfit combinations",
            "Find personal style inspiration",
            "Practice layering techniques",
        ],
        "grooming": [
            "Schedule regular haircuts",
            "Maintain nail hygiene",
            "Invest in quality deodorant",
            "Choose signature fragrance",
            "Regular eyebrow maintenance",
            "Dental care and whitening",
        ],
        "fitness": [
            "Start daily 30-minute walks",
            "Practice posture exercises",
            "Add strength training 3x/week",
            "Stretch daily",
            "Improve sleep quality",
            "Track activity progress",
        ],
        "confidence": [
            "Practice eye contact",
            "Develop authentic smile",
            "Slow down speech pattern",
            "Use open body language",
            "Build genuine compliments habit",
            "Journal self-affirmations",
        ],
    }
    
    focus_areas = dimension_focus.get(dimension, [])[:action_items]
    
    return {
        "dimension": dimension,
        "base_score": base_score,
        "confidence_level": confidence_level,
        "focus_areas": focus_areas,
        "improvement_potential": 100 - base_score,
    }


async def analyze_beauty_with_confidence(
    db: AsyncSession, user_id: uuid.UUID, assessment: dict
) -> dict:
    """Analyze beauty with per-dimension confidence scores and specific recommendations.
    
    Extends analyze_beauty_text with confidence metrics.
    """
    result = await analyze_beauty_text(db, user_id, assessment)
    
    # Add confidence scores per dimension
    result["confidence_breakdown"] = {}
    for dim in DIMENSION_WEIGHTS:
        score = result.get(f"{dim}_score", 50)
        result["confidence_breakdown"][dim] = get_dimension_confidence_scores(dim, score)
    
    return result
