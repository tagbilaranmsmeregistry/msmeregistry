const { Client } = require('pg');

const client = new Client({
  host: "db.zxszyarzzhzhnwuwaqaa.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: "Portrias mark22",
  ssl: {
    rejectUnauthorized: false
  }
});

async function main() {
  await client.connect();
  try {
    const res = await client.query(`
      SELECT column_name, data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'passkeys';
    `);
    console.log("Columns of public.passkeys:");
    console.log(res.rows);

    const res2 = await client.query(`
      SELECT column_name, data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'passkey_items';
    `);
    console.log("\nColumns of public.passkey_items:");
    console.log(res2.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
