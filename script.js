document.addEventListener('DOMContentLoaded', () => {
  const board = document.getElementById('board');
  const guessInput = document.getElementById('guess-input');
  const submitGuess = document.getElementById('submit-guess');
  const word = 'HELLO'; // Example word, you can change this to any 5-letter word
  let currentRow = 0;

  function checkGuess() {
    const guess = guessInput.value.toUpperCase();
    if (guess.length !== 5) {
      alert('Please enter a 5-letter word.');
      return;
    }

    const row = board.children[currentRow];
    for (let i = 0; i < 5; i++) {
      const cell = row.children[i];
      cell.textContent = guess[i];
      if (guess[i] === word[i]) {
        cell.style.backgroundColor = 'green';
      } else if (word.includes(guess[i])) {
        cell.style.backgroundColor = 'yellow';
      } else {
        cell.style.backgroundColor = 'gray';
      }
    }

    currentRow++;
    if (currentRow >= 6) {
      alert('Game over!');
      guessInput.disabled = true;
      submitGuess.disabled = true;
    }
  }

  function handleSubmit() {
    if (currentRow < 6) {
      checkGuess();
      guessInput.value = '';
    }
  }

  submitGuess.addEventListener('click', handleSubmit);

  guessInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      handleSubmit();
    }
  });

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
            const words = [];
            let currentWord = '';
            
            tiles.forEach((tile, index) => {
              if (index < 30) {
                const letter = tile.textContent || '';
                const evaluation = tile.getAttribute('data-state') || '';
                currentWord += letter;
                
                // Every 5 letters, push the word and reset
                if ((index + 1) % 5 === 0) {
                  words.push({
                    word: currentWord,
                    evaluations: Array.from(tiles).slice(index - 4, index + 1)
                      .map(t => t.getAttribute('data-state') || '')
                  });
                  currentWord = '';
                }
              }
            });
            return words;
          }
        }, (results) => {
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
          wordData.forEach((data, rowIndex) => {
            if (!data.word) return;
            
            const row = rows[rowIndex];
            for (let i = 0; i < 5; i++) {
              const cell = row.children[i];
              cell.textContent = data.word[i];
              
              // Set colors based on evaluation
              switch (data.evaluations[i]) {
                case 'correct':
                  cell.style.backgroundColor = 'green';
                  break;
                case 'present':
                  cell.style.backgroundColor = 'yellow';
                  break;
                case 'absent':
                  cell.style.backgroundColor = 'gray';
                  break;
                default:
                  cell.style.backgroundColor = '';
              }
            }
            currentRow++;
          });
        });
      } else {
        alert('Please navigate to the Wordle game on the New York Times website.');
      }
    });
  }

  document.getElementById('parse-wordle').addEventListener('click', parseWordle);
});
