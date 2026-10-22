/*
 * Name pools for generated people. ~200 x ~200 gives ~40,000 combinations;
 * NamePool (core/namePool.js) also guarantees no repeats within a shift.
 * A few names from the original prototype are kept for continuity.
 */

// First names by gender, so faces, hair and names agree (data/appearance.js).
export const FIRST_NAMES_F = [
  'Mary', 'Patricia', 'Jennifer', 'Linda', 'Britney', 'Abigail', 'Alice', 'Amanda', 'Angela', 'Ashley',
  'Barbara', 'Beth', 'Carol', 'Catherine', 'Chloe', 'Claire', 'Deborah', 'Diane', 'Donna', 'Dorothy',
  'Eleanor', 'Elizabeth', 'Emily', 'Grace', 'Hannah', 'Heather', 'Isabel', 'Janet', 'Jessica', 'Julia',
  'Karen', 'Katherine', 'Kimberly', 'Laura', 'Lauren', 'Lily', 'Madison', 'Margaret', 'Megan', 'Melissa',
  'Nancy', 'Natalie', 'Olivia', 'Pamela', 'Rachel', 'Rebecca', 'Samantha', 'Sandra', 'Sarah', 'Sharon',
  'Susan', 'Teresa', 'Victoria', 'Zoe', 'Ana', 'Camila', 'Elena', 'Gabriela', 'Lucia', 'Rosa', 'Sofia',
  'Valentina', 'Ximena', 'Marisol', 'Aaliyah', 'Abena', 'Adaeze', 'Amara', 'Imani', 'Nia', 'Nkechi',
  'Zainab', 'Aditi', 'Anjali', 'Divya', 'Priya', 'Meera', 'Mei', 'Ji-woo', 'Haruka', 'Xiaoling', 'Yuki',
  'Linh', 'Sunita', 'Aisha', 'Farah', 'Fatima', 'Layla', 'Rania', 'Leila', 'Astrid', 'Elsa', 'Francesca',
  'Giulia', 'Greta', 'Ingrid', 'Marta', 'Anouk', 'Siobhan', 'Agnieszka', 'Elodie',
];

export const FIRST_NAMES_M = [
  'James', 'Robert', 'John', 'Michael', 'Joseph', 'Yasunori', 'Jug', 'Aaron', 'Adam', 'Andrew', 'Anthony',
  'Benjamin', 'Brandon', 'Brian', 'Caleb', 'Charles', 'Christopher', 'Colin', 'Daniel', 'Dennis', 'Douglas',
  'Dylan', 'Edward', 'Eric', 'Ethan', 'Frank', 'Gary', 'Gregory', 'Harold', 'Henry', 'Jack', 'Jacob',
  'Jason', 'Jeffrey', 'Jonathan', 'Joshua', 'Keith', 'Kevin', 'Kyle', 'Lucas', 'Mark', 'Matthew', 'Nathan',
  'Nicholas', 'Owen', 'Paul', 'Peter', 'Richard', 'Ryan', 'Samuel', 'Scott', 'Stephen', 'Thomas', 'Timothy',
  'Tyler', 'Walter', 'William', 'Zachary', 'Alejandro', 'Carlos', 'Diego', 'Javier', 'Jorge', 'Luis',
  'Mateo', 'Santiago', 'Chidi', 'Darnell', 'Jamal', 'Kwame', 'Malik', 'Oluwaseun', 'Tariq', 'Kofi', 'Aarav',
  'Arjun', 'Rohan', 'Sanjay', 'Vikram', 'Hiroshi', 'Kenji', 'Min-jun', 'Wen', 'Thanh', 'Ravi', 'Tao', 'Amir',
  'Hassan', 'Omar', 'Samir', 'Yusuf', 'Karim', 'Anders', 'Bjorn', 'Dmitri', 'Klaus', 'Lars', 'Luca',
  'Nikolai', 'Pierre', 'Sven', 'Tobias', 'Ciaran', 'Matteo', 'Henrik',
];

