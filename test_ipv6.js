const { Client } = require('pg');

async function testIPv6() {
  const client = new Client({
    host: "2406:da14:311:1501:a70c:14bc:804e:1700",
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: "Portrias mark22",
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log("SUCCESS connected to IPv6 directly!");
    const res = await client.query(`
      SELECT column_name, data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'passkeys';
    `);
    console.log(res.rows);
    await client.end();
  } catch (err) {
    console.log("Failed:", err.message);
  }
}

testIPv6();
