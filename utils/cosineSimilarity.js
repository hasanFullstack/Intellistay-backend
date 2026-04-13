export const cosineSimilarity = (A, B) => {
    if (!A.length || !B.length) return 0;

    const dotProduct = A.reduce((sum, a, i) => sum + a * (B[i] || 0), 0);

    const magnitudeA = Math.sqrt(A.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(B.reduce((sum, b) => sum + b * b, 0));

    if (magnitudeA === 0 || magnitudeB === 0) return 0;

    return dotProduct / (magnitudeA * magnitudeB);
};