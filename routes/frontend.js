import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
  res.render('index');
});

router.get('/login', (req, res) => {
  res.render('login');
});

router.get('/dashboard', (req, res) => {
  const session = req.query.session;
  res.render('dashboard', { session });
});

router.get('/credential', (req, res) => {
  const session = req.query.session;
  res.render('credential', { session });
});

export default router;