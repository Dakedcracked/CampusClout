/**
 * Beauty rating API integration
 */

// Use NextJS proxy rewrite for API calls
const API_BASE = "/api/v1";

export interface BeautyScore {
  id: string;
  overall_score: number;
  skincare_score: number;
  style_score: number;
  grooming_score: number;
  fitness_score: number;
  confidence_score: number;
  analysis: string;
  tips: {
    skincare: string[];
    style: string[];
    grooming: string[];
    fitness: string[];
    confidence: string[];
  };
  created_at: string;
  source?: "image" | "text";
}

export interface BeautyAnalysisResponse {
  id: string;
  overall_score: number;
  skincare_score: number;
  style_score: number;
  grooming_score: number;
  fitness_score: number;
  confidence_score: number;
  analysis: string;
  tips: Record<string, string[]>;
  created_at: string;
  source?: "image" | "text";
}

/**
 * Upload an image for beauty analysis
 */
export async function uploadImageForBeautyAnalysis(
  file: File
): Promise<BeautyAnalysisResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const url = `${API_BASE}/ai/beauty/analyze-image`;

  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const detail = error.detail || error.message || response.statusText;
    
    if (response.status === 401) {
      throw new Error("Please log in again to use the beauty analyzer.");
    } else if (response.status === 400) {
      throw new Error(detail);
    } else {
      throw new Error(detail || "Beauty analysis failed. Please try again.");
    }
  }

  return response.json();
}

/**
 * Get the latest beauty score
 */
export async function getLatestBeautyScore(
  token: string
): Promise<BeautyScore | null> {
  try {
    const response = await fetch(`${API_BASE}/ai/beauty/score`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch score: ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error("Failed to get latest beauty score:", error);
    throw error;
  }
}

/**
 * Get beauty score by ID (for history)
 */
export async function getBeautyScoreHistory(
  token: string,
  limit: number = 10
): Promise<BeautyScore[]> {
  try {
    const response = await fetch(
      `${API_BASE}/ai/beauty/history?limit=${limit}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      throw new Error(`Failed to fetch history: ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error("Failed to get beauty score history:", error);
    return [];
  }
}

/**
 * Get dimension-specific recommendations
 */
export function getDimensionRecommendations(dimension: string): string[] {
  const recommendations: Record<string, string[]> = {
    skincare: [
      "Establish a consistent morning and evening skincare routine",
      "Use SPF 30+ sunscreen daily to protect against UV damage",
      "Stay hydrated by drinking at least 8 glasses of water daily",
      "Add a quality moisturizer suited to your skin type",
      "Consider weekly exfoliation to remove dead skin cells",
      "Avoid sleeping with makeup on to prevent clogged pores",
    ],
    style: [
      "Build a capsule wardrobe with versatile neutral pieces",
      "Learn your undertone (warm/cool/neutral) for better color matching",
      "Invest in well-fitting clothes that flatter your body type",
      "Study fashion blogs and Pinterest boards for style inspiration",
      "Practice layering different pieces for varied looks",
      "Keep accessories minimal and intentional",
    ],
    grooming: [
      "Schedule regular haircuts every 6-8 weeks to maintain shape",
      "Keep your nails clean, trimmed, and properly maintained",
      "Invest in a quality deodorant and consider a signature fragrance",
      "Maintain eyebrow shape through regular grooming",
      "Practice good dental hygiene and consider whitening options",
      "Keep body hair well-maintained and groomed",
    ],
    fitness: [
      "Start with 30 minutes of daily walking to build activity habits",
      "Practice proper posture: shoulders back, core engaged, chin parallel",
      "Add strength training 3x per week for lean muscle development",
      "Stretch daily for flexibility and improved appearance",
      "Aim for 7-9 hours of quality sleep each night",
      "Stay consistent with exercise—visible results take 3-4 weeks",
    ],
    confidence: [
      "Practice maintaining eye contact when speaking with others",
      "Develop an authentic smile and use it frequently",
      "Slow down your speech—confident people don't rush words",
      "Use open body language: uncross arms, take up appropriate space",
      "Genuinely compliment others—it reflects well on you",
      "Build positive self-talk habits and practice daily affirmations",
    ],
  };

  return recommendations[dimension] || [];
}

/**
 * Get reference images for dimensions
 */
export function getReferenceImages(): Record<
  string,
  {
    url: string;
    alt: string;
    source: string;
  }
> {
  return {
    skincare: {
      url: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?ixlib=rb-4.0.3&w=400",
      alt: "Skincare routine with cleansers and moisturizers",
      source: "Unsplash",
    },
    style: {
      url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0.3&w=400",
      alt: "Well-coordinated outfit with neutral tones",
      source: "Unsplash",
    },
    grooming: {
      url: "https://images.unsplash.com/photo-1552289550-bee5b51eacc1?ixlib=rb-4.0.3&w=400",
      alt: "Professional haircut and grooming",
      source: "Unsplash",
    },
    fitness: {
      url: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?ixlib=rb-4.0.3&w=400",
      alt: "Active person with good posture",
      source: "Unsplash",
    },
    confidence: {
      url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?ixlib=rb-4.0.3&w=400",
      alt: "Person with confident eye contact and warm smile",
      source: "Unsplash",
    },
  };
}

/**
 * Get description of confidence level based on score
 */
export function getConfidenceLevel(score: number): {
  level: string;
  color: string;
  description: string;
} {
  if (score >= 80) {
    return {
      level: "Excellent",
      color: "text-green-600",
      description: "Outstanding performance in this dimension",
    };
  } else if (score >= 65) {
    return {
      level: "Good",
      color: "text-blue-600",
      description: "Strong performance with room for improvement",
    };
  } else if (score >= 50) {
    return {
      level: "Fair",
      color: "text-yellow-600",
      description: "Average performance with clear improvement areas",
    };
  } else {
    return {
      level: "Needs Work",
      color: "text-red-600",
      description: "Significant opportunity for improvement",
    };
  }
}

/**
 * Format score for display
 */
export function formatScore(score: number): string {
  return score.toFixed(1);
}

/**
 * Get overall attractiveness level description
 */
export function getAttractivenessLevel(score: number): string {
  if (score >= 80) return "Exceptional";
  if (score >= 70) return "Excellent";
  if (score >= 60) return "Very Good";
  if (score >= 50) return "Good";
  if (score >= 40) return "Fair";
  return "Average";
}
