// ============================================================
// AI Engine - Crime Analysis Algorithms (CommonJS)
// Provides: Similar Crime Detection, Suspect Recommendation,
// Hotspot Analysis, Priority Scoring, Network Analysis
// ============================================================

// ---- COSINE SIMILARITY ----
function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0, magA = 0, magB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        magA += vecA[i] * vecA[i];
        magB += vecB[i] * vecB[i];
    }
    magA = Math.sqrt(magA);
    magB = Math.sqrt(magB);
    if (magA === 0 || magB === 0) return 0;
    return dotProduct / (magA * magB);
}

const CRIME_TYPES = ['Robbery', 'Burglary', 'Fraud', 'Assault', 'Cybercrime', 'Homicide', 'Theft', 'Drug Trafficking'];
const METHODS = ['Armed', 'Break-in', 'Phishing', 'Physical', 'Ransomware', 'Snatching', 'Investment Scam', 'Hacking', 'Other'];
const TIME_PERIODS = ['Morning', 'Afternoon', 'Evening', 'Night'];

function getTimePeriod(time) {
    if (!time) return 'Night';
    const hour = parseInt(time.split(':')[0]);
    if (hour >= 6 && hour < 12) return 'Morning';
    if (hour >= 12 && hour < 17) return 'Afternoon';
    if (hour >= 17 && hour < 21) return 'Evening';
    return 'Night';
}

function encodeCrime(fir) {
    const vec = [];
    CRIME_TYPES.forEach(t => vec.push(fir.crimeType === t ? 1 : 0));
    METHODS.forEach(m => vec.push(fir.method === m ? 1 : 0));
    const period = getTimePeriod(fir.time);
    TIME_PERIODS.forEach(p => vec.push(period === p ? 1 : 0));
    const sevMap = { 'Low': 0.25, 'Medium': 0.5, 'High': 0.75, 'Critical': 1.0 };
    vec.push(sevMap[fir.severity] || 0.5);
    return vec;
}

// ---- 1. SIMILAR CRIME DETECTION ----
function findSimilarCrimes(targetFir, allFirs, topN = 5) {
    const targetVec = encodeCrime(targetFir);
    const results = allFirs
        .filter(f => f.firId !== targetFir.firId)
        .map(fir => {
            const firVec = encodeCrime(fir);
            const similarity = cosineSimilarity(targetVec, firVec);
            const factors = [];
            if (fir.crimeType === targetFir.crimeType) factors.push({ factor: 'Same crime type', weight: 'High' });
            if (fir.method === targetFir.method) factors.push({ factor: 'Same method used', weight: 'High' });
            if (fir.location?.includes(targetFir.location?.split(',')[0])) factors.push({ factor: 'Same area', weight: 'Medium' });
            if (getTimePeriod(fir.time) === getTimePeriod(targetFir.time)) factors.push({ factor: 'Same time period', weight: 'Low' });
            if (fir.severity === targetFir.severity) factors.push({ factor: 'Same severity level', weight: 'Low' });
            return { fir, similarity: Math.round(similarity * 100), factors };
        })
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topN);
    return results;
}

// ---- 2. SUSPECT RECOMMENDATION ----
function recommendSuspects(targetFir, criminals, allFirs) {
    return criminals
        .map(criminal => {
            let score = 0;
            const reasons = [];
            if (criminal.crimeHistory?.includes(targetFir.crimeType)) {
                score += 35;
                reasons.push(`History of ${targetFir.crimeType} offenses`);
            }
            const targetCity = targetFir.location?.split(',').pop()?.trim();
            if (criminal.knownAddress?.includes(targetCity)) {
                score += 25;
                reasons.push(`Known address in ${targetCity}`);
            }
            const riskMap = { 'High': 15, 'Medium': 10, 'Low': 5 };
            score += riskMap[criminal.riskLevel] || 0;
            if (criminal.riskLevel === 'High') reasons.push('High risk classification');
            const convScore = Math.min(criminal.priorConvictions * 5, 15);
            score += convScore;
            if (criminal.priorConvictions > 0) reasons.push(`${criminal.priorConvictions} prior conviction(s)`);
            if (criminal.status === 'Active' || criminal.status === 'Wanted') {
                score += 10;
                reasons.push(`Currently ${criminal.status.toLowerCase()}`);
            }
            return {
                criminal,
                score: Math.min(score, 100),
                reasons,
                confidence: score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low',
            };
        })
        .sort((a, b) => b.score - a.score);
}

// ---- 3. CRIME HOTSPOT IDENTIFICATION ----
function identifyHotspots(firs) {
    const locationMap = {};
    firs.forEach(fir => {
        const city = fir.location?.split(',').pop()?.trim() || 'Unknown';
        const area = fir.location?.split(',')[0]?.trim() || 'Unknown';
        const key = `${area}, ${city}`;
        if (!locationMap[key]) {
            locationMap[key] = { location: key, area, city, count: 0, crimes: [], lat: fir.lat || 0, lng: fir.lng || 0, severitySum: 0 };
        }
        locationMap[key].count++;
        locationMap[key].crimes.push(fir.crimeType);
        const sevMap = { 'Low': 1, 'Medium': 2, 'High': 3, 'Critical': 4 };
        locationMap[key].severitySum += sevMap[fir.severity] || 2;
    });
    return Object.values(locationMap)
        .map(h => ({
            ...h,
            riskScore: ((h.count * 2 + h.severitySum) / (h.count + 1)).toFixed(1),
            dominantCrime: getMostFrequent(h.crimes),
            intensity: h.count >= 3 ? 'High' : h.count >= 2 ? 'Medium' : 'Low',
        }))
        .sort((a, b) => b.count - a.count);
}

