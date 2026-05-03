import express from 'express';
const app = express();
app.get('/download/{*doi}', (req, res) => {
  console.log('doi param:', req.params.doi);
  console.log('type:', typeof req.params.doi);
  console.log('isArray:', Array.isArray(req.params.doi));
  res.send('ok');
});
app.listen(3001, () => {
  console.log('listening on 3001');
  import('http').then(http => {
    http.get('http://localhost:3001/download/10.1038/s41586-020-2649-2', (res) => {
      process.exit(0);
    });
  });
});
