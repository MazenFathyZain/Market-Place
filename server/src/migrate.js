import { db, migrate } from './db.js';
migrate();
console.log('Migrations applied.');
db.close();
