const sql = require("msnodesqlv8");
const connectionString = process.env.CONNECTION_STRING;

function executeQuery(query, params = {}) {
  return new Promise((resolve, reject) => {
    // Add DECLARE statements for parameters at the start of the query
    const declarations = Object.keys(params)
      .map(key => `DECLARE @${key} NVARCHAR(MAX)`)
      .join(';\n');
    
    // Add SET statements to assign values to parameters
    const assignments = Object.keys(params)
      .map(key => {
        const val = params[key];
        if (val === null || val === undefined) {
          return `SET @${key} = NULL`;
        }
        // Escape single quotes to avoid breaking the SQL and prefix with N for Unicode
        const escaped = String(val).replace(/'/g, "''");
        return `SET @${key} = N'${escaped}'`;
      })
      .join(';\n');
    
    // Combine declarations, assignments, and the original query
    const fullQuery = `
      ${declarations};
      ${assignments};
      ${query}
    `;

    console.log("---Executing query:\n", fullQuery);


    sql.query(connectionString, fullQuery, [], (err, result) => {
      if (err) {
        console.error("Database query error:", err);
        console.error("Full query:", fullQuery);
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

module.exports = executeQuery;