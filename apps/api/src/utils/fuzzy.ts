export function findSimilarProperties(
  query: string,
  existing: Array<[string, string]>,
  threshold = 0.6,
): Array<{ name: string; data_type: string; similarity: number }> {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) {
    return [];
  }

  const suggestions: Array<{ name: string; data_type: string; similarity: number }> = [];

  for (const [name, dataType] of existing) {
    const normalizedName = name.toLowerCase();
    if (normalizedName === normalizedQuery) {
      continue;
    }

    const similarity = lcsSimilarity(normalizedQuery, normalizedName);
    if (similarity > threshold) {
      suggestions.push({
        name,
        data_type: dataType,
        similarity: Math.round(similarity * 1000) / 1000,
      });
    }
  }

  return suggestions.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
}

function lcsSimilarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) {
    return 1;
  }

  const lcs = longestCommonSubsequenceLength(a, b);
  return (2 * lcs) / (a.length + b.length);
}

function longestCommonSubsequenceLength(a: string, b: string): number {
  const dp: number[] = new Array(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i += 1) {
    let prev = 0;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = dp[j];
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev + 1;
      } else {
        dp[j] = Math.max(dp[j], dp[j - 1]);
      }
      prev = temp;
    }
  }

  return dp[b.length];
}
