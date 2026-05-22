const fs = require('fs');

const inicioPath = 'src/features/forja/views/ForjaInicio.tsx';
const homePath = 'src/features/forja/views/ForjaHome.tsx';

let inicio = fs.readFileSync(inicioPath, 'utf8');
let home = fs.readFileSync(homePath, 'utf8');

// The parts to move:
// 1. imports from Firebase and types added to ForjaInicio
// 2. MatchConfrontationCard component
// 3. States and hooks from inside ForjaInicio
// 4. Admin Accordion JSX
// 5. Match Center JSX

console.log("Analyzing files...");
