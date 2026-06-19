const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://zxszyarzzhzhnwuwaqaa.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4c3p5YXJ6emh6aG53dXdhcWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NTYxNjYsImV4cCI6MjA5NjUzMjE2Nn0.bH94t8zYRgPFq3g4LyvBZZ7lcWrlYC2PSR03Bzrbi94";

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
