const { Client } = require("pg");

const regions = [
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-northeast-1",
  "ap-northeast-2",
  "ap-south-1",
  "eu-west-1",
  "eu-west-2",
  "eu-west-3",
  "eu-central-1",
  "sa-east-1",
  "ca-central-1",
];

async function tryAll() {
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    const client = new Client({
      host: host,
      port: 6543,
      database: "postgres",
      user: "postgres.yoizmfjjlmajwcchmtlt",
      password: "Portrias mark22",
      ssl: {
        rejectUnauthorized: false,
      },
    });

    try {
      await client.connect();
      console.log(`SUCCESS connected to region ${region}`);
      const res = await client.query("SELECT NOW()");
      console.log(res.rows);
      await client.end();
      return; // Stop if success
    } catch (err) {
      // If the error is NOT tenant not found, print it
      if (!err.message.includes("not found")) {
        console.log(`Failed ${region}:`, err.message);
      }
    }
  }
  console.log("All regions tried.");
}

tryAll();
