const runMigrations = require('./migrate');
const app = require('./app');

const PORT = process.env.PORT || 3001;

runMigrations().then(() => {
  app.listen(PORT, () => {
    console.log(`Evotrade API running on http://localhost:${PORT} — DB: ${process.env.DB_NAME}@${process.env.DB_HOST}`);
  });
}).catch(err => {
  console.error('Migration failed, starting anyway:', err.message);
  app.listen(PORT, () => {
    console.log(`Evotrade API running on http://localhost:${PORT}`);
  });
});
