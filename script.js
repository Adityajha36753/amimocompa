// Import the Unified API client that integrates both Jikan and AniList
import unifiedAPIClient from './unified-api-client.js';

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements Cache
    const charactersContainer = document.getElementById('characters-container');
    const addCharacterBtn = document.getElementById('add-character');
    const compareBtn = document.getElementById('compare-btn');
    const resultsSection = document.getElementById('results-section');
    const resultContent = document.getElementById('result-content');
    // Ensure loader is queried correctly, even if resultsSection is initially hidden
    const loader = document.querySelector('#results-section .loader');
    const winnerBadge = document.getElementById('winner-badge');
    const winnerName = document.getElementById('winner-name');
    const contactForm = document.getElementById('contact-form');
    const resultsIntro = document.getElementById('results-intro');

    // Check if essential elements exist
    if (!charactersContainer || !addCharacterBtn || !compareBtn || !resultsSection || !resultContent || !loader || !winnerBadge || !winnerName || !contactForm || !resultsIntro) {
        console.error("Essential DOM element(s) not found. Initialization may be incomplete.");
        // Allow partial functionality if possible, but log the error.
    }

    // Character counter initialized from existing cards
    let characterCount = charactersContainer ? charactersContainer.querySelectorAll('.character-card').length : 0;

    // --- Autocomplete Setup Functions ---

    function setupCharacterAutocomplete(characterInput, animeInput) {
        const parentNode = characterInput.parentNode;
        if (!parentNode || typeof parentNode.appendChild !== 'function') {
            console.error("Autocomplete setup failed: Invalid parent node for", characterInput);
            return; // Stop setup if parent is invalid
        }
        parentNode.style.position = 'relative'; // Ensure parent is positioned

        // --- Create Dropdown Elements ---
        const autocompleteDropdown = document.createElement('div');
        autocompleteDropdown.className = 'autocomplete-dropdown absolute z-20 w-full bg-gray-700 rounded-b-lg shadow-lg hidden max-h-60 overflow-y-auto border border-gray-600';
        parentNode.appendChild(autocompleteDropdown);

        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'p-2 text-center text-gray-400'; // Initially visible inside dropdown logic, but dropdown hidden
        loadingIndicator.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Searching...';

        const noResultsDiv = document.createElement('div');
        noResultsDiv.className = 'p-2 text-center text-gray-400';
        noResultsDiv.textContent = 'No characters found';

        const errorDiv = document.createElement('div');
        errorDiv.className = 'p-2 text-center text-red-400';
        errorDiv.textContent = 'Error fetching data';
        // --- End Dropdown Elements ---


        let debounceTimer;
        const debounce = (callback, time) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(callback, time);
        };

        const showDropdown = () => autocompleteDropdown.classList.remove('hidden');
        const hideDropdown = () => autocompleteDropdown.classList.add('hidden');
        const clearDropdown = () => autocompleteDropdown.innerHTML = '';

        // --- Input Event Listener (Core Logic) ---
        characterInput.addEventListener('input', function() {
            const inputValue = this.value.trim().toLowerCase();

            if (inputValue.length < 2) {
                hideDropdown();
                clearDropdown();
                return;
            }

            clearDropdown(); // Clear previous results immediately
            autocompleteDropdown.appendChild(loadingIndicator); // Show loader
            showDropdown(); // Show dropdown with loader

            debounce(async () => {
                 // Check if input still has focus and minimum length before fetching
                 if (document.activeElement !== characterInput || characterInput.value.trim().toLowerCase().length < 2) {
                    // hideDropdown(); // Optional: Hide if focus lost during debounce
                     return;
                 }

                try {
                    const matchingCharacters = await unifiedAPIClient.searchCharacters(inputValue);
                    // Sort by popularity to ensure most famous characters appear first
                    matchingCharacters.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

                    clearDropdown(); // Clear loader/previous messages

                    if (matchingCharacters.length === 0) {
                        autocompleteDropdown.appendChild(noResultsDiv);
                       showDropdown(); // Ensure dropdown is visible even for no results
                    } else {
                        matchingCharacters.forEach(char => {
                            // Always display the anime name if available, otherwise show a more informative message
                            const seriesDisplayText = char.series_name ? `From: ${char.series_name}` : 'Series not identified yet';
                            // *** END SERIES NAME DISPLAY ***

                            const item = document.createElement('div');
                            item.className = 'p-2 hover:bg-gray-600 cursor-pointer flex items-center gap-2';

                            // Image or Initial
                            const imgContainer = document.createElement('div');
                            imgContainer.className = 'w-10 h-10 flex-shrink-0 bg-gray-600 rounded flex items-center justify-center text-gray-400 font-bold';
                            if (char.image_url) {
                                const img = document.createElement('img');
                                img.src = char.image_url; img.alt = char.name; img.className = 'w-full h-full object-cover rounded'; img.loading = 'lazy';
                                img.onerror = function() { this.replaceWith(document.createTextNode(char.name.charAt(0).toUpperCase())); };
                                imgContainer.appendChild(img);
                            } else { imgContainer.textContent = char.name.charAt(0).toUpperCase(); }
                            item.appendChild(imgContainer);

                            // Text Content
                            const textContainer = document.createElement('div'); textContainer.className = 'flex-grow min-w-0';
                            const nameSpan = document.createElement('div'); nameSpan.className = 'font-medium truncate'; nameSpan.textContent = char.name;
                            const seriesSpan = document.createElement('div'); seriesSpan.className = 'text-sm text-gray-400 truncate';
                            seriesSpan.textContent = seriesDisplayText; // Use corrected display text
                            textContainer.appendChild(nameSpan); textContainer.appendChild(seriesSpan); item.appendChild(textContainer);

                            item.dataset.malId = char.mal_id;

                            // Click Event Handler for Suggestion Item
                            item.addEventListener('mousedown', function(event) { // Use mousedown to prevent blur issues
                                event.preventDefault(); // Prevent input losing focus on click
                                characterInput.value = char.name;
                                // Set anime input value if available
                                animeInput.value = char.series_name && char.series_name !== 'Unknown Anime' ? char.series_name : '';
                                hideDropdown(); // Hide dropdown *after* selection

                                const imageContainerElement = characterInput.closest('.character-card')?.querySelector('.character-image-container');
                                updateCharacterImage(imageContainerElement, char);

                                // Always fetch detailed character info to get the most accurate anime information
                                if (char.mal_id) {
                                    unifiedAPIClient.getCharacterDetails(char)
                                        .then(detailedChar => {
                                            // Update anime input with detailed character's series name if available
                                            if (detailedChar.series_name && detailedChar.series_name !== 'Unknown Anime') {
                                                animeInput.value = detailedChar.series_name;
                                                // Add visual feedback to indicate the anime field was updated
                                                animeInput.classList.add('ring-2', 'ring-green-500');
                                                setTimeout(() => animeInput.classList.remove('ring-2', 'ring-green-500'), 1500);
                                            }
                                            updateCharacterImage(imageContainerElement, detailedChar);
                                        })
                                        .catch(err => console.warn(`Could not fetch details for ${char.name}:`, err));
                                }
                            });
                            autocompleteDropdown.appendChild(item);
                        });
                    }
                    // Ensure dropdown is shown after populating (in case debounce finished fast)
                    showDropdown();

                } catch (error) {
                    console.error('Error searching characters:', error);
                    clearDropdown();
                    autocompleteDropdown.appendChild(errorDiv);
                    showDropdown(); // Show dropdown with error
                }
            }, 350); // Debounce API call
        });

        // --- Focus Event ---
        characterInput.addEventListener('focus', function() {
            // If there's text, trigger input event to show suggestions
            if (this.value.trim().length >= 2) {
                 const event = new Event('input', { bubbles: true, cancelable: true });
                 this.dispatchEvent(event);
                 // Don't explicitly call showDropdown here, let the input handler do it after fetch/debounce
            }
        });

        // --- Blur Event ---
        characterInput.addEventListener('blur', function() {
            // Hide dropdown after a short delay ONLY if focus moved outside the dropdown itself
             setTimeout(() => {
                 if (!autocompleteDropdown.contains(document.activeElement)) {
                     hideDropdown();
                 }
             }, 150); // Short delay to allow clicks on items to register

            // AI Detection (still runs on blur, independently of dropdown)
             if (animeInput.value.trim() === '' && this.value.trim().length > 2) {
                // Use unified API client for anime detection
                unifiedAPIClient.detectAnimeFromCharacter(this.value).then(detection => {
                    if (detection?.series && detection.confidence > 0.7) {
                         animeInput.value = detection.series.name || 'Unknown Anime';
                         // Optional visual feedback...
                         animeInput.classList.add('ring-2', 'ring-green-500');
                        setTimeout(() => animeInput.classList.remove('ring-2', 'ring-green-500'), 1500);
                    }
                }).catch(err => console.warn('AI Detect Error:', err));
             }
        });


        // Setup paired anime input
        setupSeriesAutocomplete(animeInput);
    }

    // Simplified Series Autocomplete (Mirroring the simplified character logic)
    function setupSeriesAutocomplete(animeInput) {
        const parentNode = animeInput.parentNode; if (!parentNode || typeof parentNode.appendChild !== 'function') { console.error("Invalid parent for series input"); return; }
        parentNode.style.position = 'relative';
        const autocompleteDropdown = document.createElement('div'); autocompleteDropdown.className = 'autocomplete-dropdown absolute z-20 w-full bg-gray-700 rounded-b-lg shadow-lg hidden max-h-60 overflow-y-auto border border-gray-600'; parentNode.appendChild(autocompleteDropdown);
        const loadingIndicator = document.createElement('div'); loadingIndicator.className = 'p-2 text-center text-gray-400'; loadingIndicator.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Searching...';
        const noResultsDiv = document.createElement('div'); noResultsDiv.className = 'p-2 text-center text-gray-400'; noResultsDiv.textContent = 'No series found';
        const errorDiv = document.createElement('div'); errorDiv.className = 'p-2 text-center text-red-400'; errorDiv.textContent = 'Error fetching data';

        let debounceTimer; const debounce = (cb, t) => { clearTimeout(debounceTimer); debounceTimer = setTimeout(cb, t); };
        const showDropdown = () => autocompleteDropdown.classList.remove('hidden');
        const hideDropdown = () => autocompleteDropdown.classList.add('hidden');
        const clearDropdown = () => autocompleteDropdown.innerHTML = '';

        animeInput.addEventListener('input', function() {
            const inputValue = this.value.trim().toLowerCase();
            if (inputValue.length < 2) { hideDropdown(); clearDropdown(); return; }
            clearDropdown(); autocompleteDropdown.appendChild(loadingIndicator); showDropdown();
            debounce(async () => {
                 if (document.activeElement !== animeInput || animeInput.value.trim().toLowerCase().length < 2) return;
                try {
                     const matchingSeries = await unifiedAPIClient.searchSeries(inputValue);
                     matchingSeries.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
                     clearDropdown();
                     if (matchingSeries.length === 0) { autocompleteDropdown.appendChild(noResultsDiv); }
                    else { matchingSeries.forEach(series => { /* Create item */
                         const item = document.createElement('div'); item.className = 'p-2 hover:bg-gray-600 cursor-pointer flex items-center gap-2';
                         const imgContainer = document.createElement('div'); imgContainer.className = 'w-10 h-10 flex-shrink-0 bg-gray-600 rounded flex items-center justify-center text-gray-400 font-bold'; if (series.image_url) { const img = document.createElement('img'); img.src = series.image_url; img.alt = series.name; img.className = 'w-full h-full object-cover rounded'; img.loading = 'lazy'; img.onerror = function() { this.replaceWith(document.createTextNode(series.name.charAt(0).toUpperCase())); }; imgContainer.appendChild(img); } else { imgContainer.textContent = series.name.charAt(0).toUpperCase(); } item.appendChild(imgContainer);
                         const textContainer = document.createElement('div'); textContainer.className = 'flex-grow min-w-0'; const nameSpan = document.createElement('div'); nameSpan.className = 'font-medium truncate'; nameSpan.textContent = series.name; const detailsSpan = document.createElement('div'); detailsSpan.className = 'text-sm text-gray-400 truncate'; let dt = ''; if (series.year && series.year !== 'Unknown') dt += series.year; if (series.genres?.length > 0) { if (dt) dt += ' • '; dt += series.genres.slice(0, 2).join(', '); } detailsSpan.textContent = dt || 'Series Details'; textContainer.appendChild(nameSpan); textContainer.appendChild(detailsSpan); item.appendChild(textContainer);
                         item.addEventListener('mousedown', function(event) { event.preventDefault(); animeInput.value = series.name; hideDropdown(); });
                         autocompleteDropdown.appendChild(item); }); }
                    showDropdown(); // Ensure visible after populating
                } catch (error) { console.error('Error searching series:', error); clearDropdown(); autocompleteDropdown.appendChild(errorDiv); showDropdown(); }
             }, 350);
        });
        animeInput.addEventListener('focus', function() { if (this.value.trim().length >= 2) { this.dispatchEvent(new Event('input',{bubbles:true,cancelable:true})); } });
        animeInput.addEventListener('blur', () => { setTimeout(() => { if (!autocompleteDropdown.contains(document.activeElement)) { hideDropdown(); } }, 150); });
    }


    // Helper to update character card image (unchanged)
    function updateCharacterImage(imageContainerElement, charData) { /* ... same logic ... */
        if (!imageContainerElement || !charData) return;
        if (charData.image_url) { imageContainerElement.innerHTML = ''; const img = document.createElement('img'); img.src = charData.image_url; img.alt = `${charData.name} from ${charData.series_name || 'Unknown Series'}`; img.className = 'w-full h-full object-contain rounded'; img.loading = 'lazy'; img.onerror = function() { this.onerror = null; imageContainerElement.innerHTML = '<p class="text-gray-400 p-4 text-center">Image not available</p>'; this.alt = `Error loading image for ${charData.name}`; }; imageContainerElement.appendChild(img); }
        else { imageContainerElement.innerHTML = '<p class="text-gray-400 p-4 text-center">Character image appears here</p>'; }
    }

    // Helper function to determine which stat counters another stat
    function getCounterStat(stat) {
        const counterMap = {
            'strength': 'speed',        // Speed counters raw strength
            'speed': 'technique',       // Technique counters pure speed
            'intelligence': 'willpower', // Willpower counters overthinking
            'technique': 'strength',    // Raw strength can overwhelm technique
            'endurance': 'intelligence', // Intelligence finds ways around endurance
            'specialAbility': 'adaptability', // Adaptability counters special powers
            'defense': 'specialAbility', // Special abilities bypass defense
            'experience': 'adaptability', // Adaptability counters predictable experience
            'adaptability': 'experience', // Experience can outmaneuver adaptability
            'willpower': 'defense'      // Defense wears down willpower
        };
        
        return counterMap[stat] || 'technique'; // Default to technique if no counter found
    }

    // Function to manage character labels and button state
    function updateCharacterLabelsAndButton() {
        const characterCards = charactersContainer.querySelectorAll('.character-card'); characterCount = characterCards.length;
        characterCards.forEach((card, index) => { const cardIndex = index + 1; const charLabel = card.querySelector('label[for^="character-"]'); const removeBtn = card.querySelector('.remove-character'); if(charLabel) charLabel.textContent = `Character ${cardIndex}`; if (removeBtn) removeBtn.setAttribute('aria-label', `Remove Character ${cardIndex}`); });
        const isDisabled = characterCount < 2; compareBtn.disabled = isDisabled; compareBtn.classList.toggle('opacity-50', isDisabled); compareBtn.classList.toggle('cursor-not-allowed', isDisabled); compareBtn.setAttribute('aria-disabled', String(isDisabled));
    }

    // --- Initial Setup --- (unchanged)
    charactersContainer?.querySelectorAll('.character-card').forEach((card, index) => {
         const characterInput = card.querySelector('.character-input'); const animeInput = card.querySelector('.anime-input');
         if (characterInput && animeInput) { if (!characterInput.id) characterInput.id = `character-${index + 1}-input`; if (!animeInput.id) animeInput.id = `anime-${index + 1}-input`; card.querySelector('label[for^="character"]')?.setAttribute('for', characterInput.id); card.querySelector('label[for^="anime"]')?.setAttribute('for', animeInput.id); setupCharacterAutocomplete(characterInput, animeInput); }
    });
    updateCharacterLabelsAndButton();

    // --- Event Listeners ---

    // Add Character Button (unchanged)
    addCharacterBtn?.addEventListener('click', function() { /* ... same logic ... */
         if (this.disabled) return; characterCount++;
         const newCardIdSuffix = `dynamic-${Date.now()}`; const newCharacterCard = document.createElement('div'); newCharacterCard.className = 'character-card bg-gray-700 p-4 rounded-lg shadow-md transform opacity-0 scale-95 transition-all duration-300 ease-in-out';
         newCharacterCard.innerHTML = ` <div class="mb-4"><label for="character-${newCardIdSuffix}-input" class="block text-gray-300 mb-2">Character ${characterCount}</label><input id="character-${newCardIdSuffix}-input" type="text" class="character-input w-full bg-gray-600 text-white px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="Enter anime character name"></div> <div class="mb-4"><label for="anime-${newCardIdSuffix}-input" class="block text-gray-300 mb-2">Anime/Series</label><input id="anime-${newCardIdSuffix}-input" type="text" class="anime-input w-full bg-gray-600 text-white px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="Enter anime/series name"></div> <div class="character-image-container h-48 bg-gray-800 rounded-lg flex items-center justify-center mb-4 text-gray-400 p-4 text-center">Character image appears here</div> <button class="remove-character bg-red-500 hover:bg-red-600 text-white px-4 py-1 rounded-full transition-colors shadow-lg w-full" aria-label="Remove Character ${characterCount}"><i class="fas fa-trash-alt mr-2" aria-hidden="true"></i> Remove</button> `;
         charactersContainer.appendChild(newCharacterCard); requestAnimationFrame(() => newCharacterCard.classList.remove('opacity-0', 'scale-95'));
         const characterInput = newCharacterCard.querySelector('.character-input'); const animeInput = newCharacterCard.querySelector('.anime-input'); if (characterInput && animeInput) { setupCharacterAutocomplete(characterInput, animeInput); }
         const removeBtn = newCharacterCard.querySelector('.remove-character'); removeBtn.addEventListener('click', function() { newCharacterCard.style.opacity = '0'; newCharacterCard.style.transform = 'scale(0.9)'; newCharacterCard.style.height = newCharacterCard.scrollHeight + 'px'; requestAnimationFrame(() => { newCharacterCard.style.height = '0'; newCharacterCard.style.paddingTop = '0'; newCharacterCard.style.paddingBottom = '0'; newCharacterCard.style.marginTop = '0'; newCharacterCard.style.marginBottom = '0'; newCharacterCard.style.overflow = 'hidden'; }); setTimeout(() => { if (charactersContainer.contains(newCharacterCard)) { charactersContainer.removeChild(newCharacterCard); updateCharacterLabelsAndButton(); } }, 300); }, { once: true });
         updateCharacterLabelsAndButton(); characterInput.focus();
    });

    // Compare Button (updated for async battle comparison)
    compareBtn?.addEventListener('click', async function() {
        if (this.disabled) return;
        const characterCards = charactersContainer.querySelectorAll('.character-card'); 
        let isValid = true; 
        let characters = []; 
        let firstInvalidInput = null;
        
        // Validate inputs and collect character data
        characterCards.forEach(card => {
            const charInput = card.querySelector('.character-input'); 
            const animeInput = card.querySelector('.anime-input'); 
            charInput?.classList.remove('ring-2', 'ring-red-500'); 
            animeInput?.classList.remove('ring-2', 'ring-red-500'); 
            
            if (!charInput || !animeInput) return; 
            
            const charName = charInput.value.trim(); 
            const animeName = animeInput.value.trim();
            
            if (charName === '' || animeName === '') { 
                isValid = false; 
                if (charName === '') { 
                    charInput.classList.add('ring-2', 'ring-red-500'); 
                    if (!firstInvalidInput) firstInvalidInput = charInput; 
                } 
                if (animeName === '') { 
                    animeInput.classList.add('ring-2', 'ring-red-500'); 
                    if (!firstInvalidInput) firstInvalidInput = animeInput; 
                } 
            } else { 
                // Get character image if available
                const imgContainer = card.querySelector('.character-image-container'); 
                let imgUrl = imgContainer?.querySelector('img')?.src || null; 
                if (imgUrl && (imgUrl.includes('via.placeholder.com') || !imgUrl.startsWith('http'))) { 
                    imgUrl = null; 
                } 
                
                // Get MAL ID if available from dataset
                const malId = charInput.dataset?.malId || null;
                
                characters.push({ 
                    name: charName, 
                    anime: animeName, 
                    imageUrl: imgUrl,
                    mal_id: malId
                }); 
            }
        });
        
        // Handle validation errors
        if (!isValid) { 
            console.warn('Validation failed.'); 
            resultsIntro.textContent = "Please fill in all character and anime names."; 
            resultsIntro.classList.add('text-red-400'); 
            firstInvalidInput?.focus(); 
            setTimeout(() => { 
                document.querySelectorAll('.ring-red-500').forEach(el => el.classList.remove('ring-2', 'ring-red-500')); 
                resultsIntro.textContent = "Comparison results will appear here."; 
                resultsIntro.classList.remove('text-red-400'); 
            }, 3000); 
            return; 
        }
        
        if (characters.length < 2) { 
            console.warn("Compare triggered with less than 2 characters."); 
            return; 
        }
        
        // Show loading state
        resultsSection.classList.remove('hidden'); 
        resultsIntro.textContent = `Simulating battle: ${characters.map(c=>c.name).join(' vs ')}...`; 
        resultsIntro.classList.remove('text-red-400'); 
        resultContent.innerHTML = ''; 
        loader.classList.remove('hidden'); 
        winnerBadge.classList.add('hidden'); 
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // Set up battle animation container
        const battleAnimationContainer = resultsSection.querySelector('.battle-animation'); 
        if (!battleAnimationContainer) { 
            console.error("Battle animation container not found!"); 
            loader.classList.add('hidden'); 
            return; 
        } 
        battleAnimationContainer.innerHTML = '';
        
        // Create character elements in the battle display
        characters.forEach((character, index) => {
           const resultDiv = document.createElement('div'); 
           resultDiv.className = 'character-result text-center flex-shrink-0 mx-2 md:mx-4 my-2 md:my-0 transition-transform duration-300'; 
           
           const imgSize = characters.length > 4 ? 'h-20 w-20 md:h-24 md:w-24' : 'h-24 w-24 md:h-32 md:w-32'; 
           const imgDiv = document.createElement('div'); 
           imgDiv.className = `character-image-result ${imgSize} bg-gray-700 rounded-full mx-auto mb-2 overflow-hidden border-2 border-gray-600 shadow-lg`; 
           
           if (character.imageUrl) { 
               const img = document.createElement('img'); 
               img.src = character.imageUrl; 
               img.alt = `${character.name} from ${character.anime}`; 
               img.className = 'w-full h-full object-cover'; 
               img.loading = 'lazy'; 
               img.onerror = function() { 
                   this.onerror = null; 
                   const initial = character.name.charAt(0).toUpperCase(); 
                   imgDiv.innerHTML = `<div class="w-full h-full flex items-center justify-center text-gray-400 text-3xl md:text-4xl font-bold" aria-label="${img.alt} (Image failed)">${initial}</div>`; 
               }; 
               imgDiv.appendChild(img); 
           } else { 
               const initial = character.name.charAt(0).toUpperCase(); 
               const noImgAlt = `${character.name} from ${character.anime} (No image available)`; 
               imgDiv.innerHTML = `<div class="w-full h-full flex items-center justify-center text-gray-400 text-3xl md:text-4xl font-bold" aria-label="${noImgAlt}">${initial}</div>`; 
           } 
           
           const nameSize = characters.length > 4 ? 'text-base md:text-lg' : 'text-lg md:text-xl'; 
           const nameH4 = document.createElement('h4'); 
           nameH4.className = `character-name-result ${nameSize} font-bold mt-1 break-words max-w-[150px] mx-auto`; 
           nameH4.textContent = character.name; 
           
           const animeP = document.createElement('p'); 
           animeP.className = 'character-anime-result text-xs md:text-sm text-gray-400 italic break-words max-w-[150px] mx-auto'; 
           animeP.textContent = character.anime; 
           
           resultDiv.appendChild(imgDiv); 
           resultDiv.appendChild(nameH4); 
           resultDiv.appendChild(animeP); 
           battleAnimationContainer.appendChild(resultDiv); 
           
           if (index < characters.length - 1) { 
               const vsBadgeEl = document.createElement('div'); 
               const vsSize = characters.length > 4 ? 'h-10 w-10 text-sm md:h-12 md:w-12 md:text-base' : 'h-12 w-12 text-base md:h-16 md:w-16 md:text-xl'; 
               vsBadgeEl.className = `vs-badge flex-shrink-0 ${vsSize} bg-red-600 rounded-full text-white font-bold flex items-center justify-center mx-1 animate-vsGlow`; 
               vsBadgeEl.textContent = 'VS'; 
               battleAnimationContainer.appendChild(vsBadgeEl); 
           } 
        });
        
        // Add a slight delay for visual effect before showing results
        setTimeout(async () => {
            // Check if results section is still visible
            if (resultsSection.offsetParent === null) return;
            
            try {
                // Call the async battle comparison function and await its result
                const result = await generateComparisonResult(characters);
                
                // Update the UI with battle results
                loader.classList.add('hidden');
                resultsIntro.textContent = "Analysis Complete!";
                resultContent.innerHTML = result.analysis;
                winnerName.textContent = result.winner;
                winnerBadge.classList.remove('hidden');
                
                // Highlight the winner in the battle display
                document.querySelectorAll('.character-result.winner-highlight').forEach(el => 
                    el.classList.remove('winner-highlight')
                );
                const winnerIndex = characters.findIndex(c => c.name === result.winner);
                const winnerCard = battleAnimationContainer.querySelectorAll('.character-result')[winnerIndex];
                winnerCard?.classList.add('winner-highlight');
            } catch (e) {
                // Handle errors gracefully
                console.error("Error displaying comparison result:", e);
                loader.classList.add('hidden');
                resultsIntro.textContent = "Analysis Error";
                resultContent.innerHTML = `<p class="text-red-400 text-center">An error occurred during battle analysis. Please try again.</p>`;
                winnerBadge.classList.add('hidden');
            }
        }, 2000);
    });

    // Contact Form Listener (AJAX Version - unchanged)
    contactForm?.addEventListener('submit', function(e) { /* ... same AJAX logic ... */
        e.preventDefault(); const form=e.target; const formData=new FormData(form); const submitButton=form.querySelector('button[type="submit"]'); let formStatusDiv=form.querySelector('.form-status'); if(!formStatusDiv){formStatusDiv=document.createElement('div'); formStatusDiv.className='form-status text-center mt-4 text-sm'; submitButton.parentNode.parentNode.insertBefore(formStatusDiv,submitButton.parentNode.nextSibling);} formStatusDiv.textContent=''; formStatusDiv.className='form-status text-center mt-4 text-sm'; let formValid=true; form.querySelectorAll('input[required],textarea[required]').forEach(i=>{ i.classList.remove('ring-2','ring-red-500'); let iv=i.value.trim()!==''; if(i.type==='email'&&iv){iv=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.value);} if(i.hasAttribute('minlength')&&iv){iv=i.value.trim().length>=parseInt(i.getAttribute('minlength'),10);} if(!iv){i.classList.add('ring-2','ring-red-500');formValid=false;}}); if(!formValid){formStatusDiv.textContent='Please correct the highlighted fields.'; formStatusDiv.className+=' text-red-400'; setTimeout(()=>{ form.querySelectorAll('.ring-red-500').forEach(el => el.classList.remove('ring-2','ring-red-500')); },3000); return;} submitButton.disabled=true; submitButton.innerHTML='<i class="fas fa-spinner fa-spin mr-2"></i> Sending...'; fetch(form.action,{method:form.method,body:formData,headers:{'Accept':'application/json'}}) .then(r=>{if(r.ok){return r.json();}else{return r.json().then(d=>{throw new Error(d.message||`Server error: ${r.status}`);});}}) .then(d=>{console.log('FormSubmit OK:', d);formStatusDiv.textContent="Message sent! Thank you.";formStatusDiv.className='form-status text-center mt-4 text-sm text-green-400'; form.reset();}) .catch(err=>{console.error('Form submit error:', err);formStatusDiv.textContent=`Error: ${err.message||'Could not send message.'}`; formStatusDiv.className='form-status text-center mt-4 text-sm text-red-400';}) .finally(()=>{submitButton.disabled=false; submitButton.innerHTML='<i class="fas fa-paper-plane mr-2"></i> Send Message'; setTimeout(()=>{formStatusDiv.textContent=''; formStatusDiv.className='form-status text-center mt-4 text-sm';},6000);}); });


    // --- Comparison Result Generation Function (Enhanced Fair Battle System) ---
    async function generateComparisonResult(characters) {
        // Fetch character data from unified API when possible
        const characterDataPromises = characters.map(async c => {
            try {
                // Try to get character data from unified API (combines AniList and Jikan)
                const searchResults = await unifiedAPIClient.searchCharacters(c.name);
                if (searchResults && searchResults.length > 0) {
                    // Find the best match by comparing character name and anime
                    const bestMatch = searchResults.find(result => 
                        result.name.toLowerCase() === c.name.toLowerCase() && 
                        result.series_name?.toLowerCase() === c.anime.toLowerCase()
                    ) || searchResults[0];
                    
                    // Get detailed character info
                    if (bestMatch.mal_id || bestMatch.anilist_id || bestMatch.id) {
                        const detailedChar = await unifiedAPIClient.getCharacterDetails(bestMatch);
                        if (detailedChar) {
                            c.apiData = detailedChar;
                            // Try to get anime data for additional context
                            try {
                                const animeResults = await unifiedAPIClient.searchSeries(c.anime);
                                if (animeResults && animeResults.length > 0) {
                                    const bestAnimeMatch = animeResults.find(result => 
                                        result.name.toLowerCase() === c.anime.toLowerCase()
                                    ) || animeResults[0];
                                    c.animeData = bestAnimeMatch;
                                }
                            } catch (err) {
                                console.warn(`Could not fetch anime data for ${c.anime}:`, err);
                            }
                        }
                    }
                }
            } catch (err) {
                console.warn(`Could not fetch character data for ${c.name}:`, err);
            }
            return c;
        });
        
        // Wait for all API calls to complete
        characters = await Promise.all(characterDataPromises);
        
        // Define character attributes based on API data when available, or generate deterministically
        characters.forEach(c => {
            // Use character name and anime as seeds for deterministic attribute generation
            const nameSeed = [...c.name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
            const animeSeed = [...c.anime].reduce((sum, char) => sum + char.charCodeAt(0), 0);
            const combinedSeed = (nameSeed * animeSeed) % 1000;
            
            // Generate base attributes using the seed for consistency
            const generateAttribute = (offset, baseValue = 0) => {
                // If we have a base value from API data, use it to influence the result
                if (baseValue > 0) {
                    // Create a value between 60-95 that's influenced by API data
                    return Math.min(95, Math.max(60, baseValue + ((combinedSeed + offset) % 11) - 5));
                }
                // Otherwise create a value between 60-95 that's deterministic for each character
                return Math.floor(((combinedSeed + offset) % 36) + 60);
            };
            
            // Extract relevant data from API if available
            let apiPopularity = 0;
            let apiFavorites = 0;
            let apiAnimeRating = 0;
            let apiAnimePopularity = 0;
            let apiRole = '';
            let apiAbilities = [];
            
            if (c.apiData) {
                apiPopularity = c.apiData.popularity || 0;
                apiFavorites = c.apiData.favorites || 0;
                apiRole = c.apiData.role || '';
                
                // Extract abilities from character description if available
                if (c.apiData.about) {
                    const abilityKeywords = ['ability', 'power', 'skill', 'technique', 'quirk', 'magic', 'jutsu', 'haki', 'stand', 'zanpakuto', 'bankai', 'sharingan', 'devil fruit'];
                    abilityKeywords.forEach(keyword => {
                        const regex = new RegExp(`(${keyword}[^.!?]*[.!?])`, 'gi');
                        const matches = c.apiData.about.match(regex);
                        if (matches) {
                            apiAbilities = [...apiAbilities, ...matches];
                        }
                    });
                }
            }
            
            if (c.animeData) {
                apiAnimeRating = c.animeData.score || 0;
                apiAnimePopularity = c.animeData.popularity || 0;
            }
            
            // Calculate base values from API data
            const popularityFactor = apiPopularity > 0 ? Math.min(20, Math.floor(apiPopularity / 100)) : 0;
            const favoritesFactor = apiFavorites > 0 ? Math.min(15, Math.floor(apiFavorites / 50)) : 0;
            const animeRatingFactor = apiAnimeRating > 0 ? Math.floor((apiAnimeRating - 5) * 5) : 0;
            const animePopularityFactor = apiAnimePopularity > 0 ? Math.min(10, Math.floor(apiAnimePopularity / 1000)) : 0;
            
            // Role-based adjustments
            const roleFactors = {
                'Main': { specialAbility: 10, willpower: 8 },
                'Supporting': { technique: 5, intelligence: 5 },
                'Antagonist': { strength: 8, specialAbility: 7 },
                'Villain': { strength: 10, specialAbility: 8 }
            };
            
            const roleFactor = roleFactors[apiRole] || {};
            
            // Define comprehensive set of attributes for fair comparison
            c.powerMetrics = {
                strength: generateAttribute(1, 70 + popularityFactor + (roleFactor.strength || 0)),      // Physical power
                speed: generateAttribute(2, 70 + favoritesFactor + (roleFactor.speed || 0)),         // Movement and reaction time
                intelligence: generateAttribute(3, 70 + animeRatingFactor + (roleFactor.intelligence || 0)),   // Strategic thinking and problem-solving
                technique: generateAttribute(4, 70 + (roleFactor.technique || 0)),      // Skill and precision in combat
                endurance: generateAttribute(5, 70 + popularityFactor + (roleFactor.endurance || 0)),      // Stamina and ability to withstand damage
                specialAbility: generateAttribute(6, 70 + favoritesFactor + animeRatingFactor + (roleFactor.specialAbility || 0)), // Unique powers or abilities
                defense: generateAttribute(7, 70 + (roleFactor.defense || 0)),        // Ability to block or avoid attacks
                experience: generateAttribute(8, 70 + animePopularityFactor + (roleFactor.experience || 0)),     // Combat experience and battle wisdom
                adaptability: generateAttribute(9, 70 + animeRatingFactor + (roleFactor.adaptability || 0)),   // Ability to adjust to different situations
                willpower: generateAttribute(10, 70 + favoritesFactor + (roleFactor.willpower || 0))      // Mental fortitude and determination
            };
            
            // Adjust attributes based on extracted abilities
            if (apiAbilities.length > 0) {
                // Keywords that might indicate strength in certain attributes
                const attributeKeywords = {
                    strength: ['strength', 'power', 'force', 'might', 'muscle', 'physical', 'giant', 'titan', 'hulk'],
                    speed: ['speed', 'fast', 'quick', 'agile', 'swift', 'flash', 'teleport', 'instant'],
                    intelligence: ['smart', 'genius', 'intellect', 'strategy', 'tactical', 'mind', 'brain', 'iq'],
                    technique: ['technique', 'skill', 'precision', 'mastery', 'expert', 'proficient', 'trained'],
                    endurance: ['endurance', 'stamina', 'durability', 'resilient', 'tough', 'tank', 'withstand'],
                    specialAbility: ['special', 'unique', 'power', 'ability', 'magic', 'quirk', 'jutsu', 'haki', 'stand', 'zanpakuto', 'bankai', 'sharingan', 'devil fruit'],
                    defense: ['defense', 'shield', 'armor', 'protect', 'guard', 'block', 'barrier'],
                    experience: ['experience', 'veteran', 'battle-hardened', 'seasoned', 'master', 'expert'],
                    adaptability: ['adapt', 'flexible', 'versatile', 'adjust', 'evolve', 'transform'],
                    willpower: ['will', 'determination', 'resolve', 'spirit', 'courage', 'brave', 'fearless']
                };
                
                // Check each ability against keywords
                apiAbilities.forEach(ability => {
                    const abilityText = ability.toLowerCase();
                    Object.entries(attributeKeywords).forEach(([attr, keywords]) => {
                        if (keywords.some(keyword => abilityText.includes(keyword))) {
                            // Boost the attribute if keywords are found (max +10)
                            c.powerMetrics[attr] = Math.min(95, c.powerMetrics[attr] + 5);
                        }
                    });
                });
            }
            
            // Calculate overall power level as weighted average of attributes
            const weights = {
                strength: 1.0,
                speed: 1.0,
                intelligence: 1.0,
                technique: 1.1,
                endurance: 0.9,
                specialAbility: 1.2,
                defense: 0.9,
                experience: 1.1,
                adaptability: 0.8,
                willpower: 1.0
            };
            
            let totalWeight = 0;
            let weightedSum = 0;
            
            Object.entries(c.powerMetrics).forEach(([attr, value]) => {
                const weight = weights[attr] || 1.0;
                weightedSum += value * weight;
                totalWeight += weight;
            });
            
            c.powerLevel = Math.floor(weightedSum / totalWeight);
            
            // Store extracted abilities for display
            c.extractedAbilities = apiAbilities.slice(0, 3);
            
            // Generate techniques based on character's attributes and API data
            const adj = ['Blazing', 'Shadow', 'Mystic', 'Celestial', 'Iron', 'Swift', 'Quantum', 'Void', 'Arctic', 'Gale'];
            const noun = ['Strike', 'Guard', 'Burst', 'Aura', 'Wave', 'Step', 'Illusion', 'Edge', 'Barrier', 'Torrent'];
            const uAdj = ['Final', 'Omega', 'Limitless', 'Divine', 'Forbidden', 'Zero', 'Cosmic', 'Infinite', 'Apex', 'Nexus'];
            const uNoun = ['Judgment', 'Impact', 'Domain', 'Requiem', 'Unleashed', 'Genesis', 'Oblivion', 'Blast', 'Annihilation', 'Ascension'];
            
            // Use character attributes to determine technique power instead of random values
            c.techniques = [
                {
                    name: `${adj[nameSeed % adj.length]} ${noun[animeSeed % noun.length]}`,
                    type: 'Offensive',
                    power: Math.min(95, Math.floor((c.powerMetrics.strength + c.powerMetrics.technique) / 2))
                },
                {
                    name: `${adj[(nameSeed + 3) % adj.length]} ${noun[(animeSeed + 2) % noun.length]}`,
                    type: 'Defensive',
                    power: Math.min(95, Math.floor((c.powerMetrics.defense + c.powerMetrics.endurance) / 2))
                },
                {
                    name: `${adj[(nameSeed + 5) % adj.length]} ${noun[(animeSeed + 4) % noun.length]}`,
                    type: 'Utility/Support',
                    power: Math.min(95, Math.floor((c.powerMetrics.intelligence + c.powerMetrics.adaptability) / 2))
                },
                {
                    name: `${uAdj[nameSeed % uAdj.length]} ${uNoun[animeSeed % uNoun.length]}`,
                    type: 'Ultimate',
                    power: Math.min(98, Math.floor((c.powerMetrics.specialAbility + c.powerMetrics.willpower + c.powerMetrics.technique) / 3))
                }
            ];
            
            // If we have extracted abilities from API, use them as technique names when possible
            if (apiAbilities.length > 0) {
                // Try to use actual abilities for technique names
                if (apiAbilities.length >= 1) {
                    const abilityName = apiAbilities[0].replace(/^[^:]*:\s*/, '').trim().split('.')[0];
                    if (abilityName.length > 3 && abilityName.length < 30) {
                        c.techniques[0].name = abilityName;
                        c.techniques[0].isCanonical = true;
                    }
                }
                if (apiAbilities.length >= 2) {
                    const abilityName = apiAbilities[1].replace(/^[^:]*:\s*/, '').trim().split('.')[0];
                    if (abilityName.length > 3 && abilityName.length < 30) {
                        c.techniques[1].name = abilityName;
                        c.techniques[1].isCanonical = true;
                    }
                }
                if (apiAbilities.length >= 3) {
                    const abilityName = apiAbilities[2].replace(/^[^:]*:\s*/, '').trim().split('.')[0];
                    if (abilityName.length > 3 && abilityName.length < 30) {
                        c.techniques[3].name = abilityName; // Use for ultimate
                        c.techniques[3].isCanonical = true;
                    }
                }
            }
            
            // Generate technique descriptions based on their power
            c.techniques.forEach(t => {
                t.description = `A ${t.power > 90 ? 'devastatingly' : t.power > 80 ? 'potent' : 'standard'} ${t.type.toLowerCase()} technique${t.isCanonical ? ' from the series' : ''}.`;
            });
        });
        
        // Battle simulation with environment considerations
        const envs = [
            {name: "Shattered Cityscape", effect: "favors Agility & Tactical Thinking", favors: ['speed', 'intelligence']},
            {name: "Dimensional Rift", effect: "favors Special Abilities & Adaptability", favors: ['specialAbility', 'adaptability']},
            {name: "Sky Arena", effect: "favors Flight/Speed & Ranged Attacks", favors: ['speed', 'technique']},
            {name: "Ancient Temple Ruins", effect: "favors Technique & Defense", favors: ['technique', 'defense']},
            {name: "Molten Battlefield", effect: "testing Endurance & Raw Power", favors: ['endurance', 'strength']},
            {name: "Mystic Forest", effect: "favors Adaptability & Special Abilities", favors: ['adaptability', 'specialAbility']},
            {name: "Underwater Cavern", effect: "tests Endurance & Adaptability", favors: ['endurance', 'adaptability']},
            {name: "Astral Plane", effect: "amplifies Intelligence & Special Abilities", favors: ['intelligence', 'specialAbility']},
            {name: "Colosseum Arena", effect: "rewards Technique & Experience", favors: ['technique', 'experience']},
            {name: "Frozen Tundra", effect: "challenges Endurance & Willpower", favors: ['endurance', 'willpower']}
        ];
        
        // Select battle environment based on characters' attributes for a fair match
        // Find the most balanced environment that doesn't heavily favor any single character
        let selectedEnv = null;
        let lowestAdvantageGap = Infinity;
        
        envs.forEach(env => {
            // Calculate how much each character benefits from this environment
            const envScores = characters.map(c => {
                let score = 0;
                env.favors.forEach(attr => {
                    score += c.powerMetrics[attr];
                });
                return score;
            });
            
            // Find the gap between highest and lowest scores
            const maxScore = Math.max(...envScores);
            const minScore = Math.min(...envScores);
            const gap = maxScore - minScore;
            
            // Select environment with smallest gap (most fair)
            if (gap < lowestAdvantageGap) {
                lowestAdvantageGap = gap;
                selectedEnv = env;
            }
        });
        
        const battleEnv = selectedEnv || envs[0];
        
        // Calculate battle scores with environment considerations and matchup analysis
        characters.forEach(c => {
            // Base score from power level (60%)
            c.battleScore = c.powerLevel * 0.6;
            
            // Environment bonus (10%)
            battleEnv.favors.forEach(attr => {
                if (c.powerMetrics[attr] > 80) {
                    c.battleScore += (c.powerMetrics[attr] - 80) * 0.5;
                }
            });
            
            // Technique effectiveness (10%)
            const ultimatePower = c.techniques.find(t => t.type === 'Ultimate')?.power || 0;
            c.battleScore += ultimatePower * 0.1;
            
            // Balanced attribute bonus (10%)
            // Reward characters with well-rounded stats
            const attributeValues = Object.values(c.powerMetrics);
            const minAttribute = Math.min(...attributeValues);
            const maxAttribute = Math.max(...attributeValues);
            const balanceScore = 100 - (maxAttribute - minAttribute);
            c.battleScore += balanceScore * 0.1;
            
            // Matchup analysis - compare strengths and weaknesses against opponents (10%)
            let matchupScore = 0;
            characters.forEach(opponent => {
                if (opponent !== c) {
                    // Find this character's highest stats
                    const myBestStats = Object.entries(c.powerMetrics).sort((a, b) => b[1] - a[1]).slice(0, 3);
                    // Find opponent's lowest stats
                    const opponentWorstStats = Object.entries(opponent.powerMetrics).sort((a, b) => a[1] - b[1]).slice(0, 3);
                    
                    // Check if any of character's strengths target opponent's weaknesses
                    myBestStats.forEach(myStatPair => {
                        opponentWorstStats.forEach(oppStatPair => {
                            if (myStatPair[0] === getCounterStat(oppStatPair[0])) {
                                // Calculate advantage based on stat difference
                                const advantage = (myStatPair[1] - oppStatPair[1]) / 10;
                                matchupScore += advantage;
                            }
                        });
                    });
                    
                    // Check for direct stat advantages
                    Object.entries(c.powerMetrics).forEach(([attr, value]) => {
                        const oppValue = opponent.powerMetrics[attr];
                        if (value > oppValue + 15) { // Significant advantage
                            matchupScore += 1;
                        }
                    });
                }
            });
            
            // Normalize matchup score and add to battle score (10%)
            const normalizedMatchupScore = Math.min(10, matchupScore);
            c.battleScore += normalizedMatchupScore;
            
            // Store detailed battle analysis for display
            c.battleAnalysis = {
                basePower: c.powerLevel * 0.6,
                environmentBonus: c.battleScore - (c.powerLevel * 0.6) - (ultimatePower * 0.1) - (balanceScore * 0.1) - normalizedMatchupScore,
                techniqueBonus: ultimatePower * 0.1,
                balanceBonus: balanceScore * 0.1,
                matchupBonus: normalizedMatchupScore
            };
        });
        
        // Sort characters by battle score to determine winner
        characters.sort((a, b) => b.battleScore - a.battleScore);
        const winner = characters[0];
        const loser = characters.length > 1 ? characters[characters.length - 1] : null;
        
        // Generate battle analysis HTML with more detailed and fair comparison
        let analysis = `<div class="battle-analysis space-y-5 text-gray-100">`;
        analysis += `<p class="text-lg text-center border-b border-gray-600 pb-3">Simulation verdict: <strong class="text-yellow-300">${winner.name}</strong> wins against ${characters.filter(c => c !== winner).map(c => `<strong>${c.name}</strong>`).join(' & ')}!</p>`;
        analysis += `<div class="environment-section border-l-4 border-purple-400 pl-4 py-2 bg-gray-700/60 rounded shadow"><h4 class="text-xl font-semibold text-purple-300 mb-1 flex items-center"><i class="fas fa-map-marker-alt mr-2 w-4"></i> Battlefield: ${battleEnv.name}</h4><p class="text-sm italic text-gray-300">${battleEnv.effect}.</p></div>`;
        
        // Display character stats with API data indicators
        analysis += `<div class="power-metrics-section"><h4 class="text-xl font-semibold text-purple-300 mb-3 flex items-center"><i class="fas fa-chart-bar mr-2 w-4"></i> Combatant Stats</h4><div class="grid grid-cols-1 ${characters.length > 1 ? 'sm:grid-cols-2' : ''} ${characters.length > 3 ? 'lg:grid-cols-3' : ''} gap-5">`;
        
        const clrs = {
            strength: 'red-500',
            speed: 'blue-500',
            intelligence: 'purple-500',
            technique: 'yellow-500',
            endurance: 'green-500',
            specialAbility: 'pink-500',
            defense: 'teal-500',
            experience: 'amber-500',
            adaptability: 'indigo-500',
            willpower: 'orange-500'
        };
        
        characters.forEach(c => {
            let mBars = '';
            Object.entries(c.powerMetrics).forEach(([m, v]) => {
                const mName = m[0].toUpperCase() + m.slice(1).replace(/([A-Z])/g, ' $1');
                const cClass = clrs[m] || 'gray-500';
                // Add API data indicator if available
                const apiIndicator = c.apiData ? '<i class="fas fa-check-circle text-green-400 ml-1 text-xs" title="Enhanced with series data"></i>' : '';
                mBars += `<div class="mb-1.5"><div class="flex jb text-xs mb-0.5"><span class="font-medium text-gray-300">${mName}${apiIndicator}</span><span class="font-semibold text-gray-100">${v}</span></div><div class="w-full bg-gray-600 rounded-full h-1.5" title="${mName}: ${v}%"><div class="bg-${cClass} h-1.5 rounded-full" style="width:${v}%"></div></div></div>`;
            });
            
            const ult = c.techniques.find(t => t.type === 'Ultimate') || {name: "?", description: "N/A", power: 0};
            const canonicalBadge = ult.isCanonical ? '<span class="text-xs bg-blue-500 text-white px-1 py-0.5 rounded ml-1" title="Ability from series">CANON</span>' : '';
            
            // Add battle score breakdown
            const scoreBreakdown = c.battleAnalysis ? `
                <div class="mt-2 pt-2 border-t border-gray-600/50">
                    <p class="text-xs font-semibold text-gray-300">Battle Score Breakdown:</p>
                    <div class="grid grid-cols-2 gap-x-2 gap-y-1 mt-1 text-xs">
                        <div>Base Power: <span class="text-purple-300">${Math.round(c.battleAnalysis.basePower)}</span></div>
                        <div>Environment: <span class="text-green-300">+${Math.round(c.battleAnalysis.environmentBonus)}</span></div>
                        <div>Technique: <span class="text-blue-300">+${Math.round(c.battleAnalysis.techniqueBonus)}</span></div>
                        <div>Balance: <span class="text-yellow-300">+${Math.round(c.battleAnalysis.balanceBonus)}</span></div>
                        <div>Matchup: <span class="text-red-300">+${Math.round(c.battleAnalysis.matchupBonus)}</span></div>
                        <div class="font-bold">Total: <span class="text-white">${Math.round(c.battleScore)}</span></div>
                    </div>
                </div>` : '';
            
            // Add abilities section if available
            const abilitiesSection = c.extractedAbilities && c.extractedAbilities.length > 0 ? `
                <div class="mt-2 pt-2 border-t border-gray-600/50">
                    <p class="text-xs font-semibold text-gray-300 flex items-center"><i class="fas fa-bolt mr-1 w-3 text-yellow-400"></i>Known Abilities:</p>
                    <ul class="text-xs text-gray-300 mt-1 pl-3 list-disc space-y-0.5 max-h-20 overflow-y-auto">
                        ${c.extractedAbilities.map(ability => `<li class="truncate" title="${ability}">${ability.substring(0, 60)}${ability.length > 60 ? '...' : ''}</li>`).join('')}
                    </ul>
                </div>` : '';
            
            // Enhanced character card
            analysis += `<div class="p-4 ${c === winner ? 'bg-gradient-to-br from-purple-900 via-gray-700 to-gray-700 ring-2 ring-purple-400/80 scale-[1.02]' : 'bg-gray-700'} rounded-lg shadow-md relative overflow-hidden transition-transform duration-300">
                <h5 class="font-bold text-lg text-gray-100 mb-0.5 pr-12">${c.name} ${c === winner ? '<span class="abs top-1 right-1 text-xs bg-purple-400 text-black font-bold px-2 py-0.5 rounded-full">WINNER</span>' : ''}</h5>
                <p class="text-xs text-gray-400 italic mb-2">(${c.anime}) ${c.apiData ? '<span class="text-xs bg-green-500 text-white px-1 py-0.5 rounded">DATA ENHANCED</span>' : ''}</p>
                <p class="text-sm mb-3 font-semibold">Power Level: <strong class="text-purple-300 text-base">${c.powerLevel}</strong></p>
                <div class="mb-3">${mBars}</div>
                <div class="mt-2 pt-2 border-t border-gray-600/50">
                    <p class="text-xs font-semibold text-gray-300 flex items-center"><i class="fas fa-star mr-1 w-3 text-yellow-400"></i>Ultimate:</p>
                    <p class="text-sm font-medium text-cyan-300 truncate" title="${ult.description} (Power: ${ult.power})">${ult.name} ${canonicalBadge}</p>
                </div>
                ${abilitiesSection}
                ${scoreBreakdown}
            </div>`;
        });
        
        analysis += `</div></div>`;
        
        // Generate battle progression with multiple phases
        analysis += `<div class="border-t border-gray-600 pt-4"><h4 class="text-xl font-semibold text-purple-300 mb-2 flex items-center"><i class="fas fa-history mr-2 w-4"></i> Battle Progression</h4><div class="space-y-3 text-sm text-gray-200 bg-gray-800/50 p-3 rounded shadow-inner">`;
        
        // Phase 1: Initial clash
        analysis += `<div>
            <h5 class="font-semibold text-purple-200 mb-1">Phase 1: Initial Engagement</h5>
            <p><i class="fas fa-hourglass-start w-4 text-gray-400 mr-1.5"></i>The battle begins in <span class="italic">${battleEnv.name}</span>, testing each fighter's ${battleEnv.favors[0].replace(/([A-Z])/g, ' $1').toLowerCase()} and ${battleEnv.favors[1].replace(/([A-Z])/g, ' $1').toLowerCase()}.</p>
        </div>`;
        
        // Phase 2: Tactical adjustments
        const secondPlaceChar = characters.length > 1 ? characters[1] : null;
        if (secondPlaceChar) {
            const secondPlaceTopStat = Object.entries(secondPlaceChar.powerMetrics).sort((a, b) => b[1] - a[1])[0];
            analysis += `<div>
                <h5 class="font-semibold text-purple-200 mb-1">Phase 2: Tactical Adjustments</h5>
                <p><i class="fas fa-chess-knight w-4 text-blue-400 mr-1.5"></i><strong>${secondPlaceChar.name}</strong> initially gains ground using ${secondPlaceTopStat[0].replace(/([A-Z])/g, ' $1').toLowerCase()} (${secondPlaceTopStat[1]}).</p>
            </div>`;
        }
        
        // Phase 3: Power shift
        const winnerTopStat = Object.entries(winner.powerMetrics).sort((a, b) => b[1] - a[1])[0];
        analysis += `<div>
            <h5 class="font-semibold text-purple-200 mb-1">Phase 3: Power Shift</h5>
            <p><i class="fas fa-bolt w-4 text-yellow-400 mr-1.5"></i><strong>${winner.name}</strong> turns the tide through superior ${winnerTopStat[0].replace(/([A-Z])/g, ' $1').toLowerCase()} (${winnerTopStat[1]}).</p>
            ${battleEnv.favors.includes(winnerTopStat[0]) ? `<p><i class="fas fa-mountain w-4 text-gray-400 mr-1.5"></i>The ${battleEnv.name} environment amplifies ${winner.name}'s ${winnerTopStat[0].replace(/([A-Z])/g, ' $1').toLowerCase()} advantage.</p>` : ''}
        </div>`;
        
        // Phase 4: Decisive moment
        const winnerUltimate = winner.techniques.find(t => t.type === 'Ultimate');
        analysis += `<div>
            <h5 class="font-semibold text-purple-200 mb-1">Phase 4: Decisive Moment</h5>
            <p><i class="fas fa-meteor w-4 text-red-500 mr-1.5"></i><strong>${winner.name}</strong> unleashes ${winnerUltimate.isCanonical ? 'their canonical ability' : 'their ultimate technique'}: <span class="text-cyan-300 font-medium">${winnerUltimate.name}</span> (Power: ${winnerUltimate.power}).</p>
            <p><i class="fas fa-trophy w-4 text-yellow-500 mr-1.5"></i>This proves decisive, securing victory for <strong>${winner.name}</strong>!</p>
        </div>`;
        
        analysis += `</div></div>`;
        
        // Enhanced win factors with detailed reasoning
        analysis += `<div class="border-t border-gray-600 pt-4 pb-2"><h4 class="text-xl font-semibold text-purple-300 mb-2 flex items-center"><i class="fas fa-crown mr-2 w-4 text-yellow-400"></i> Victory Analysis for ${winner.name}</h4>`;
        
        // Add score comparison chart
        analysis += `<div class="mb-4 p-3 bg-gray-800/50 rounded">
            <h5 class="text-sm font-semibold text-gray-200 mb-2">Battle Score Comparison</h5>
            <div class="space-y-2">
                ${characters.map(c => {
                    const percentage = (c.battleScore / Math.max(...characters.map(ch => ch.battleScore))) * 100;
                    return `<div>
                        <div class="flex justify-between text-xs mb-1">
                            <span class="font-medium ${c === winner ? 'text-yellow-300' : 'text-gray-300'}">${c.name}</span>
                            <span class="font-semibold text-gray-100">${Math.round(c.battleScore)}</span>
                        </div>
                        <div class="w-full bg-gray-700 rounded-full h-2">
                            <div class="${c === winner ? 'bg-yellow-500' : 'bg-purple-500'} h-2 rounded-full" style="width:${percentage}%"></div>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </div>`;
        
        // Detailed win factors
        analysis += `<ul class="list-none text-sm space-y-2 pl-2 text-gray-200">`;
        
        let fctrs = [];
        const wStats = Object.entries(winner.powerMetrics).sort((a, b) => b[1] - a[1]);
        
        // Overall power advantage
        const avgPower = characters.reduce((s, c) => s + c.powerLevel, 0) / characters.length;
        if (winner.powerLevel > avgPower + 5) {
            fctrs.push({icon: 'fa-angle-double-up', text: `<strong>Superior Power Level:</strong> ${winner.name}'s overall power (${winner.powerLevel}) exceeds the average (${Math.floor(avgPower)}) by ${Math.floor(winner.powerLevel - avgPower)} points.`});
        }
        
        // Top stat advantages
        fctrs.push({icon: 'fa-arrow-up', text: `<strong>Exceptional ${wStats[0][0].replace(/([A-Z])/g, ' $1')}:</strong> At ${wStats[0][1]} points, ${winner.name}'s greatest strength gives them a significant edge.`});
        
        if (wStats[1][1] > 85) {
            fctrs.push({icon: 'fa-check', text: `<strong>Superior ${wStats[1][0].replace(/([A-Z])/g, ' $1')}:</strong> With ${wStats[1][1]} points in this attribute, ${winner.name} maintains versatility in combat.`});
        }
        
        // Environment advantage
        if (battleEnv.favors.some(attr => winner.powerMetrics[attr] > 85)) {
            const favAttr = battleEnv.favors.find(attr => winner.powerMetrics[attr] > 85);
            fctrs.push({icon: 'fa-map-marker-alt', text: `<strong>Battlefield Advantage:</strong> The ${battleEnv.name} environment synergizes with ${winner.name}'s ${favAttr.replace(/([A-Z])/g, ' $1').toLowerCase()}, amplifying their effectiveness.`});
        }
        
        // Ultimate technique advantage
        if (winner.techniques.find(t => t.type === 'Ultimate')?.power > 90) {
            const ult = winner.techniques.find(t => t.type === 'Ultimate');
            fctrs.push({icon: 'fa-star', text: `<strong>Devastating Ultimate Technique:</strong> ${winner.name}'s ${ult.isCanonical ? 'canonical ability' : 'ultimate technique'} "${ult.name}" (Power: ${ult.power}) delivers exceptional damage.`});
        }
        
        // Matchup advantages
        if (characters.length === 2) {
            const opponent = characters.find(c => c !== winner);
            const myBestStats = Object.entries(winner.powerMetrics).sort((a, b) => b[1] - a[1]).slice(0, 2);
            const opponentWorstStats = Object.entries(opponent.powerMetrics).sort((a, b) => a[1] - b[1]).slice(0, 2);
            
            myBestStats.forEach(myStatPair => {
                opponentWorstStats.forEach(oppStatPair => {
                    if (myStatPair[0] === getCounterStat(oppStatPair[0])) {
                        fctrs.push({icon: 'fa-bullseye', text: `<strong>Favorable Matchup:</strong> ${winner.name}'s ${myStatPair[0].replace(/([A-Z])/g, ' $1').toLowerCase()} (${myStatPair[1]}) directly counters ${opponent.name}'s weakness in ${oppStatPair[0].replace(/([A-Z])/g, ' $1').toLowerCase()} (${oppStatPair[1]}).`});
                    }
                });
            });
        }
        
        // Balance advantage
        const winnerAttrs = Object.values(winner.powerMetrics);
        const winnerMinAttr = Math.min(...winnerAttrs);
        const winnerMaxAttr = Math.max(...winnerAttrs);
        const winnerBalance = 100 - (winnerMaxAttr - winnerMinAttr);
        
        if (winnerBalance > 70) {
            fctrs.push({icon: 'fa-balance-scale', text: `<strong>Well-Balanced Fighter:</strong> ${winner.name}'s attributes are evenly distributed (Balance Score: ${winnerBalance}), making them adaptable to various situations.`});
        }
        
        // Display all factors
        fctrs.forEach(f => {
            analysis += `<li class="flex items-start mb-2"><i class="fas ${f.icon} w-4 mr-2 mt-1 text-purple-300 fa-fw"></i><span>${f.text}</span></li>`;
        });
        
        analysis += `</ul><p class="text-xs text-gray-400 mt-4 italic">*Analysis based on character attributes, series data, and battle conditions. All matchups are simulated with fairness algorithms to ensure balanced competition.</p></div>`;
        analysis += `</div>`;
        
        return {winner: winner.name, analysis: analysis};
    }
    
    // Helper function to determine which stat counters another stat
    function getCounterStat(stat) {
        const counterMap = {
            'strength': 'speed',        // Speed counters raw strength
            'speed': 'technique',       // Technique counters pure speed
            'intelligence': 'willpower', // Willpower counters overthinking
            'technique': 'strength',    // Raw strength can overwhelm technique
            'endurance': 'intelligence', // Intelligence finds ways around endurance
            'specialAbility': 'adaptability', // Adaptability counters special powers
            'defense': 'specialAbility', // Special abilities bypass defense
            'experience': 'adaptability', // Adaptability counters predictable experience
            'adaptability': 'experience', // Experience can outmaneuver adaptability
            'willpower': 'defense'      // Defense wears down willpower
        };
        
        return counterMap[stat] || 'technique'; // Default to technique if no counter found
    }
}); // End DOMContentLoaded