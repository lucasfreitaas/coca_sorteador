import oracledb from 'oracledb';

const dbConfig = {
  user: "COCA",
  password: "MANAGER",
  connectString: "192.168.1.3:1521/ORCL" 
};

async function checkData() {
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    
    console.log("Checking records for provided IDs in FINANCEIRO...");
    const result = await connection.execute(
      `SELECT COUNT(*) FROM FINANCEIRO WHERE CADASTRO_ID IN ('123451', '123452', '123453', '123454', '123455', '123457', '123458', '123459', '1234510', '1234511', '1234512', '1234513', '1234514', '1234515', '1234516', '1234517', '1234518', '1234519', '1234520', '1234521', '1234560')`
    );
    console.log("Count in FINANCEIRO:", result.rows[0][0]);

    console.log("Checking VW_COCA content...");
    const vwResult = await connection.execute(`SELECT COUNT(*) FROM VW_COCA`);
    console.log("Count in VW_COCA:", vwResult.rows[0][0]);

    if (vwResult.rows[0][0] === 0) {
        console.log("VIEW IS EMPTY! Trying to see why...");
        const finAll = await connection.execute(`SELECT COUNT(*) FROM FINANCEIRO`);
        console.log("Total rows in FINANCEIRO:", finAll.rows[0][0]);
    }

  } catch (err) {
    console.error("Error:", err);
  } finally {
    if (connection) await connection.close();
  }
}

checkData();