export const FIRST_NAMES = [...FIRST_NAMES_F, ...FIRST_NAMES_M];

const FEMININE = new Set(FIRST_NAMES_F);

/** 'f' or 'm' from a full name's first name (presentation only: hair, facial hair). */
export const genderOf = (name = '') => (FEMININE.has(name.split(' ')[0]) ? 'f' : 'm');

export const LAST_NAMES = [
  // Prototype originals
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'VanWagner', 'Cossey', 'Farnsworth', 'Mitsuda',
  // English / American
  'Adams', 'Allen', 'Anderson', 'Baker', 'Bennett', 'Brooks', 'Campbell', 'Carter', 'Clark', 'Collins', 'Cook', 'Cooper',
  'Edwards', 'Evans', 'Fisher', 'Foster', 'Graham', 'Gray', 'Green', 'Hall', 'Harris', 'Hayes', 'Hill', 'Howard',
  'Hughes', 'Jenkins', 'Kelly', 'King', 'Lee', 'Lewis', 'Long', 'Marshall', 'Martin', 'Mitchell', 'Moore', 'Morgan',
  'Murphy', 'Nelson', 'Parker', 'Perry', 'Phillips', 'Powell', 'Price', 'Reed', 'Roberts', 'Robinson', 'Rogers', 'Ross',
  'Russell', 'Sanders', 'Scott', 'Stewart', 'Sullivan', 'Taylor', 'Thomas', 'Thompson', 'Turner', 'Walker', 'Ward', 'Watson',
  'White', 'Wilson', 'Wood', 'Wright', 'Young', 'Fletcher', 'Holloway', 'Pembroke', 'Whitfield', 'Ashworth',
  // Hispanic
  'Alvarez', 'Castillo', 'Delgado', 'Fernandez', 'Flores', 'Gonzalez', 'Gutierrez', 'Hernandez', 'Jimenez', 'Lopez', 'Martinez', 'Mendoza',
  'Morales', 'Ortiz', 'Ramirez', 'Reyes', 'Rivera', 'Rodriguez', 'Ruiz', 'Sanchez', 'Torres', 'Vargas', 'Vasquez', 'Ferreira',
  // African
  'Adeyemi', 'Asante', 'Banda', 'Diallo', 'Eze', 'Mensah', 'Mwangi', 'Ndlovu', 'Nwosu', 'Okafor', 'Okonkwo', 'Owusu',
  // South & East Asian
  'Bhatt', 'Chatterjee', 'Das', 'Gupta', 'Iyer', 'Kapoor', 'Kumar', 'Mehta', 'Nair', 'Patel', 'Rao', 'Reddy',
  'Sharma', 'Singh', 'Chen', 'Huang', 'Li', 'Liu', 'Wang', 'Zhang', 'Zhou', 'Kim', 'Park', 'Choi',
  'Nakamura', 'Sato', 'Suzuki', 'Tanaka', 'Watanabe', 'Yamamoto', 'Nguyen', 'Tran', 'Pham', 'Le',
  // Middle Eastern
  'Abbasi', 'Aziz', 'Farouk', 'Haddad', 'Hakimi', 'Karimi', 'Mansour', 'Nasser', 'Rahman', 'Saleh', 'Khalil', 'Darwish',
  // European
  'Andersson', 'Bauer', 'Becker', 'Bianchi', 'Dubois', 'Fischer', 'Hansen', 'Horvath', 'Jansen', 'Kowalski', 'Lindqvist', 'Moreau',
  'Novak', 'Olsen', 'Petrov', 'Ricci', 'Rossi', 'Schmidt', 'Schneider', 'Weber', 'Wojcik', 'Ivanova', "O'Brien", 'MacLeod',
];

// Fictional host departments for visitor appointments
export const DEPARTMENTS = ['Facilities', 'Finance', 'Legal', 'Engineering', 'HR', 'Procurement', 'Research', 'Operations', 'IT', 'Compliance'];
