const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/scnbcp', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('✅ MongoDB Connected Successfully');
  process.exit(0);
})
.catch(err => {
  console.error('❌ MongoDB Connection Error:', err);
  process.exit(1);
});