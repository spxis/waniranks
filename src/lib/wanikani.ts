type WaniKaniUserResponse = {
  data: {
    id: string;
    username: string;
    level: number;
  };
};

type WaniKaniCollectionResponse = {
  total_count: number;
};

type WaniKaniSummaryResponse = {
  data: {
    reviews: Array<{
      available_at: string;
      subject_ids: number[];
    }>;
  };
};

type LeaderboardStats = {
  wkUserId: string;
  wkUsername: string;
  wkLevel: number;
  reviewCount: number;
  burnedCount: number;
  pendingReviews: number;
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
  const [userRes, reviewStatsRes, burnedRes, summaryRes] = await Promise.all([
    fetchWaniKani<WaniKaniUserResponse>("/user", token),
    fetchWaniKani<WaniKaniCollectionResponse>("/review_statistics", token),
    fetchWaniKani<WaniKaniCollectionResponse>("/assignments?srs_stages=9", token),
    fetchWaniKani<WaniKaniSummaryResponse>("/summary", token),
  ]);

  const wkLevel = userRes.data.level;
  const reviewCount = reviewStatsRes.total_count;
  const burnedCount = burnedRes.total_count;
  const now = Date.now();
  const pendingReviews = summaryRes.data.reviews
    .filter((group) => new Date(group.available_at).getTime() <= now)
    .reduce((sum, group) => sum + group.subject_ids.length, 0);

  // Weighted score based on real progress metrics only.
  const score = wkLevel * 1000 + reviewCount * 2 + burnedCount * 4;

  return {
    wkUserId: userRes.data.id,
    wkUsername: userRes.data.username,
    wkLevel,
    reviewCount,
    burnedCount,
    pendingReviews,
    score,
  };
}
