// Unified API Client - Integrates both AniList and Jikan APIs

import aniListClient from './anilist-client.js';
import jikanClient from './jikan-client.js';

class UnifiedAPIClient {
    constructor() {
        this.aniListClient = aniListClient || new AniListClient();
        this.jikanClient = jikanClient || new JikanClient();
        this.cache = {
            characters: new Map(),
            series: new Map()
        };
        this.cacheExpiry = 30 * 60 * 1000; // 30 minutes cache expiry
    }

    // Helper method to check and retrieve from cache
    _getFromCache(cacheType, key) {
        const cacheEntry = this.cache[cacheType].get(key);
        if (cacheEntry && (Date.now() - cacheEntry.timestamp < this.cacheExpiry)) {
            console.log(`Cache hit for ${cacheType}: ${key}`);
            return cacheEntry.data;
        }
        return null;
    }

    // Helper method to store in cache
    _storeInCache(cacheType, key, data) {
        this.cache[cacheType].set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    // Merge character data from both APIs
    _mergeCharacterData(aniListData, jikanData) {
        // If we only have data from one source, return that
        if (!aniListData && !jikanData) return null;
        if (!aniListData) return jikanData;
        if (!jikanData) return aniListData;

        // Create a merged character object with the best data from both sources
        const mergedCharacter = {
            // Use AniList ID as primary if available, otherwise use MAL ID
            id: aniListData.id || jikanData.id,
            mal_id: jikanData.mal_id || null,
            anilist_id: aniListData.id || null,
            name: aniListData.name || jikanData.name,
            native_name: aniListData.native_name || null,
            // Prefer AniList image if available as it's often higher quality
            image_url: aniListData.image_url || jikanData.image_url,
            // Combine descriptions, preferring the longer one
            description: (aniListData.description && aniListData.description.length > (jikanData.about?.length || 0)) 
                ? aniListData.description 
                : jikanData.about || aniListData.description || '',
            // Series information
            seriesId: aniListData.seriesId || jikanData.seriesId,
            series_mal_id: jikanData.series_mal_id || null,
            series_anilist_id: aniListData.seriesId || null,
            series_name: aniListData.series_name || jikanData.series_name || 'Unknown Anime',
            series_image: aniListData.series_image || null,
            // Combine genres from both sources for more comprehensive data
            series_genres: [...new Set([
                ...(aniListData.series_genres || []), 
                ...(jikanData.animeData?.genres || [])
            ])],
            // Use the higher popularity value
            popularity: Math.max(aniListData.popularity || 0, jikanData.popularity || 0),
            // Combine nicknames if available
            nicknames: jikanData.nicknames || [],
            // Take the best attributes from both sources
            strength: Math.max(aniListData.strength || 0, jikanData.strength || 0) || Math.floor(Math.random() * 30) + 70,
            speed: Math.max(aniListData.speed || 0, jikanData.speed || 0) || Math.floor(Math.random() * 30) + 70,
            intelligence: Math.max(aniListData.intelligence || 0, jikanData.intelligence || 0) || Math.floor(Math.random() * 30) + 70,
            // Flag indicating data was merged from both sources
            dataSource: 'unified'
        };

        return mergedCharacter;
    }

    // Search for characters using both APIs
    async searchCharacters(query) {
        if (!query || query.trim() === '') return [];
        
        // Check cache first
        const cacheKey = `search:${query.toLowerCase()}`;
        const cachedResult = this._getFromCache('characters', cacheKey);
        if (cachedResult) return cachedResult;
        
        try {
            // Fetch from both APIs in parallel
            const [aniListResults, jikanResults] = await Promise.allSettled([
                this.aniListClient.searchCharacters(query),
                this.jikanClient.searchCharacters(query)
            ]);
            
            // Extract results or empty arrays if rejected
            const aniListCharacters = aniListResults.status === 'fulfilled' ? aniListResults.value : [];
            const jikanCharacters = jikanResults.status === 'fulfilled' ? jikanResults.value : [];
            
            // Create a map to merge characters by name
            const characterMap = new Map();
            
            // Process AniList characters
            aniListCharacters.forEach(char => {
                const key = char.name.toLowerCase();
                characterMap.set(key, { aniList: char, jikan: null });
            });
            
            // Process Jikan characters and merge with AniList data when possible
            jikanCharacters.forEach(char => {
                const key = char.name.toLowerCase();
                if (characterMap.has(key)) {
                    // Merge with existing AniList character
                    characterMap.get(key).jikan = char;
                } else {
                    // Add new Jikan character
                    characterMap.set(key, { aniList: null, jikan: char });
                }
            });
            
            // Merge the data and create final character list
            const mergedCharacters = Array.from(characterMap.values()).map(({ aniList, jikan }) => {
                return this._mergeCharacterData(aniList, jikan);
            }).filter(Boolean); // Remove any null results
            
            // Sort by popularity
            mergedCharacters.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
            
            // Cache the results
            this._storeInCache('characters', cacheKey, mergedCharacters);
            
            return mergedCharacters;
        } catch (error) {
            console.error('Error searching characters with unified API:', error);
            
            // Fallback to individual APIs if one fails
            try {
                const jikanResults = await this.jikanClient.searchCharacters(query);
                return jikanResults;
            } catch (jikanError) {
                console.error('Jikan fallback failed:', jikanError);
                try {
                    const aniListResults = await this.aniListClient.searchCharacters(query);
                    return aniListResults;
                } catch (aniListError) {
                    console.error('AniList fallback failed:', aniListError);
                    return [];
                }
            }
        }
    }

    // Get character details by ID from both sources when possible
    async getCharacterDetails(character) {
        if (!character) return null;
        
        // Determine which IDs we have
        const malId = character.mal_id;
        const anilistId = character.anilist_id || character.id;
        
        // Check cache first
        const cacheKey = `details:${malId || ''}:${anilistId || ''}`;
        const cachedResult = this._getFromCache('characters', cacheKey);
        if (cachedResult) return cachedResult;
        
        try {
            // Fetch from both APIs in parallel when possible
            const apiPromises = [];
            
            if (malId) {
                apiPromises.push(this.jikanClient.getCharacterDetailsByMalId(malId)
                    .catch(err => {
                        console.warn(`Could not fetch Jikan details for character ${malId}:`, err);
                        return null;
                    }));
            } else {
                apiPromises.push(Promise.resolve(null));
            }
            
            if (anilistId) {
                // Assuming AniList client has a similar method
                apiPromises.push(this.aniListClient.getCharacterById(anilistId)
                    .catch(err => {
                        console.warn(`Could not fetch AniList details for character ${anilistId}:`, err);
                        return null;
                    }));
            } else {
                apiPromises.push(Promise.resolve(null));
            }
            
            const [jikanDetails, anilistDetails] = await Promise.all(apiPromises);
            
            // Merge the data
            const mergedCharacter = this._mergeCharacterData(anilistDetails, jikanDetails);
            
            // If we have a merged character, cache it
            if (mergedCharacter) {
                this._storeInCache('characters', cacheKey, mergedCharacter);
            }
            
            return mergedCharacter || character; // Return original if no details found
        } catch (error) {
            console.error('Error fetching character details:', error);
            return character; // Return original character on error
        }
    }

    // Search for anime series using both APIs
    async searchSeries(query) {
        if (!query || query.trim() === '') return [];
        
        // Check cache first
        const cacheKey = `search:${query.toLowerCase()}`;
        const cachedResult = this._getFromCache('series', cacheKey);
        if (cachedResult) return cachedResult;
        
        try {
            // Fetch from both APIs in parallel
            const [aniListResults, jikanResults] = await Promise.allSettled([
                this.aniListClient.searchSeries(query),
                this.jikanClient.searchSeries(query)
            ]);
            
            // Extract results or empty arrays if rejected
            const aniListSeries = aniListResults.status === 'fulfilled' ? aniListResults.value : [];
            const jikanSeries = jikanResults.status === 'fulfilled' ? jikanResults.value : [];
            
            // Create a map to merge series by name
            const seriesMap = new Map();
            
            // Process AniList series
            aniListSeries.forEach(series => {
                const key = series.name.toLowerCase();
                seriesMap.set(key, { aniList: series, jikan: null });
            });
            
            // Process Jikan series and merge with AniList data when possible
            jikanSeries.forEach(series => {
                const key = series.name.toLowerCase();
                if (seriesMap.has(key)) {
                    // Merge with existing AniList series
                    seriesMap.get(key).jikan = series;
                } else {
                    // Add new Jikan series
                    seriesMap.set(key, { aniList: null, jikan: series });
                }
            });
            
            // Merge the data and create final series list
            const mergedSeries = Array.from(seriesMap.values()).map(({ aniList, jikan }) => {
                // If we have data from both sources, merge them
                if (aniList && jikan) {
                    return {
                        id: aniList.id || jikan.id,
                        mal_id: jikan.mal_id || null,
                        anilist_id: aniList.id || null,
                        name: aniList.name || jikan.name,
                        image_url: aniList.image_url || jikan.image_url,
                        // Use the higher popularity value
                        popularity: Math.max(aniList.popularity || 0, jikan.popularity || 0),
                        year: aniList.seasonYear || jikan.year || 'Unknown',
                        // Combine genres from both sources
                        genres: [...new Set([...(aniList.genres || []), ...(jikan.genres || [])])],
                        // Flag indicating data was merged from both sources
                        dataSource: 'unified'
                    };
                }
                // Otherwise return data from the available source
                return aniList || jikan;
            });
            
            // Sort by popularity
            mergedSeries.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
            
            // Cache the results
            this._storeInCache('series', cacheKey, mergedSeries);
            
            return mergedSeries;
        } catch (error) {
            console.error('Error searching series with unified API:', error);
            
            // Fallback to individual APIs if one fails
            try {
                const jikanResults = await this.jikanClient.searchSeries(query);
                return jikanResults;
            } catch (jikanError) {
                console.error('Jikan fallback failed:', jikanError);
                try {
                    const aniListResults = await this.aniListClient.searchSeries(query);
                    return aniListResults;
                } catch (aniListError) {
                    console.error('AniList fallback failed:', aniListError);
                    return [];
                }
            }
        }
    }

    // AI-like detection of anime from character name using both APIs
    async detectAnimeFromCharacter(characterName) {
        if (!characterName || characterName.trim() === '') return null;
        
        try {
            // Try Jikan first as it has this functionality
            const jikanDetection = await this.jikanClient.detectAnimeFromCharacter(characterName)
                .catch(err => {
                    console.warn(`Jikan anime detection failed for ${characterName}:`, err);
                    return null;
                });
            
            if (jikanDetection && jikanDetection.confidence > 0.7) {
                return jikanDetection;
            }
            
            // If Jikan fails or has low confidence, try with AniList
            const characters = await this.aniListClient.searchCharacters(characterName)
                .catch(err => {
                    console.warn(`AniList character search failed for ${characterName}:`, err);
                    return [];
                });
            
            if (characters.length > 0) {
                // Find the best match based on name similarity
                const bestMatch = characters.reduce((best, current) => {
                    const currentSimilarity = this._calculateStringSimilarity(
                        characterName.toLowerCase(),
                        current.name.toLowerCase()
                    );
                    
                    if (currentSimilarity > best.similarity) {
                        return { character: current, similarity: currentSimilarity };
                    }
                    return best;
                }, { character: null, similarity: 0 });
                
                if (bestMatch.similarity > 0.7 && bestMatch.character.series_name) {
                    return {
                        character: bestMatch.character.name,
                        series: { name: bestMatch.character.series_name },
                        confidence: bestMatch.similarity,
                        source: 'anilist'
                    };
                }
            }
            
            // If both APIs fail, return null or the best guess we have
            return jikanDetection || null;
        } catch (error) {
            console.error('Error detecting anime from character:', error);
            return null;
        }
    }

    // Helper method to calculate string similarity (Levenshtein distance based)
    _calculateStringSimilarity(str1, str2) {
        if (!str1 || !str2) return 0;
        if (str1 === str2) return 1;
        
        const len1 = str1.length;
        const len2 = str2.length;
        
        // Quick length check
        if (Math.abs(len1 - len2) > 5) return 0;
        
        // Use Levenshtein distance
        const track = Array(len2 + 1).fill(null).map(() => 
            Array(len1 + 1).fill(null));
        
        for (let i = 0; i <= len1; i++) track[0][i] = i;
        for (let j = 0; j <= len2; j++) track[j][0] = j;
        
        for (let j = 1; j <= len2; j++) {
            for (let i = 1; i <= len1; i++) {
                const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
                track[j][i] = Math.min(
                    track[j][i - 1] + 1, // deletion
                    track[j - 1][i] + 1, // insertion
                    track[j - 1][i - 1] + indicator // substitution
                );
            }
        }
        
        // Convert distance to similarity score (0-1)
        const maxLen = Math.max(len1, len2);
        const distance = track[len2][len1];
        return 1 - (distance / maxLen);
    }
}

// Create and export a singleton instance
const unifiedAPIClient = new UnifiedAPIClient();
export default unifiedAPIClient;