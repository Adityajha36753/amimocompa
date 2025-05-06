// Jikan API Client - Direct API integration without local database

class JikanClient {
    constructor() {
        this.baseUrl = 'https://api.jikan.moe/v4';
        this.rateLimit = 4; // Jikan API has a rate limit of 3 requests per second
        this.requestQueue = [];
        this.processing = false;
    }

    // Helper method to handle rate limiting
    async processQueue() {
        if (this.processing || this.requestQueue.length === 0) return;
        
        this.processing = true;
        
        while (this.requestQueue.length > 0) {
            const { url, resolve, reject } = this.requestQueue.shift();
            
            try {
                const response = await fetch(url);
                
                if (response.status === 429) {
                    // Rate limited, wait and try again
                    console.warn('Rate limit reached for Jikan API, waiting before retry...');
                    this.requestQueue.unshift({ url, resolve, reject });
                    await new Promise(r => setTimeout(r, 1000));
                    continue;
                }
                
                if (!response.ok) {
                    throw new Error(`API error: ${response.status}`);
                }
                
                const data = await response.json();
                resolve(data);
            } catch (error) {
                console.error('Error fetching from Jikan API:', error);
                reject(error);
            }
            
            // Wait to respect rate limit
            await new Promise(r => setTimeout(r, 1000 / this.rateLimit));
        }
        
        this.processing = false;
    }

