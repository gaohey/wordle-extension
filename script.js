document.addEventListener('DOMContentLoaded', () => {
  const board = document.getElementById('board');
  const parseButton = document.getElementById('parse-wordle');
  const possibleCount = document.getElementById('possible-count');
  const hintsSection = document.getElementById('top-hints');
  let currentRow = 0;
  let topHints = [];

  async function getHint(wordScores) {
    if (!wordScores || wordScores.length === 0) {
      alert('No words to analyze. Please parse the Wordle board first.');
      parseButton.disabled = false;
      parseButton.textContent = 'Get Hint';
      possibleCount.textContent = '';
      return;
    }

    const rawQuery = wordScores.join('-');
    
    try {
      // const response = await fetch(`https://yianhe.pythonanywhere.com/get-hint/${rawQuery}`);
      const response = await fetch(`https://yianhe.pythonanywhere.com/get-hint-multi/${rawQuery}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const hintWord = data.hint;
      
      // Store top hints but don't show them yet
      topHints = data.top_hints || [];
      
      // Update possible words count and make it clickable if we have top hints
      if (data.possible_choices !== undefined) {
        possibleCount.innerHTML = `Possible Guesses<br>Left: ${data.possible_choices}`;
        if (topHints.length > 0) {
          possibleCount.style.cursor = 'pointer';
          possibleCount.title = 'Click to see top suggestions';
          possibleCount.onclick = showTopHints;
          // Hide hints section when updating possible count
          hintsSection.textContent = '';
          hintsSection.classList.remove('show');
        } else {
          possibleCount.style.cursor = 'default';
          possibleCount.onclick = null;
          possibleCount.title = '';
        }
      }
      
      if (!hintWord) {
        alert('No hint available');
        parseButton.disabled = false;
        parseButton.textContent = 'Get Hint';
        return;
      }

      // Display the hint word in the next row
      const row = board.children[currentRow];
      if (row) {
        for (let i = 0; i < 5; i++) {
          const cell = row.children[i];
          cell.textContent = hintWord[i].toUpperCase();
          cell.style.backgroundColor = ''; // Reset background color for hint
        }
        currentRow++;
      }
      
      // Re-enable button after hint is displayed
      parseButton.disabled = false;
      parseButton.textContent = 'Get Hint';

    } catch (error) {
      console.error('Error fetching hint:', error);
      alert('Failed to get hint. Please try again.');
      parseButton.disabled = false;
      parseButton.textContent = 'Get Hint';
      possibleCount.textContent = '';
      possibleCount.onclick = null;
      possibleCount.style.cursor = 'default';
      possibleCount.title = '';
      clearTopHints();
    }
  }

  function showTopHints() {
    if (topHints.length === 0) {
      hintsSection.textContent = '';
      hintsSection.classList.remove('show');
      return;
    }
    
    // Toggle hints visibility
    if (hintsSection.classList.contains('show')) {
      hintsSection.textContent = '';
      hintsSection.classList.remove('show');
      return;
    }
    
    // Take only top 5 hints
    const topFiveHints = topHints.slice(0, 5);
    const hintsText = topFiveHints
      .map((hint, index) => `${index + 1}. ${hint.toUpperCase()}`)
      .join('<br>');
    
    hintsSection.innerHTML = `<strong>Top Suggestions (max 5):</strong><br>${hintsText}`;
    hintsSection.classList.add('show');
  }

  function clearTopHints() {
    hintsSection.textContent = '';
    hintsSection.classList.remove('show');
    topHints = [];
  }

  function parseWordle() {
    // Reset top hints when starting new parse
    clearTopHints();
    possibleCount.onclick = null;
    possibleCount.style.cursor = 'default';
    possibleCount.title = '';

    // Disable button and show loading state
    parseButton.disabled = true;
    parseButton.textContent = 'Solving...';
    possibleCount.textContent = '';  // Clear count while loading

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0 || !tabs[0]) {
        alert('No active tab found.');
        parseButton.disabled = false;
        parseButton.textContent = 'Get Hint';
        return;
      }

      const activeTab = tabs[0];
      if (!activeTab.url) {
        alert('Cannot access tab URL. Make sure required permissions are set in manifest.json');
        parseButton.disabled = false;
        parseButton.textContent = 'Get Hint';
        return;
      }

      if (activeTab.url.includes("nytimes.com/games/wordle")) {
        chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: () => {
            const tiles = document.querySelectorAll('[class^="Tile-module_tile"]');
            const formattedResults = [];
            let currentWord = '';
            let currentScore = '';
            let shouldContinue = true;
            
            tiles.forEach((tile, index) => {
              // Skip if we've already found an incomplete row
              if (!shouldContinue) return;
              
              if (index < 30) {
                const letter = tile.textContent || '';
                const state = tile.getAttribute('data-state') || '';
                
                // Check if current tile is incomplete
                if (state === 'tbd' || state === 'empty') {
                  shouldContinue = false;
                  // Reset current word if it's an incomplete row
                  currentWord = '';
                  currentScore = '';
                  return;
                }
                
                currentWord += letter;
                
                // Convert state to number
                let scoreDigit = '0';
                if (state === 'correct') scoreDigit = '2';
                else if (state === 'present') scoreDigit = '1';
                currentScore += scoreDigit;
                
                // Every 5 letters, push the formatted result and reset
                if ((index + 1) % 5 === 0) {
                  if (currentWord) {
                    formattedResults.push(`${currentWord}${currentScore}`);
                  }
                  currentWord = '';
                  currentScore = '';
                }
              }
            });
            return formattedResults;
          }
        }, async (results) => {
          if (chrome.runtime.lastError) {
            console.error('Script execution failed:', chrome.runtime.lastError);
            alert('Failed to execute script: ' + chrome.runtime.lastError.message);
            parseButton.disabled = false;
            parseButton.textContent = 'Get Hint';
            return;
          }

          const wordData = results[0].result;
          
          // If no words found, display a random starter word
          if (!wordData || !wordData.length) {
            currentRow = 0;
            const starterWords = ['TARSE','RAISE', 'ARISE'];
            const randomWord = starterWords[Math.floor(Math.random() * starterWords.length)];
            
            const row = board.children[currentRow];
            for (let i = 0; i < 5; i++) {
              const cell = row.children[i];
              cell.textContent = randomWord[i].toUpperCase();
              cell.style.backgroundColor = '';
              cell.style.color = 'black';
            }
            currentRow++;
            parseButton.disabled = false;
            parseButton.textContent = 'Get Hint';
            possibleCount.innerHTML = 'Possible Guesses<br>Left: 2315';
            // Make initial count clickable with all possible starter words
            topHints = starterWords;
            possibleCount.style.cursor = 'pointer';
            possibleCount.title = 'Click to see recommended starter words';
            possibleCount.onclick = showTopHints;
            return;
          }

          // Clear existing board
          currentRow = 0;
          const rows = board.children;
          
          // Display the parsed words and colors
          wordData.forEach((entry, rowIndex) => {
            const word = entry.slice(0, 5);
            const score = entry.slice(5);
            const row = rows[rowIndex];
            
            for (let i = 0; i < 5; i++) {
              const cell = row.children[i];
              cell.textContent = word[i].toUpperCase();
              
              // Set colors based on score digit using Wordle's color scheme
              switch (score[i]) {
                case '2':
                  cell.style.backgroundColor = '#6aaa64';  // Wordle green
                  cell.style.color = 'white';  // Text color
                  break;
                case '1':
                  cell.style.backgroundColor = '#c9b458';  // Wordle yellow
                  cell.style.color = 'white';  // Text color
                  break;
                case '0':
                  cell.style.backgroundColor = '#787c7e';  // Wordle grey
                  cell.style.color = 'white';  // Text color
                  break;
                default:
                  cell.style.backgroundColor = '';
                  cell.style.color = 'black';  // Reset text color
              }
            }
            currentRow++;
          });

          // Get and display hint after parsing
          await getHint(wordData);
        });
      } else {
        alert('Please navigate to the Wordle game on the New York Times website.');
        parseButton.disabled = false;
        parseButton.textContent = 'Get Hint';
      }
    });
  }

  // Add click event listener to the parse button
  parseButton.addEventListener('click', parseWordle);
});
