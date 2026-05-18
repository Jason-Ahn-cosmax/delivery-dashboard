const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname, { extensions: ['html'] }));

app.get('/healthz', (_req, res) => res.status(200).send('ok'));

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`delivery-dashboard listening on ${PORT}`);
});
