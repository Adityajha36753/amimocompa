// AniList API Client - Direct GraphQL API integration

class AniListClient {
    constructor() {
        this.baseUrl = 'https://graphql.anilist.co';
        this.rateLimit = 90; // AniList API allows 90 requests per minute
        this.requestQueue = [];
        this.processing = false;
    }

    // Helper method to handle rate limiting
    async processQueue() {
        if (this.processing || this.requestQueue.length === 0) return;
        
        this.processing = true;
        
        while (this.requestQueue.length > 0) {
            const { query, variables, resolve, reject } = this.requestQueue.shift();
            
            try {
                const response = await fetch(this.baseUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    body: JSON.stringify({
                        query: query,
                        variables: variables
                    })
                });
                
                if (response.status === 429) {
                    // Rate limited, wait and try again
                    console.warn('Rate limit reached for AniList API, waiting before retry...');
                    this.requestQueue.unshift({ query, variables, resolve, reject });
                    await new Promise(r => setTimeout(r, 60000)); // Wait a minute
                    continue;
                }
                
                if (!response.ok) {
                    throw new Error(`API error: ${response.status}`);
                }
                
                const data = await response.json();
                resolve(data);
            } catch (error) {
                console.error('Error fetching from AniList API:', error);
                reject(error);
            }
            
            // Wait to respect rate limit
            await new Promise(r => setTimeout(r, 60000 / this.rateLimit));
        }
        
