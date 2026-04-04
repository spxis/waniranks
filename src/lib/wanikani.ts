type WaniKaniUserResponse = {
  data: {
    id: number;
    username: string;
    level: number;
  };
};

type WaniKaniReviewsResponse = {
  total_count: number;
};

type LeaderboardStats = {
  wkUserId: number;
  wkUsername: string;
  wkLevel: number;
  reviewCount: number;
  score: number;
};

const BASE_URL = "https://api.wanikani.com/v2";

async function fetchWaniKani<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Wanikani-Revision": "20170710",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`WaniKani API error: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getLeaderboardStats(token: string): Promise<LeaderboardStats> {
  const [userRes, reviewsRes] = await Promise.all([
    fetchWaniKani<WaniKaniUserResponse>("/user", token),
    fetchWaniKani<WaniKaniReviewsResponse>("/reviews", token),
  ]);

  const wkLevel = userRes.data.level;
  const reviewCount = reviewsRes.total_count;

  return {
    wkUserId: userRes.data.id,
    wkUsername: userRes.data.username,
    wkLevel,
    reviewCount,
    score: wkLevel * 1000 + reviewCount,
  };
}