    // Queue a request and process it
    queueRequest(url) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({ url, resolve, reject });
            this.processQueue();
        });
    }

    // Search for characters by name
    async searchCharacters(query) {
        if (!query || query.trim() === '') return [];
        
        try {
            const url = `${this.baseUrl}/characters?q=${encodeURIComponent(query)}&limit=10`;
            const data = await this.queueRequest(url);
            
            if (!data.data || data.data.length === 0) {
                return [];
            }
            
            // Process the character data
            const characters = [];
            
            for (const apiChar of data.data) {
                // Get anime information for this character
                let seriesId = null;
                let seriesName = 'Unknown Anime';
                let seriesMalId = null;
                
                if (apiChar.anime && apiChar.anime.length > 0) {
                    const animeInfo = apiChar.anime[0];
                    seriesMalId = animeInfo.anime?.mal_id || animeInfo.mal_id;
                    seriesId = seriesMalId; // Use MAL ID as series ID
                    seriesName = animeInfo.anime?.title || animeInfo.title || 'Unknown Anime';
                }
                
                // Create a character entry
                const character = {
                    id: apiChar.mal_id,
                    name: apiChar.name,
                    mal_id: apiChar.mal_id,
                    image_url: apiChar.images?.jpg?.image_url || '',
                    seriesId: seriesId,
                    series_mal_id: seriesMalId,
                    series_name: seriesName, // Add the series name to the character object
                    powers: ['Unknown Power'], // API doesn't provide powers
                    strength: Math.floor(Math.random() * 30) + 70, // Random stats for demo
                    speed: Math.floor(Math.random() * 30) + 70,
                    intelligence: Math.floor(Math.random() * 30) + 70,
                    popularity: apiChar.favorites || 50
                };
                
                characters.push(character);
            }
            
            return characters;
        } catch (error) {
            console.error('Error searching characters:', error);
            return [];
        }
    }

    // Search for anime series by name
    async searchSeries(query) {
        if (!query || query.trim() === '') return [];
        
        try {
            const url = `${this.baseUrl}/anime?q=${encodeURIComponent(query)}&limit=10`;
            const data = await this.queueRequest(url);
            
            if (!data.data || data.data.length === 0) {
                return [];
            }
            
            // Process the series data
            return data.data.map(anime => ({
                id: anime.mal_id,
                name: anime.title,
                mal_id: anime.mal_id,
                image_url: anime.images?.jpg?.image_url || '',
                popularity: Math.round(anime.score * 10) || 80,
                year: anime.year || 'Unknown',
                genres: anime.genres?.map(g => g.name) || []
            }));
        } catch (error) {
            console.error('Error searching anime series:', error);
            return [];
        }
    }

    // Get character details by MAL ID
    async getCharacterDetailsByMalId(malId) {
        try {
            const url = `${this.baseUrl}/characters/${malId}/full`;
            const data = await this.queueRequest(url);
            
            if (!data.data) {
                throw new Error('No character data returned from API');
            }
            
            const charData = data.data;
            
            // Create a character entry with detailed information
            const character = {
                id: charData.mal_id,
                name: charData.name,
                mal_id: charData.mal_id,
                image_url: charData.images?.jpg?.image_url || '',
                about: charData.about || '',
                nicknames: charData.nicknames || [],
                detailed: true,
                powers: ['Unknown Power'], // API doesn't provide powers
                strength: Math.floor(Math.random() * 30) + 70,
                speed: Math.floor(Math.random() * 30) + 70,
                intelligence: Math.floor(Math.random() * 30) + 70,
                popularity: charData.favorites || 50
            };
            
            // If the character has anime appearances, add series info
            if (charData.anime && charData.anime.length > 0) {
                const animeAppearance = charData.anime[0];
                character.seriesId = animeAppearance.anime?.mal_id || animeAppearance.mal_id;
                character.series_mal_id = animeAppearance.anime?.mal_id || animeAppearance.mal_id;
                character.series_name = animeAppearance.anime?.title || animeAppearance.title || 'Unknown Anime';
                character.role = animeAppearance.role || 'Unknown';
                
                // Log the anime information for debugging
                console.log('Anime appearance data:', animeAppearance);
                console.log('Series name extracted:', character.series_name);
            }
            
            return character;
        } catch (error) {
            console.error('Error fetching character details:', error);
            throw error;
        }
    }

    // Simple AI-like detection of anime from character name
    // This is a simplified version that uses the API search
    async detectAnimeFromCharacter(characterName) {
        if (!characterName || characterName.trim() === '') return null;
        
        try {
            const characters = await this.searchCharacters(characterName);
            
            if (characters.length === 0) return null;
            
            // Find the best match based on name similarity
            const bestMatch = characters.reduce((best, current) => {
                const currentSimilarity = this.calculateStringSimilarity(
                    characterName.toLowerCase(),
                    current.name.toLowerCase()
                );
                
                if (!best || currentSimilarity > best.similarity) {
                    return { character: current, similarity: currentSimilarity };
                }
                
                return best;
            }, null);
            
            if (bestMatch && bestMatch.similarity > 0.7) {
                // Get series info if available
                let series = null;
                if (bestMatch.character.seriesId) {
                        // Create a series object with the information from the character
                    series = {
                        id: bestMatch.character.seriesId,
                        name: bestMatch.character.series_name || 'Unknown Anime',
                        mal_id: bestMatch.character.series_mal_id
                    };
                    
                    // Log the series information for debugging
                    console.log('Series info for character detection:', series);
                }
                
                return {
                    character: bestMatch.character,
                    series: series,
                    confidence: bestMatch.similarity
                };
            }
            
            return null;
        } catch (error) {
            console.error('Error detecting anime from character:', error);
            return null;
        }
    }

    // Simple string similarity algorithm (Levenshtein distance based)
    calculateStringSimilarity(str1, str2) {
        const track = Array(str2.length + 1).fill(null).map(() => 
            Array(str1.length + 1).fill(null));
        
        for (let i = 0; i <= str1.length; i += 1) {
            track[0][i] = i;
        }
        
        for (let j = 0; j <= str2.length; j += 1) {
            track[j][0] = j;
        }
        
        for (let j = 1; j <= str2.length; j += 1) {
            for (let i = 1; i <= str1.length; i += 1) {
                const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
                track[j][i] = Math.min(
                    track[j][i - 1] + 1, // deletion
                    track[j - 1][i] + 1, // insertion
                    track[j - 1][i - 1] + indicator, // substitution
                );
            }
        }
        
        const distance = track[str2.length][str1.length];
        const maxLength = Math.max(str1.length, str2.length);
        const similarity = 1 - distance / maxLength;
        
        return similarity;
    }
}

// Create and export a singleton instance
const jikanClient = new JikanClient();
export default jikanClient;