        this.processing = false;
    }

    // Queue a request and process it
    queueRequest(query, variables = {}) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({ query, variables, resolve, reject });
            this.processQueue();
        });
    }

    // Search for characters by name
    async searchCharacters(query) {
        if (!query || query.trim() === '') return [];
        
        try {
            const graphqlQuery = `
                query ($search: String) {
                    Page(page: 1, perPage: 10) {
                        characters(search: $search) {
                            id
                            name {
                                full
                                native
                            }
                            image {
                                large
                                medium
                            }
                            description
                            media(sort: POPULARITY_DESC, perPage: 1) {
                                nodes {
                                    id
                                    title {
                                        romaji
                                        english
                                        native
                                    }
                                    type
                                    format
                                    genres
                                    coverImage {
                                        large
                                        medium
                                    }
                                }
                            }
                        }
                    }
                }
            `;
            
            const data = await this.queueRequest(graphqlQuery, { search: query });
            
            if (!data.data || !data.data.Page || !data.data.Page.characters || data.data.Page.characters.length === 0) {
                return [];
            }
            
            // Process the character data
            const characters = [];
            
            for (const apiChar of data.data.Page.characters) {
                // Get anime information for this character
                let seriesId = null;
                let seriesName = 'Unknown Anime';
                let seriesImage = '';
                let seriesGenres = [];
                
                if (apiChar.media && apiChar.media.nodes && apiChar.media.nodes.length > 0) {
                    const mediaInfo = apiChar.media.nodes[0];
                    seriesId = mediaInfo.id;
                    seriesName = mediaInfo.title.english || mediaInfo.title.romaji || 'Unknown Anime';
                    seriesImage = mediaInfo.coverImage?.large || mediaInfo.coverImage?.medium || '';
                    seriesGenres = mediaInfo.genres || [];
                }
                
                // Create a character entry
                const character = {
                    id: apiChar.id,
                    name: apiChar.name.full,
                    native_name: apiChar.name.native,
                    image_url: apiChar.image?.large || apiChar.image?.medium || '',
                    description: apiChar.description,
                    seriesId: seriesId,
                    series_name: seriesName,
                    series_image: seriesImage,
                    series_genres: seriesGenres,
                    // Generate random stats for demo purposes
                    // In a real app, these would be derived from character data
                    strength: Math.floor(Math.random() * 30) + 70,
                    speed: Math.floor(Math.random() * 30) + 70,
                    intelligence: Math.floor(Math.random() * 30) + 70,
                    popularity: Math.floor(Math.random() * 100)
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
            const graphqlQuery = `
                query ($search: String) {
                    Page(page: 1, perPage: 10) {
                        media(search: $search, type: ANIME) {
                            id
                            title {
                                romaji
                                english
                                native
                            }
                            coverImage {
                                large
                                medium
                            }
                            format
                            genres
                            averageScore
                            popularity
                            seasonYear
                            description
                        }
                    }
                }
            `;
            
            const data = await this.queueRequest(graphqlQuery, { search: query });
            
            if (!data.data || !data.data.Page || !data.data.Page.media || data.data.Page.media.length === 0) {
                return [];
            }
            
            // Process the series data
            return data.data.Page.media.map(anime => ({
                id: anime.id,
                name: anime.title.english || anime.title.romaji,
                native_name: anime.title.native,
                image_url: anime.coverImage?.large || anime.coverImage?.medium || '',
                popularity: anime.popularity || 0,
                score: anime.averageScore || 0,
                year: anime.seasonYear || 'Unknown',
                genres: anime.genres || [],
                description: anime.description || '',
                format: anime.format || 'Unknown'
            }));
        } catch (error) {
            console.error('Error searching anime series:', error);
            return [];
        }
    }

    // Get character details by ID
    async getCharacterDetailsById(id) {
        try {
            const graphqlQuery = `
                query ($id: Int) {
                    Character(id: $id) {
                        id
                        name {
                            full
                            native
                        }
                        image {
                            large
                        }
                        description
                        favourites
                        media(sort: POPULARITY_DESC) {
                            edges {
                                node {
                                    id
                                    title {
                                        romaji
                                        english
                                    }
                                    coverImage {
                                        large
                                    }
                                    type
                                    format
                                    genres
                                }
                                role
                            }
                        }
                    }
                }
            `;
            
            const data = await this.queueRequest(graphqlQuery, { id: parseInt(id) });
            
            if (!data.data || !data.data.Character) {
                throw new Error('No character data returned from API');
            }
            
            const charData = data.data.Character;
            
            // Create a character entry with detailed information
            const character = {
                id: charData.id,
                name: charData.name.full,
                native_name: charData.name.native,
                image_url: charData.image?.large || '',
                description: charData.description || '',
                detailed: true,
                popularity: charData.favourites || 0,
                // Generate random stats for demo purposes
                strength: Math.floor(Math.random() * 30) + 70,
                speed: Math.floor(Math.random() * 30) + 70,
                intelligence: Math.floor(Math.random() * 30) + 70
            };
            
            // If the character has anime appearances, add series info
            if (charData.media && charData.media.edges && charData.media.edges.length > 0) {
                const animeAppearance = charData.media.edges[0];
                character.seriesId = animeAppearance.node.id;
                character.series_name = animeAppearance.node.title.english || animeAppearance.node.title.romaji || 'Unknown Anime';
                character.role = animeAppearance.role || 'Unknown';
                character.series_image = animeAppearance.node.coverImage?.large || '';
                character.series_genres = animeAppearance.node.genres || [];
                
                // Add all series appearances
                character.appearances = charData.media.edges.map(edge => ({
                    series_id: edge.node.id,
                    series_name: edge.node.title.english || edge.node.title.romaji,
                    role: edge.role,
                    image: edge.node.coverImage?.large || ''
                }));
            }
            
            return character;
        } catch (error) {
            console.error('Error fetching character details:', error);
            throw error;
        }
    }

    // Get anime details by ID
    async getAnimeDetailsById(id) {
        try {
            const graphqlQuery = `
                query ($id: Int) {
                    Media(id: $id, type: ANIME) {
                        id
                        title {
                            romaji
                            english
                            native
                        }
                        coverImage {
                            large
                        }
                        bannerImage
                        format
                        episodes
                        duration
                        status
                        genres
                        averageScore
                        popularity
                        seasonYear
                        description
                        characters(sort: ROLE, perPage: 10) {
                            nodes {
                                id
                                name {
                                    full
                                }
                                image {
                                    medium
                                }
                            }
                        }
                    }
                }
            `;
            
            const data = await this.queueRequest(graphqlQuery, { id: parseInt(id) });
            
            if (!data.data || !data.data.Media) {
                throw new Error('No anime data returned from API');
            }
            
            const animeData = data.data.Media;
            
            // Create an anime entry with detailed information
            return {
                id: animeData.id,
                name: animeData.title.english || animeData.title.romaji,
                native_name: animeData.title.native,
                image_url: animeData.coverImage?.large || '',
                banner_image: animeData.bannerImage || '',
                format: animeData.format || 'Unknown',
                episodes: animeData.episodes || 0,
                duration: animeData.duration || 0,
                status: animeData.status || 'Unknown',
                genres: animeData.genres || [],
                score: animeData.averageScore || 0,
                popularity: animeData.popularity || 0,
                year: animeData.seasonYear || 'Unknown',
                description: animeData.description || '',
                characters: animeData.characters?.nodes?.map(char => ({
                    id: char.id,
                    name: char.name.full,
                    image_url: char.image?.medium || ''
                })) || []
            };
        } catch (error) {
            console.error('Error fetching anime details:', error);
            throw error;
        }
    }

    // Detect anime from character name
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
                    series = {
                        id: bestMatch.character.seriesId,
                        name: bestMatch.character.series_name || 'Unknown Anime',
                        image: bestMatch.character.series_image || ''
                    };
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

    // Get character power stats and abilities (simulated)
    async getCharacterPowerStats(characterId, seriesId) {
        // In a real application, this would fetch actual data from a database or API
        // For this demo, we'll generate realistic-looking stats based on the character ID
        
        // Use character ID as a seed for pseudo-random but consistent stats
        const seed = parseInt(characterId) || Math.floor(Math.random() * 1000);
        const rng = (base) => Math.floor((((seed * 9301 + 49297) % 233280) / 233280) * 30) + base;
        
        const stats = {
            strength: rng(70),
            speed: rng(70),
            intelligence: rng(70),
            technique: rng(70),
            endurance: rng(70),
            specialAbility: rng(70),
            powerLevel: 0
        };
        
        // Calculate overall power level
        stats.powerLevel = Math.floor(Object.values(stats).reduce((sum, stat) => sum + stat, 0) / 6);
        
        // Generate abilities based on character and series
        const abilities = [
            {
                name: 'Primary Technique',
                description: 'The character\'s signature move or ability',
                power: rng(80),
                type: 'offensive'
            },
            {
                name: 'Defensive Maneuver',
                description: 'A technique used to protect against attacks',
                power: rng(75),
                type: 'defensive'
            },
            {
                name: 'Special Skill',
                description: 'A unique ability that sets this character apart',
                power: rng(85),
                type: 'special'
            },
            {
                name: 'Ultimate Power',
                description: 'The character\'s most powerful technique, used in desperate situations',
                power: rng(90),
                type: 'ultimate'
            }
        ];
        
        return {
            stats: stats,
            abilities: abilities
        };
    }

    // Compare two characters and generate a battle analysis
    async compareCharacters(characters) {
        // This would ideally use real character data and a sophisticated algorithm
        // For now, we'll enhance the existing comparison with more detailed information
        
        // Fetch additional data for each character if we have IDs
        for (const character of characters) {
            if (character.id) {
                try {
                    const powerData = await this.getCharacterPowerStats(character.id, character.seriesId);
                    character.powerMetrics = powerData.stats;
                    character.techniques = powerData.abilities;
                } catch (error) {
                    console.warn(`Could not fetch power data for ${character.name}:`, error);
                    // Fallback to random stats if API fails
                    character.powerMetrics = {
                        strength: Math.floor(Math.random() * 30) + 70,
                        speed: Math.floor(Math.random() * 30) + 70,
                        intelligence: Math.floor(Math.random() * 30) + 70,
                        technique: Math.floor(Math.random() * 30) + 70,
                        endurance: Math.floor(Math.random() * 30) + 70,
                        specialAbility: Math.floor(Math.random() * 30) + 70
                    };
                    
                    // Calculate overall power level
                    const metrics = Object.values(character.powerMetrics);
                    character.powerLevel = Math.floor(metrics.reduce((sum, value) => sum + value, 0) / metrics.length);
                }
            }
        }
        
        return characters;
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
const aniListClient = new AniListClient();
export default aniListClient;