function getMostFrequent(arr) {
    const freq = {};
    arr.forEach(item => freq[item] = (freq[item] || 0) + 1);
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';
}

// ---- 4. CASE PRIORITY SCORING ----
function calculatePriority(fir, evidenceList, cases) {
    const weights = { severity: 0.30, evidenceStrength: 0.20, recency: 0.20, publicImpact: 0.15, patternMatch: 0.15 };
    const sevScores = { 'Critical': 10, 'High': 7.5, 'Medium': 5, 'Low': 2.5 };
    const severityScore = sevScores[fir.severity] || 5;
    const caseEvidence = evidenceList.filter(e => {
        const c = cases.find(cs => cs.firId === fir.firId);
        return c && e.caseId === c.caseId;
    });
    const evidenceScore = Math.min(caseEvidence.length * 2.5, 10);
    const daysAgo = Math.floor((new Date() - new Date(fir.date)) / (1000 * 60 * 60 * 24));
    const recencyScore = Math.max(10 - daysAgo * 0.2, 1);
    const highImpactTypes = ['Robbery', 'Homicide', 'Assault', 'Cybercrime'];
    const publicImpactScore = highImpactTypes.includes(fir.crimeType) ? 8 : 5;
    const patternScore = fir.severity === 'Critical' ? 9 : fir.severity === 'High' ? 7 : 5;
    const totalScore = (
        severityScore * weights.severity +
        evidenceScore * weights.evidenceStrength +
        recencyScore * weights.recency +
        publicImpactScore * weights.publicImpact +
        patternScore * weights.patternMatch
    );
    return {
        totalScore: Math.round(totalScore * 10) / 10,
        maxScore: 10,
        breakdown: [
            { factor: 'Crime Severity', score: severityScore, weight: weights.severity * 100 + '%', explanation: `${fir.severity} severity crime` },
            { factor: 'Evidence Strength', score: evidenceScore, weight: weights.evidenceStrength * 100 + '%', explanation: `${caseEvidence.length} evidence item(s) collected` },
            { factor: 'Recency', score: Math.round(recencyScore * 10) / 10, weight: weights.recency * 100 + '%', explanation: `${daysAgo} days since incident` },
            { factor: 'Public Impact', score: publicImpactScore, weight: weights.publicImpact * 100 + '%', explanation: `${fir.crimeType} - ${highImpactTypes.includes(fir.crimeType) ? 'high' : 'moderate'} public concern` },
            { factor: 'Pattern Match', score: patternScore, weight: weights.patternMatch * 100 + '%', explanation: `Matches ${fir.severity?.toLowerCase()} risk patterns` },
        ],
        priority: totalScore >= 7.5 ? 'Critical' : totalScore >= 5.5 ? 'High' : totalScore >= 3.5 ? 'Medium' : 'Low',
    };
}

// ---- 5. CRIMINAL NETWORK ANALYSIS ----
function analyzeNetwork(criminals) {
    const nodes = criminals.map(c => ({
        id: c.criminalId, name: c.name, riskLevel: c.riskLevel, status: c.status,
        crimes: c.crimeHistory || [], connections: 0,
    }));
    const edges = [];
    const edgeSet = new Set();
    criminals.forEach(c => {
        (c.associates || []).forEach(assocId => {
            const key = [Math.min(c.criminalId, assocId), Math.max(c.criminalId, assocId)].join('-');
            if (!edgeSet.has(key)) {
                edgeSet.add(key);
                const assoc = criminals.find(cr => cr.criminalId === assocId);
                const sharedCrimes = assoc ? c.crimeHistory?.filter(ct => assoc.crimeHistory?.includes(ct)) || [] : [];
                const sharedCases = assoc ? (c.relatedCases || []).filter(cs => (assoc.relatedCases || []).includes(cs)) : [];
                edges.push({
                    source: c.criminalId, target: assocId,
                    relationship: sharedCrimes.length > 0 ? `Shared crime type: ${sharedCrimes.join(', ')}` : 'Known associate',
                    sharedCases: sharedCases.length, strength: sharedCrimes.length + sharedCases.length,
                });
            }
        });
    });
    edges.forEach(e => {
        const sourceNode = nodes.find(n => n.id === e.source);
        const targetNode = nodes.find(n => n.id === e.target);
        if (sourceNode) sourceNode.connections++;
        if (targetNode) targetNode.connections++;
    });
    const keyPlayers = [...nodes].sort((a, b) => b.connections - a.connections).slice(0, 3);
    return { nodes, edges, keyPlayers };
}

module.exports = { findSimilarCrimes, recommendSuspects, identifyHotspots, calculatePriority, analyzeNetwork };
