/* Question banks. Shape: { q: "question", a: ["four", "answer", "choices", "here"], c: indexOfCorrect }
   QUESTIONS gate power-ups (easy general trivia); HARD_QUESTIONS are asked to revive after a crash.
   Answer order is shuffled at runtime, so `c` just has to point at the right entry. */
/* Regular questions (power-ups): easy general trivia. Shape { q, a:[4], c } */
export const QUESTIONS=[
  { q:"What is the capital of France?", a:["Madrid", "Berlin", "Rome", "Paris"], c:3 },
  { q:"Which planet is known as the Red Planet?", a:["Jupiter", "Mars", "Venus", "Saturn"], c:1 },
  { q:"How many continents are there?", a:["8", "7", "6", "5"], c:1 },
  { q:"What gas do plants take in from the air?", a:["Helium", "Nitrogen", "Oxygen", "Carbon dioxide"], c:3 },
  { q:"What is the largest ocean on Earth?", a:["Atlantic", "Arctic", "Indian", "Pacific"], c:3 },
  { q:"How many legs does a spider have?", a:["8", "12", "10", "6"], c:0 },
  { q:"At what temperature does water freeze in Fahrenheit?", a:["0°F", "100°F", "50°F", "32°F"], c:3 },
  { q:"Which animal is called the \"King of the Jungle\"?", a:["Tiger", "Lion", "Gorilla", "Elephant"], c:1 },
  { q:"What color do you get when you mix blue and yellow?", a:["Purple", "Orange", "Brown", "Green"], c:3 },
  { q:"Who painted the Mona Lisa?", a:["Pablo Picasso", "Vincent van Gogh", "Claude Monet", "Leonardo da Vinci"], c:3 },
  { q:"What is the tallest animal in the world?", a:["Ostrich", "Elephant", "Horse", "Giraffe"], c:3 },
  { q:"How many days are in a leap year?", a:["364", "366", "367", "365"], c:1 },
  { q:"Which instrument has 88 keys?", a:["Violin", "Piano", "Trumpet", "Guitar"], c:1 },
  { q:"In which sport do you score a touchdown?", a:["Tennis", "Basketball", "Soccer", "American football"], c:3 },
  { q:"What is the largest planet in our solar system?", a:["Saturn", "Neptune", "Earth", "Jupiter"], c:3 },
  { q:"What do bees make?", a:["Syrup", "Honey", "Butter", "Jam"], c:1 },
  { q:"How many sides does a hexagon have?", a:["6", "7", "5", "8"], c:0 },
  { q:"Which country is home to the kangaroo?", a:["Canada", "India", "Brazil", "Australia"], c:3 },
  { q:"What is H2O more commonly called?", a:["Oxygen", "Water", "Sugar", "Salt"], c:1 },
  { q:"Which fruit \"keeps the doctor away,\" according to the saying?", a:["A banana", "An orange", "An apple", "A grape"], c:2 },
  { q:"What is the closest star to Earth?", a:["The Sun", "Sirius", "Polaris", "Alpha Centauri"], c:0 },
  { q:"How many minutes are in an hour?", a:["60", "100", "90", "30"], c:0 },
  { q:"What is the main ingredient in guacamole?", a:["Lime", "Tomato", "Avocado", "Pepper"], c:2 },
  { q:"Which of these animals is a mammal?", a:["Shark", "Octopus", "Trout", "Dolphin"], c:3 },
  { q:"Which famous ship sank on its first voyage in 1912?", a:["Titanic", "Santa Maria", "Lusitania", "Mayflower"], c:0 },
  { q:"What shape has three sides?", a:["Triangle", "Pentagon", "Circle", "Square"], c:0 },
  { q:"What is the longest river in South America?", a:["Mississippi", "Amazon", "Danube", "Nile"], c:1 },
  { q:"What does a thermometer measure?", a:["Speed", "Weight", "Temperature", "Time"], c:2 },
  { q:"How many players does one soccer team have on the field?", a:["9", "10", "12", "11"], c:3 },
  { q:"What is 7 × 8?", a:["64", "48", "56", "54"], c:2 },
  { q:"What is the smallest US state by area?", a:["Rhode Island", "Vermont", "Connecticut", "Delaware"], c:0 },
  { q:"What does a caterpillar turn into?", a:["A bee", "A spider", "A butterfly or moth", "A beetle"], c:2 },
  { q:"Which month has the fewest days?", a:["April", "November", "February", "January"], c:2 },
  { q:"Who wrote \"Romeo and Juliet\"?", a:["Jane Austen", "William Shakespeare", "Charles Dickens", "Mark Twain"], c:1 },
  { q:"What is the hardest natural substance?", a:["Diamond", "Iron", "Gold", "Quartz"], c:0 },
  { q:"Which of these is a primary color of paint?", a:["Green", "Orange", "Purple", "Red"], c:3 },
  { q:"In which country are the Great Pyramids of Giza?", a:["Peru", "India", "Egypt", "Mexico"], c:2 },
  { q:"What is a baby cat called?", a:["A cub", "A puppy", "A kitten", "A foal"], c:2 },
  { q:"How many strings does a standard guitar have?", a:["6", "8", "4", "5"], c:0 },
  { q:"Which planet is famous for its rings?", a:["Saturn", "Mars", "Mercury", "Venus"], c:0 }
];
/* Harder trivia questions (revive). */
export const HARD_QUESTIONS=[
  { q:"What is the chemical symbol for gold?", a:["Ag", "Gd", "Go", "Au"], c:3 },
  { q:"In what year did astronauts first land on the Moon?", a:["1969", "1965", "1972", "1959"], c:0 },
  { q:"How many bones are in the adult human body?", a:["256", "226", "186", "206"], c:3 },
  { q:"What is the capital of Canada?", a:["Ottawa", "Toronto", "Montreal", "Vancouver"], c:0 },
  { q:"Which element has the atomic number 1?", a:["Carbon", "Helium", "Hydrogen", "Oxygen"], c:2 },
  { q:"Who developed the theory of relativity?", a:["Isaac Newton", "Nikola Tesla", "Galileo Galilei", "Albert Einstein"], c:3 }
];
