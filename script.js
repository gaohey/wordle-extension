document.addEventListener('DOMContentLoaded', () => {
  const board = document.getElementById('board');
  let currentRow = 0;

  async function getHint(wordScores) {
    if (!wordScores || wordScores.length === 0) {
      alert('No words to analyze. Please parse the Wordle board first.');
      return;
    }

    const rawQuery = wordScores.join('-');
    
    try {
      const response = await fetch(`https://yianhe.pythonanywhere.com/get-hint/${rawQuery}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const hintWord = data.hint;
      
      if (!hintWord) {
        alert('No hint available');
        return;
      }

      // Display the hint word in the next row
      const row = board.children[currentRow];
      if (row) {
        for (let i = 0; i < 5; i++) {
          const cell = row.children[i];
          cell.textContent = hintWord[i];
          cell.style.backgroundColor = ''; // Reset background color for hint
        }
        currentRow++;
      }
    } catch (error) {
      console.error('Error fetching hint:', error);
      alert('Failed to get hint. Please try again.');
    }
  }

  function parseWordle() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0 || !tabs[0]) {
        alert('No active tab found.');
        return;
      }

      const activeTab = tabs[0];
      if (!activeTab.url) {
        alert('Cannot access tab URL. Make sure required permissions are set in manifest.json');
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
            
            tiles.forEach((tile, index) => {
              if (index < 30) {
                const letter = tile.textContent || '';
                const state = tile.getAttribute('data-state') || '';
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
            return;
          }

          const wordData = results[0].result;
          if (!wordData || !wordData.length) return;

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
              cell.textContent = word[i];
              
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
      }
    });
  }

  // Add click event listener to the parse button
  document.getElementById('parse-wordle').addEventListener('click', parseWordle);
});
