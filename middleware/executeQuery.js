const sql = require("msnodesqlv8");
const connectionString = process.env.CONNECTION_STRING;

function executeQuery(query, params = []) {
  return new Promise((resolve, reject) => {
    sql.query(connectionString, query, params, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

module.exports = executeQuery;