const { Client } = require("pg");

const client = new Client({
  host: "db.yoizmfjjlmajwcchmtlt.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: "Portrias mark22",
  ssl: {
    rejectUnauthorized: false,
  },
});

async function disableRLS() {
  try {
    await client.connect();
    console.log("Connected to database...");

    // Disable RLS on businesses table
    await client.query(
      "ALTER TABLE public.businesses DISABLE ROW LEVEL SECURITY;",
    );
    console.log("✓ Disabled RLS on businesses table");

    // Verify RLS is disabled
    const res = await client.query(`
      SELECT schemaname, tablename, rowsecurity 
      FROM pg_tables 
      WHERE tablename = 'businesses' AND schemaname = 'public'
    `);
    console.log("✓ RLS Status:", res.rows);
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await client.end();
  }
}

disableRLS();
