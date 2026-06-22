const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://yoizmfjjlmajwcchmtlt.supabase.co";
const supabaseKey = "sb_publishable_fs0z84TXTh5V35AQSBqJzw_YC0RbhBJ";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testIdReturn() {
  const uniqName = "passkey_" + Date.now();
  console.log("Upserting name:", uniqName);
  const { data, error } = await supabase
    .from("passkeys")
    .upsert({ name: uniqName })
    .select();
  console.log("Upsert Result:", { data, error });
}

testIdReturn();
