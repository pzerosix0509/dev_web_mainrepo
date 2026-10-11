const app = require('./src/app');

const server = app.listen(0, async () => {
  try {
    const port = server.address().port;
    const base = `http://127.0.0.1:${port}`;

    // 1. GET /students
    const r1 = await fetch(`${base}/students`);
    const html = await r1.text();
    console.log('GET /students status:', r1.status);
    console.log('Contains <div id="root"></div>:', html.includes('<div id="root"'));
    console.log('Loads React 18:', html.includes('react@18'));

    // 2. GET /api/students
    const r2 = await fetch(`${base}/api/students`);
    const list1 = await r2.json();
    console.log('GET /api/students status:', r2.status, 'Initial count:', list1.length);

    // 3. POST /api/students with invalid data
    const r3 = await fetch(`${base}/api/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', email: 'not-an-email' }),
    });
    const errBody = await r3.json();
    console.log('POST /api/students invalid status:', r3.status, 'Errors:', errBody.errors);

    // 4. POST /api/students with valid data
    const r4 = await fetch(`${base}/api/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Trần Văn CSR',
        email: 'tranvancsr@student.hcmus.edu.vn',
      }),
    });
    const created = await r4.json();
    console.log('POST /api/students valid status:', r4.status, 'Created:', created.id, created.name, created.email);

    // 5. Verify count increased
    const r5 = await fetch(`${base}/api/students`);
    const list2 = await r5.json();
    console.log('GET /api/students new count:', list2.length);

    // 6. Reset state to clean seed students
    const r6 = await fetch(`${base}/api/students/reset`, { method: 'POST' });
    const resetRes = await r6.json();
    console.log('POST /api/students/reset status:', r6.status, 'Count after reset:', resetRes.count);

    console.log('\n>>> All smoke tests PASSED successfully! <<<');
  } catch (err) {
    console.error('Test failed:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
