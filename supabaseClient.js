// Initialize using the global 'supabase' variable from the CDN script tag
const supabaseUrl = "https://yoizmfjjlmajwcchmtlt.supabase.co";
const supabaseKey = "sb_publishable_fs0z84TXTh5V35AQSBqJzw_YC0RbhBJ"; // Replace with your 'anon/public' key

// Initialize client and assign to window.supabase to replace the library global object with the client instance
const clientInstance = supabase.createClient(supabaseUrl, supabaseKey);
window.supabase = clientInstance;

/**
 * Fetches all records from a given table, handling PostgREST's default row limit (1000).
 * This function will make multiple requests if necessary to retrieve all data.
 * @param {string} tableName The name of the table to fetch from.
 * @param {string} selectQuery The select query string (e.g., '*').
 * @returns {Promise<Array>} A promise that resolves to an array of all records.
 * @throws {Error} If any Supabase query encounters an error.
 */
window.fetchAllRecords = async function (tableName, selectQuery = "*") {
  let allRecords = [];
  let offset = 0;
  const limit = 1000; // PostgREST default max_rows. We fetch in chunks of this size.

  while (true) {
    const { data, error } = await clientInstance
      .from(tableName)
      .select(selectQuery)
      .range(offset, offset + limit - 1);

    if (error) throw error;
    if (!data || data.length === 0) break; // No more data

    allRecords = allRecords.concat(data);
    offset += limit;
    if (data.length < limit) break; // If less than limit returned, we've reached the end
  }
  return allRecords;
};

/**
 * Simple HTML escaping to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
window.escapeHtml = function (str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};
